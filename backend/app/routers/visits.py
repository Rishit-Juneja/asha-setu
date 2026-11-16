import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Patient, Visit, Worker, utcnow
from ..schemas import VisitConfirmIn, VisitDraftOut, VisitExtract, VisitOut
from ..security import get_current_worker
from ..services import audio as audio_service
from ..services import extraction as extractor
from ..services import gnani, readback, risk

router = APIRouter(prefix="/api/visits", tags=["visits"])

TOPIC = "ASHA home visit report from a frontline health worker"
KEYTERMS = [
    "BP",
    "ANC",
    "IFA",
    "haemoglobin",
    "hemoglobin",
    "pregnancy",
    "follow-up",
    "referral",
]


def _structured(visit: Visit) -> VisitExtract:
    return VisitExtract.model_validate(visit.structured or {})


def _draft(visit: Visit) -> VisitDraftOut:
    return VisitDraftOut(
        id=visit.id,
        transcript=visit.transcript,
        detected_language=visit.detected_language or visit.language,
        structured=_structured(visit),
        missing_fields=visit.missing_fields or [],
        risk_level=visit.risk_level,
        risk_reasons=visit.risk_reasons or [],
        follow_up_date=visit.follow_up_date,
        status=visit.status,
        created_at=visit.created_at,
    )


def _out(visit: Visit, db: Session) -> VisitOut:
    patient = db.get(Patient, visit.patient_id) if visit.patient_id else None
    worker = db.get(Worker, visit.worker_id)
    data = _draft(visit).model_dump()
    return VisitOut(
        **data,
        patient_id=visit.patient_id,
        patient_name=patient.name if patient else None,
        worker_name=worker.name if worker else None,
        visit_type=visit.visit_type,
        language=visit.language,
        confirmed_at=visit.confirmed_at,
        stt_model=visit.stt_model,
        llm_model=visit.llm_model,
        latency_ms=visit.latency_ms,
    )


def _get_visit(visit_id: str, worker: Worker, db: Session) -> Visit:
    visit = db.get(Visit, visit_id)
    if visit is None:
        raise HTTPException(404, "Visit not found")
    if worker.role not in {"supervisor", "admin"} and visit.worker_id != worker.id:
        raise HTTPException(403, "This visit belongs to another worker")
    return visit


async def transcribe_upload(
    audio: UploadFile, language: str
) -> tuple[str, str | None, str | None, str]:
    """Save an upload, transcode to 16 kHz WAV, run Gnani Prisma (chunked past 29s)."""
    raw = await audio.read()
    if not raw:
        raise HTTPException(422, "Empty audio file")
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(413, "Audio file is too large")

    audio_dir = settings.data_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(audio.filename or "visit.webm").suffix or ".webm"
    name = uuid.uuid4().hex
    source = audio_dir / f"{name}_source{suffix}"
    source.write_bytes(raw)
    wav = audio_dir / f"{name}.wav"
    try:
        audio_service.to_wav16k(source, wav)
    except Exception as exc:
        raise HTTPException(422, "Could not decode the audio file") from exc

    detected_language: str | None = None
    duration = audio_service.probe_duration(wav)
    try:
        if duration > 29:
            parts = audio_service.split_wav(wav)
            results = [
                await gnani.transcribe_file(part, language, topic=TOPIC, keyterms=KEYTERMS)
                for part in parts
            ]
            text = " ".join(
                (result.get("transcript") or "").strip()
                for result in results
                if result.get("transcript")
            ).strip()
            stt_model = results[0].get("model") if results else None
        else:
            result = await gnani.transcribe_file(
                wav, language, topic=TOPIC, keyterms=KEYTERMS
            )
            text = (result.get("transcript") or "").strip()
            detected_language = result.get("detected_language_code")
            stt_model = result.get("model")
    except Exception as exc:
        raise HTTPException(502, f"Speech recognition failed: {exc}") from exc
    return text, detected_language, stt_model, str(wav.relative_to(settings.data_dir))


@router.post("/draft", response_model=VisitDraftOut)
async def create_draft(
    audio: UploadFile | None = File(None),
    transcript: str | None = Form(None),
    patient_id: int | None = Form(None),
    visit_type: str = Form("anc"),
    language: str = Form("kn-IN"),
    client_uuid: str | None = Form(None),
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> VisitDraftOut:
    if client_uuid:
        existing = db.scalar(select(Visit).where(Visit.client_uuid == client_uuid))
        if existing is not None:
            return _draft(existing)

    started = time.monotonic()
    detected_language: str | None = None
    stt_model: str | None = None
    audio_path: str | None = None
    text = (transcript or "").strip()

    if audio is not None and not text:
        text, detected_language, stt_model, audio_path = await transcribe_upload(
            audio, language
        )
    elif audio is not None:
        raw = await audio.read()
        audio_dir = settings.data_dir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(audio.filename or "visit.webm").suffix or ".webm"
        source = audio_dir / f"{uuid.uuid4().hex}{suffix}"
        source.write_bytes(raw)
        audio_path = str(source.relative_to(settings.data_dir))

    if not text:
        raise HTTPException(422, "No speech detected. Please record again.")

    extracted, llm_model = await extractor.extract(text, language, visit_type)
    missing = extractor.compute_missing(extracted, visit_type)
    level, reasons = risk.assess(extracted)

    visit = Visit(
        worker_id=worker.id,
        patient_id=patient_id,
        visit_type=visit_type,
        language=language,
        detected_language=detected_language,
        transcript=text,
        structured=extracted.model_dump(mode="json"),
        missing_fields=missing,
        risk_level=level,
        risk_reasons=reasons,
        follow_up_date=extracted.follow_up_date,
        audio_path=audio_path,
        stt_model=stt_model,
        llm_model=llm_model,
        latency_ms=int((time.monotonic() - started) * 1000),
        status="draft",
        client_uuid=client_uuid,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return _draft(visit)


@router.post("/{visit_id}/confirm", response_model=VisitOut)
def confirm_visit(
    visit_id: str,
    body: VisitConfirmIn,
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> VisitOut:
    visit = _get_visit(visit_id, worker, db)
    extracted = body.structured
    extracted.missing_fields = []
    missing = extractor.compute_missing(extracted, body.visit_type or visit.visit_type)
    level, reasons = risk.assess(extracted)

    patient_id = body.patient_id or visit.patient_id
    patient = db.get(Patient, patient_id) if patient_id is not None else None
    if patient_id is not None and patient is None:
        raise HTTPException(404, "Patient not found")
    if patient is None and extracted.patient_name:
        patient = db.scalar(
            select(Patient).where(
                func.lower(Patient.name) == extracted.patient_name.lower()
            )
        )
    if patient is not None:
        if not patient.age and extracted.age:
            patient.age = extracted.age
        if not patient.village and extracted.village:
            patient.village = extracted.village
        extracted.patient_name = extracted.patient_name or patient.name
        extracted.age = extracted.age or patient.age
        extracted.sex = extracted.sex or patient.sex
        extracted.village = extracted.village or patient.village
        patient_id = patient.id
    elif extracted.patient_name:
        patient = Patient(
            name=extracted.patient_name,
            age=extracted.age,
            sex=extracted.sex,
            village=extracted.village,
            created_by=worker.id,
        )
        db.add(patient)
        db.flush()
        patient_id = patient.id

    visit.patient_id = patient_id
    visit.structured = extracted.model_dump(mode="json")
    visit.missing_fields = missing
    visit.risk_level = level
    visit.risk_reasons = reasons
    visit.follow_up_date = extracted.follow_up_date
    visit.visit_type = body.visit_type or visit.visit_type
    visit.language = body.language or visit.language
    visit.status = "confirmed"
    visit.confirmed_at = utcnow()
    db.commit()
    db.refresh(visit)
    return _out(visit, db)


@router.get("", response_model=list[VisitOut])
def list_visits(
    limit: int = Query(30, ge=1, le=100),
    status: str | None = Query(None),
    risk: str | None = Query(None),
    patient_id: int | None = Query(None),
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> list[VisitOut]:
    stmt = select(Visit).order_by(Visit.created_at.desc()).limit(limit)
    if worker.role not in {"supervisor", "admin"}:
        stmt = stmt.where(Visit.worker_id == worker.id)
    if status:
        stmt = stmt.where(Visit.status == status)
    if risk:
        stmt = stmt.where(Visit.risk_level == risk)
    if patient_id:
        stmt = stmt.where(Visit.patient_id == patient_id)
    return [_out(visit, db) for visit in db.scalars(stmt).all()]


@router.get("/{visit_id}", response_model=VisitOut)
def get_visit(
    visit_id: str,
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> VisitOut:
    return _out(_get_visit(visit_id, worker, db), db)


@router.get("/{visit_id}/readback-text")
def get_readback_text(
    visit_id: str,
    language: str | None = Query(None),
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> dict:
    visit = _get_visit(visit_id, worker, db)
    lang = language or visit.language
    text = readback.build_readback(
        _structured(visit), lang, visit.risk_level, visit.risk_reasons or []
    )
    steps = (
        readback.action_steps(visit.risk_reasons or [], lang)
        if visit.risk_level == "red"
        else []
    )
    return {"text": text, "language": lang, "steps": steps}


@router.post("/{visit_id}/readback")
async def readback_audio(
    visit_id: str,
    language: str | None = Query(None),
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> FileResponse:
    visit = _get_visit(visit_id, worker, db)
    lang = language or visit.language
    text = readback.build_readback(
        _structured(visit), lang, visit.risk_level, visit.risk_reasons or []
    )
    try:
        path = await gnani.synthesize_cached(text, lang)
    except Exception as exc:
        raise HTTPException(502, f"Text to speech failed: {exc}") from exc
    return FileResponse(
        path, media_type="audio/wav", headers={"Cache-Control": "public, max-age=86400"}
    )

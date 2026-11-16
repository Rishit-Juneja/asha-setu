"""Call mode: a hands-free voice conversation that fills the visit report.

Timbre asks for each missing field, Prisma hears the answer, Evon re-reads the
whole conversation, and the draft is merged so earlier answers are never lost.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Visit, Worker
from ..schemas import VisitDraftOut, VisitExtract
from ..security import get_current_worker
from ..services import extraction as extractor
from ..services import gnani, risk
from ..services.readback import _bucket
from .visits import _draft, _get_visit, transcribe_upload

router = APIRouter(prefix="/api/call", tags=["call"])

# Asked in this order; keys match compute_missing()
QUESTIONS = {
    "patient_name": {
        "hi": "मरीज़ का नाम क्या है?",
        "mixed": "Patient ka naam kya hai?",
        "kn": "ರೋಗಿಯ ಹೆಸರು ಏನು?",
        "en": "What is the patient's name?",
    },
    "pregnancy_weeks": {
        "hi": "गर्भावस्था कितने महीने की है?",
        "mixed": "Pregnancy kitne mahine ki hai?",
        "kn": "ಗರ್ಭಧಾರಣೆ ಎಷ್ಟು ತಿಂಗಳು?",
        "en": "How many months pregnant is she?",
    },
    "vitals": {
        "hi": "बीपी कितना था, या कोई तकलीफ़?",
        "mixed": "BP kitna tha, ya koi takleef?",
        "kn": "ಬಿಪಿ ಎಷ್ಟು, ಅಥವಾ ಏನಾದರೂ ತೊಂದರೆ?",
        "en": "What was the BP, or any symptoms?",
    },
    "age": {
        "hi": "{name} की उम्र कितनी है?",
        "mixed": "{name} ki umar kitni hai?",
        "kn": "{name} ಅವರ ವಯಸ್ಸು ಎಷ್ಟು?",
        "en": "How old is {name}?",
    },
    "follow_up_date": {
        "hi": "अगली भेंट कब करनी है?",
        "mixed": "Agla follow-up kab karna hai?",
        "kn": "ಮುಂದಿನ ಭೇಟಿ ಯಾವಾಗ?",
        "en": "When is the next follow-up?",
    },
}
GREETING = {
    "hi": "नमस्ते {worker} जी। विज़िट के बारे में बताइए।",
    "mixed": "Namaste {worker} ji. Visit ke baare mein bataiye.",
    "kn": "ನಮಸ್ಕಾರ {worker} ಅವರೇ. ಭೇಟಿಯ ಬಗ್ಗೆ ಹೇಳಿ.",
    "en": "Namaste {worker}. Tell me about the visit.",
}
DONE = {
    "hi": "धन्यवाद। रिपोर्ट तैयार है, एक बार देख लीजिए।",
    "mixed": "Dhanyavaad. Report taiyaar hai, ek baar dekh lijiye.",
    "kn": "ಧನ್ಯವಾದ. ವರದಿ ಸಿದ್ಧವಾಗಿದೆ, ಒಮ್ಮೆ ನೋಡಿ.",
    "en": "Thank you. The report is ready, please check it once.",
}


def question_text(field: str, bucket: str, name: str | None) -> str:
    text = QUESTIONS[field][bucket]
    if "{name}" not in text:
        return text
    if name:
        return text.format(name=f"{name} जी" if bucket == "hi" else name)
    fallback = {"hi": "उनकी उम्र कितनी है?", "mixed": "Unki umar kitni hai?",
                "kn": "ಅವರ ವಯಸ್ಸು ಎಷ್ಟು?", "en": "How old is she?"}
    return fallback[bucket]


def next_question(visit: Visit, language: str, asked: set[str]) -> tuple[str | None, str]:
    bucket = _bucket(language)
    missing = set(visit.missing_fields or [])
    for field in QUESTIONS:
        if field in missing and field not in asked:
            name = (visit.structured or {}).get("patient_name")
            return field, question_text(field, bucket, name)
    return None, DONE[bucket]


def merge(old: dict, new: dict) -> dict:
    """Fill gaps only: what was already heard is locked, so re-reading the whole
    conversation can't drift a correct BP. Corrections happen on the Review screen."""
    out = dict(old)
    for key, value in new.items():
        current = old.get(key)
        if isinstance(value, dict) and isinstance(current, dict):
            out[key] = merge(current, value)
        elif isinstance(value, list) and isinstance(current, list):
            out[key] = current + [v for v in value if v not in current]
        elif current in (None, [], "") and value not in (None, [], ""):
            out[key] = value
    return out


@router.get("/greeting")
def greeting(
    language: str = Query("hi-IN"), worker: Worker = Depends(get_current_worker)
) -> dict:
    return {"text": GREETING[_bucket(language)].format(worker=worker.name)}


@router.get("/{visit_id}/question")
def question(
    visit_id: str,
    language: str | None = Query(None),
    asked: str = Query(""),
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> dict:
    visit = _get_visit(visit_id, worker, db)
    field, text = next_question(
        visit, language or visit.language, {a for a in asked.split(",") if a}
    )
    return {"field": field, "text": text}


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    language: str = "hi-IN"


@router.post("/speak")
async def speak(body: SpeakIn, worker: Worker = Depends(get_current_worker)) -> FileResponse:
    try:
        path = await gnani.synthesize_cached(body.text, body.language)
    except Exception as exc:
        raise HTTPException(502, f"Text to speech failed: {exc}") from exc
    return FileResponse(path, media_type="audio/wav")


@router.post("/{visit_id}/answer")
async def answer(
    visit_id: str,
    audio: UploadFile = File(...),
    field: str = Form(...),
    question_asked: str = Form(""),
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> dict:
    visit = _get_visit(visit_id, worker, db)
    if visit.status != "draft":
        raise HTTPException(409, "Visit is already confirmed")
    heard, *_ = await transcribe_upload(audio, visit.language)
    if heard:
        # Give the model the question too: "umar kitni? — pachchees saal"
        visit.transcript = f"{visit.transcript}\n{question_asked} — {heard}".strip()
        extracted, llm_model = await extractor.extract(
            visit.transcript, visit.language, visit.visit_type
        )
        structured = VisitExtract.model_validate(
            merge(visit.structured or {}, extracted.model_dump(mode="json"))
        )
        structured.missing_fields = []
        level, reasons = risk.assess(structured)
        visit.structured = structured.model_dump(mode="json")
        visit.missing_fields = extractor.compute_missing(structured, visit.visit_type)
        visit.risk_level, visit.risk_reasons = level, reasons
        visit.follow_up_date = structured.follow_up_date
        visit.llm_model = llm_model
        db.commit()
        db.refresh(visit)
    return {"heard": heard, "field": field, "visit": _draft(visit).model_dump(mode="json")}

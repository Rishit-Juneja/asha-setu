import csv
import io
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, Visit, Worker, utcnow
from ..security import get_current_worker
from ..services import gnani

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _require_supervisor(worker: Worker) -> None:
    if worker.role not in {"supervisor", "admin"}:
        raise HTTPException(403, "Supervisor access only")


@router.get("/summary")
def summary(
    worker: Worker = Depends(get_current_worker), db: Session = Depends(get_db)
) -> dict:
    _require_supervisor(worker)
    today = date.today()
    start = datetime.combine(today, time.min)
    week_ago = utcnow() - timedelta(days=7)

    def count(*where) -> int:
        return (
            db.scalar(select(func.count()).select_from(Visit).where(*where)) or 0
        )

    total = count(Visit.status == "confirmed")
    today_count = count(Visit.status == "confirmed", Visit.created_at >= start)
    red = count(
        Visit.status == "confirmed",
        Visit.risk_level == "red",
        Visit.created_at >= week_ago,
    )
    amber = count(
        Visit.status == "confirmed",
        Visit.risk_level == "amber",
        Visit.created_at >= week_ago,
    )
    patients = db.scalar(select(func.count()).select_from(Patient)) or 0
    workers = (
        db.scalar(
            select(func.count()).select_from(Worker).where(Worker.role != "supervisor")
        )
        or 0
    )
    overdue = count(
        Visit.status == "confirmed", Visit.follow_up_date < today
    )

    followups = db.scalars(
        select(Visit)
        .where(
            Visit.status == "confirmed",
            Visit.follow_up_date >= today,
            Visit.follow_up_date <= today + timedelta(days=3),
        )
        .order_by(Visit.follow_up_date)
        .limit(10)
    ).all()

    recent = db.scalars(
        select(Visit)
        .where(Visit.status == "confirmed")
        .order_by(Visit.created_at.desc())
        .limit(8)
    ).all()

    def brief(visit: Visit) -> dict:
        patient = db.get(Patient, visit.patient_id) if visit.patient_id else None
        structured = visit.structured or {}
        return {
            "id": visit.id,
            "patient_name": patient.name if patient else structured.get("patient_name"),
            "village": patient.village if patient else structured.get("village"),
            "visit_type": visit.visit_type,
            "risk_level": visit.risk_level,
            "risk_reasons": visit.risk_reasons or [],
            "follow_up_date": (
                visit.follow_up_date.isoformat() if visit.follow_up_date else None
            ),
            "created_at": visit.created_at.isoformat(),
            "status": visit.status,
            "language": visit.language,
        }

    return {
        "totals": {
            "visits": total,
            "visits_today": today_count,
            "patients": patients,
            "workers": workers,
            "red_last_7d": red,
            "amber_last_7d": amber,
            "overdue_followups": overdue,
        },
        "followups": [brief(visit) for visit in followups],
        "recent": [brief(visit) for visit in recent],
    }


@router.get("/export.csv")
def export_csv(
    worker: Worker = Depends(get_current_worker), db: Session = Depends(get_db)
) -> StreamingResponse:
    _require_supervisor(worker)
    visits = db.scalars(
        select(Visit).where(Visit.status == "confirmed").order_by(Visit.created_at.desc())
    ).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "visit_id",
            "created_at",
            "visit_type",
            "language",
            "patient_name",
            "age",
            "sex",
            "village",
            "bp_systolic",
            "bp_diastolic",
            "hemoglobin",
            "temperature_c",
            "pregnancy_months",
            "pregnancy_weeks",
            "danger_signs",
            "symptoms",
            "actions",
            "referrals",
            "follow_up_date",
            "risk_level",
            "risk_reasons",
            "missing_fields",
        ]
    )
    for visit in visits:
        structured = visit.structured or {}
        patient = db.get(Patient, visit.patient_id) if visit.patient_id else None
        vitals = structured.get("vitals") or {}
        pregnancy = structured.get("pregnancy") or {}
        writer.writerow(
            [
                visit.id,
                visit.created_at.isoformat(),
                visit.visit_type,
                visit.language,
                patient.name if patient else structured.get("patient_name"),
                patient.age if patient else structured.get("age"),
                patient.sex if patient else structured.get("sex"),
                patient.village if patient else structured.get("village"),
                vitals.get("bp_systolic"),
                vitals.get("bp_diastolic"),
                vitals.get("hemoglobin"),
                vitals.get("temperature_c"),
                pregnancy.get("months"),
                pregnancy.get("weeks"),
                "; ".join(pregnancy.get("danger_signs") or []),
                "; ".join(structured.get("symptoms") or []),
                "; ".join(structured.get("actions_taken") or []),
                "; ".join(structured.get("referrals") or []),
                visit.follow_up_date.isoformat() if visit.follow_up_date else "",
                visit.risk_level,
                "; ".join(visit.risk_reasons or []),
                "; ".join(visit.missing_fields or []),
            ]
        )

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=asha-setu-visits.csv"},
    )


def alert_text(visit: Visit) -> str:
    name = (visit.structured or {}).get("patient_name") or "Unnamed patient"
    village = visit.patient.village if visit.patient else None
    where = f" in {village}" if village else ""
    reasons = "; ".join((visit.risk_reasons or [])[:2])
    return f"Red alert. {name}{where}. {reasons}. Reported by {visit.worker.name}."


@router.post("/alert/{visit_id}")
async def alert_audio(
    visit_id: str,
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> FileResponse:
    _require_supervisor(worker)
    visit = db.get(Visit, visit_id)
    if not visit or visit.risk_level != "red":
        raise HTTPException(404, "No red visit with that id")
    try:
        path = await gnani.synthesize_cached(alert_text(visit), "en-IN")
    except Exception as exc:
        raise HTTPException(502, f"Text to speech failed: {exc}") from exc
    return FileResponse(path, media_type="audio/wav")

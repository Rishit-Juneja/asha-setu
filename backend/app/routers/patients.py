from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, Worker
from ..schemas import PatientIn, PatientOut
from ..security import get_current_worker

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=list[PatientOut])
def list_patients(
    q: str | None = Query(None),
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> list[Patient]:
    stmt = select(Patient).order_by(Patient.created_at.desc()).limit(50)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(Patient.name.ilike(like), Patient.village.ilike(like))
        )
    return list(db.scalars(stmt).all())


@router.post("", response_model=PatientOut)
def create_patient(
    body: PatientIn,
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
) -> Patient:
    patient = Patient(**body.model_dump(), created_by=worker.id)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient

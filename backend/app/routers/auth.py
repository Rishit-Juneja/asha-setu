from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Worker
from ..schemas import LoginIn, TokenOut, WorkerOut
from ..security import create_token, get_current_worker, verify_pin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    worker = db.scalar(select(Worker).where(Worker.phone == body.phone))
    if worker is None or not verify_pin(body.pin, worker.pin_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid phone number or PIN"
        )
    return TokenOut(access_token=create_token(worker), worker=worker)


@router.get("/me", response_model=WorkerOut)
def me(worker: Worker = Depends(get_current_worker)) -> Worker:
    return worker

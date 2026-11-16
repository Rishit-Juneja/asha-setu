import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(20), default="asha")
    language: Mapped[str] = mapped_column(String(32), default="kn-IN")
    pin_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    visits: Mapped[list["Visit"]] = relationship(back_populates="worker")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(12), nullable=True)
    village: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    conditions: Mapped[list] = mapped_column(JSON, default=list)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    client_uuid: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True, nullable=True
    )
    worker_id: Mapped[int] = mapped_column(ForeignKey("workers.id"), index=True)
    patient_id: Mapped[int | None] = mapped_column(
        ForeignKey("patients.id"), index=True, nullable=True
    )
    visit_type: Mapped[str] = mapped_column(String(40), default="anc")
    language: Mapped[str] = mapped_column(String(32), default="kn-IN")
    detected_language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    transcript: Mapped[str] = mapped_column(Text, default="")
    structured: Mapped[dict] = mapped_column(JSON, default=dict)
    missing_fields: Mapped[list] = mapped_column(JSON, default=list)
    risk_level: Mapped[str] = mapped_column(String(10), default="green", index=True)
    risk_reasons: Mapped[list] = mapped_column(JSON, default=list)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    audio_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stt_model: Mapped[str | None] = mapped_column(String(40), nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(60), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    worker: Mapped["Worker"] = relationship(back_populates="visits")
    patient: Mapped["Patient | None"] = relationship()

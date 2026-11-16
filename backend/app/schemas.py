from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginIn(BaseModel):
    phone: str
    pin: str


class WorkerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str
    language: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    worker: WorkerOut


class PatientIn(BaseModel):
    name: str
    age: int | None = None
    sex: str | None = None
    village: str | None = None
    phone: str | None = None
    conditions: list[str] = Field(default_factory=list)


class PatientOut(PatientIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class Vitals(BaseModel):
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    weight_kg: float | None = None
    hemoglobin: float | None = None
    temperature_c: float | None = None


class Pregnancy(BaseModel):
    months: int | None = None
    weeks: int | None = None
    danger_signs: list[str] = Field(default_factory=list)


class VisitExtract(BaseModel):
    patient_name: str | None = None
    age: int | None = None
    sex: str | None = None
    village: str | None = None
    vitals: Vitals = Field(default_factory=Vitals)
    pregnancy: Pregnancy = Field(default_factory=Pregnancy)
    symptoms: list[str] = Field(default_factory=list)
    actions_taken: list[str] = Field(default_factory=list)
    referrals: list[str] = Field(default_factory=list)
    follow_up_date: date | None = None
    notes: str | None = None
    readback_text: str | None = None
    missing_fields: list[str] = Field(default_factory=list)


class VisitDraftOut(BaseModel):
    id: str
    transcript: str
    detected_language: str | None = None
    structured: VisitExtract
    missing_fields: list[str]
    risk_level: str
    risk_reasons: list[str]
    follow_up_date: date | None = None
    status: str
    created_at: datetime


class VisitConfirmIn(BaseModel):
    structured: VisitExtract
    patient_id: int | None = None
    visit_type: str | None = None
    language: str | None = None


class VisitOut(VisitDraftOut):
    patient_id: int | None = None
    patient_name: str | None = None
    worker_name: str | None = None
    visit_type: str
    language: str
    confirmed_at: datetime | None = None
    stt_model: str | None = None
    llm_model: str | None = None
    latency_ms: int | None = None

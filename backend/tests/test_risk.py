from app.schemas import Pregnancy, VisitExtract, Vitals
from app.services.risk import assess


def test_severe_bp_is_red():
    extract = VisitExtract(vitals=Vitals(bp_systolic=170, bp_diastolic=115))
    level, reasons = assess(extract)
    assert level == "red"
    assert any("severely high" in reason for reason in reasons)


def test_high_bp_is_amber():
    extract = VisitExtract(vitals=Vitals(bp_systolic=142, bp_diastolic=92))
    level, reasons = assess(extract)
    assert level == "amber"
    assert any("is high" in reason for reason in reasons)


def test_low_hemoglobin_is_red():
    extract = VisitExtract(vitals=Vitals(hemoglobin=6.2))
    level, reasons = assess(extract)
    assert level == "red"
    assert any("severely low" in reason for reason in reasons)


def test_danger_sign_is_red():
    extract = VisitExtract(
        pregnancy=Pregnancy(weeks=30, danger_signs=["bleeding"]),
        vitals=Vitals(bp_systolic=118, bp_diastolic=76),
    )
    level, reasons = assess(extract)
    assert level == "red"
    assert any("bleeding" in reason for reason in reasons)


def test_normal_visit_is_green():
    extract = VisitExtract(
        vitals=Vitals(bp_systolic=118, bp_diastolic=76), symptoms=["mild cold"]
    )
    level, reasons = assess(extract)
    assert level == "green"
    assert reasons == []


def test_empty_visit_is_amber():
    level, reasons = assess(VisitExtract())
    assert level == "amber"
    assert reasons

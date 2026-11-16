from app.schemas import Pregnancy, VisitExtract, Vitals
from app.services.readback import build_readback
from app.services.risk import assess
from app.services.protocols import steps


def test_convulsion_steps_lead_with_ambulance():
    out = steps(["Danger sign reported: convulsion"], "en")
    assert out[0].startswith("Call the 108")
    assert "Give nothing by mouth." in out


def test_steps_dedupe_and_cap():
    reasons = ["BP 170/115 is severely high", "Danger sign reported: bleeding"]
    out = steps(reasons, "mixed")
    assert len(out) == 3 and len(set(out)) == 3


def test_amber_reason_has_no_steps():
    assert steps(["BP 142/92 is high", "Temperature 38.2C is high"], "en") == []


def test_red_readback_speaks_protocol():
    extract = VisitExtract(
        patient_name="Sunita",
        pregnancy=Pregnancy(months=8, danger_signs=["severe headache"]),
        vitals=Vitals(bp_systolic=168, bp_diastolic=112),
    )
    level, reasons = assess(extract)
    text = build_readback(extract, "kn-IN", level, reasons)
    assert level == "red"
    assert "108" in text and "ಎಡಬದಿಗೆ" in text


def test_readback_ignores_llm_free_text():
    extract = VisitExtract(
        patient_name="Seema",
        readback_text="Seema, 21-year-old female",
        vitals=Vitals(bp_systolic=170, bp_diastolic=110),
    )
    level, reasons = assess(extract)
    text = build_readback(extract, "hi-IN", level, reasons)
    assert "21" not in text and "रिपोर्ट" in text and "108" in text

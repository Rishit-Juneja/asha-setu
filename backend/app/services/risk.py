from ..schemas import VisitExtract

DANGER_SIGNS = [
    "bleeding",
    "convulsion",
    "unconscious",
    "severe headache",
    "blurred vision",
    "no fetal movement",
    "breathlessness",
    "severe abdominal pain",
]

RANK = {"green": 0, "amber": 1, "red": 2}


def assess(extract: VisitExtract) -> tuple[str, list[str]]:
    level = "green"
    reasons: list[str] = []

    def bump(candidate: str) -> None:
        nonlocal level
        if RANK[candidate] > RANK[level]:
            level = candidate

    vitals = extract.vitals
    if vitals.bp_systolic and vitals.bp_diastolic:
        systolic, diastolic = vitals.bp_systolic, vitals.bp_diastolic
        if systolic >= 160 or diastolic >= 110:
            bump("red")
            reasons.append(f"BP {systolic}/{diastolic} is severely high")
        elif systolic >= 140 or diastolic >= 90:
            bump("amber")
            reasons.append(f"BP {systolic}/{diastolic} is high")

    if vitals.hemoglobin is not None:
        if vitals.hemoglobin < 7:
            bump("red")
            reasons.append(f"Hb {vitals.hemoglobin} is severely low")
        elif vitals.hemoglobin < 9:
            bump("amber")
            reasons.append(f"Hb {vitals.hemoglobin} is low")

    if vitals.temperature_c is not None:
        if vitals.temperature_c >= 39:
            bump("red")
            reasons.append(f"Temperature {vitals.temperature_c}C is very high")
        elif vitals.temperature_c >= 38:
            bump("amber")
            reasons.append(f"Temperature {vitals.temperature_c}C is high")

    signs = [s.lower() for s in extract.pregnancy.danger_signs + extract.symptoms]
    for danger in DANGER_SIGNS:
        if any(danger in sign for sign in signs):
            bump("red")
            reasons.append(f"Danger sign reported: {danger}")

    has_vitals = any(
        [
            vitals.bp_systolic,
            vitals.bp_diastolic,
            vitals.weight_kg,
            vitals.hemoglobin,
            vitals.temperature_c,
        ]
    )
    if not has_vitals and not extract.symptoms and level == "green":
        bump("amber")
        reasons.append("No vitals or symptoms recorded")

    return level, reasons

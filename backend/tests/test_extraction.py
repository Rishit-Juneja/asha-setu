from app.services.extraction import fallback_extract


def test_hinglish_fallback_extracts_clinical_fields():
    transcript = (
        "Sunita ji ka BP 140 by 90 hai, saat mahine ki pregnancy hai, "
        "IFA tablets diye, Monday follow up karna hai."
    )
    extract = fallback_extract(transcript, "hi-IN,en-IN", "anc")
    assert extract.patient_name == "Sunita"
    assert extract.vitals.bp_systolic == 140
    assert extract.vitals.bp_diastolic == 90
    assert extract.pregnancy.months == 7
    assert extract.pregnancy.weeks is None
    assert extract.follow_up_date is not None
    assert "age" in extract.missing_fields


def test_kannada_fallback_extracts_bp_with_kannada_separator():
    transcript = "ಸುನೀತಾ ಅವರಿಗೆ ರಕ್ತದೊತ್ತಡ 150 ಬೈ 95 ಇತ್ತು. ಏಳು ತಿಂಗಳ ಗರ್ಭ."
    extract = fallback_extract(transcript, "kn-IN", "anc")
    assert extract.vitals.bp_systolic == 150
    assert extract.vitals.bp_diastolic == 95
    assert extract.pregnancy.months == 7


def test_fallback_flags_danger_symptom():
    transcript = "Fatima ji ko bleeding ho rahi hai, BP 110 by 70."
    extract = fallback_extract(transcript, "hi-IN", "anc")
    assert "bleeding" in extract.symptoms


def test_fallback_parses_spoken_number_words():
    transcript = (
        "Sunita ji ka BP one hundred forty by ninety hai, saat mahine ki pregnancy hai."
    )
    extract = fallback_extract(transcript, "hi-IN,en-IN", "anc")
    assert extract.vitals.bp_systolic == 140
    assert extract.vitals.bp_diastolic == 90
    assert extract.pregnancy.months == 7


def test_fallback_keeps_explicit_weeks_as_weeks():
    transcript = "Meena ji ka BP 118 by 76 hai, 28 hafte ki pregnancy hai."
    extract = fallback_extract(transcript, "hi-IN,en-IN", "anc")
    assert extract.pregnancy.weeks == 28
    assert extract.pregnancy.months is None


def test_fallback_extracts_ifa_action():
    extract = fallback_extract("IFA tablets diye aur Monday follow up.", "hi-IN", "anc")
    assert "IFA tablets given" in extract.actions_taken


def test_hinglish_danger_phrases_and_ka_name():
    from app.services.extraction import fallback_extract
    from app.services.risk import assess

    extract = fallback_extract(
        "Meena ka BP 130 by 80 hai, tez sar dard aur dhundla dikh raha hai.",
        "hi-IN,en-IN",
        "anc",
    )
    assert extract.patient_name == "Meena"
    assert {"severe headache", "blurred vision"} <= set(extract.symptoms)
    assert assess(extract)[0] == "red"


def test_spoken_bp_and_hindi_age_words():
    from app.services.extraction import fallback_extract

    extract = fallback_extract(
        "Rukhsana ki umar chabbis saal, BP one twenty by eighty hai.", "hi-IN,en-IN", "anc"
    )
    assert (extract.vitals.bp_systolic, extract.vitals.bp_diastolic) == (120, 80)
    assert extract.age == 26


def test_grounding_prefers_literal_digits_and_rule_dates():
    from datetime import date

    from app.schemas import Pregnancy, VisitExtract, Vitals
    from app.services.extraction import _ground

    llm = VisitExtract(
        patient_name="Meena ji",
        missing_fields=["notes", "weight_kg"],
        age=24,
        vitals=Vitals(bp_systolic=186, bp_diastolic=112),
        pregnancy=Pregnancy(months=9),
        follow_up_date=date(2030, 1, 1),
    )
    out = _ground(
        llm,
        "Meena chabbis saal, BP 168 by 112, saat mahine, follow-up Monday.",
        "hi-IN,en-IN",
        "anc",
    )
    assert out.vitals.bp_systolic == 168
    assert out.age == 26
    assert out.follow_up_date != date(2030, 1, 1)
    assert out.pregnancy.months == 7
    assert out.patient_name == "Meena" and out.missing_fields == []


def test_grounding_drops_numbers_nobody_said():
    from app.schemas import Pregnancy, VisitExtract, Vitals
    from app.services.extraction import _ground

    llm = VisitExtract(
        patient_name="Seema",
        age=21,
        vitals=Vitals(bp_systolic=170, bp_diastolic=110, hemoglobin=9.5),
        pregnancy=Pregnancy(months=8),
    )
    out = _ground(
        llm,
        "आज मैंने सीमा के घर विज़िट किया। बीपी एक सौ सत्तर बटा एक सौ दस है, आठ महीने की गर्भावस्था है।",
        "hi-IN",
        "anc",
    )
    assert out.age is None and out.vitals.hemoglobin is None
    assert (out.vitals.bp_systolic, out.vitals.bp_diastolic) == (170, 110)
    assert out.pregnancy.months == 8


def test_hindi_bp_and_age_words_romanized_and_devanagari():
    from app.services.extraction import fallback_extract

    roman = fallback_extract(
        "BP ek sau sattar bata ek sau das hai, umar pachchis saal.", "hi-IN,en-IN", "anc"
    )
    assert (roman.vitals.bp_systolic, roman.vitals.bp_diastolic) == (170, 110)
    assert roman.age == 25
    deva = fallback_extract("बीपी एक सौ चालीस बटा नब्बे है। उम्र पच्चीस साल।", "hi-IN", "anc")
    assert (deva.vitals.bp_systolic, deva.vitals.bp_diastolic) == (140, 90)
    assert deva.age == 25

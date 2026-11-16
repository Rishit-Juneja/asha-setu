import json
import logging
import re
from datetime import date, timedelta

import httpx
from pydantic import ValidationError

from ..config import settings
from . import hindi_numbers
from ..schemas import Pregnancy, VisitExtract, Vitals

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You convert a frontline health worker's home-visit voice note into a structured record.

Rules:
- Extract only what the worker said. Never invent names, numbers, symptoms, or dates.
- Normalize spoken numbers to digits (BP as systolic/diastolic). Only fill a number the worker actually said; otherwise null.
- Pregnancy: use pregnancy.months when the worker says months (mahine, tingalu) and pregnancy.weeks when they say weeks (hafte, vaara). Never convert between them.
- The transcript may be code-mixed (Hinglish) or in an Indian language. Understand it. Keep the patient name as spoken.
- If a field is not mentioned, use null (or [] for lists) and add its field name to missing_fields.
- symptoms and pregnancy.danger_signs must be short plain-English terms. Use these exact words for danger signs: bleeding, convulsion, unconscious, severe headache, blurred vision, no fetal movement, breathlessness, severe abdominal pain. Example: "tez sar dard" -> "severe headache", "dhundla dikhna" -> "blurred vision".
- actions_taken and referrals: short English, e.g. "IFA tablets given", "referred to PHC".
- Hindi number words are exact: bees=20, ikkees=21, baais=22, teis=23, chaubees=24, pachchees=25, chhabbees/chabbis=26, sattaais=27, atthaais=28, untees=29, tees=30. "saadhe aath" = 8.5.
- Do not diagnose and do not give medical advice.
- follow_up_date must be ISO YYYY-MM-DD. Resolve relative dates (tomorrow, kal, Monday, next week) from today's date.
- readback_text: always null.
Return ONLY JSON matching this schema:
{schema}
"""

WORD_NUMBERS = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5, "panch": 5,
    "chhe": 6, "che": 6, "saat": 7, "sat": 7, "aath": 8, "ath": 8, "nau": 9,
    "das": 10, "ondu": 1, "eradu": 2, "mooru": 3, "muru": 3, "naalku": 4,
    "nalku": 4, "aidu": 5, "aaru": 6, "elu": 7, "entu": 8, "ombattu": 9,
    "hattu": 10, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5,
    "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5,
    "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8, "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10,
}

AGE_WORD_RE = re.compile(
    rf"(?<![\w\u0900-\u097f])({hindi_numbers._WORD})\s*(?:saal|sal|varsh|साल|वर्ष)",
    re.IGNORECASE,
)

EN_UNITS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
EN_TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
EN_WORDS = "|".join(
    sorted(list(EN_UNITS) + list(EN_TENS) + ["hundred", "and"], key=len, reverse=True)
)
BP_WORDS_RE = re.compile(
    rf"\b((?:{EN_WORDS})(?:[\s-]+(?:{EN_WORDS}))*)\s+(?:by|/)\s+"
    rf"((?:{EN_WORDS})(?:[\s-]+(?:{EN_WORDS}))*)\b",
    re.IGNORECASE,
)

BP_RE = re.compile(r"(\d{2,3})\s*(?:/|by|\u0cac\u0cc8)\s*(\d{2,3})", re.IGNORECASE)
MONTH_RE = re.compile(
    r"(\d{1,2})\s*(?:months?|mahine|maheene|mahina|\u0ca4\u0cbf\u0c82\u0c97\u0cb3\u0cc1?)",
    re.IGNORECASE,
)
WORD_MONTH_RE = re.compile(
    r"\b(" + "|".join(WORD_NUMBERS) + r")\s*(?:months?|mahine|maheene|mahina|\u0ca4\u0cbf\u0c82\u0c97\u0cb3\u0cc1?)",
    re.IGNORECASE,
)
WEEK_RE = re.compile(
    r"(\d{1,2})\s*(?:weeks?|hafte|haftey|vaara|\u0cb5\u0cbe\u0cb0)",
    re.IGNORECASE,
)
WORD_WEEK_RE = re.compile(
    r"\b(" + "|".join(WORD_NUMBERS) + r")\s*(?:weeks?|hafte|haftey|vaara|\u0cb5\u0cbe\u0cb0)",
    re.IGNORECASE,
)
AGE_RE = re.compile(
    r"\b(\d{1,2})\s*(?:years?|yrs?|saal|\u0cb5\u0cb0\u0ccd\u0cb7)", re.IGNORECASE
)
NAME_RE = re.compile(r"\b([A-Z][a-z]{2,})\s+(?:ji|avara|avaru|ka|ki|ke)\b")
HEMOGLOBIN_RE = re.compile(r"(?:hb|hemoglobin|haemoglobin)\D{0,12}(\d{1,2}(?:\.\d)?)", re.IGNORECASE)

WEEKDAYS = {
    "monday": 0, "somvar": 0, "somwar": 0, "सोमवार": 0, "ಸೋಮವಾರ": 0,
    "tuesday": 1, "mangalvar": 1, "मंगलवार": 1, "ಮಂಗಳವಾರ": 1,
    "wednesday": 2, "budhvar": 2, "बुधवार": 2, "ಬುಧವಾರ": 2,
    "thursday": 3, "guruvar": 3, "गुरुवार": 3, "ಗುರುವಾರ": 3,
    "friday": 4, "shukravar": 4, "शुक्रवार": 4, "ಶುಕ್ರವಾರ": 4,
    "saturday": 5, "shanivar": 5, "शनिवार": 5, "ಶನಿವಾರ": 5,
    "sunday": 6, "ravivar": 6, "रविवार": 6, "ಭಾನುವಾರ": 6,
}

SYMPTOM_WORDS = {
    # Hinglish danger-sign phrases first, so the risk rules see the severe form
    "tez sir dard": "severe headache", "tez sar dard": "severe headache", "bahut sir dard": "severe headache",
    "dhundla": "blurred vision", "blurred": "blurred vision", "धुंधला": "blurred vision", "ಮಂಜು": "blurred vision",
    "halchal nahi": "no fetal movement", "hil nahi raha": "no fetal movement",
    "behosh": "unconscious", "बेहोश": "unconscious",
    "tez pet dard": "severe abdominal pain",
    "sar dard": "headache",
    "bleeding": "bleeding", "khoon": "bleeding", "रक्तस्राव": "bleeding", "ರಕ್ತಸ್ರಾವ": "bleeding",
    "fever": "fever", "bukhar": "fever", "ज्वर": "fever", "ಜ್ವರ": "fever",
    "swelling": "swelling", "sujan": "swelling", "सूजन": "swelling", "ಊತ": "swelling",
    "headache": "headache", "sir dard": "headache", "सिरदर्द": "headache", "ತಲೆನೋವು": "headache",
    "dizzy": "dizziness", "chakkar": "dizziness", "चक्कर": "dizziness", "ತಲೆಸುತ್ತು": "dizziness",
    "convulsion": "convulsion", "fits": "convulsion", "मिरगी": "convulsion", "ಸೆಳೆತ": "convulsion",
    "breathless": "breathlessness", "saans": "breathlessness", "सांस": "breathlessness", "ಉಸಿರಾಟ": "breathlessness",
}


def _schema_text() -> str:
    return json.dumps(VisitExtract.model_json_schema(), ensure_ascii=False)


LIST_KEYS = {"danger_signs", "symptoms", "actions_taken", "referrals", "missing_fields"}


def _drop_null_lists(value):
    # small models return null for empty lists; the schema wants []
    if isinstance(value, dict):
        return {
            k: [] if k in LIST_KEYS and v is None else _drop_null_lists(v)
            for k, v in value.items()
        }
    return value


def _parse_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model output")
    return _drop_null_lists(json.loads(text[start : end + 1]))


async def _call_gemini(prompt: str) -> str:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.llm_model}:generateContent"
    )
    payload = {
        "systemInstruction": {
            "parts": [{"text": SYSTEM_PROMPT.format(schema=_schema_text())}]
        },
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            url, params={"key": settings.llm_api_key}, json=payload
        )
    response.raise_for_status()
    body = response.json()
    return body["candidates"][0]["content"]["parts"][0]["text"]


async def _call_ollama(prompt: str) -> str:
    # Native API: /v1 can't turn Evon's thinking off (50s+ of hidden reasoning)
    base = (settings.llm_base_url or "http://localhost:11434").removesuffix("/v1")
    payload = {
        "model": settings.llm_model,
        "stream": False,
        "think": False,
        "format": "json",
        "keep_alive": "60m",
        "options": {"temperature": 0.1},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT.format(schema=_schema_text())},
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(f"{base.rstrip('/')}/api/chat", json=payload)
    response.raise_for_status()
    return response.json()["message"]["content"]


async def _call_openai_compatible(prompt: str) -> str:
    base = settings.llm_base_url or (
        "http://localhost:11434/v1"
        if settings.llm_provider == "ollama"
        else "https://api.openai.com/v1"
    )
    headers = {"Content-Type": "application/json"}
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"
    payload = {
        "model": settings.llm_model,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT.format(schema=_schema_text()),
            },
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            f"{base.rstrip('/')}/chat/completions", headers=headers, json=payload
        )
    response.raise_for_status()
    body = response.json()
    return body["choices"][0]["message"]["content"]


def _english_number(text: str) -> int | None:
    total = 0
    current = 0
    found = False
    for token in text.lower().replace("-", " ").split():
        if token in EN_UNITS:
            current += EN_UNITS[token]
            found = True
        elif token in EN_TENS:
            # spoken BP style: "one twenty" = 120, "one forty" = 140
            current = current * 100 + EN_TENS[token] if 0 < current < 10 else current + EN_TENS[token]
            found = True
        elif token == "hundred":
            current = (current or 1) * 100
            found = True
        elif token == "and":
            continue
        else:
            return None
    return total + current if found else None


def _normalize_bp_words(text: str) -> str:
    def replace(match: re.Match) -> str:
        systolic = _english_number(match.group(1))
        diastolic = _english_number(match.group(2))
        if systolic and diastolic:
            return f"{systolic}/{diastolic}"
        return match.group(0)

    return BP_WORDS_RE.sub(replace, text)


def _next_weekday(name: str, today: date) -> date:
    target = WEEKDAYS[name.lower()]
    delta = (target - today.weekday()) % 7
    if delta == 0:
        delta = 7
    return today + timedelta(days=delta)


def _follow_up(transcript: str, today: date) -> date | None:
    lowered = transcript.lower()
    if "tomorrow" in lowered or "kal " in lowered or lowered.endswith(" kal"):
        return today + timedelta(days=1)
    if "next week" in lowered or "agle hafte" in lowered:
        return today + timedelta(days=7)
    for name in WEEKDAYS:
        if name in lowered:
            return _next_weekday(name, today)
    return None


def fallback_extract(transcript: str, language: str, visit_type: str) -> VisitExtract:
    today = date.today()
    normalized = _normalize_bp_words(hindi_numbers.normalize_bp(transcript))
    vitals = Vitals()
    pregnancy = Pregnancy()
    symptoms: list[str] = []

    bp = BP_RE.search(normalized)
    if bp:
        vitals.bp_systolic = int(bp.group(1))
        vitals.bp_diastolic = int(bp.group(2))

    months = MONTH_RE.search(transcript)
    if months:
        pregnancy.months = int(months.group(1))
    else:
        word_months = WORD_MONTH_RE.search(transcript)
        if word_months:
            pregnancy.months = WORD_NUMBERS[word_months.group(1).lower()]

    weeks = WEEK_RE.search(transcript)
    if weeks:
        pregnancy.weeks = int(weeks.group(1))
    else:
        word_weeks = WORD_WEEK_RE.search(transcript)
        if word_weeks:
            pregnancy.weeks = WORD_NUMBERS[word_weeks.group(1).lower()]

    hb = HEMOGLOBIN_RE.search(transcript)
    if hb:
        vitals.hemoglobin = float(hb.group(1))

    age = AGE_RE.search(transcript)
    age_word = AGE_WORD_RE.search(transcript)
    name = NAME_RE.search(transcript)

    lowered = transcript.lower()
    for word, canonical in SYMPTOM_WORDS.items():
        if word in lowered and canonical not in symptoms:
            symptoms.append(canonical)

    actions: list[str] = []
    if any(word in lowered for word in ["ifa", "iron tablet", "ಐರನ್"]):
        actions.append("IFA tablets given")
    if "paracetamol" in lowered:
        actions.append("paracetamol given")
    if any(word in lowered for word in ["refer", "phc", "ಆಸ್ಪತ್ರೆ"]):
        actions.append("referred to PHC")

    extract = VisitExtract(
        patient_name=name.group(1) if name else None,
        age=int(age.group(1)) if age else (
            hindi_numbers.WORDS[age_word.group(1).lower()] if age_word else None
        ),
        vitals=vitals,
        pregnancy=pregnancy,
        symptoms=symptoms,
        actions_taken=actions,
        follow_up_date=_follow_up(transcript, today),
        missing_fields=[],
    )
    extract.missing_fields = compute_missing(extract, visit_type)
    return extract


def compute_missing(extract: VisitExtract, visit_type: str) -> list[str]:
    missing = list(extract.missing_fields)

    def add(field: str) -> None:
        if field not in missing:
            missing.append(field)

    if not extract.patient_name:
        add("patient_name")
    if extract.age is None:
        add("age")
    vitals = extract.vitals
    has_vitals = any(
        [
            vitals.bp_systolic,
            vitals.bp_diastolic,
            vitals.weight_kg,
            vitals.hemoglobin,
            vitals.temperature_c,
        ]
    )
    if not has_vitals and not extract.symptoms:
        add("vitals")
    if (
        visit_type in {"anc", "postnatal"}
        and extract.pregnancy.weeks is None
        and extract.pregnancy.months is None
    ):
        add("pregnancy_weeks")
    if extract.follow_up_date is None:
        add("follow_up_date")
    return missing


# A number only counts if the worker said a word that anchors it.
# Stops the LLM inventing an age or Hb that nobody mentioned.
CUES = {
    "age": ["saal", " sal", "साल", "वर्ष", "varsh", "year", "yrs", "umar", "umr", "उम्र", "उमर", "ವರ್ಷ", "ವಯಸ್ಸು", " age "],
    "bp": ["bp", "बीपी", "blood pressure", "ब्लड प्रेशर", "रक्तचाप", "ರಕ್ತದೊತ್ತಡ", "ಬಿಪಿ"],
    "hemoglobin": ["hb", "hemoglobin", "haemoglobin", "हीमोग्लोबिन", "एचबी", "ಹಿಮೋಗ್ಲೋಬಿನ್"],
    "temperature_c": ["temperature", "temp", "bukhar", "fever", "बुखार", "तापमान", "डिग्री", "degree", "ಜ್ವರ", "ತಾಪಮಾನ"],
    "weight_kg": ["weight", "kg", "kilo", "वजन", "वज़न", "किलो", "ತೂಕ"],
    "months": ["month", "mahin", "mahee", "महीन", "माह", "ತಿಂಗಳ", "tingal"],
    "weeks": ["week", "hafte", "हफ्त", "हफ़्त", "सप्ताह", "ವಾರ", "vaara"],
}


def _heard(field: str, lowered: str) -> bool:
    return any(cue in lowered for cue in CUES[field])


HONORIFIC_RE = re.compile(r"\s+(?:ji|didi|bai|behen|amma|avaru|avara)$", re.IGNORECASE)


def _ground(
    llm: VisitExtract, transcript: str, language: str, visit_type: str
) -> VisitExtract:
    """Rules beat the LLM where rules are certain: dates, and numbers said as digits."""
    rules = fallback_extract(transcript, language, visit_type)
    # strip punctuation only; \W would also eat Hindi vowel signs (बीपी -> ब प)
    lowered = f" {re.sub(r'[.,!?;:।|()\'\"-]', ' ', transcript.lower())} "
    if not _heard("age", lowered):
        llm.age = None
    if not _heard("bp", lowered):
        llm.vitals.bp_systolic = llm.vitals.bp_diastolic = None
    for field in ("hemoglobin", "temperature_c", "weight_kg"):
        if not _heard(field, lowered):
            setattr(llm.vitals, field, None)
    for field in ("months", "weeks"):
        if not _heard(field, lowered):
            setattr(llm.pregnancy, field, None)
    digits = set(re.findall(r"\d+(?:\.\d+)?", transcript))

    def said(value) -> bool:
        return value is not None and f"{value:g}" in digits

    for obj_llm, obj_rules, fields in [
        (llm.vitals, rules.vitals, ["hemoglobin", "temperature_c", "weight_kg"]),
    ]:
        for field in fields:
            rule_value = getattr(obj_rules, field)
            if said(rule_value):
                setattr(obj_llm, field, rule_value)
    # BP phrases, "N saal" / "N mahine" / "N hafte" patterns are unambiguous
    if rules.vitals.bp_systolic and rules.vitals.bp_diastolic:
        llm.vitals.bp_systolic = rules.vitals.bp_systolic
        llm.vitals.bp_diastolic = rules.vitals.bp_diastolic
    if rules.age:
        llm.age = rules.age
    for field in ("months", "weeks"):
        if getattr(rules.pregnancy, field):
            setattr(llm.pregnancy, field, getattr(rules.pregnancy, field))
    if rules.follow_up_date:
        llm.follow_up_date = rules.follow_up_date
    if llm.patient_name:
        llm.patient_name = HONORIFIC_RE.sub("", llm.patient_name).strip() or None
    llm.missing_fields = []  # compute_missing owns this; LLMs flag every empty field
    llm.readback_text = None  # read-back is built from grounded values only
    return llm


def _prompt(transcript: str, language: str, visit_type: str) -> str:
    return (
        f"Today is {date.today().isoformat()}. "
        f"Visit type: {visit_type}. Language hint: {language}.\n"
        f'Transcript:\n"""{transcript}"""'
    )


async def extract(
    transcript: str, language: str, visit_type: str
) -> tuple[VisitExtract, str]:
    if not settings.llm_api_key and settings.llm_provider != "ollama":
        data = fallback_extract(transcript, language, visit_type)
        return data, "fallback-regex"

    prompt = _prompt(transcript, language, visit_type)
    for attempt in range(2):
        try:
            if settings.llm_provider == "gemini":
                raw = await _call_gemini(prompt)
            elif settings.llm_provider == "ollama":
                raw = await _call_ollama(prompt)
            else:
                raw = await _call_openai_compatible(prompt)
            parsed = _parse_json(raw)
            parsed.setdefault("missing_fields", [])
            value = _ground(VisitExtract.model_validate(parsed), transcript, language, visit_type)
            return value, settings.llm_model
        except (httpx.HTTPError, ValidationError, ValueError, KeyError) as exc:
            logger.warning("extraction attempt %s failed: %s", attempt + 1, exc)

    return fallback_extract(transcript, language, visit_type), "fallback-regex"

import re

from ..schemas import VisitExtract
from . import protocols

TEMPLATES = {
    "kn": "ವರದಿ ದಾಖಲಾಗಿದೆ.",
    "hi": "रिपोर्ट दर्ज हो गई है।",
    "mixed": "Report record ho gayi hai.",
    "en": "The visit report has been recorded.",
}

FOLLOW_UP = {
    "kn": "ಮರುಭೇಟಿ",
    "hi": "अगली भेंट",
    "mixed": "Follow-up",
    "en": "Follow-up",
}

URGENT = {
    "kn": "ಇದು ಅಪಾಯದ ಪ್ರಕರಣ. ತಕ್ಷಣ ವೈದ್ಯರಿಗೆ ತಿಳಿಸಿ.",
    "hi": "यह जोखिम वाला मामला है। तुरंत डॉक्टर को बताएं।",
    "mixed": "Yeh risk case hai. Turant doctor ko bataiye.",
    "en": "This is a high-risk case. Inform the doctor immediately.",
}

MONTHS_TEXT = {
    "kn": "{n} ತಿಂಗಳ ಗರ್ಭಧಾರಣೆ.",
    "hi": "{n} महीने की गर्भावस्था.",
    "mixed": "{n} months pregnancy.",
    "en": "{n} months pregnant.",
}

WEEKS_TEXT = {
    "kn": "{n} ವಾರಗಳ ಗರ್ಭಧಾರಣೆ.",
    "hi": "{n} हफ्ते की गर्भावस्था.",
    "mixed": "{n} weeks pregnancy.",
    "en": "{n} weeks pregnant.",
}

MONTH_NAMES = {
    "kn": [
        "ಜನವರಿ", "ಫೆಬ್ರವರಿ", "ಮಾರ್ಚ್", "ಏಪ್ರಿಲ್", "ಮೇ", "ಜೂನ್",
        "ಜುಲೈ", "ಆಗಸ್ಟ್", "ಸೆಪ್ಟೆಂಬರ್", "ಅಕ್ಟೋಬರ್", "ನವೆಂಬರ್", "ಡಿಸೆಂಬರ್",
    ],
    "hi": [
        "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
        "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
    ],
}

DANGER_WORDS = {
    "kn": {
        "bleeding": "ರಕ್ತಸ್ರಾವ",
        "convulsion": "ಸೆಳೆತ",
        "unconscious": "ಅಪ್ರಜ್ಞೆ",
        "severe headache": "ತೀವ್ರ ತಲೆನೋವು",
        "blurred vision": "ಮಂಜು ಕಾಣುವುದು",
        "no fetal movement": "ಮಗುವಿನ ಚಲನೆ ಇಲ್ಲ",
        "breathlessness": "ಉಸಿರಾಟದ ತೊಂದರೆ",
        "severe abdominal pain": "ತೀವ್ರ ಹೊಟ್ಟೆನೋವು",
    },
    "hi": {
        "bleeding": "रक्तस्राव",
        "convulsion": "दौरा",
        "unconscious": "बेहोशी",
        "severe headache": "तेज़ सिरदर्द",
        "blurred vision": "धुंधला दिखना",
        "no fetal movement": "बच्चे की हलचल नहीं",
        "breathlessness": "सांस लेने में तकलीफ़",
        "severe abdominal pain": "तेज़ पेट दर्द",
    },
}


def _bucket(language: str) -> str:
    if "," in language:
        return "mixed"
    if language.startswith("kn"):
        return "kn"
    if language.startswith("hi"):
        return "hi"
    return "en"


def _date_text(value, bucket: str) -> str:
    if bucket in MONTH_NAMES:
        return f"{value.day} {MONTH_NAMES[bucket][value.month - 1]}"
    return f"{value.day} {value.strftime('%B')}"


def _localize_reason(reason: str, bucket: str) -> str:
    if bucket in {"en", "mixed"}:
        return reason

    match = re.search(r"BP (\d+)/(\d+) is (severely )?high", reason)
    if match:
        degree = "ತುಂಬಾ ಹೆಚ್ಚಿದೆ" if bucket == "kn" else "बहुत ज़्यादा है"
        return f"ರಕ್ತದೊತ್ತಡ {match.group(1)}/{match.group(2)} {degree}" if bucket == "kn" else f"बीपी {match.group(1)}/{match.group(2)} {degree}"

    match = re.search(r"Hb ([\d.]+) is (severely )?low", reason)
    if match:
        degree = "ತುಂಬಾ ಕಡಿಮೆ ಇದೆ" if bucket == "kn" else "बहुत कम है"
        return f"ಹಿಮೋಗ್ಲೋಬಿನ್ {match.group(1)} {degree}" if bucket == "kn" else f"हीमोग्लोबिन {match.group(1)} {degree}"

    match = re.search(r"Temperature ([\d.]+)C is (very )?high", reason)
    if match:
        degree = "ತುಂಬಾ ಹೆಚ್ಚಿದೆ" if bucket == "kn" else "बहुत ज़्यादा है"
        return f"ತಾಪಮಾನ {match.group(1)} ಡಿಗ್ರಿ {degree}" if bucket == "kn" else f"तापमान {match.group(1)} डिग्री {degree}"

    if reason.startswith("Danger sign reported:"):
        sign = reason.split(":", 1)[1].strip()
        word = DANGER_WORDS.get(bucket, {}).get(sign, sign)
        return f"ಅಪಾಯದ ಲಕ್ಷಣ: {word}" if bucket == "kn" else f"खतरे का लक्षण: {word}"

    return reason


def urgent_text(risk_reasons: list[str], bucket: str) -> str:
    return " ".join(protocols.steps(risk_reasons, bucket)) or URGENT[bucket]


def action_steps(risk_reasons: list[str], language: str) -> list[str]:
    return protocols.steps(risk_reasons, _bucket(language))


def build_readback(
    structured: VisitExtract, language: str, risk_level: str, risk_reasons: list[str]
) -> str:
    # Always the template: LLM free text skips grounding and once read back an invented age
    bucket = _bucket(language)
    parts = [TEMPLATES[bucket]]
    if structured.patient_name:
        parts.append(structured.patient_name)
    vitals = structured.vitals
    if vitals.bp_systolic and vitals.bp_diastolic:
        parts.append(f"BP {vitals.bp_systolic}/{vitals.bp_diastolic}.")
    if structured.pregnancy.months:
        parts.append(MONTHS_TEXT[bucket].format(n=structured.pregnancy.months))
    elif structured.pregnancy.weeks:
        parts.append(WEEKS_TEXT[bucket].format(n=structured.pregnancy.weeks))
    if structured.follow_up_date:
        parts.append(
            f"{FOLLOW_UP[bucket]} {_date_text(structured.follow_up_date, bucket)}."
        )
    if risk_level != "green" and risk_reasons:
        parts.append("; ".join(_localize_reason(r, bucket) for r in risk_reasons[:2]) + ".")
    if risk_level == "red":
        parts.append(urgent_text(risk_reasons, bucket))
    return " ".join(parts)[:600]

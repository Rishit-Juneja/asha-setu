"""What an ASHA should do right now for a red case.

Fixed table, never LLM-generated. Steps stay within ASHA scope (call 108,
position, refer) following MoHFW ASHA/ANC danger-sign guidance.
ponytail: needs sign-off from a clinician before any real deployment.
"""

STEPS = {
    "call108": {
        "en": "Call the 108 ambulance now.",
        "mixed": "Abhi 108 ambulance ko call kariye.",
        "hi": "अभी 108 एम्बुलेंस को फ़ोन करें।",
        "kn": "ಈಗಲೇ 108 ಆಂಬುಲೆನ್ಸ್‌ಗೆ ಕರೆ ಮಾಡಿ.",
    },
    "fru": {
        "en": "Take her to the FRU hospital immediately.",
        "mixed": "Turant FRU hospital le jaiye.",
        "hi": "तुरंत FRU अस्पताल ले जाएं।",
        "kn": "ತಕ್ಷಣ FRU ಆಸ್ಪತ್ರೆಗೆ ಕರೆದೊಯ್ಯಿರಿ.",
    },
    "phc": {
        "en": "Refer her to the PHC today.",
        "mixed": "Aaj hi PHC refer kariye.",
        "hi": "आज ही PHC भेजें।",
        "kn": "ಇಂದೇ PHC ಗೆ ಕಳುಹಿಸಿ.",
    },
    "left": {
        "en": "Keep her lying on her left side.",
        "mixed": "Unhe baayi karvat litaiye.",
        "hi": "उन्हें बाईं करवट लिटाएं।",
        "kn": "ಅವರನ್ನು ಎಡಬದಿಗೆ ಮಲಗಿಸಿ.",
    },
    "nothing": {
        "en": "Give nothing by mouth.",
        "mixed": "Muh se kuch mat dijiye.",
        "hi": "मुँह से कुछ न दें।",
        "kn": "ಬಾಯಿಯಿಂದ ಏನೂ ಕೊಡಬೇಡಿ.",
    },
    "stay": {
        "en": "Stay with her until help arrives.",
        "mixed": "Madad aane tak unke saath rahiye.",
        "hi": "मदद आने तक उनके साथ रहें।",
        "kn": "ಸಹಾಯ ಬರುವವರೆಗೆ ಅವರ ಜೊತೆ ಇರಿ.",
    },
}

# reason substring (from risk.assess) -> steps, most urgent first
RULES = [
    ("convulsion", ["call108", "left", "nothing"]),
    ("unconscious", ["call108", "left", "nothing"]),
    ("bleeding", ["call108", "fru", "stay"]),
    ("severe headache", ["call108", "fru", "left"]),
    ("blurred vision", ["call108", "fru", "left"]),
    ("breathlessness", ["call108", "fru"]),
    ("severe abdominal pain", ["call108", "fru"]),
    ("severely high", ["call108", "fru", "left"]),
    ("no fetal movement", ["fru"]),
    ("severely low", ["fru"]),
    ("very high", ["phc"]),
]


def steps(reasons: list[str], bucket: str, limit: int = 3) -> list[str]:
    keys: list[str] = []
    for needle, rule in RULES:
        if any(needle in r for r in reasons):
            keys += [k for k in rule if k not in keys]
    return [STEPS[k][bucket] for k in keys[:limit]]

from datetime import date, timedelta

from sqlalchemy import select

from .database import SessionLocal
from .models import Patient, Visit, Worker, utcnow
from .security import hash_pin


def _structured(
    name: str,
    age: int,
    sex: str,
    village: str,
    *,
    bp: tuple[int, int] | None = None,
    hb: float | None = None,
    temp: float | None = None,
    weeks: int | None = None,
    danger: list[str] | None = None,
    symptoms: list[str] | None = None,
    actions: list[str] | None = None,
    referrals: list[str] | None = None,
    follow_up: date | None = None,
    readback: str | None = None,
) -> dict:
    return {
        "patient_name": name,
        "age": age,
        "sex": sex,
        "village": village,
        "vitals": {
            "bp_systolic": bp[0] if bp else None,
            "bp_diastolic": bp[1] if bp else None,
            "weight_kg": None,
            "hemoglobin": hb,
            "temperature_c": temp,
        },
        "pregnancy": {"weeks": weeks, "danger_signs": danger or []},
        "symptoms": symptoms or [],
        "actions_taken": actions or [],
        "referrals": referrals or [],
        "follow_up_date": follow_up.isoformat() if follow_up else None,
        "notes": None,
        "readback_text": readback,
        "missing_fields": [],
    }


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(Worker).limit(1)) is not None:
            return

        lakshmi = Worker(
            name="Lakshmi",
            phone="9000000001",
            role="asha",
            language="kn-IN",
            pin_hash=hash_pin("1234"),
        )
        priya = Worker(
            name="Priya",
            phone="9000000003",
            role="asha",
            language="hi-IN,en-IN",
            pin_hash=hash_pin("1234"),
        )
        rao = Worker(
            name="Dr. Rao",
            phone="9000000002",
            role="supervisor",
            language="en-IN",
            pin_hash=hash_pin("1234"),
        )
        db.add_all([lakshmi, priya, rao])
        db.flush()

        sunita = Patient(name="Sunita", age=32, sex="F", village="Hosahalli", conditions=[])
        meena = Patient(name="Meena", age=26, sex="F", village="Gollahalli", conditions=[])
        ravi = Patient(name="Ravi", age=45, sex="M", village="Hosahalli", conditions=["diabetes"])
        fatima = Patient(name="Fatima", age=29, sex="F", village="Kerehalli", conditions=[])
        db.add_all([sunita, meena, ravi, fatima])
        db.flush()

        today = date.today()
        now = utcnow()

        visits = [
            Visit(
                worker_id=lakshmi.id,
                patient_id=sunita.id,
                visit_type="anc",
                language="kn-IN",
                transcript=(
                    "ನಮಸ್ಕಾರ, ಇವತ್ತು ಸುನೀತಾ ಅವರ ಮನೆ ಭೇಟಿ ಮಾಡಿದೆ. "
                    "ಅವರಿಗೆ ಏಳು ತಿಂಗಳ ಗರ್ಭ. ರಕ್ತದೊತ್ತಡ 150 ಬೈ 95 ಇತ್ತು. "
                    "ಕಾಲು ಸ್ವಲ್ಪ ಊತ ಇದೆ. ಐರನ್ ಮಾತ್ರೆ ಕೊಟ್ಟಿದ್ದೇನೆ. "
                    "ನಾಡಿದ್ದು ಮತ್ತೆ ಭೇಟಿ ಮಾಡ್ತೀನಿ."
                ),
                structured=_structured(
                    "Sunita", 32, "F", "Hosahalli",
                    bp=(150, 95), hb=9.2, weeks=28,
                    symptoms=["mild swelling"], actions=["IFA tablets given", "BP checked"],
                    follow_up=today + timedelta(days=2),
                    readback="ಸುನೀತಾ ಅವರ ರಕ್ತದೊತ್ತಡ 150/95, ಏಳು ತಿಂಗಳ ಗರ್ಭ. ಐರನ್ ಮಾತ್ರೆ ಕೊಟ್ಟಿದೆ. ನಾಡಿದ್ದು ಮರುಭೇಟಿ.",
                ),
                missing_fields=[],
                risk_level="amber",
                risk_reasons=["BP 150/95 is high"],
                follow_up_date=today + timedelta(days=2),
                stt_model="gnani-prisma-v2.5",
                llm_model="gemini-2.5-flash",
                latency_ms=4200,
                status="confirmed",
                created_at=now - timedelta(days=1, hours=3),
                confirmed_at=now - timedelta(days=1, hours=2),
            ),
            Visit(
                worker_id=priya.id,
                patient_id=meena.id,
                visit_type="anc",
                language="hi-IN,en-IN",
                transcript=(
                    "Meena ji ka BP 118 by 76 hai, chaubees hafte ki pregnancy hai. "
                    "Chakkar aa rahe hain, Hb 6.4 aaya hai. IFA tablets diye aur PHC "
                    "bhej diya Hb test ke liye. Kal follow-up."
                ),
                structured=_structured(
                    "Meena", 26, "F", "Gollahalli",
                    bp=(118, 76), hb=6.4, weeks=24,
                    symptoms=["dizziness"], actions=["IFA tablets given", "referred to PHC"],
                    referrals=["PHC for Hb test"], follow_up=today + timedelta(days=1),
                    readback="Meena ji ka BP 118 by 76, chaubees hafte ki pregnancy, Hb 6.4. PHC referral diya. Kal follow-up.",
                ),
                missing_fields=[],
                risk_level="red",
                risk_reasons=["Hb 6.4 is severely low"],
                follow_up_date=today + timedelta(days=1),
                stt_model="gnani-prisma-v2.5",
                llm_model="gemini-2.5-flash",
                latency_ms=5100,
                status="confirmed",
                created_at=now - timedelta(hours=4),
                confirmed_at=now - timedelta(hours=3),
            ),
            Visit(
                worker_id=priya.id,
                patient_id=ravi.id,
                visit_type="general",
                language="hi-IN,en-IN",
                transcript=(
                    "Ravi ji ko do din se bukhar hai, temperature 38.4 hai. BP 132 by 86. "
                    "Paracetamol diya hai. Kal dobara check karungi."
                ),
                structured=_structured(
                    "Ravi", 45, "M", "Hosahalli",
                    bp=(132, 86), temp=38.4,
                    symptoms=["fever"], actions=["paracetamol given"],
                    follow_up=today + timedelta(days=1),
                    readback="Ravi ji ka temperature 38.4, BP 132 by 86. Paracetamol diya. Kal check.",
                ),
                missing_fields=["pregnancy_weeks"],
                risk_level="amber",
                risk_reasons=["Temperature 38.4C is high"],
                follow_up_date=today + timedelta(days=1),
                stt_model="gnani-prisma-v2.5",
                llm_model="gemini-2.5-flash",
                latency_ms=3900,
                status="confirmed",
                created_at=now - timedelta(days=2, hours=1),
                confirmed_at=now - timedelta(days=2),
            ),
            Visit(
                worker_id=lakshmi.id,
                patient_id=fatima.id,
                visit_type="postnatal",
                language="kn-IN",
                transcript=(
                    "ಫಾತಿಮಾ ಅವರ ಮಗುವಿಗೆ ಒಂದು ತಿಂಗಳು. ರಕ್ತದೊತ್ತಡ 112 ಬೈ 74. "
                    "ಎದೆಹಾಲು ಕೊಡುವ ಬಗ್ಗೆ ಸಲಹೆ ಕೊಟ್ಟಿದ್ದೇನೆ. ಮರುಭೇಟಿ ನಿನ್ನೆ ಮಾಡಬೇಕಿತ್ತು."
                ),
                structured=_structured(
                    "Fatima", 29, "F", "Kerehalli",
                    bp=(112, 74),
                    actions=["breastfeeding counselling"],
                    follow_up=today - timedelta(days=1),
                    readback="ಫಾತಿಮಾ ಅವರ ರಕ್ತದೊತ್ತಡ 112/74. ಎದೆಹಾಲು ಸಲಹೆ ಕೊಟ್ಟಿದೆ. ಮರುಭೇಟಿ ಬಾಕಿ ಇದೆ.",
                ),
                missing_fields=["follow_up_date"],
                risk_level="green",
                risk_reasons=[],
                follow_up_date=today - timedelta(days=1),
                stt_model="gnani-prisma-v2.5",
                llm_model="gemini-2.5-flash",
                latency_ms=3600,
                status="confirmed",
                created_at=now - timedelta(days=4, hours=2),
                confirmed_at=now - timedelta(days=4, hours=1),
            ),
            Visit(
                worker_id=lakshmi.id,
                patient_id=sunita.id,
                visit_type="anc",
                language="kn-IN",
                transcript=(
                    "ಸುನೀತಾ ಅವರಿಗೆ ರಕ್ತಸ್ರಾವ ಆಗುತ್ತಿದೆ. ರಕ್ತದೊತ್ತಡ 162 ಬೈ 112. "
                    "ತಕ್ಷಣ PHC ಗೆ ಕಳಿಸಿದ್ದೇನೆ."
                ),
                structured=_structured(
                    "Sunita", 32, "F", "Hosahalli",
                    bp=(162, 112), weeks=27,
                    danger=["bleeding"], actions=["referred to PHC urgently"],
                    referrals=["PHC"], follow_up=today,
                    readback="ಸುನೀತಾ ಅವರಿಗೆ ರಕ್ತಸ್ರಾವ, ರಕ್ತದೊತ್ತಡ 162/112. ತಕ್ಷಣ PHC ಗೆ ಕಳಿಸಿದೆ.",
                ),
                missing_fields=[],
                risk_level="red",
                risk_reasons=["BP 162/112 is severely high", "Danger sign reported: bleeding"],
                follow_up_date=today,
                stt_model="gnani-prisma-v2.5",
                llm_model="gemini-2.5-flash",
                latency_ms=4700,
                status="confirmed",
                created_at=now - timedelta(days=5, hours=5),
                confirmed_at=now - timedelta(days=5, hours=4),
            ),
            Visit(
                worker_id=priya.id,
                patient_id=meena.id,
                visit_type="anc",
                language="hi-IN,en-IN",
                transcript="Meena ji ka BP 118 by 76, bees hafte ki pregnancy, sab theek hai.",
                structured=_structured(
                    "Meena", 26, "F", "Gollahalli",
                    bp=(118, 76), weeks=20,
                    actions=["routine ANC check"],
                    follow_up=today + timedelta(days=5),
                    readback="Meena ji ka BP 118 by 76, bees hafte ki pregnancy. Sab theek hai.",
                ),
                missing_fields=[],
                risk_level="green",
                risk_reasons=[],
                follow_up_date=today + timedelta(days=5),
                stt_model="gnani-prisma-v2.5",
                llm_model="gemini-2.5-flash",
                latency_ms=3100,
                status="confirmed",
                created_at=now - timedelta(days=6, hours=2),
                confirmed_at=now - timedelta(days=6, hours=1),
            ),
        ]

        db.add_all(visits)
        db.commit()
    finally:
        db.close()

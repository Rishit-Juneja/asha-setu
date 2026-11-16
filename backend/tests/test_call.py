from pathlib import Path

from app.routers.call import merge

from .conftest import login


def test_merge_fills_gaps_and_locks_heard_values():
    old = {"patient_name": "Seema", "vitals": {"bp_systolic": 170, "hemoglobin": None}, "symptoms": ["headache"]}
    new = {"patient_name": None, "vitals": {"bp_systolic": 177, "hemoglobin": 8.5}, "symptoms": ["fever"]}
    out = merge(old, new)
    assert out["patient_name"] == "Seema"
    assert out["vitals"] == {"bp_systolic": 170, "hemoglobin": 8.5}
    assert out["symptoms"] == ["headache", "fever"]


def test_call_flow_asks_then_fills_missing_field(client, monkeypatch):
    headers = login(client, "9000000003")
    greet = client.get("/api/call/greeting?language=hi-IN", headers=headers).json()
    assert "Priya" in greet["text"]

    draft = client.post(
        "/api/visits/draft",
        headers=headers,
        data={"transcript": "Seema ji ka BP 150 by 95 hai, saat mahine ki pregnancy, Monday follow-up.",
              "language": "hi-IN,en-IN", "visit_type": "anc"},
    ).json()
    assert "age" in draft["missing_fields"]

    q = client.get(f"/api/call/{draft['id']}/question", headers=headers).json()
    assert q["field"] == "age" and "Seema" in q["text"]

    async def fake_transcribe(audio, language):
        return "Pachchees saal", None, "prisma-test", "audio/x.wav"

    monkeypatch.setattr("app.routers.call.transcribe_upload", fake_transcribe)
    out = client.post(
        f"/api/call/{draft['id']}/answer",
        headers=headers,
        data={"field": "age", "question_asked": q["text"]},
        files={"audio": ("a.webm", b"x", "audio/webm")},
    ).json()
    visit = out["visit"]
    assert visit["structured"]["age"] == 25
    assert visit["structured"]["vitals"]["bp_systolic"] == 150
    assert "age" not in visit["missing_fields"]

    done = client.get(f"/api/call/{draft['id']}/question?asked=age", headers=headers).json()
    assert done["field"] is None and "Dhanyavaad" in done["text"]


def test_speak_returns_wav(client, monkeypatch):
    async def fake_synthesize(text, language="kn-IN", voice=None):
        path = Path("test_speak.wav")
        path.write_bytes(b"RIFF....WAVE")
        return path

    monkeypatch.setattr("app.services.gnani.synthesize_cached", fake_synthesize)
    r = client.post("/api/call/speak", headers=login(client), json={"text": "नमस्ते", "language": "hi-IN"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("audio/wav")
    Path("test_speak.wav").unlink(missing_ok=True)

from pathlib import Path

from tests.conftest import login


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_login_rejects_bad_pin(client):
    response = client.post(
        "/api/auth/login", json={"phone": "9000000001", "pin": "0000"}
    )
    assert response.status_code == 401


def test_seeded_patients_and_visits(client):
    headers = login(client, phone="9000000002")
    patients = client.get("/api/patients", headers=headers).json()
    assert any(patient["name"] == "Sunita" for patient in patients)
    visits = client.get("/api/visits", headers=headers).json()
    assert len(visits) >= 6
    assert visits[0]["status"] == "confirmed"


def test_draft_confirm_and_readback_text(client):
    headers = login(client)
    payload = {
        "transcript": (
            "Sunita ji ka BP 140 by 90 hai, saat mahine ki pregnancy hai, "
            "IFA tablets diye, Monday follow up karna hai."
        ),
        "visit_type": "anc",
        "language": "hi-IN,en-IN",
        "client_uuid": "test-draft-1",
    }
    response = client.post("/api/visits/draft", headers=headers, data=payload)
    assert response.status_code == 200, response.text
    draft = response.json()
    assert draft["structured"]["vitals"]["bp_systolic"] == 140
    assert draft["risk_level"] == "amber"
    visit_id = draft["id"]

    repeat = client.post("/api/visits/draft", headers=headers, data=payload)
    assert repeat.status_code == 200
    assert repeat.json()["id"] == visit_id

    patients = client.get("/api/patients", headers=headers).json()
    sunita = next(patient for patient in patients if patient["name"] == "Sunita")

    confirm = client.post(
        f"/api/visits/{visit_id}/confirm",
        headers=headers,
        json={
            "structured": draft["structured"],
            "patient_id": sunita["id"],
            "visit_type": "anc",
            "language": "hi-IN,en-IN",
        },
    )
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["status"] == "confirmed"
    assert confirm.json()["patient_name"] == "Sunita"

    readback = client.get(f"/api/visits/{visit_id}/readback-text", headers=headers)
    assert readback.status_code == 200
    assert readback.json()["text"]


def test_readback_audio_is_cached(client, monkeypatch):
    headers = login(client)
    visits = client.get("/api/visits", headers=headers).json()
    visit_id = visits[0]["id"]

    async def fake_synthesize(text, language="kn-IN", voice=None):
        path = Path("test_readback.wav")
        path.write_bytes(b"RIFF....WAVE")
        return path

    monkeypatch.setattr("app.services.gnani.synthesize_cached", fake_synthesize)
    response = client.post(f"/api/visits/{visit_id}/readback", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    Path("test_readback.wav").unlink(missing_ok=True)


def test_worker_cannot_open_dashboard(client):
    headers = login(client)
    response = client.get("/api/dashboard/summary", headers=headers)
    assert response.status_code == 403


def test_supervisor_dashboard_and_csv(client):
    headers = login(client, phone="9000000002")
    summary = client.get("/api/dashboard/summary", headers=headers)
    assert summary.status_code == 200
    totals = summary.json()["totals"]
    assert totals["visits"] >= 5
    assert totals["red_last_7d"] >= 1

    csv_response = client.get("/api/dashboard/export.csv", headers=headers)
    assert csv_response.status_code == 200
    assert csv_response.text.startswith("visit_id,")


def test_confirm_links_patient_by_name_and_fills_age(client):
    headers = login(client)
    draft = client.post(
        "/api/visits/draft",
        headers=headers,
        data={
            "transcript": "Sunita ji ka BP 118 by 76 hai, follow up Monday.",
            "visit_type": "general",
            "language": "hi-IN,en-IN",
            "client_uuid": "test-link-1",
        },
    ).json()
    assert draft["structured"]["age"] is None

    before = client.get("/api/patients", headers=headers).json()
    confirm = client.post(
        f"/api/visits/{draft['id']}/confirm",
        headers=headers,
        json={"structured": draft["structured"], "visit_type": "general"},
    )
    assert confirm.status_code == 200, confirm.text
    body = confirm.json()
    sunita = next(patient for patient in before if patient["name"] == "Sunita")
    assert body["patient_id"] == sunita["id"]
    assert body["structured"]["age"] == 32

    after = client.get("/api/patients", headers=headers).json()
    assert len(after) == len(before)


def test_supervisor_red_alert_audio(client, monkeypatch):
    spoken = {}

    async def fake_synthesize(text, language="kn-IN", voice=None):
        spoken["text"] = text
        path = Path("test_alert.wav")
        path.write_bytes(b"RIFF....WAVE")
        return path

    monkeypatch.setattr("app.services.gnani.synthesize_cached", fake_synthesize)
    sup = login(client, "9000000002")
    red = client.get("/api/visits?risk=red&status=confirmed", headers=sup).json()[0]
    assert client.post(f"/api/dashboard/alert/{red['id']}", headers=login(client)).status_code == 403
    response = client.post(f"/api/dashboard/alert/{red['id']}", headers=sup)
    assert response.status_code == 200
    assert spoken["text"].startswith("Red alert.") and "Reported by" in spoken["text"]
    readback = client.get(f"/api/visits/{red['id']}/readback-text", headers=sup).json()
    assert readback["steps"]
    Path("test_alert.wav").unlink(missing_ok=True)

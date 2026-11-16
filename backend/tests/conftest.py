import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

os.environ["DATABASE_URL"] = "sqlite:///./test_ashasetu.db"
os.environ["DATA_DIR"] = "./test_data"
os.environ["JWT_SECRET"] = "test-secret-0123456789abcdef0123456789abcdef"
os.environ["LLM_API_KEY"] = ""
os.environ["LLM_PROVIDER"] = "gemini"

db_file = ROOT / "test_ashasetu.db"
if db_file.exists():
    db_file.unlink()

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, phone: str = "9000000001", pin: str = "1234") -> dict:
    response = client.post("/api/auth/login", json={"phone": phone, "pin": pin})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

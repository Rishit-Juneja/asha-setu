from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR, settings
from .database import Base, engine
from .routers import auth, call, dashboard, patients, visits, ws_stt
from .seed import seed_if_empty
from .services.gnani import VOICES

DIST = BASE_DIR / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "audio").mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "tts").mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(visits.router)
app.include_router(dashboard.router)
app.include_router(ws_stt.router)
app.include_router(call.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/config")
def config() -> dict:
    return {
        "languages": [
            {"code": "kn-IN", "label": "Kannada", "voice": VOICES["kn-IN"]},
            {"code": "hi-IN,en-IN", "label": "Hinglish", "voice": VOICES["auto"]},
            {"code": "hi-IN", "label": "Hindi", "voice": VOICES["hi-IN"]},
            {"code": "ta-IN", "label": "Tamil", "voice": VOICES["ta-IN"]},
            {"code": "te-IN", "label": "Telugu", "voice": VOICES["te-IN"]},
            {"code": "mr-IN", "label": "Marathi", "voice": VOICES["mr-IN"]},
            {"code": "bn-IN", "label": "Bengali", "voice": VOICES["bn-IN"]},
            {"code": "en-IN", "label": "English", "voice": VOICES["en-IN"]},
        ],
        "visit_types": [
            {"code": "anc", "label": "Antenatal (ANC)"},
            {"code": "postnatal", "label": "Postnatal"},
            {"code": "immunization", "label": "Immunization"},
            {"code": "newborn", "label": "Newborn care"},
            {"code": "general", "label": "General check-up"},
        ],
    }


if DIST.exists():
    if (DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "ws/")):
            raise HTTPException(404)
        candidate = (DIST / full_path).resolve()
        if candidate.is_file() and DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
else:

    @app.get("/")
    def root() -> dict:
        return {"app": settings.app_name, "docs": "/docs", "status": "ok"}

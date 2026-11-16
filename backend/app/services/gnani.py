import asyncio
import hashlib
import json
from pathlib import Path

import httpx

from ..config import settings

_semaphore = asyncio.Semaphore(1)

VOICES = {
    "kn-IN": "Saanvi",
    "hi-IN": "Nalini",
    "en-IN": "Kaveri",
    "ta-IN": "Asmita",
    "te-IN": "Suhana",
    "ml-IN": "Reshma",
    "mr-IN": "Zahira",
    "bn-IN": "Kirra",
    "gu-IN": "Falak",
    "pa-IN": "Mehuli",
    "auto": "Poorvi",
}

RETRY_STATUS = {429, 500, 502, 503, 504}


def voice_for(language: str) -> str:
    return VOICES.get(language, "Kaveri")


def tts_language(language: str) -> str:
    return "auto" if "," in language else language


def stt_format(language: str, override: str | None = None) -> str:
    if override:
        return override
    return "transliterate" if "," in language else "verbatim"


async def _request(method: str, url: str, **kwargs) -> httpx.Response:
    last_error: object | None = None
    for attempt in range(3):
        response: httpx.Response | None = None
        async with _semaphore:
            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    response = await client.request(method, url, **kwargs)
                except httpx.HTTPError as exc:
                    last_error = exc
        if response is not None:
            if response.status_code == 200:
                return response
            if response.status_code not in RETRY_STATUS:
                response.raise_for_status()
            last_error = RuntimeError(
                f"Gnani {response.status_code}: {response.text[:300]}"
            )
        if attempt < 2:
            await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Gnani request failed: {last_error}")


async def transcribe_file(
    path: Path,
    language: str,
    *,
    fmt: str | None = None,
    topic: str | None = None,
    keyterms: list[str] | None = None,
    model: str | None = None,
) -> dict:
    data = {
        "language_code": language,
        "model": model or settings.gnani_stt_model,
        "format": stt_format(language, fmt),
    }
    if topic:
        data["topic"] = topic
    if keyterms:
        data["keyterms"] = json.dumps(keyterms, ensure_ascii=False)
    audio_bytes = path.read_bytes()
    response = await _request(
        "POST",
        settings.gnani_stt_url,
        headers={"X-API-Key-ID": settings.gnani_api_key},
        data=data,
        files={"audio_file": (path.name, audio_bytes, "audio/wav")},
    )
    return response.json()


async def synthesize(
    text: str, language: str = "kn-IN", voice: str | None = None, speed: float = 1.0
) -> bytes:
    payload = {
        "text": text,
        "voice": voice or voice_for(language),
        "model": settings.gnani_tts_model,
        "language": tts_language(language),
        "speed": speed,
        "audio_config": {
            "sample_rate": 24000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav",
        },
    }
    response = await _request(
        "POST",
        settings.gnani_tts_url,
        headers={
            "X-API-Key-ID": settings.gnani_api_key,
            "Content-Type": "application/json",
        },
        json=payload,
    )
    return response.content


async def synthesize_cached(
    text: str, language: str = "kn-IN", voice: str | None = None
) -> Path:
    voice_id = voice or voice_for(language)
    key = hashlib.sha256(f"{text}|{language}|{voice_id}".encode()).hexdigest()[:32]
    cache_dir = settings.data_dir / "tts"
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / f"{key}.wav"
    if not target.exists():
        audio = await synthesize(text, language, voice_id)
        target.write_bytes(audio)
    return target

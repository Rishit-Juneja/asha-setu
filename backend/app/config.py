from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", extra="ignore", case_sensitive=False
    )

    app_name: str = "ASHA Setu"
    gnani_api_key: str = ""
    gnani_stt_url: str = "https://api.vachana.ai/stt/v3"
    gnani_stt_ws: str = "wss://api.vachana.ai/stt/v3/stream"
    gnani_tts_url: str = "https://api.vachana.ai/api/v1/tts/inference"
    gnani_tts_model: str = "timbre-v2.5"
    gnani_stt_model: str = "prisma-v3.0"

    llm_provider: str = "gemini"
    llm_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"
    llm_base_url: str = ""

    jwt_secret: str = "dev-change-me"
    jwt_expire_minutes: int = 60 * 24 * 7

    database_url: str = "sqlite:///./ashasetu.db"
    data_dir: Path = Path("./data")
    app_base_url: str = "http://localhost:8000"


settings = Settings()

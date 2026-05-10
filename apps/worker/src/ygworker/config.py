import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    log_level: str = "INFO"


def load_settings() -> Settings:
    return Settings(
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )


def _required(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"환경변수 누락: {key}")
    return value

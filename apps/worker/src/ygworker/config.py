import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    log_level: str = "INFO"
    rpc_port: int = 8080
    rpc_secret: str = "dev-secret-change-me"
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:rms6654@gmail.com"


def load_settings() -> Settings:
    return Settings(
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        rpc_port=int(os.environ.get("WORKER_RPC_PORT", "8080")),
        rpc_secret=os.environ.get("WORKER_RPC_SECRET", "dev-secret-change-me"),
        vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY", ""),
        vapid_subject=os.environ.get("VAPID_SUBJECT", "mailto:rms6654@gmail.com"),
    )


def _required(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"환경변수 누락: {key}")
    return value

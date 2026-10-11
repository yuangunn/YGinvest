import pytest

from ygworker.config import load_settings


def test_load_settings_requires_rpc_secret(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.delenv("WORKER_RPC_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="WORKER_RPC_SECRET"):
        load_settings()


def test_load_settings_reads_rpc_secret(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setenv("WORKER_RPC_SECRET", "s3cret")
    assert load_settings().rpc_secret == "s3cret"

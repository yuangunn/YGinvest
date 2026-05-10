from typing import Any

from fastapi import FastAPI

from ygworker.rpc.stocks import make_router as make_stocks_router


def build_app(supabase: Any, secret: str) -> FastAPI:
    app = FastAPI(title="YGinvest Worker RPC")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    app.include_router(make_stocks_router(supabase, secret))
    return app

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ygworker.data_sources.yahoo import fetch_quote


class LookupRequest(BaseModel):
    symbol: str


class LookupResponse(BaseModel):
    symbol: str
    name: str
    market: str
    currency: str
    price: float
    name_ko: str | None = None


def make_router(supabase: Any, secret: str) -> APIRouter:
    router = APIRouter()

    def _check_secret(x_worker_secret: str | None = Header(default=None)) -> None:
        if x_worker_secret != secret:
            raise HTTPException(status_code=401, detail="unauthorized")

    @router.post("/rpc/stocks/lookup", response_model=LookupResponse)
    def lookup(req: LookupRequest, _: None = Depends(_check_secret)) -> LookupResponse:
        quote = fetch_quote(req.symbol)
        if quote is None:
            raise HTTPException(status_code=404, detail="not_found")

        now = datetime.now(timezone.utc).isoformat()
        # ad-hoc 조회된 종목은 한국어명을 알 수 없음 (yfinance에 한국어 표기 없음).
        # 한국 종목(.KS/.KQ)이면 quote.name이 영문일 것 — 실제 표시는 search 컴포넌트의
        # `name_ko ?? name` 폴백에 의존. 향후 pykrx로 한국어명 보강 가능.
        record = {
            "symbol": quote.symbol,
            "market": quote.market,
            "currency": quote.currency,
            "name": quote.name,
            "name_ko": None,
            "market_cap": quote.market_cap,
            "per": quote.per,
            "sector": quote.sector,
            "last_price": quote.price,
            "last_price_at": now,
            "fifty_two_week_high": quote.fifty_two_week_high,
            "fifty_two_week_low": quote.fifty_two_week_low,
            "is_active": True,
            "updated_at": now,
        }
        supabase.table("stocks").upsert(record, on_conflict="symbol").execute()

        return LookupResponse(
            symbol=quote.symbol,
            name=quote.name,
            market=quote.market,
            currency=quote.currency,
            price=quote.price,
        )

    return router

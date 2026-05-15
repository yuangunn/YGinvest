from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ygworker.data_sources.naver_news import fetch_kr_news
from ygworker.data_sources.yahoo import fetch_history, fetch_quote
from ygworker.data_sources.yahoo_news import fetch_key_metrics, fetch_news
from ygworker.jobs.enrich_stock_info import run_enrich_stock_info
from ygworker.jobs.fetch_macro_indicators import run_fetch_macro_indicators


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
    import structlog

    def _check_secret(x_worker_secret: str | None = Header(default=None)) -> None:
        if x_worker_secret != secret:
            raise HTTPException(status_code=401, detail="unauthorized")

    @router.post("/rpc/enrich_now")
    def enrich_now(_: None = Depends(_check_secret)) -> dict:
        """Plan #22 hotfix — 모든 stocks의 sector/PER/52w/market_cap를 yfinance로 갱신."""
        log = structlog.get_logger()
        return run_enrich_stock_info(supabase, log)

    @router.post("/rpc/macro_now")
    def macro_now(_: None = Depends(_check_secret)) -> dict:
        """Plan #27.4: 거시경제 지표 수동 fetch (cron 누락 시 backfill)."""
        log = structlog.get_logger()
        run_fetch_macro_indicators(supabase, log)
        return {"ok": True}

    @router.post("/rpc/stocks/lookup", response_model=LookupResponse)
    def lookup(req: LookupRequest, _: None = Depends(_check_secret)) -> LookupResponse:
        quote = fetch_quote(req.symbol)
        if quote is None:
            raise HTTPException(status_code=404, detail="not_found")

        now = datetime.now(UTC).isoformat()
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

    class BarsRequest(BaseModel):
        symbol: str
        interval: str = "15m"
        period: str = "60d"

    @router.post("/rpc/stocks/bars")
    def bars(req: BarsRequest, _: None = Depends(_check_secret)) -> dict:
        if req.interval not in ("15m", "1h", "1d"):
            raise HTTPException(status_code=400, detail="invalid_interval")
        bars_data = fetch_history(req.symbol, period=req.period, interval=req.interval)
        out = []
        for b in bars_data:
            ts = b["ts"].isoformat() if hasattr(b["ts"], "isoformat") else str(b["ts"])
            out.append({**b, "ts": ts})
        return {"symbol": req.symbol, "interval": req.interval, "bars": out}

    class NewsRequest(BaseModel):
        symbol: str
        limit: int = 10

    @router.post("/rpc/stocks/news")
    def news(req: NewsRequest, _: None = Depends(_check_secret)) -> dict:
        # KR 종목(.KS/.KQ) → Naver Finance 한국어 뉴스 스크래핑
        # US 종목 → yfinance Ticker.news (영어)
        if req.symbol.endswith((".KS", ".KQ")):
            try:
                items = fetch_kr_news(req.symbol, limit=req.limit)
            except Exception:
                # Naver 차단/타임아웃 시 yfinance fallback (영어라도 보여주자)
                items = fetch_news(req.symbol, limit=req.limit)
        else:
            items = fetch_news(req.symbol, limit=req.limit)
        return {"symbol": req.symbol, "news": items}

    class FinancialsRequest(BaseModel):
        symbol: str

    @router.post("/rpc/stocks/financials")
    def financials(req: FinancialsRequest, _: None = Depends(_check_secret)) -> dict:
        return fetch_key_metrics(req.symbol)

    return router

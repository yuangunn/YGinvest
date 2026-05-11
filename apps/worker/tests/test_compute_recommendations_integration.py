"""Plan #8 추천 계산 통합 테스트 (real Postgres)."""

import os
from datetime import date, timedelta

import pytest
from dotenv import load_dotenv
from supabase import create_client

from ygworker.jobs.compute_recommendations import run_compute_recommendations

load_dotenv()


@pytest.fixture(scope="module")
def admin():
    return create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )


@pytest.fixture
def cleanup(admin):
    symbols: list[str] = []
    yield symbols
    for sym in symbols:
        try:
            admin.table("stock_bars").delete().eq("symbol", sym).execute()
            admin.table("recommendations").delete().eq("symbol", sym).execute()
            admin.table("stocks").delete().eq("symbol", sym).execute()
        except Exception:
            pass


def _seed_stock_and_bars(
    admin,
    cleanup,
    symbol: str,
    currency: str,
    last_price: float,
    market_cap: float,
    per: float,
    hi: float,
    today_close: float,
    prev_closes: list[float],
    today_vol: float,
    prev_vols: list[float],
) -> None:
    cleanup.append(symbol)
    market = "KRX_KS" if currency == "KRW" else "NASDAQ"
    admin.table("stocks").upsert(
        {
            "symbol": symbol,
            "name": f"{symbol} Test",
            "market": market,
            "currency": currency,
            "last_price": last_price,
            "market_cap": market_cap,
            "per": per,
            "fifty_two_week_high": hi,
            "is_active": True,
        },
        on_conflict="symbol",
    ).execute()

    today_d = date.today()
    bars = [
        {
            "symbol": symbol,
            "interval": "1d",
            "ts": today_d.isoformat(),
            "open": today_close,
            "high": today_close,
            "low": today_close,
            "close": today_close,
            "volume": today_vol,
        }
    ]
    for i, (c, v) in enumerate(zip(prev_closes, prev_vols, strict=False)):
        d = today_d - timedelta(days=i + 1)
        bars.append(
            {
                "symbol": symbol,
                "interval": "1d",
                "ts": d.isoformat(),
                "open": c,
                "high": c,
                "low": c,
                "close": c,
                "volume": v,
            }
        )
    admin.table("stock_bars").upsert(bars, on_conflict="symbol,interval,ts").execute()


class _Logger:
    def info(self, *a, **k):
        pass

    def warning(self, *a, **k):
        pass

    def error(self, *a, **k):
        pass


def test_compute_recommendations_round_trip(admin, cleanup):
    # KR 종목: 오늘 +10% + 거래량 5배 — top_gainers + volume_surge 진입 기대
    _seed_stock_and_bars(
        admin,
        cleanup,
        "TEST_KR1.KS",
        "KRW",
        last_price=11000,
        market_cap=1_000_000_000_000,
        per=8.5,
        hi=11500,
        today_close=11000,
        prev_closes=[10000, 9900, 9800, 9900, 10000],
        today_vol=500_000,
        prev_vols=[100_000] * 5,
    )

    run_compute_recommendations(admin, _Logger())

    # top_gainers KR에 TEST_KR1.KS 포함
    gainers = (
        admin.table("recommendations")
        .select("symbol, rank, score, reason")
        .eq("category", "top_gainers")
        .eq("market_scope", "KR")
        .order("rank")
        .execute()
        .data
    )
    assert any(r["symbol"] == "TEST_KR1.KS" for r in gainers)

    # volume_surge KR에 TEST_KR1.KS 포함 (5x)
    surge = (
        admin.table("recommendations")
        .select("symbol")
        .eq("category", "volume_surge")
        .eq("market_scope", "KR")
        .execute()
        .data
    )
    assert any(r["symbol"] == "TEST_KR1.KS" for r in surge)

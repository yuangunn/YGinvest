"""가격 fetch — KR/US 모든 active stocks의 last_price/last_price_at 갱신.

Plan #47.2 대대적 개선:
  - KR: FDR StockListing → yfinance batch fallback → per-symbol history fallback
  - US: yfinance batch → per-symbol history fallback
  - 30일 이상 stale 종목 → is_active=false 자동 비활성화 (noise 제거)
  - 모든 fallback 단계에 명확한 로그
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import yfinance as yf

from ygworker.data_sources.fdr import _fetch_listing
from ygworker.data_sources.yahoo import fetch_closes_batch
from ygworker.data_sources.yf_session import get_yf_session

# yfinance batch는 200개 권장 (메모리 안정성)
BATCH_SIZE = 200

# per-symbol fallback 시 너무 많이 시도하면 느려짐 — 가장 stale한 것만
PER_SYMBOL_FALLBACK_LIMIT = 100


def _fetch_one_history(symbol: str) -> float | None:
    """단일 종목 yfinance.history(period='5d') fallback."""
    try:
        df = yf.Ticker(symbol, session=get_yf_session()).history(
            period="5d", interval="1d", auto_adjust=True
        )
        if df is None or df.empty:
            return None
        cleaned = df["Close"].dropna() if "Close" in df.columns else None
        if cleaned is None or cleaned.empty:
            return None
        v = float(cleaned.iloc[-1])
        if v <= 0 or v != v:  # NaN
            return None
        return v
    except Exception:
        return None


def _load_all_active_stocks(supabase: Any) -> list[dict]:
    """active=true 모든 stocks 페이지네이션으로 전부 가져오기.

    Supabase REST는 기본 1000 row limit. 3000+ active 종목 모두 처리하려면
    .range()로 페이징 필요. 이거 없으면 1000개 이후 종목은 영원히 stale.
    """
    out: list[dict] = []
    offset = 0
    page_size = 1000
    while True:
        page = (
            supabase.table("stocks")
            .select("symbol, last_price_at")
            .eq("is_active", True)
            .order("symbol", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        if not page:
            break
        out.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return out


def run_fetch_prices(supabase: Any, logger: Any) -> None:
    """모든 active stocks의 last_price/last_price_at 갱신."""
    rows = _load_all_active_stocks(supabase)
    if not rows:
        logger.info("fetch_prices.skip", reason="no_active_symbols")
        return

    symbols = [r["symbol"] for r in rows]
    # stale 점수: last_price_at이 오래된 종목 우선 처리 (fallback queue용)
    stale_score: dict[str, datetime] = {}
    for r in rows:
        ts_str = r.get("last_price_at")
        if not ts_str:
            stale_score[r["symbol"]] = datetime.min.replace(tzinfo=UTC)
        else:
            try:
                stale_score[r["symbol"]] = datetime.fromisoformat(
                    ts_str.replace("Z", "+00:00")
                )
            except Exception:
                stale_score[r["symbol"]] = datetime.min.replace(tzinfo=UTC)

    kr_symbols = [s for s in symbols if s.endswith((".KS", ".KQ"))]
    us_symbols = [s for s in symbols if not s.endswith((".KS", ".KQ"))]
    logger.info("fetch_prices.start", kr=len(kr_symbols), us=len(us_symbols))

    now = datetime.now(UTC).isoformat()
    updated: set[str] = set()

    def commit_price(sym: str, price: float) -> None:
        try:
            supabase.table("stocks").update(
                {"last_price": price, "last_price_at": now, "updated_at": now}
            ).eq("symbol", sym).execute()
            updated.add(sym)
        except Exception as exc:
            logger.warning("fetch_prices.update_failed", symbol=sym, error=str(exc))

    # ─── KR Step 1: FDR StockListing ───
    if kr_symbols:
        kr_prices = _build_kr_price_map(logger)
        for sym in kr_symbols:
            price = kr_prices.get(sym)
            if price is not None:
                commit_price(sym, price)

        # ─── KR Step 2: yfinance batch (FDR 미발견) ───
        kr_missing_after_fdr = [s for s in kr_symbols if s not in updated]
        if kr_missing_after_fdr:
            logger.info(
                "fetch_prices.kr_fdr_missing",
                count=len(kr_missing_after_fdr),
                sample=kr_missing_after_fdr[:5],
            )
            for i in range(0, len(kr_missing_after_fdr), BATCH_SIZE):
                chunk = kr_missing_after_fdr[i : i + BATCH_SIZE]
                try:
                    batch = fetch_closes_batch(chunk)
                except Exception as exc:
                    logger.warning(
                        "fetch_prices.kr_yf_batch_failed",
                        chunk_start=i,
                        error=str(exc),
                    )
                    continue
                for sym, close in batch.items():
                    commit_price(sym, close)

        # ─── KR Step 3: per-symbol history fallback (batch도 실패) ───
        kr_still_missing = [s for s in kr_symbols if s not in updated]
        if kr_still_missing:
            # 가장 stale한 종목 우선
            kr_still_missing.sort(key=lambda s: stale_score[s])
            target = kr_still_missing[:PER_SYMBOL_FALLBACK_LIMIT]
            logger.info(
                "fetch_prices.kr_per_symbol_fallback",
                target=len(target),
                skipped=len(kr_still_missing) - len(target),
            )
            kr_fallback_ok = 0
            for sym in target:
                price = _fetch_one_history(sym)
                if price is not None:
                    commit_price(sym, price)
                    kr_fallback_ok += 1
            logger.info(
                "fetch_prices.kr_per_symbol_done",
                ok=kr_fallback_ok,
                total=len(target),
            )

    # ─── US Step 1: yfinance batch ───
    if us_symbols:
        for i in range(0, len(us_symbols), BATCH_SIZE):
            chunk = us_symbols[i : i + BATCH_SIZE]
            try:
                batch = fetch_closes_batch(chunk)
            except Exception as exc:
                logger.warning(
                    "fetch_prices.us_batch_failed",
                    chunk_start=i,
                    error=str(exc),
                )
                continue
            for sym, close in batch.items():
                commit_price(sym, close)

        # ─── US Step 2: per-symbol history fallback ───
        us_missing = [s for s in us_symbols if s not in updated]
        if us_missing:
            us_missing.sort(key=lambda s: stale_score[s])
            target = us_missing[:PER_SYMBOL_FALLBACK_LIMIT]
            logger.info(
                "fetch_prices.us_per_symbol_fallback",
                target=len(target),
                skipped=len(us_missing) - len(target),
            )
            us_fallback_ok = 0
            for sym in target:
                price = _fetch_one_history(sym)
                if price is not None:
                    commit_price(sym, price)
                    us_fallback_ok += 1
            logger.info(
                "fetch_prices.us_per_symbol_done",
                ok=us_fallback_ok,
                total=len(target),
            )

    # ─── Final: 30일 이상 stale한 종목 → is_active=false (watchdog) ───
    # 일주일 이상 fetch 실패 = 상장폐지/이름 변경 가능성 → 비활성화로 noise 줄임
    cutoff = (datetime.now(UTC) - timedelta(days=30)).isoformat()
    try:
        stale_res = (
            supabase.table("stocks")
            .update({"is_active": False, "updated_at": now})
            .eq("is_active", True)
            .lt("last_price_at", cutoff)
            .execute()
        )
        n_deactivated = len(stale_res.data or [])
        if n_deactivated > 0:
            logger.warning(
                "fetch_prices.deactivated_stale",
                count=n_deactivated,
                cutoff_days=30,
            )
    except Exception as exc:
        logger.warning("fetch_prices.deactivate_failed", error=str(exc))

    logger.info(
        "fetch_prices.done",
        updated=len(updated),
        kr=len([s for s in updated if s.endswith((".KS", ".KQ"))]),
        us=len([s for s in updated if not s.endswith((".KS", ".KQ"))]),
        total_active=len(symbols),
    )


def _build_kr_price_map(logger: Any) -> dict[str, float]:
    """KOSPI + KOSDAQ FDR listing → {symbol: close} 매핑."""
    out: dict[str, float] = {}
    for market_name, suffix in (("KOSPI", ".KS"), ("KOSDAQ", ".KQ")):
        try:
            df = _fetch_listing(market_name)
        except Exception as exc:
            logger.warning(
                "fetch_prices.kr_listing_failed", market=market_name, error=str(exc)
            )
            continue
        if df is None or df.empty:
            continue
        for _, row in df.iterrows():
            code = str(row.get("Code", "")).strip()
            close = row.get("Close")
            if code and close is not None and close == close:
                out[f"{code}{suffix}"] = float(close)
    return out

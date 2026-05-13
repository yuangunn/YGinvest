"""One-shot enrichment: yfinance -> Cloud Supabase.

Bypasses Railway worker (slow auto-deploy). Run locally with uv.

Usage:
  cd apps/worker
  set CLOUD_URL=https://...supabase.co
  set CLOUD_KEY=<service_role>
  uv run python scripts/enrich_one_shot.py
"""
import io
import os
import sys
import time
from datetime import UTC, datetime

# Force UTF-8 stdout on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import yfinance as yf
from supabase import create_client

CLOUD_URL = os.environ.get("CLOUD_URL")
CLOUD_KEY = os.environ.get("CLOUD_KEY")
if not CLOUD_URL or not CLOUD_KEY:
    print("Set CLOUD_URL and CLOUD_KEY env vars")
    sys.exit(1)

supabase = create_client(CLOUD_URL, CLOUD_KEY)


def fetch_symbols_to_enrich(limit: int | None = None) -> list[str]:
    """sector가 비어있는 종목을 market_cap DESC로 우선 처리.

    이미 enrichment된 종목은 skip (idempotent). limit 지정 시 상위 N개만.
    """
    all_rows: list[dict] = []
    offset = 0
    while True:
        rows = (
            supabase.table("stocks")
            .select("symbol, market_cap, sector")
            .eq("is_active", True)
            .is_("sector", "null")
            .order("market_cap", desc=True, nullsfirst=False)
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
        if limit and len(all_rows) >= limit:
            break
    out = [r["symbol"] for r in all_rows]
    if limit:
        out = out[:limit]
    return out


# Backward compatibility alias
def fetch_all_symbols() -> list[str]:
    return fetch_symbols_to_enrich()


def enrich(symbol: str) -> dict | None:
    try:
        info = yf.Ticker(symbol).info or {}
    except Exception as exc:
        print(f"  {symbol}: fetch failed -{exc}")
        return None
    if not info:
        return None
    update: dict = {"updated_at": datetime.now(UTC).isoformat()}
    sector = info.get("sector")
    if sector:
        update["sector"] = sector
    # PER: trailingPE 우선, forwardPE fallback (KR 종목은 trailing이 종종 null)
    per = info.get("trailingPE")
    if per is None or not isinstance(per, (int, float)) or per <= 0 or per > 1000:
        per = info.get("forwardPE")
    if per is not None and isinstance(per, (int, float)) and 0 < per <= 1000:
        update["per"] = float(per)
    h52 = info.get("fiftyTwoWeekHigh")
    l52 = info.get("fiftyTwoWeekLow")
    if h52 is not None and l52 is not None:
        update["fifty_two_week_high"] = float(h52)
        update["fifty_two_week_low"] = float(l52)
    mcap = info.get("marketCap")
    if mcap and mcap > 0:
        update["market_cap"] = float(mcap)
    if len(update) <= 1:
        return None
    return update


def main():
    limit_str = os.environ.get("LIMIT")
    limit = int(limit_str) if limit_str else None
    symbols = fetch_symbols_to_enrich(limit=limit)
    print(f"Symbols to enrich (sector NULL): {len(symbols)} (limit={limit})")
    updated = 0
    failed = 0
    start = time.time()
    for idx, sym in enumerate(symbols):
        if (idx + 1) % 20 == 0:
            elapsed = time.time() - start
            rate = (idx + 1) / elapsed
            eta = (len(symbols) - idx - 1) / rate if rate > 0 else 0
            print(
                f"[{idx+1}/{len(symbols)}] updated={updated} failed={failed} "
                f"rate={rate:.1f}/s ETA={eta:.0f}s"
            )
        update = enrich(sym)
        if not update:
            failed += 1
            continue
        try:
            supabase.table("stocks").update(update).eq("symbol", sym).execute()
            updated += 1
            if updated <= 5:
                print(f"  OK {sym}: {list(update.keys())}")
        except Exception as exc:
            failed += 1
            print(f"  {sym}: update failed -{exc}")
    print(
        f"\nDONE -total={len(symbols)} updated={updated} failed={failed} "
        f"elapsed={time.time()-start:.0f}s"
    )


if __name__ == "__main__":
    main()

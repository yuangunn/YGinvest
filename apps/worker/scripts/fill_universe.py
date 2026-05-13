"""Universe 확장 one-shot script — KR KOSPI+KOSDAQ 전체 + US S&P 500 추가.

기존 stocks는 건드리지 않고 INSERT only (`on_conflict=do nothing`).

Usage:
  cd apps/worker
  set CLOUD_URL=https://...supabase.co
  set CLOUD_KEY=<service_role>
  uv run python scripts/fill_universe.py
"""
import io
import os
import sys
import time
from datetime import UTC, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import FinanceDataReader as fdr
from supabase import create_client

CLOUD_URL = os.environ.get("CLOUD_URL")
CLOUD_KEY = os.environ.get("CLOUD_KEY")
if not CLOUD_URL or not CLOUD_KEY:
    print("Set CLOUD_URL and CLOUD_KEY env vars")
    sys.exit(1)

supabase = create_client(CLOUD_URL, CLOUD_KEY)


def _is_nan(x) -> bool:
    return x is None or (isinstance(x, float) and x != x)


def existing_symbols() -> set[str]:
    all_syms: set[str] = set()
    offset = 0
    while True:
        rows = (
            supabase.table("stocks")
            .select("symbol")
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        if not rows:
            break
        all_syms.update(r["symbol"] for r in rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return all_syms


def fetch_kr_market(market_name: str, suffix: str, market_enum: str) -> list[dict]:
    """KOSPI 또는 KOSDAQ 전체 listing."""
    print(f"Fetching {market_name}...")
    df = fdr.StockListing(market_name)
    if df is None or df.empty:
        print("  empty result")
        return []
    df = df.sort_values("Marcap", ascending=False)
    out: list[dict] = []
    for _, row in df.iterrows():
        code = str(row.get("Code", "")).strip()
        name = str(row.get("Name", "")).strip()
        marcap = float(row.get("Marcap", 0) or 0)
        close = row.get("Close")
        close_val = (
            float(close) if close is not None and not _is_nan(close) else None
        )
        if not code or not name:
            continue
        out.append(
            {
                "symbol": f"{code}{suffix}",
                "market": market_enum,
                "currency": "KRW",
                "name": name,
                "name_ko": name,
                "market_cap": marcap if marcap > 0 else None,
                "last_price": close_val,
                "is_active": True,
            }
        )
    print(f"  {market_name}: {len(out)} listings")
    return out


def fetch_sp500() -> list[dict]:
    """S&P 500 + NASDAQ 100 합쳐 dedupe."""
    print("Fetching S&P 500 + NASDAQ 100...")
    all_rows: dict[str, dict] = {}

    for listing_name, default_market in (
        ("S&P500", "NYSE"),
        ("NASDAQ100", "NASDAQ"),
    ):
        try:
            df = fdr.StockListing(listing_name)
        except Exception as exc:
            print(f"  {listing_name} failed: {exc}")
            continue
        if df is None or df.empty:
            continue
        for _, row in df.iterrows():
            symbol = str(row.get("Symbol", "")).strip()
            name = str(row.get("Name") or row.get("Korean Name") or symbol).strip()
            if not symbol or symbol in all_rows:
                continue
            # market 추정: ticker가 일반적으로 NYSE/NASDAQ 구분 어려움
            # default_market 사용 (NASDAQ100이면 NASDAQ, S&P500이면 NYSE 우선)
            all_rows[symbol] = {
                "symbol": symbol,
                "market": default_market,
                "currency": "USD",
                "name": name,
                "name_ko": None,
                "is_active": True,
            }
    out = list(all_rows.values())
    print(f"  US merged: {len(out)} unique tickers")
    return out


def main():
    now_iso = datetime.now(UTC).isoformat()
    existing = existing_symbols()
    print(f"\nExisting in DB: {len(existing)} stocks\n")

    candidates: list[dict] = []
    candidates += fetch_kr_market("KOSPI", ".KS", "KRX_KS")
    candidates += fetch_kr_market("KOSDAQ", ".KQ", "KRX_KQ")
    candidates += fetch_sp500()

    # de-dupe by symbol, skip existing
    seen: set[str] = set()
    new_records: list[dict] = []
    for r in candidates:
        s = r["symbol"]
        if s in seen or s in existing:
            continue
        seen.add(s)
        r["updated_at"] = now_iso
        if r.get("last_price") is not None:
            r["last_price_at"] = now_iso
        new_records.append(r)

    print(f"\nTotal candidates: {len(candidates)} (raw)")
    print(f"New (not in DB): {len(new_records)}\n")

    if not new_records:
        print("Nothing to insert.")
        return

    # INSERT in chunks (Supabase REST has request size limits)
    chunk_size = 200
    inserted = 0
    failed_chunks = 0
    start = time.time()
    for i in range(0, len(new_records), chunk_size):
        chunk = new_records[i:i + chunk_size]
        try:
            supabase.table("stocks").upsert(chunk, on_conflict="symbol").execute()
            inserted += len(chunk)
            print(f"[{i+len(chunk)}/{len(new_records)}] +{len(chunk)} OK")
        except Exception as exc:
            failed_chunks += 1
            print(f"[{i+len(chunk)}/{len(new_records)}] chunk failed: {exc}")

    print(
        f"\nDONE - inserted {inserted}/{len(new_records)} "
        f"failed_chunks={failed_chunks} elapsed={time.time()-start:.0f}s"
    )


if __name__ == "__main__":
    main()

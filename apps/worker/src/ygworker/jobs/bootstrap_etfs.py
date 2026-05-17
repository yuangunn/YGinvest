"""Plan #32: ETF bootstrap — 큐레이션 50개 + KR 거래량 상위 자동 수집.

부팅 시 1회 + 매일 새벽 1회 갱신.

데이터 소스:
1. etf_master.ALL_ETFS — 수동 큐레이션 50개 (KR 30 + US 20)
2. FDR `fdr.StockListing('ETF/KR')` — 한국 ETF 전체 리스트.
   거래량/시가총액 상위 N개 자동 추가.

upsert: 이미 존재하는 종목은 instrument_type='etf' + fund_family/category 등 갱신.
가격은 fetch_prices(또는 enrich)이 별도 fetch.
"""
from datetime import UTC, datetime
from typing import Any

import FinanceDataReader as fdr  # noqa: N813

from ygworker.data_sources.etf_master import ALL_ETFS, EtfMasterEntry

# KR ETF 자동 수집 — 거래량 또는 시가총액 상위 N개
KR_AUTO_TOP_N = 50


def run_bootstrap_etfs(supabase: Any, logger: Any) -> dict[str, int]:
    """ETF 마스터 prefetch.

    Step 1: 큐레이션 50개 (KR_ETFS + US_ETFS) upsert
    Step 2: FDR ETF/KR 리스팅에서 거래량 상위 N개 자동 추가
            (이미 있는 종목은 skip — 큐레이션 우선)
    """
    now_iso = datetime.now(UTC).isoformat()
    inserted_curated = 0
    inserted_auto = 0

    # ───── Step 1: 큐레이션 ETF 50개 ─────────────────────────────
    curated_records: list[dict] = []
    for entry in ALL_ETFS:
        curated_records.append(
            _entry_to_record(entry, now_iso)
        )

    if curated_records:
        try:
            supabase.table("stocks").upsert(
                curated_records, on_conflict="symbol"
            ).execute()
            inserted_curated = len(curated_records)
            logger.info(
                "bootstrap_etfs.curated_upserted",
                count=inserted_curated,
            )
        except Exception as exc:
            logger.error("bootstrap_etfs.curated_failed", error=str(exc))

    # ───── Step 2: KR ETF 자동 수집 (FDR) ───────────────────────
    try:
        df = fdr.StockListing("ETF/KR")
    except Exception as exc:
        logger.warning("bootstrap_etfs.kr_listing_failed", error=str(exc))
        df = None

    if df is not None and not df.empty:
        # 거래량 또는 시가총액 컬럼 확인 (FDR 버전마다 컬럼명 다름)
        # 일반적으로: 'Symbol'/'Code', 'Name', 'Close', 'Volume', 'Marcap' 정도
        sort_col = None
        for candidate in ("Marcap", "MarketCap", "Volume", "Amount"):
            if candidate in df.columns:
                sort_col = candidate
                break

        if sort_col:
            df_sorted = df.sort_values(sort_col, ascending=False).head(KR_AUTO_TOP_N)
        else:
            df_sorted = df.head(KR_AUTO_TOP_N)

        # 큐레이션에 이미 있는 심볼은 skip
        curated_symbols = {e.symbol for e in ALL_ETFS}
        auto_records: list[dict] = []

        for _, row in df_sorted.iterrows():
            code = str(row.get("Symbol") or row.get("Code") or "").strip()
            name = str(row.get("Name") or "").strip()
            if not code or not name:
                continue

            # Plan #34: FDR ETF/KR listing의 Symbol 컬럼이 가끔 "KODEX"/"TIGER"
            # 같은 운용사 prefix를 반환하는 버그 — 6자리 숫자(+ optional suffix)만
            # 통과시켜 stocks 테이블 오염 방지.
            bare_code = code.removesuffix(".KS").removesuffix(".KQ")
            if not (bare_code.isdigit() and len(bare_code) == 6):
                logger.debug(
                    "bootstrap_etfs.invalid_code_skip", code=code, name=name
                )
                continue

            # KR ETF는 보통 .KS suffix (KOSPI 상장)
            symbol = code if code.endswith((".KS", ".KQ")) else f"{code}.KS"
            if symbol in curated_symbols:
                continue

            close = row.get("Close")
            close_val = (
                float(close) if close is not None and close == close else None
            )
            marcap = row.get("Marcap") or row.get("MarketCap")
            marcap_val = (
                float(marcap) if marcap is not None and marcap == marcap else None
            )

            auto_records.append({
                "symbol": symbol,
                "market": "KRX_KS",  # ETF는 거의 다 KOSPI
                "currency": "KRW",
                "name": name,
                "name_ko": name,
                "instrument_type": "etf",
                "last_price": close_val,
                "last_price_at": now_iso if close_val is not None else None,
                "market_cap": marcap_val,
                "is_active": True,
                "updated_at": now_iso,
            })

        if auto_records:
            try:
                # auto 발견된 ETF는 중복 시 skip하되 instrument_type만 갱신.
                # 큐레이션이 항상 우선이라 큐레이션 필드는 덮어쓰기 X.
                supabase.table("stocks").upsert(
                    auto_records, on_conflict="symbol", ignore_duplicates=False
                ).execute()
                inserted_auto = len(auto_records)
                logger.info(
                    "bootstrap_etfs.auto_upserted",
                    count=inserted_auto,
                    sort_col=sort_col,
                )
            except Exception as exc:
                logger.error("bootstrap_etfs.auto_failed", error=str(exc))
    else:
        logger.info("bootstrap_etfs.kr_listing_empty")

    result = {
        "curated": inserted_curated,
        "auto": inserted_auto,
        "total": inserted_curated + inserted_auto,
    }
    logger.info("bootstrap_etfs.done", **result)
    return result


def _entry_to_record(entry: EtfMasterEntry, now_iso: str) -> dict:
    """큐레이션 entry → stocks upsert record."""
    return {
        "symbol": entry.symbol,
        "market": entry.market,
        "currency": entry.currency,
        "name": entry.name_en,
        "name_ko": entry.name_ko,
        "instrument_type": "etf",
        "etf_category": entry.category,
        "fund_family": entry.fund_family,
        "underlying_index": entry.underlying_index,
        "is_active": True,
        "updated_at": now_iso,
    }

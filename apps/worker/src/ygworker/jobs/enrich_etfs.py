"""Plan #32: ETF 메타 enrichment — yfinance에서 expense_ratio / aum / holdings fetch.

매일 1회 (KR 장 시작 전, enrich_stock_info 직후) 실행.

수집 필드:
- expense_ratio: info['annualReportExpenseRatio'] 또는 info['fundFamily']['expenseRatio']
- aum (Total Net Assets): info['totalAssets']
- inception_date: info['fundInceptionDate'] (unix timestamp)
- holdings: Ticker(...).funds_data.top_holdings (DataFrame)

yfinance가 ETF별로 데이터 가용성이 다름:
- US 대형 ETF (SPY, QQQ, VOO): 거의 모든 필드 OK
- KR ETF (069500.KS 등): 기본 메타만, holdings는 거의 없음
- 일부 leveraged/inverse ETF: holdings 정보 X
"""
from datetime import UTC, datetime
from typing import Any

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def _fetch_etf_info(symbol: str) -> tuple[dict, Any]:
    """yfinance Ticker.info + funds_data를 retry 래핑."""
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}
    return info, ticker


def run_enrich_etfs(supabase: Any, logger: Any, batch_size: int = 20) -> dict[str, int]:
    """모든 ETF의 expense_ratio/aum/inception_date + holdings 갱신."""
    rows = (
        supabase.table("stocks")
        .select("symbol, currency")
        .eq("instrument_type", "etf")
        .eq("is_active", True)
        .execute()
        .data
        or []
    )

    if not rows:
        logger.info("enrich_etfs.skip", reason="no_etfs")
        return {"total": 0, "updated_meta": 0, "updated_holdings": 0}

    logger.info("enrich_etfs.start", count=len(rows))
    now_iso = datetime.now(UTC).isoformat()

    updated_meta = 0
    updated_holdings = 0
    failed = 0

    for idx, row in enumerate(rows):
        symbol = row["symbol"]
        try:
            info, ticker = _fetch_etf_info(symbol)
        except Exception as exc:
            failed += 1
            logger.debug("enrich_etfs.fetch_failed", symbol=symbol, error=str(exc))
            continue

        if not info:
            failed += 1
            continue

        # ───── meta 업데이트 ─────────────────────────────────
        update: dict[str, Any] = {"updated_at": now_iso}

        # expense_ratio: yfinance ETF info에서 직접 가져오기
        # 'netExpenseRatio'는 0.0945처럼 소수로 반환 (또는 9.45같이 % 단위일 수 있음)
        exp = info.get("netExpenseRatio") or info.get("annualReportExpenseRatio")
        if exp is not None and isinstance(exp, (int, float)) and exp > 0:
            # 1보다 크면 % 단위로 들어온 것 → 100으로 나눔
            exp_normalized = exp / 100 if exp > 1 else exp
            if 0 < exp_normalized < 0.2:  # 합리적 범위 (0~20%)
                update["expense_ratio"] = round(exp_normalized, 4)

        # AUM (Total Net Assets)
        aum = info.get("totalAssets")
        if aum is not None and isinstance(aum, (int, float)) and aum > 0:
            update["aum"] = float(aum)

        # inception_date: unix timestamp → date
        incept = info.get("fundInceptionDate")
        if incept is not None and isinstance(incept, (int, float)) and incept > 0:
            try:
                from datetime import date
                incept_date = date.fromtimestamp(incept)
                update["inception_date"] = incept_date.isoformat()
            except (ValueError, OSError):
                pass

        # underlying_index가 비어있으면 info['category']에서 가져오기 시도
        cat = info.get("category")
        if cat and isinstance(cat, str):
            # 기존 underlying_index가 NULL이면 채움 (큐레이션 우선)
            current = (
                supabase.table("stocks")
                .select("underlying_index")
                .eq("symbol", symbol)
                .maybeSingle()
                .execute()
                .data
            )
            if current and not current.get("underlying_index"):
                update["underlying_index"] = cat

        if len(update) > 1:  # updated_at 외에 갱신할 게 있음
            try:
                supabase.table("stocks").update(update).eq("symbol", symbol).execute()
                updated_meta += 1
            except Exception as exc:
                logger.debug(
                    "enrich_etfs.update_meta_failed", symbol=symbol, error=str(exc)
                )

        # ───── holdings 업데이트 ─────────────────────────────
        try:
            holdings_data = _fetch_holdings(ticker, symbol)
        except Exception as exc:
            holdings_data = []
            logger.debug(
                "enrich_etfs.holdings_fetch_failed", symbol=symbol, error=str(exc)
            )

        if holdings_data:
            # 기존 holdings 삭제 후 재삽입 (rank 변경 가능)
            try:
                supabase.table("etf_holdings").delete().eq(
                    "etf_symbol", symbol
                ).execute()

                holding_records: list[dict] = []
                for rank, h in enumerate(holdings_data[:20], 1):  # Top 20까지
                    holding_records.append({
                        "etf_symbol": symbol,
                        "rank": rank,
                        "holding_symbol": h.get("symbol"),  # NULL 가능
                        "holding_name": h["name"],
                        "weight": round(h["weight"], 4),
                        "updated_at": now_iso,
                    })

                if holding_records:
                    supabase.table("etf_holdings").insert(holding_records).execute()
                    updated_holdings += 1
            except Exception as exc:
                logger.debug(
                    "enrich_etfs.holdings_update_failed",
                    symbol=symbol,
                    error=str(exc),
                )

        if (idx + 1) % batch_size == 0:
            logger.info(
                "enrich_etfs.progress",
                done=idx + 1,
                total=len(rows),
                updated_meta=updated_meta,
                updated_holdings=updated_holdings,
                failed=failed,
            )

    result = {
        "total": len(rows),
        "updated_meta": updated_meta,
        "updated_holdings": updated_holdings,
        "failed": failed,
    }
    logger.info("enrich_etfs.done", **result)
    return result


def _fetch_holdings(ticker: Any, symbol: str) -> list[dict]:
    """yfinance Ticker → top holdings 추출.

    Returns: list of {symbol, name, weight} dicts. 비어있으면 [].

    yfinance 0.2.x: ticker.funds_data.top_holdings (DataFrame)
                    columns: ['Holding Name', 'Symbol'], index: weight
    """
    try:
        funds_data = getattr(ticker, "funds_data", None)
        if funds_data is None:
            return []

        top_holdings = getattr(funds_data, "top_holdings", None)
        if top_holdings is None or top_holdings.empty:
            return []

        out: list[dict] = []
        for _, row in top_holdings.iterrows():
            # DataFrame 구조가 yfinance 버전마다 다를 수 있음 — 안전하게 추출
            name = (
                row.get("Holding Name")
                or row.get("name")
                or row.get("Name")
                or ""
            )
            holding_sym = (
                row.get("Symbol") or row.get("symbol") or None
            )
            if isinstance(holding_sym, str):
                holding_sym = holding_sym.strip() or None

            # weight는 보통 index에 있거나 'Holding Percent' 컬럼
            weight = row.get("Holding Percent") or row.get("weight") or row.get("Weight")
            if weight is None:
                continue
            try:
                weight_val = float(weight)
                # %로 들어오면 100으로 나눔
                if weight_val > 1:
                    weight_val = weight_val / 100
            except (ValueError, TypeError):
                continue

            if not name or weight_val <= 0:
                continue

            out.append({
                "symbol": holding_sym,
                "name": str(name)[:200],  # name 컬럼 길이 제한
                "weight": weight_val,
            })

        return out
    except Exception:
        return []

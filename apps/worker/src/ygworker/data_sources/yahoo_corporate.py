"""yfinance corporate actions: dividends + splits/merges.

KR 종목(`.KS`/`.KQ` suffix)도 yfinance가 그대로 받음. FDR과 달리 suffix
필요. KR 배당은 yfinance가 한국 거래소 ex-date를 정확히 알고 있는 종목만
지원 (모든 종목 X — yfinance 한계).
"""

from datetime import date
from typing import Any

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_dividends(symbol: str, today: date) -> list[dict]:
    """yfinance Ticker.dividends에서 ex_date >= today인 행만 반환.

    Returns: list of {ex_date: date, amount_per_share: float}
    """
    series = yf.Ticker(symbol).dividends
    if series is None or len(series) == 0:
        return []

    out: list[dict] = []
    for ts, amount in series.items():
        try:
            ex_date = _ts_to_date(ts)
            if ex_date < today:
                continue
            amount_f = float(amount)
            if amount_f <= 0 or _is_nan(amount_f):
                continue
            out.append({"ex_date": ex_date, "amount_per_share": amount_f})
        except (ValueError, TypeError):
            continue
    return out


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_splits(symbol: str, today: date) -> list[dict]:
    """yfinance Ticker.splits에서 ex_date >= today + ratio != 1 행만 반환.

    Returns: list of {ex_date: date, ratio: float, action_type: 'split'|'reverse_split'}
    """
    series = yf.Ticker(symbol).splits
    if series is None or len(series) == 0:
        return []

    out: list[dict] = []
    for ts, ratio in series.items():
        try:
            ex_date = _ts_to_date(ts)
            if ex_date < today:
                continue
            ratio_f = float(ratio)
            if ratio_f <= 0 or ratio_f == 1.0 or _is_nan(ratio_f):
                continue
            out.append(
                {
                    "ex_date": ex_date,
                    "ratio": ratio_f,
                    "action_type": "split" if ratio_f > 1 else "reverse_split",
                }
            )
        except (ValueError, TypeError):
            continue
    return out


def _ts_to_date(value: Any) -> date:
    if hasattr(value, "date"):
        return value.date()
    return value


def _is_nan(value: Any) -> bool:
    try:
        return value != value
    except Exception:
        return False

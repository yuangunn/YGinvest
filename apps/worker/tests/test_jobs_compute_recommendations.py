from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from ygworker.jobs.compute_recommendations import (
    _compute_change_pct,
    _compute_volume_ratio,
    run_compute_recommendations,
)


def test_change_pct_positive():
    # 100 → 110: +10%
    assert abs(_compute_change_pct(today=110, prev=100) - 0.10) < 1e-9


def test_change_pct_negative():
    # 100 → 90: -10%
    assert abs(_compute_change_pct(today=90, prev=100) - (-0.10)) < 1e-9


def test_change_pct_zero_prev_returns_zero():
    # 분모 0 보호
    assert _compute_change_pct(today=10, prev=0) == 0.0


def test_volume_ratio_3x():
    # today 300, 5d avg 100 → 3.0
    assert _compute_volume_ratio(today=300, prev_5d=[100, 100, 100, 100, 100]) == 3.0


def test_volume_ratio_zero_avg_returns_zero():
    assert _compute_volume_ratio(today=500, prev_5d=[0, 0]) == 0.0


def _bars(symbol, today_close, prev_closes, today_vol, prev_vols):
    today = datetime.now(UTC).date()
    out = [
        {
            "symbol": symbol,
            "ts": today.isoformat(),
            "close": today_close,
            "volume": today_vol,
        }
    ]
    for i, (c, v) in enumerate(zip(prev_closes, prev_vols, strict=False)):
        d = today - timedelta(days=i + 1)
        out.append(
            {"symbol": symbol, "ts": d.isoformat(), "close": c, "volume": v}
        )
    return out


def test_run_compute_writes_recommendations_after_delete():
    """워커가 추천 테이블을 atomic 갱신: DELETE all → INSERT new."""
    fake = MagicMock()

    stocks_data = [
        {
            "symbol": "005930.KS", "currency": "KRW", "market": "KRX_KS",
            "last_price": 285500, "market_cap": 1_700_000_000_000_000,
            "per": 10.5, "fifty_two_week_high": 290000,
        },
        {
            "symbol": "AAPL", "currency": "USD", "market": "NASDAQ",
            "last_price": 200, "market_cap": 3_000_000_000_000,
            "per": 32.0, "fifty_two_week_high": 220,
        },
    ]
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        stocks_data
    )

    bars_data = (
        _bars(
            "005930.KS", 285500, [260000, 258000, 255000, 257000, 260000],
            500_000_000, [100_000_000] * 5,  # 5x volume — surge!
        )
        + _bars(
            "AAPL", 200, [180, 178, 175, 177, 179],
            50_000_000, [20_000_000] * 5,  # 2.5x — below 3.0 threshold
        )
    )
    # 페이지네이션: 첫 .range() 호출엔 모든 데이터, 두 번째엔 빈 결과
    bars_chain = (
        fake.table.return_value.select.return_value.gte.return_value.in_.return_value.range.return_value.execute
    )
    bars_chain.side_effect = [
        MagicMock(data=bars_data),
        MagicMock(data=[]),
    ]

    logger = MagicMock()
    run_compute_recommendations(fake, logger)

    # DELETE 호출 확인
    delete_calls = fake.table.return_value.delete.call_args_list
    assert len(delete_calls) >= 1

    # INSERT 호출 확인
    insert_calls = fake.table.return_value.insert.call_args_list
    inserted = []
    for c in insert_calls:
        rows = c.args[0] if c.args else []
        inserted.extend(rows)

    categories = {r["category"] for r in inserted}
    assert "top_gainers" in categories
    assert "volume_surge" in categories  # KR 5x volume

    # 005930.KS는 +9.8% (285500/260000 - 1) → top_gainers KR에 포함
    kr_gainers = [
        r for r in inserted
        if r["category"] == "top_gainers" and r["market_scope"] == "KR"
    ]
    assert any(r["symbol"] == "005930.KS" for r in kr_gainers)

    # 005930.KS는 5x volume → volume_surge KR에 포함
    kr_surge = [
        r for r in inserted
        if r["category"] == "volume_surge" and r["market_scope"] == "KR"
    ]
    assert any(r["symbol"] == "005930.KS" for r in kr_surge)

    # AAPL 2.5x는 3.0 미만 → US volume_surge에서 제외
    us_surge = [
        r for r in inserted
        if r["category"] == "volume_surge" and r["market_scope"] == "US"
    ]
    assert all(r["symbol"] != "AAPL" for r in us_surge)


def test_run_compute_skips_when_no_stocks():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_compute_recommendations(fake, logger)

    fake.table.return_value.delete.assert_not_called()
    logger.info.assert_called_with(
        "compute_recommendations.skip", reason="no_stocks"
    )

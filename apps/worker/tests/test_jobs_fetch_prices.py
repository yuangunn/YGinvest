from unittest.mock import MagicMock, patch

import pandas as pd

from ygworker.jobs.fetch_prices import run_fetch_prices

# Plan #47.2 이후 파이프라인:
#   KR: FDR listing(_fetch_listing) → yfinance batch(fetch_closes_batch)
#       → per-symbol(_fetch_one_history)
#   US: yfinance batch(fetch_closes_batch) → per-symbol(_fetch_one_history)
# 종목 목록은 _load_all_active_stocks 가 .range() 로 페이지네이션해서 읽는다.


def _fake_with_stocks(rows: list[dict]) -> MagicMock:
    fake = MagicMock()
    chain = (
        fake.table.return_value.select.return_value.eq.return_value.order.return_value
        .range.return_value.execute
    )
    chain.return_value.data = rows
    # stale 비활성화 update 는 빈 결과
    stale_chain = fake.table.return_value.update.return_value.eq.return_value.lt.return_value
    stale_chain.execute.return_value.data = []
    return fake


def _price_updates(fake: MagicMock) -> dict[str, float]:
    """stocks.update({...last_price...}).eq("symbol", sym) 호출을 {sym: price} 로 모은다."""
    out: dict[str, float] = {}
    update = fake.table.return_value.update
    eq_calls = update.return_value.eq.call_args_list
    for call, eq_call in zip(update.call_args_list, eq_calls, strict=False):
        payload = call.args[0] if call.args else call.kwargs
        if "last_price" in payload:
            assert "last_price_at" in payload
            out[eq_call.args[1]] = payload["last_price"]
    return out


@patch("ygworker.jobs.fetch_prices._fetch_one_history")
@patch("ygworker.jobs.fetch_prices.fetch_closes_batch")
@patch("ygworker.jobs.fetch_prices._fetch_listing")
def test_fetch_prices_updates_kr_via_fdr_and_us_via_batch(mock_listing, mock_batch, mock_hist):
    fake = _fake_with_stocks(
        [
            {"symbol": "005930.KS", "last_price_at": None},
            {"symbol": "000660.KS", "last_price_at": None},
            {"symbol": "AAPL", "last_price_at": None},
        ]
    )
    mock_listing.side_effect = [
        pd.DataFrame({"Code": ["005930", "000660"], "Close": [268500.0, 1686000.0]}),
        pd.DataFrame(),  # KOSDAQ 빈
    ]
    mock_batch.return_value = {"AAPL": 158.5}
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    prices = _price_updates(fake)
    assert prices == {"005930.KS": 268500.0, "000660.KS": 1686000.0, "AAPL": 158.5}
    # KR 은 FDR 로 전부 찾았으므로 batch 는 US 1회만, per-symbol fallback 은 없음
    assert mock_batch.call_count == 1
    assert mock_batch.call_args.args[0] == ["AAPL"]
    mock_hist.assert_not_called()


@patch("ygworker.jobs.fetch_prices._fetch_one_history")
@patch("ygworker.jobs.fetch_prices.fetch_closes_batch")
@patch("ygworker.jobs.fetch_prices._fetch_listing")
def test_fetch_prices_handles_empty_universe(mock_listing, mock_batch, mock_hist):
    fake = _fake_with_stocks([])
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    mock_listing.assert_not_called()
    mock_batch.assert_not_called()
    mock_hist.assert_not_called()
    logger.info.assert_called_with("fetch_prices.skip", reason="no_active_symbols")


@patch("ygworker.jobs.fetch_prices._fetch_one_history")
@patch("ygworker.jobs.fetch_prices.fetch_closes_batch")
@patch("ygworker.jobs.fetch_prices._fetch_listing")
def test_fetch_prices_falls_back_per_symbol_and_skips_failures(mock_listing, mock_batch, mock_hist):
    fake = _fake_with_stocks(
        [
            {"symbol": "AAPL", "last_price_at": None},
            {"symbol": "BAD", "last_price_at": None},
        ]
    )
    mock_batch.return_value = {"AAPL": 158.5}  # BAD 는 batch 에서 누락
    mock_hist.return_value = None  # per-symbol 도 실패
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    assert _price_updates(fake) == {"AAPL": 158.5}
    mock_hist.assert_called_once_with("BAD")

from unittest.mock import MagicMock, patch

import pandas as pd

from ygworker.jobs.fetch_prices import run_fetch_prices


@patch("ygworker.jobs.fetch_prices.fetch_us_close")
@patch("ygworker.jobs.fetch_prices._fetch_listing")
def test_fetch_prices_updates_kr_via_batch_and_us_per_symbol(mock_listing, mock_us):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "005930.KS"},
        {"symbol": "000660.KS"},
        {"symbol": "AAPL"},
    ]
    mock_listing.side_effect = [
        pd.DataFrame({"Code": ["005930", "000660"], "Close": [268500.0, 1686000.0]}),
        pd.DataFrame(),  # KOSDAQ 빈
    ]
    mock_us.return_value = 158.5
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    update_calls = fake.table.return_value.update.call_args_list
    assert len(update_calls) == 3
    payloads = [c.args[0] if c.args else c.kwargs for c in update_calls]
    assert all("last_price" in p and "last_price_at" in p for p in payloads)
    # KR/US 모두 업데이트
    update_prices = [p["last_price"] for p in payloads]
    assert 268500.0 in update_prices
    assert 158.5 in update_prices


@patch("ygworker.jobs.fetch_prices.fetch_us_close")
@patch("ygworker.jobs.fetch_prices._fetch_listing")
def test_fetch_prices_handles_empty_universe(mock_listing, mock_us):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    mock_listing.assert_not_called()
    mock_us.assert_not_called()
    logger.info.assert_called_with("fetch_prices.skip", reason="no_active_symbols")


@patch("ygworker.jobs.fetch_prices.fetch_us_close")
@patch("ygworker.jobs.fetch_prices._fetch_listing")
def test_fetch_prices_skips_us_failures(mock_listing, mock_us):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"},
        {"symbol": "BAD"},
    ]
    mock_us.side_effect = [158.5, RuntimeError("rate limited")]
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    update_calls = fake.table.return_value.update.call_args_list
    # AAPL만 update, BAD는 skip
    assert len(update_calls) == 1

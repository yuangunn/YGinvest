from unittest.mock import MagicMock, patch

from ygworker.data_sources.yahoo import YahooQuote
from ygworker.jobs.fetch_prices import run_fetch_prices


def _yq(symbol, price=100.0, market="NASDAQ", currency="USD"):
    return YahooQuote(
        symbol=symbol,
        name=f"{symbol} Corp",
        currency=currency,
        market=market,
        price=price,
        market_cap=None,
        per=None,
        sector=None,
        fifty_two_week_high=None,
        fifty_two_week_low=None,
    )


@patch("ygworker.jobs.fetch_prices.fetch_quotes")
def test_fetch_prices_updates_active_stocks(mock_fetch):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"},
        {"symbol": "MSFT"},
        {"symbol": "005930.KS"},
    ]
    mock_fetch.return_value = [
        _yq("AAPL", 158.5),
        _yq("MSFT", 380.0),
        _yq("005930.KS", 70000.0, "KRX_KS", "KRW"),
    ]
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    mock_fetch.assert_called_once_with(["AAPL", "MSFT", "005930.KS"])
    update_calls = fake.table.return_value.update.call_args_list
    assert len(update_calls) == 3
    updated_payload = [c.args[0] if c.args else c.kwargs for c in update_calls]
    assert all("last_price" in p and "last_price_at" in p for p in updated_payload)


@patch("ygworker.jobs.fetch_prices.fetch_quotes")
def test_fetch_prices_handles_empty_universe(mock_fetch):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    mock_fetch.assert_not_called()
    logger.info.assert_called_with("fetch_prices.skip", reason="no_active_symbols")


@patch("ygworker.jobs.fetch_prices.fetch_quotes")
def test_fetch_prices_skips_failed_quotes(mock_fetch):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"},
        {"symbol": "BAD_SYMBOL"},
    ]
    # fetch_quotes는 실패한 심볼은 자동 누락
    mock_fetch.return_value = [_yq("AAPL", 158.5)]
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    update_calls = fake.table.return_value.update.call_args_list
    assert len(update_calls) == 1
    # 업데이트된 건 AAPL뿐. BAD_SYMBOL는 update 호출 없음

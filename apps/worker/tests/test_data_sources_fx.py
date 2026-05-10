import re

import pytest
from pytest_httpx import HTTPXMock

from ygworker.data_sources.fx import fetch_usd_krw_rate


def test_fetch_usd_krw_rate_success(httpx_mock: HTTPXMock):
    # URL 기반(query string 순서 무관)이 아니라 host+path만 매칭
    httpx_mock.add_response(
        url=re.compile(r"^https://api\.exchangerate\.host/latest"),
        json={"rates": {"KRW": 1395.42}, "base": "USD"},
    )
    rate = fetch_usd_krw_rate()
    assert rate == 1395.42


def test_fetch_usd_krw_rate_retries_on_failure(httpx_mock: HTTPXMock):
    # 첫 두 번 500, 세 번째 성공
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(json={"rates": {"KRW": 1400.0}, "base": "USD"})
    rate = fetch_usd_krw_rate()
    assert rate == 1400.0


def test_fetch_usd_krw_rate_raises_after_3_failures(httpx_mock: HTTPXMock):
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(status_code=500)
    with pytest.raises(Exception):  # noqa: B017 — tenacity wraps in RetryError
        fetch_usd_krw_rate()

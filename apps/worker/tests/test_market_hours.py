from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from ygworker.market_hours import (
    is_any_market_open,
    is_kr_market_open,
    is_kr_open_extended,
    is_us_market_open,
    kr_session_label,
)

KST = ZoneInfo("Asia/Seoul")


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        ("2026-05-11T09:30:00+09:00", True),   # 월요일 09:30 KST 장중
        ("2026-05-11T15:29:00+09:00", True),   # 월요일 15:29 장중
        ("2026-05-11T15:31:00+09:00", False),  # 월요일 15:31 마감
        ("2026-05-11T08:59:00+09:00", False),  # 월요일 08:59 개장 전
        ("2026-05-09T10:00:00+09:00", False),  # 토요일 → 휴장
        ("2026-05-10T10:00:00+09:00", False),  # 일요일 → 휴장
    ],
)
def test_is_kr_market_open(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert is_kr_market_open(ts) is expected


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        # 미국 장은 ET 09:30-16:00. KST는 +13(서머타임) 또는 +14(표준시) 차이
        # 2026-05 → 서머타임. ET 09:30 = KST 22:30
        ("2026-05-11T22:30:00+09:00", True),   # 월요일(미국 시각) 09:30 ET
        ("2026-05-11T23:00:00+09:00", True),
        ("2026-05-12T05:00:00+09:00", True),
        ("2026-05-12T06:00:00+09:00", False),  # 16:00 ET 마감
        # 토/일 KST가 아니라 미국 토/일 기준이어야 함. KST 일요일 02:00 = ET 토요일 13:00 → 휴장
        ("2026-05-10T02:00:00+09:00", False),
    ],
)
def test_is_us_market_open(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert is_us_market_open(ts) is expected


def test_is_any_market_open_kr_only():
    ts = datetime(2026, 5, 11, 10, 0, tzinfo=KST)
    assert is_any_market_open(ts) is True


def test_is_any_market_open_neither():
    ts = datetime(2026, 5, 9, 12, 0, tzinfo=KST)  # 토요일 정오 KST
    assert is_any_market_open(ts) is False


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        # 프리마켓 08:00-08:50
        ("2026-05-11T08:00:00+09:00", True),
        ("2026-05-11T08:30:00+09:00", True),
        ("2026-05-11T08:49:00+09:00", True),
        ("2026-05-11T08:50:00+09:00", False),  # 휴장 시작
        ("2026-05-11T08:55:00+09:00", False),
        # 정규장 09:00-15:20
        ("2026-05-11T09:00:00+09:00", True),
        ("2026-05-11T12:00:00+09:00", True),
        ("2026-05-11T15:19:00+09:00", True),
        ("2026-05-11T15:20:00+09:00", False),  # 휴장 시작
        ("2026-05-11T15:25:00+09:00", False),
        # 애프터마켓 15:30-20:00
        ("2026-05-11T15:30:00+09:00", True),
        ("2026-05-11T18:00:00+09:00", True),
        ("2026-05-11T19:59:00+09:00", True),
        ("2026-05-11T20:00:00+09:00", False),  # 마감
        # 주말은 False
        ("2026-05-09T10:00:00+09:00", False),
        # 07:59 — 프리마켓 전
        ("2026-05-11T07:59:00+09:00", False),
    ],
)
def test_is_kr_open_extended(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert is_kr_open_extended(ts) is expected


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        ("2026-05-11T08:30:00+09:00", "pre"),
        ("2026-05-11T08:55:00+09:00", "closed"),  # 휴장
        ("2026-05-11T10:00:00+09:00", "regular"),
        ("2026-05-11T15:25:00+09:00", "closed"),  # 휴장
        ("2026-05-11T17:00:00+09:00", "after"),
        ("2026-05-11T21:00:00+09:00", "closed"),
        ("2026-05-09T10:00:00+09:00", "closed"),  # 토요일
    ],
)
def test_kr_session_label(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert kr_session_label(ts) == expected

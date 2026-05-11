from datetime import datetime, time
from typing import Literal
from zoneinfo import ZoneInfo

import pandas_market_calendars as mcal

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")

# 캐시: 매년 한 번만 캘린더 빌드
_kr_cal = mcal.get_calendar("XKRX")  # KRX
_us_cal = mcal.get_calendar("NYSE")

KrSession = Literal["pre", "regular", "after", "closed"]


def _is_session_day(cal, dt: datetime) -> bool:
    """해당 날짜가 영업일(휴장 X)인지."""
    schedule = cal.schedule(start_date=dt.date(), end_date=dt.date())
    return not schedule.empty


def is_kr_market_open(ts: datetime) -> bool:
    """KRX 정규 운영 시간: 평일 09:00-15:30 KST. (legacy — 사용 자제, NXT 시간엔
    is_kr_open_extended 권장)."""
    local = ts.astimezone(KST)
    if not _is_session_day(_kr_cal, local):
        return False
    open_t = time(9, 0)
    close_t = time(15, 30)
    return open_t <= local.time() <= close_t


def kr_session_label(ts: datetime) -> KrSession:
    """현재 KR 세션 라벨. NXT 거래시간 기준.

    - 'pre'     08:00–08:50  (NXT 프리마켓)
    - 'regular' 09:00–15:20  (NXT 메인마켓 — KRX 정규장 09:00–15:30보다 10분 짧음.
                              15:20–15:30은 KRX는 열려있지만 NXT가 휴장이라
                              우리는 'closed'로 통일 — 평일 저녁 거래 일관성)
    - 'after'   15:30–20:00  (NXT 애프터마켓)
    - 'closed'  그 외 시간 (휴장 10분 × 2 + 야간 + 주말 + 공휴일)

    boundary는 half-open: end는 항상 제외 (08:50, 15:20, 20:00 모두 closed).
    """
    local = ts.astimezone(KST)
    if not _is_session_day(_kr_cal, local):
        return "closed"
    t = local.time()
    if time(8, 0) <= t < time(8, 50):
        return "pre"
    if time(9, 0) <= t < time(15, 20):
        return "regular"
    if time(15, 30) <= t < time(20, 0):
        return "after"
    return "closed"


def is_kr_open_extended(ts: datetime) -> bool:
    """KR 종목 거래 가능 여부 (NXT 포함 08:00-20:00 KST, 휴장 10분 × 2 제외)."""
    return kr_session_label(ts) != "closed"


def is_us_market_open(ts: datetime) -> bool:
    """NYSE/NASDAQ 운영 시간: 평일 09:30-16:00 ET, 미국 공휴일 제외."""
    local = ts.astimezone(ET)
    if not _is_session_day(_us_cal, local):
        return False
    open_t = time(9, 30)
    close_t = time(16, 0)
    return open_t <= local.time() <= close_t


def is_any_market_open(ts: datetime | None = None) -> bool:
    """KR (NXT 포함) 또는 US 장이 열려 있으면 True. 인자 없으면 현재 시각."""
    if ts is None:
        ts = datetime.now(tz=KST)
    return is_kr_open_extended(ts) or is_us_market_open(ts)

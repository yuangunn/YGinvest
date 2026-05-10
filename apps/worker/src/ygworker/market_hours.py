from datetime import datetime, time
from zoneinfo import ZoneInfo

import pandas_market_calendars as mcal

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")

# 캐시: 매년 한 번만 캘린더 빌드
_kr_cal = mcal.get_calendar("XKRX")  # KRX
_us_cal = mcal.get_calendar("NYSE")


def _is_session_day(cal, dt: datetime) -> bool:
    """해당 날짜가 영업일(휴장 X)인지."""
    schedule = cal.schedule(start_date=dt.date(), end_date=dt.date())
    return not schedule.empty


def is_kr_market_open(ts: datetime) -> bool:
    """KRX 운영 시간: 평일 09:00-15:30 KST, 한국 공휴일 제외."""
    local = ts.astimezone(KST)
    if not _is_session_day(_kr_cal, local):
        return False
    open_t = time(9, 0)
    close_t = time(15, 30)
    return open_t <= local.time() <= close_t


def is_us_market_open(ts: datetime) -> bool:
    """NYSE/NASDAQ 운영 시간: 평일 09:30-16:00 ET, 미국 공휴일 제외."""
    local = ts.astimezone(ET)
    if not _is_session_day(_us_cal, local):
        return False
    open_t = time(9, 30)
    close_t = time(16, 0)
    return open_t <= local.time() <= close_t


def is_any_market_open(ts: datetime | None = None) -> bool:
    """KR 또는 US 장이 열려 있으면 True. 인자 없으면 현재 시각."""
    if ts is None:
        ts = datetime.now(tz=KST)
    return is_kr_market_open(ts) or is_us_market_open(ts)

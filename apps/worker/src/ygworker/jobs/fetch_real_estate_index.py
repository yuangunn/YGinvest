"""Plan #33: 한국부동산원 R-ONE 주간 부동산 가격지수 fetch.

R-ONE 공개 API:
- https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do
- 무료, 인증키 (data.go.kr 같은 시스템) 필요.
- 통계표: 'A_2024_00404' (주간 아파트 매매가격지수, 시도별)
- 갱신 주기: 매주 월요일

지역 → R-ONE 시도 매핑:
- seoul_gangbuk / seoul_gangnam → 서울 (분리 추적 불가, 같은 시도)
- busan_apt → 부산
- daegu_apt → 대구
- ...

호출 실패 / 인증키 없으면 graceful skip — base 가격으로 게임 계속 동작.
환경변수: REB_API_KEY (없으면 skip)
"""
import os
from datetime import UTC, datetime
from typing import Any

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

# R-ONE의 시도 코드 (통계표 A_2024_00404의 분류 코드 — 인증 신청 후 확인)
# 게임 region_code → R-ONE 시도명 매핑
REGION_TO_REB_AREA: dict[str, str] = {
    "rural_studio": "전국",
    "cheongju_villa": "충북",
    "gwangju_apt": "광주",
    "daejeon_apt": "대전",
    "daegu_apt": "대구",
    "incheon_apt": "인천",
    "busan_apt": "부산",
    "suwon_apt": "경기",
    "seoul_gangbuk": "서울",
    "seoul_gangnam": "서울",  # 동일 (강남/강북 분리 통계는 별도 통계표 필요)
}

REB_API_URL = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do"
REB_STATISTIC_ID = "A_2024_00404"  # 주간 아파트 매매가격지수


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=4))
def _fetch_reb_indices(api_key: str) -> dict[str, float]:
    """R-ONE에서 시도별 최신 주간 지수 반환.

    Returns: {시도명: 지수 / 100} (지수는 base 100 기준이라 1.05 = +5%로 정규화)
    """
    params = {
        "KEY": api_key,
        "STATBL_ID": REB_STATISTIC_ID,
        "Type": "json",
        "pIndex": 1,
        "pSize": 100,  # 시도 17개 + 전국 = 충분
    }
    resp = requests.get(REB_API_URL, params=params, timeout=15)
    resp.raise_for_status()
    payload = resp.json()

    # R-ONE 응답 구조 (가변적, 인증 후 실제 확인 필요):
    # {"SttsApiTblData": [{"head": [...]}, {"row": [{"CLS_NM": "서울", "DTA_VAL": "108.42", ...}, ...]}]}
    out: dict[str, float] = {}
    try:
        data_section = payload.get("SttsApiTblData") or []
        for section in data_section:
            for row in section.get("row", []):
                area = row.get("CLS_NM") or row.get("REGION_NM")
                val = row.get("DTA_VAL") or row.get("DATA_VALUE")
                if area and val is not None:
                    try:
                        # R-ONE은 base 100 기준 → 1.0 base로 정규화
                        out[str(area)] = float(val) / 100.0
                    except (ValueError, TypeError):
                        continue
    except (KeyError, TypeError):
        pass

    return out


def run_fetch_real_estate_index(supabase: Any, logger: Any) -> dict[str, int]:
    """R-ONE 주간 지수 → real_estate_listings.weekly_index 갱신.

    API 키 없거나 응답 실패 시 graceful skip (base price로 게임 계속 동작).
    """
    api_key = os.environ.get("REB_API_KEY", "").strip()
    if not api_key:
        logger.info("fetch_real_estate_index.skip", reason="no_api_key")
        return {"updated": 0, "skipped": True}

    try:
        area_indices = _fetch_reb_indices(api_key)
    except Exception as exc:
        logger.warning("fetch_real_estate_index.fetch_failed", error=str(exc))
        return {"updated": 0, "error": str(exc)}

    if not area_indices:
        logger.warning("fetch_real_estate_index.empty_response")
        return {"updated": 0, "empty": True}

    now_iso = datetime.now(UTC).isoformat()
    updated = 0

    for region_code, reb_area in REGION_TO_REB_AREA.items():
        index = area_indices.get(reb_area)
        if index is None:
            logger.debug(
                "fetch_real_estate_index.region_missing",
                region=region_code,
                area=reb_area,
            )
            continue
        try:
            supabase.table("real_estate_listings").update(
                {
                    "weekly_index": round(index, 4),
                    "weekly_index_updated_at": now_iso,
                }
            ).eq("region_code", region_code).execute()
            updated += 1
        except Exception as exc:
            logger.warning(
                "fetch_real_estate_index.update_failed",
                region=region_code,
                error=str(exc),
            )

    logger.info("fetch_real_estate_index.done", updated=updated, total_areas=len(area_indices))
    return {"updated": updated, "total_areas_available": len(area_indices)}

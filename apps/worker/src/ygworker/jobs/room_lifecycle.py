from typing import Any


def run_room_lifecycle(supabase: Any, logger: Any) -> None:
    """1분 주기. open→active, active→ended 전이를 PG 함수로 위임.

    PG function `transition_room_lifecycle`이 실제 SQL UPDATE + 펜딩 주문
    환원 + cancelled 마킹을 atomically 처리. 워커는 단순히 호출만.
    """
    try:
        result = supabase.rpc("transition_room_lifecycle", {}).execute()
        data = result.data if hasattr(result, "data") else result
        logger.info(
            "room_lifecycle.done",
            opened=data.get("opened", 0),
            ended=data.get("ended", 0),
        )
    except Exception as exc:
        logger.error("room_lifecycle.failed", error=str(exc))

"""pytest 공통 설정.

통합 테스트(라이브 Supabase 필요)는 파일 단위로 `integration` 마커를 붙이고,
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없으면 건너뛴다.

- 로컬 단위 테스트:   uv run pytest -m "not integration"
- 통합 테스트:        supabase start 후 .env 에 키를 두고 uv run pytest -m integration
- CI: worker-ci.yml 의 unit 잡은 "not integration", contract 잡은 supabase start 후 integration
"""

import os

import pytest

INTEGRATION_FILES = {
    "test_compute_recommendations_integration.py",
    "test_corporate_action_functions.py",
    "test_notification_flow.py",
    "test_room_functions.py",
    "test_signup_trigger.py",
    "test_trading_functions.py",
}


def _live_supabase_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    live = _live_supabase_configured()
    skip = pytest.mark.skip(
        reason="라이브 Supabase 필요 (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정)"
    )
    for item in items:
        if item.path.name in INTEGRATION_FILES:
            item.add_marker(pytest.mark.integration)
            if not live:
                item.add_marker(skip)

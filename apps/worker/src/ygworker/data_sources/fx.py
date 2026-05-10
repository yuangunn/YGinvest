import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def fetch_usd_krw_rate() -> float:
    """Frankfurter (ECB)에서 현재 USD/KRW 환율을 가져옴.

    이전에는 exchangerate.host를 사용했으나 2026년 유료화됨.
    Frankfurter (https://frankfurter.dev)는 ECB 데이터를 무료로 제공.
    응답 형태: {"amount":1.0,"base":"USD","date":"...","rates":{"KRW":1466.78}}
    """
    resp = httpx.get(
        "https://api.frankfurter.dev/v1/latest",
        params={"from": "USD", "to": "KRW"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return float(data["rates"]["KRW"])

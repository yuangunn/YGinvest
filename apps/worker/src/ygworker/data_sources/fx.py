import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def fetch_usd_krw_rate() -> float:
    """exchangerate.host에서 현재 USD/KRW 환율을 가져옴."""
    resp = httpx.get(
        "https://api.exchangerate.host/latest",
        params={"base": "USD", "symbols": "KRW"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return float(data["rates"]["KRW"])

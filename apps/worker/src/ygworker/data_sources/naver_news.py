"""Naver Finance 종목 뉴스 스크래퍼 (한국어 뉴스 — KR 종목 전용).

yfinance가 KR 종목에 영어 뉴스를 주로 반환하는 문제 해결. Naver Finance
종목 뉴스 페이지는 한국어 기사 + 한국 언론사 출처. CSS 셀렉터:
- `table.type5 tbody tr` (단, `class~=relation_tit`는 관련 기사라 skip)
- `td.title a.tit` — 제목 + href
- `td.info`         — 언론사
- `td.date`         — 'YYYY.MM.DD HH:MM' KST

Scrapling Fetcher (pure HTTP, no browser) 사용. 빠르고 가벼움.
"""

from datetime import datetime
from typing import Any

from scrapling.fetchers import Fetcher
from tenacity import retry, stop_after_attempt, wait_exponential

NAVER_BASE = "https://finance.naver.com"


def _kr_code(symbol: str) -> str:
    """KR 종목 코드만 추출 ('.KS'/'.KQ' suffix 제거)."""
    return symbol.removesuffix(".KS").removesuffix(".KQ")


def _parse_kst(date_str: str) -> str | None:
    """'2026.05.11 22:07' → ISO 8601 KST '2026-05-11T22:07:00+09:00'.

    예외 시 None.
    """
    try:
        dt = datetime.strptime(date_str.strip(), "%Y.%m.%d %H:%M")
        return dt.isoformat() + "+09:00"
    except (ValueError, TypeError):
        return None


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_kr_news(symbol: str, limit: int = 10) -> list[dict]:
    """Naver Finance에서 KR 종목 뉴스 리스트를 가져온다.

    Returns: list of {title, link, publisher, published_at(ISO 8601 KST)}.
    yfinance fetch_news와 동일 shape.
    """
    code = _kr_code(symbol)
    url = (
        f"{NAVER_BASE}/item/news_news.naver"
        f"?code={code}&page=1&clusterId="
    )
    # follow_redirects=True가 기본. timeout 15s.
    page = Fetcher.get(url, timeout=15)
    rows = page.css("table.type5 tbody tr")

    out: list[dict] = []
    for row in rows:
        # 관련 기사 sub-row 제외
        klass = row.attrib.get("class", "") if hasattr(row, "attrib") else ""
        if "relation_tit" in str(klass):
            continue

        title_els = row.css("td.title a.tit")
        info_els = row.css("td.info")
        date_els = row.css("td.date")
        if not title_els:
            continue

        title_el = title_els[0]
        title = _safe_text(title_el)
        href = _safe_attrib(title_el, "href")
        if not title or not href:
            continue

        link = href if href.startswith("http") else NAVER_BASE + href
        publisher = _safe_text(info_els[0]) if info_els else ""
        date_str = _safe_text(date_els[0]) if date_els else ""
        published_at = _parse_kst(date_str) if date_str else None

        out.append(
            {
                "title": title,
                "link": link,
                "publisher": publisher,
                "published_at": published_at,
            }
        )
        if len(out) >= limit:
            break
    return out


def _safe_text(el: Any) -> str:
    try:
        text = el.text
        return text.strip() if text else ""
    except Exception:
        return ""


def _safe_attrib(el: Any, key: str) -> str:
    try:
        return str(el.attrib.get(key, ""))
    except Exception:
        return ""

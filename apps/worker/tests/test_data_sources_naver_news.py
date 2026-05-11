from unittest.mock import MagicMock, patch

from ygworker.data_sources.naver_news import (
    _kr_code,
    fetch_kr_news,
)


def test_kr_code_strips_ks_suffix():
    assert _kr_code("005930.KS") == "005930"
    assert _kr_code("247540.KQ") == "247540"
    # bare code: passes through
    assert _kr_code("005930") == "005930"


def _row(href: str, title: str, publisher: str, date: str, *, relation: bool = False):
    row = MagicMock()
    row.attrib = {"class": "relation_tit" if relation else ""}
    title_a = MagicMock()
    title_a.text = title
    title_a.attrib = {"href": href}
    info = MagicMock()
    info.text = publisher
    date_el = MagicMock()
    date_el.text = date
    # css('td.title a.tit') → [title_a]
    # css('td.info') → [info]
    # css('td.date') → [date_el]
    def css_side_effect(sel):
        if sel == "td.title a.tit":
            return [title_a]
        if sel == "td.info":
            return [info]
        if sel == "td.date":
            return [date_el]
        return []
    row.css = MagicMock(side_effect=css_side_effect)
    return row


@patch("ygworker.data_sources.naver_news.Fetcher")
def test_fetch_kr_news_parses_table_rows(mock_fetcher):
    page = MagicMock()
    page.css.return_value = [
        _row(
            "/item/news_read.naver?article_id=001&office_id=011&code=005930",
            "삼성전자 호실적 발표",
            "한국경제",
            "2026.05.11 22:07",
        ),
        _row(
            "/item/news_read.naver?article_id=002&office_id=008&code=005930",
            "이재용 회장 美 출장",
            "머니투데이",
            "2026.05.11 21:30",
        ),
    ]
    mock_fetcher.get.return_value = page

    out = fetch_kr_news("005930.KS", limit=5)

    assert len(out) == 2
    assert out[0]["title"] == "삼성전자 호실적 발표"
    assert out[0]["publisher"] == "한국경제"
    assert out[0]["link"].startswith("https://finance.naver.com/item/news_read.naver?article_id=001")
    # 2026.05.11 22:07 → ISO 8601 KST
    assert out[0]["published_at"] == "2026-05-11T22:07:00+09:00"


@patch("ygworker.data_sources.naver_news.Fetcher")
def test_fetch_kr_news_skips_relation_tit_rows(mock_fetcher):
    """관련 기사(relation_tit class)는 메인 기사가 아니므로 제외."""
    page = MagicMock()
    page.css.return_value = [
        _row(
            "/item/news_read.naver?article_id=001",
            "메인 뉴스",
            "조선",
            "2026.05.11 21:00",
        ),
        _row(
            "/item/news_read.naver?article_id=002",
            "관련 기사",
            "동아",
            "2026.05.11 20:00",
            relation=True,
        ),
    ]
    mock_fetcher.get.return_value = page

    out = fetch_kr_news("005930.KS", limit=10)
    assert len(out) == 1
    assert out[0]["title"] == "메인 뉴스"


@patch("ygworker.data_sources.naver_news.Fetcher")
def test_fetch_kr_news_respects_limit(mock_fetcher):
    page = MagicMock()
    page.css.return_value = [
        _row(f"/item/news_read.naver?article_id={i}", f"뉴스 {i}", "X", "2026.05.11 12:00")
        for i in range(20)
    ]
    mock_fetcher.get.return_value = page

    out = fetch_kr_news("005930.KS", limit=5)
    assert len(out) == 5


@patch("ygworker.data_sources.naver_news.Fetcher")
def test_fetch_kr_news_empty_returns_empty_list(mock_fetcher):
    page = MagicMock()
    page.css.return_value = []
    mock_fetcher.get.return_value = page

    assert fetch_kr_news("005930.KS", limit=5) == []

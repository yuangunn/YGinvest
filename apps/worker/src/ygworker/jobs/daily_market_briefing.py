"""Plan #47: 일일 시장 시황 브리핑.

매일 06:30 KST 실행:
  1) RSS feed 7개 + Yahoo Finance 헤드라인 fetch (~150-200개)
  2) Claude Haiku로 키워드 추출 + 카테고리 분류 + 구조화된 요약
  3) macro_indicators 최신값 snapshot (10종)
  4) market_briefing 테이블에 upsert (date PK)

Plan #47.1 수정사항:
  - macro symbol mapping fix (USDKRW/OIL_WTI 실제 DB 매칭)
  - 한국경제 RSS 새 URL (https://www.hankyung.com/feed/economy)
  - 뉴시스 + 매경 부동산 + 한겨레 정치 RSS 추가
  - Yahoo ^KQ11 (응답 없음) 제거 + 한국 주요 종목 (삼성/하이닉스/네이버 등) 추가
  - feedparser User-Agent 헤더 (일부 사이트 봇 차단 회피)
  - Summary 프롬프트 개선 — 단락 분리 + 항목별 구조
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import anthropic
import feedparser
from tenacity import retry, stop_after_attempt, wait_exponential

from ygworker.data_sources.yahoo_news import fetch_news as fetch_yahoo_news

# ─────────────────────────────────────────────────────────────
# RSS 소스 (한국 경제 주요 매체)
# Plan #47.1: 한경 새 URL + 뉴시스/매경 부동산/한겨레 정치 추가
# ─────────────────────────────────────────────────────────────
RSS_SOURCES = [
    ("연합뉴스 경제", "https://www.yna.co.kr/rss/economy.xml"),
    ("연합뉴스 종합", "https://www.yna.co.kr/rss/news.xml"),
    ("한겨레 경제", "http://www.hani.co.kr/rss/economy/"),
    ("한겨레 정치", "http://www.hani.co.kr/rss/politics/"),
    ("매일경제 경제", "https://www.mk.co.kr/rss/30100041/"),
    ("매일경제 부동산", "https://www.mk.co.kr/rss/50300009/"),
    ("매일경제 IT", "https://www.mk.co.kr/rss/50100032/"),
    ("한국경제 경제", "https://www.hankyung.com/feed/economy"),
    ("한국경제 금융", "https://www.hankyung.com/feed/finance"),
    ("경향신문 경제", "https://www.khan.co.kr/rss/rssdata/economy_news.xml"),
    ("뉴시스 경제", "https://www.newsis.com/RSS/economy.xml"),
]

# 글로벌 + 한국 대표 종목 헤드라인용 Yahoo 심볼
# Plan #47.1: ^KQ11 (응답 없음) 제거, 한국 시총 상위 종목 추가
YAHOO_SYMBOLS = [
    "^GSPC",  # S&P 500
    "^IXIC",  # NASDAQ
    "^KS11",  # KOSPI
    "TSLA",
    "NVDA",
    "AAPL",
    "MSFT",
    # 한국 시총 상위 (KS11 news 부족 보완)
    "005930.KS",  # 삼성전자
    "000660.KS",  # SK하이닉스
    "035420.KS",  # NAVER
    "035720.KS",  # 카카오
    "207940.KS",  # 삼성바이오로직스
    "005380.KS",  # 현대차
]

# macro_indicators 실제 DB 심볼 매핑
# Plan #47.1: USDKRW/OIL_WTI 등 실제 이름 매칭
MACRO_KEYS = [
    "KOSPI",
    "KOSDAQ",
    "SP500",
    "NASDAQ",
    "USDKRW",
    "OIL_WTI",
    "GOLD",
    "BTC_USD",
    "DXY",
    "VIX",
    "TNX10Y",
    "FED_FUNDS",
]

# feedparser는 default UA가 단순해서 일부 사이트가 차단 → 브라우저 UA 사용
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 YGinvestBot/1.0"
)


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=3))
def fetch_rss(name: str, url: str, limit: int = 25) -> list[dict[str, Any]]:
    # feedparser는 agent param 지원 (사이트별 봇 차단 회피)
    feed = feedparser.parse(url, agent=USER_AGENT)
    out: list[dict[str, Any]] = []
    for entry in feed.entries[:limit]:
        title = (entry.get("title") or "").strip()
        if not title:
            continue
        published = entry.get("published") or entry.get("updated") or ""
        out.append(
            {
                "title": title,
                "url": entry.get("link") or "",
                "source": name,
                "published_at": published,
            }
        )
    return out


def fetch_all_headlines(logger: Any) -> list[dict[str, Any]]:
    """RSS + Yahoo 헤드라인 모두 합쳐 반환 (제목 dedup)."""
    all_items: list[dict[str, Any]] = []

    for name, url in RSS_SOURCES:
        try:
            items = fetch_rss(name, url)
            if items:
                logger.info("briefing.rss_ok", source=name, count=len(items))
                all_items.extend(items)
            else:
                logger.warning("briefing.rss_empty", source=name, url=url)
        except Exception as e:
            logger.warning("briefing.rss_fail", source=name, error=str(e))

    for symbol in YAHOO_SYMBOLS:
        try:
            items = fetch_yahoo_news(symbol, limit=5)
            if items:
                for it in items:
                    all_items.append(
                        {
                            "title": it.get("title", ""),
                            "url": it.get("link", ""),
                            "source": f"Yahoo ({it.get('publisher', '')})",
                            "published_at": it.get("published_at"),
                        }
                    )
                logger.info("briefing.yahoo_ok", symbol=symbol, count=len(items))
            else:
                logger.debug("briefing.yahoo_empty", symbol=symbol)
        except Exception as e:
            logger.warning("briefing.yahoo_fail", symbol=symbol, error=str(e))

    # 제목 50자 prefix 기준 dedup (긴 헤드라인 우선)
    seen: dict[str, dict[str, Any]] = {}
    for item in all_items:
        key = item["title"][:50]
        if key not in seen or len(item["title"]) > len(seen[key]["title"]):
            seen[key] = item
    deduped = list(seen.values())
    return deduped


def fetch_macro_snapshot(supabase: Any) -> dict[str, Any]:
    """주요 매크로 지수 최신값 snapshot. 실제 DB 심볼 매칭."""
    snap: dict[str, Any] = {}
    for symbol in MACRO_KEYS:
        try:
            res = (
                supabase.table("macro_indicators")
                .select("ts, value")
                .eq("symbol", symbol)
                .order("ts", desc=True)
                .limit(2)
                .execute()
            )
            rows = res.data or []
            if not rows:
                continue
            latest = float(rows[0]["value"])
            prev = float(rows[1]["value"]) if len(rows) > 1 else latest
            change_pct = ((latest - prev) / prev * 100) if prev else 0.0
            snap[symbol] = {
                "value": latest,
                "change_pct": round(change_pct, 2),
                "ts": rows[0]["ts"],
            }
        except Exception:
            continue
    return snap


# ─────────────────────────────────────────────────────────────
# Claude Haiku 프롬프트 — 구조화된 요약 + JSON 출력
# Plan #47.1: summary를 단락 분리 + 항목별로 개선
# ─────────────────────────────────────────────────────────────
BRIEFING_SYSTEM = (
    "당신은 한국 금융 시장 애널리스트입니다. "
    "주어진 경제 뉴스 헤드라인들을 분석해서 오늘의 시장 브리핑을 생성합니다.\n\n"
    "출력은 반드시 valid JSON만. 다른 텍스트 X.\n\n"
    "JSON 스키마:\n"
    "{\n"
    '  "summary": {\n'
    '    "headline": "오늘 한 줄 요약 (40자 이내, 문장 형태)",\n'
    '    "kr_market": "한국 시장 동향 2-3줄 (각 줄 80자 이내)",\n'
    '    "us_market": "미국/글로벌 시장 동향 1-2줄",\n'
    '    "key_issues": "오늘의 핵심 이슈 (정치/지정학/기업) 1-2줄"\n'
    "  },\n"
    '  "keywords": [\n'
    "    {\n"
    '      "keyword": "짧은 한국어 단어/구",\n'
    '      "category": "monetary|war|politics|real_estate|corporate|tech|global|other",\n'
    '      "headline_count": 추정 개수,\n'
    '      "article_indexes": [0, 5, 12]   // 최대 5개, input 헤드라인의 0-based index\n'
    "    }\n"
    "  ]\n"
    "}\n\n"
    "규칙:\n"
    "- summary의 각 필드는 빈 문자열 X. 해당 정보 부족하면 짧게라도 작성.\n"
    "- keywords는 6-8개. 가장 자주 언급되거나 시장 영향력 있는 키워드 우선.\n"
    "- 카테고리:\n"
    "  · monetary — 금리, 통화정책, FOMC, 한은\n"
    "  · war — 전쟁, 지정학, 휴전, 분쟁\n"
    "  · politics — 정치, 규제, 선거, 정부 정책\n"
    "  · real_estate — 부동산, 주택 정책, 분양\n"
    "  · corporate — 기업 실적, 인사, M&A, 파업\n"
    "  · tech — 반도체, AI, IT, 데이터센터\n"
    "  · global — 해외 시장, 환율, 원자재\n"
    "  · other — 위에 안 맞는 경우\n"
    "- 음모론/추측성 표현 금지. 객관적 사실 기반."
)


def build_user_prompt(headlines: list[dict[str, Any]], today_kst: str) -> str:
    lines = [f"오늘 날짜: {today_kst}", "", "분석할 헤드라인 목록:"]
    for i, h in enumerate(headlines):
        lines.append(f"[{i}] ({h['source']}) {h['title']}")
    lines.append("")
    lines.append("위 헤드라인들을 위 JSON 스키마에 맞춰 응답해주세요.")
    return "\n".join(lines)


def generate_briefing_with_claude(
    headlines: list[dict[str, Any]],
    today_kst: str,
    logger: Any,
) -> tuple[dict[str, Any], int, int, str]:
    """Claude Haiku로 키워드 + 요약 생성."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY env var missing")

    model = "claude-haiku-4-5"
    client = anthropic.Anthropic(api_key=api_key)

    msg = client.messages.create(
        model=model,
        max_tokens=2500,
        system=BRIEFING_SYSTEM,
        messages=[{"role": "user", "content": build_user_prompt(headlines, today_kst)}],
    )

    text = ""
    for block in msg.content:
        if hasattr(block, "text"):
            text += block.text
    text = text.strip()

    # ```json``` 감싸면 제거
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(line for line in lines if not line.startswith("```"))

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("briefing.parse_fail", raw=text[:500], error=str(e))
        raise

    return (
        parsed,
        msg.usage.input_tokens,
        msg.usage.output_tokens,
        model,
    )


def flatten_summary(s: Any) -> str:
    """structured summary → 단일 텍스트 (DB는 text 컬럼이라).

    형식:
      [Headline]

      🇰🇷 한국 시장
      [kr_market]

      🌐 글로벌
      [us_market]

      🔑 핵심 이슈
      [key_issues]
    """
    if isinstance(s, str):
        return s.strip()
    if not isinstance(s, dict):
        return ""

    parts: list[str] = []
    headline = (s.get("headline") or "").strip()
    if headline:
        parts.append(headline)

    kr = (s.get("kr_market") or "").strip()
    if kr:
        parts.append("\n🇰🇷 한국 시장\n" + kr)

    us = (s.get("us_market") or "").strip()
    if us:
        parts.append("\n🌐 글로벌\n" + us)

    key = (s.get("key_issues") or "").strip()
    if key:
        parts.append("\n🔑 핵심 이슈\n" + key)

    return "\n".join(parts)


def enrich_keywords(
    raw_keywords: list[dict[str, Any]],
    headlines: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Claude가 준 keyword + article_indexes를 실제 article 데이터로 펼침."""
    out: list[dict[str, Any]] = []
    for kw in raw_keywords:
        idxs = kw.get("article_indexes") or []
        articles: list[dict[str, Any]] = []
        for idx in idxs:
            try:
                i = int(idx)
            except (TypeError, ValueError):
                continue
            if 0 <= i < len(headlines):
                h = headlines[i]
                articles.append(
                    {
                        "title": h["title"],
                        "url": h["url"],
                        "source": h["source"],
                        "published_at": h.get("published_at"),
                    }
                )
        out.append(
            {
                "keyword": kw.get("keyword", ""),
                "category": kw.get("category", "other"),
                "headline_count": kw.get("headline_count", len(articles)),
                "articles": articles,
            }
        )
    return out


def run_daily_market_briefing(supabase: Any, logger: Any) -> None:
    """매일 06:30 KST 실행."""
    kst = ZoneInfo("Asia/Seoul")
    today_kst = datetime.now(kst).date().isoformat()
    logger.info("briefing.start", date=today_kst)

    # 1) 헤드라인 수집
    headlines = fetch_all_headlines(logger)
    if len(headlines) < 10:
        logger.error("briefing.too_few_headlines", count=len(headlines))
        return
    logger.info("briefing.headlines_collected", count=len(headlines))

    if len(headlines) > 200:
        headlines = headlines[:200]

    # 2) Claude 호출
    try:
        parsed, in_tok, out_tok, model = generate_briefing_with_claude(
            headlines, today_kst, logger
        )
    except Exception as e:
        logger.error("briefing.claude_fail", error=str(e))
        return

    summary_text = flatten_summary(parsed.get("summary"))
    raw_keywords = parsed.get("keywords") or []
    keywords = enrich_keywords(raw_keywords, headlines)

    if not summary_text or not keywords:
        logger.error(
            "briefing.empty_result",
            summary_len=len(summary_text),
            kw_count=len(keywords),
        )
        return

    # 3) Macro snapshot
    macro = fetch_macro_snapshot(supabase)

    # 4) Upsert
    row = {
        "date": today_kst,
        "summary": summary_text,
        "keywords": keywords,
        "macro_snapshot": macro,
        "source_count": len(headlines),
        "model": model,
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "generated_at": datetime.now(UTC).isoformat(),
    }

    try:
        supabase.table("market_briefing").upsert(row).execute()
        logger.info(
            "briefing.saved",
            date=today_kst,
            keywords=len(keywords),
            macro_count=len(macro),
            headlines=len(headlines),
            input_tokens=in_tok,
            output_tokens=out_tok,
        )
    except Exception as e:
        logger.error("briefing.save_fail", error=str(e))

"""Plan #47: 일일 시장 시황 브리핑 (평일 06:30 + 12:30 KST).

  - morning (06:30): 장 시작 전, 오늘 시장 영향 줄 이슈 정리
  - noon (12:30): 오전장 정리, KR 오전 KOSPI/KOSDAQ 흐름 + 미국 마감

Plan #47.4 토큰 최적화:
  - 헤드라인 200 → 100 cap (input ~50% 감소)
  - 시스템 프롬프트 압축 (600 → 300 tokens)
  - 출처/인덱스 포맷 간결화
  - 회당 ~$0.0095, 평일 2회 연 ~$5 ($5 크레딧 1년 정확)
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

import anthropic
import feedparser
from tenacity import retry, stop_after_attempt, wait_exponential

from ygworker.data_sources.yahoo_news import fetch_news as fetch_yahoo_news

# ─────────────────────────────────────────────────────────────
# RSS 소스 (한국 경제 주요 매체)
# ─────────────────────────────────────────────────────────────
RSS_SOURCES = [
    ("연합경제", "https://www.yna.co.kr/rss/economy.xml"),
    ("연합종합", "https://www.yna.co.kr/rss/news.xml"),
    ("한겨레", "http://www.hani.co.kr/rss/economy/"),
    ("한겨레정치", "http://www.hani.co.kr/rss/politics/"),
    ("매경", "https://www.mk.co.kr/rss/30100041/"),
    ("매경부동산", "https://www.mk.co.kr/rss/50300009/"),
    ("매경IT", "https://www.mk.co.kr/rss/50100032/"),
    ("한경", "https://www.hankyung.com/feed/economy"),
    ("한경금융", "https://www.hankyung.com/feed/finance"),
    ("경향", "https://www.khan.co.kr/rss/rssdata/economy_news.xml"),
    ("뉴시스", "https://www.newsis.com/RSS/economy.xml"),
]

YAHOO_SYMBOLS = [
    "^GSPC", "^IXIC", "^KS11",
    "TSLA", "NVDA", "AAPL", "MSFT",
    "005930.KS", "000660.KS", "035420.KS",
    "035720.KS", "207940.KS", "005380.KS",
]

MACRO_KEYS = [
    "KOSPI", "KOSDAQ", "SP500", "NASDAQ",
    "USDKRW", "OIL_WTI", "GOLD", "BTC_USD",
    "DXY", "VIX", "TNX10Y", "FED_FUNDS",
]

HEADLINE_CAP = 100  # 토큰 최적화 — 200 → 100

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 YGinvestBot/1.0"
)

Slot = Literal["morning", "noon"]


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=3))
def fetch_rss(name: str, url: str, limit: int = 15) -> list[dict[str, Any]]:
    """RSS feed parse. limit 25 → 15 (토큰 최적화)."""
    feed = feedparser.parse(url, agent=USER_AGENT)
    out: list[dict[str, Any]] = []
    for entry in feed.entries[:limit]:
        title = (entry.get("title") or "").strip()
        if not title:
            continue
        out.append(
            {
                "title": title,
                "url": entry.get("link") or "",
                "source": name,
                "published_at": entry.get("published") or entry.get("updated") or "",
            }
        )
    return out


def fetch_all_headlines(logger: Any) -> list[dict[str, Any]]:
    all_items: list[dict[str, Any]] = []

    for name, url in RSS_SOURCES:
        try:
            items = fetch_rss(name, url)
            if items:
                all_items.extend(items)
            else:
                logger.warning("briefing.rss_empty", source=name)
        except Exception as e:
            logger.warning("briefing.rss_fail", source=name, error=str(e))

    for symbol in YAHOO_SYMBOLS:
        try:
            items = fetch_yahoo_news(symbol, limit=3)  # 5 → 3 (토큰 최적화)
            for it in items:
                all_items.append(
                    {
                        "title": it.get("title", ""),
                        "url": it.get("link", ""),
                        "source": "Yahoo",  # publisher 생략 (토큰 절감)
                        "published_at": it.get("published_at"),
                    }
                )
        except Exception as e:
            logger.warning("briefing.yahoo_fail", symbol=symbol, error=str(e))

    # dedup
    seen: dict[str, dict[str, Any]] = {}
    for item in all_items:
        key = item["title"][:50]
        if key not in seen or len(item["title"]) > len(seen[key]["title"]):
            seen[key] = item

    deduped = list(seen.values())
    logger.info("briefing.dedup", before=len(all_items), after=len(deduped))
    return deduped[:HEADLINE_CAP]  # cap


def fetch_macro_snapshot(supabase: Any) -> dict[str, Any]:
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
# 압축된 시스템 프롬프트 (300 토큰 추정 — 기존 600)
# ─────────────────────────────────────────────────────────────
BRIEFING_SYSTEM_MORNING = (
    "한국 금융 시장 애널리스트. 오전 06:30 KST 기준 장 시작 전 브리핑.\n"
    "출력: valid JSON만.\n"
    '{"summary": {"headline":"40자내", "kr_market":"한국 시장 전망 2-3줄", '
    '"us_market":"미국 마감 정리 1-2줄", "key_issues":"오늘 핵심 이슈 1-2줄"}, '
    '"keywords": [{"keyword":"키워드", "category":"...", '
    '"headline_count":n, "article_indexes":[0,1,2]}]}\n'
    "category: monetary|war|politics|real_estate|corporate|tech|global|other.\n"
    "keywords 6-8개. article_indexes는 최대 5개.\n"
    "객관적 사실 기반. 추측 금지."
)

BRIEFING_SYSTEM_NOON = (
    "한국 금융 시장 애널리스트. 정오 12:30 KST 기준 오전장 정리 브리핑.\n"
    "출력: valid JSON만.\n"
    '{"summary": {"headline":"40자내", "kr_market":"오전 KOSPI/KOSDAQ 흐름 2-3줄", '
    '"us_market":"미국 야간 동향 1-2줄", "key_issues":"점심까지 주요 이슈 1-2줄"}, '
    '"keywords": [{"keyword":"키워드", "category":"...", '
    '"headline_count":n, "article_indexes":[0,1,2]}]}\n'
    "category: monetary|war|politics|real_estate|corporate|tech|global|other.\n"
    "keywords 6-8개. article_indexes는 최대 5개.\n"
    "객관적 사실 기반. 추측 금지."
)


def build_user_prompt(headlines: list[dict[str, Any]], today_kst: str) -> str:
    # 간결한 포맷: 헤드라인만 (출처/인덱스는 모델이 추론)
    lines = [f"날짜: {today_kst}", "헤드라인:"]
    for i, h in enumerate(headlines):
        lines.append(f"[{i}]{h['title']}")
    return "\n".join(lines)


def generate_briefing_with_claude(
    headlines: list[dict[str, Any]],
    today_kst: str,
    slot: Slot,
    logger: Any,
) -> tuple[dict[str, Any], int, int, str]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY env var missing")

    model = "claude-haiku-4-5"
    client = anthropic.Anthropic(api_key=api_key)
    system_prompt = (
        BRIEFING_SYSTEM_MORNING if slot == "morning" else BRIEFING_SYSTEM_NOON
    )

    msg = client.messages.create(
        model=model,
        max_tokens=2000,
        system=system_prompt,
        messages=[
            {"role": "user", "content": build_user_prompt(headlines, today_kst)}
        ],
    )

    text = ""
    for block in msg.content:
        if hasattr(block, "text"):
            text += block.text
    text = text.strip()

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


def run_daily_market_briefing(
    supabase: Any, logger: Any, slot: Slot = "morning"
) -> None:
    """평일 06:30 KST (morning) 또는 12:30 KST (noon) 실행.

    Args:
        slot: 'morning' (장 시작 전) | 'noon' (오전장 정리)
    """
    kst = ZoneInfo("Asia/Seoul")
    now_kst = datetime.now(kst)
    today_kst = now_kst.date().isoformat()

    # 평일만 (월=0, ..., 일=6)
    if now_kst.weekday() >= 5:
        logger.info("briefing.weekend_skip", date=today_kst, slot=slot)
        return

    logger.info("briefing.start", date=today_kst, slot=slot)

    headlines = fetch_all_headlines(logger)
    if len(headlines) < 10:
        logger.error("briefing.too_few_headlines", count=len(headlines))
        return
    logger.info("briefing.headlines_capped", count=len(headlines))

    try:
        parsed, in_tok, out_tok, model = generate_briefing_with_claude(
            headlines, today_kst, slot, logger
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

    macro = fetch_macro_snapshot(supabase)

    row = {
        "date": today_kst,
        "slot": slot,
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
        supabase.table("market_briefing").upsert(row, on_conflict="date,slot").execute()
        logger.info(
            "briefing.saved",
            date=today_kst,
            slot=slot,
            keywords=len(keywords),
            macro_count=len(macro),
            headlines=len(headlines),
            input_tokens=in_tok,
            output_tokens=out_tok,
        )
    except Exception as e:
        logger.error("briefing.save_fail", error=str(e))


def run_morning_briefing(supabase: Any, logger: Any) -> None:
    run_daily_market_briefing(supabase, logger, slot="morning")


def run_noon_briefing(supabase: Any, logger: Any) -> None:
    run_daily_market_briefing(supabase, logger, slot="noon")

"""Plan #47: 일일 시장 시황 브리핑.

매일 06:30 KST 실행:
  1) RSS feed (연합/한경/매경/조선비즈) + Yahoo Finance 헤드라인 fetch
  2) Claude Haiku에 통합 → 키워드 추출 + 카테고리 분류 + 요약
  3) macro_indicators 최신값 snapshot
  4) market_briefing 테이블에 upsert (date PK)
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
# ─────────────────────────────────────────────────────────────
RSS_SOURCES = [
    ("연합뉴스 경제", "https://www.yna.co.kr/rss/economy.xml"),
    ("한겨레 경제", "http://www.hani.co.kr/rss/economy/"),
    ("매일경제", "https://www.mk.co.kr/rss/30100041/"),
    ("한국경제", "http://rss.hankyung.com/feed/economy.xml"),
    ("경향신문 경제", "https://www.khan.co.kr/rss/rssdata/economy_news.xml"),
]

# 글로벌 헤드라인용 Yahoo 심볼 (대표 지수 + 이슈 종목)
YAHOO_SYMBOLS = ["^GSPC", "^IXIC", "^KS11", "^KQ11", "TSLA", "NVDA", "AAPL"]


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=3))
def fetch_rss(name: str, url: str, limit: int = 25) -> list[dict[str, Any]]:
    feed = feedparser.parse(url)
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
    """RSS + Yahoo 헤드라인 모두 합쳐 반환."""
    all_items: list[dict[str, Any]] = []

    for name, url in RSS_SOURCES:
        try:
            items = fetch_rss(name, url)
            logger.info("briefing.rss_ok", source=name, count=len(items))
            all_items.extend(items)
        except Exception as e:
            logger.warning("briefing.rss_fail", source=name, error=str(e))

    for symbol in YAHOO_SYMBOLS:
        try:
            items = fetch_yahoo_news(symbol, limit=5)
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
        except Exception as e:
            logger.warning("briefing.yahoo_fail", symbol=symbol, error=str(e))

    # 제목 기준 중복 제거 (긴 헤드라인 우선)
    seen: dict[str, dict[str, Any]] = {}
    for item in all_items:
        key = item["title"][:50]
        if key not in seen or len(item["title"]) > len(seen[key]["title"]):
            seen[key] = item
    deduped = list(seen.values())
    return deduped


def fetch_macro_snapshot(supabase: Any) -> dict[str, Any]:
    """주요 매크로 지수 최신값 snapshot (대시보드 popup 표시용)."""
    keys = ["KOSPI", "KOSDAQ", "SP500", "NASDAQ", "USD_KRW", "WTI_OIL", "GOLD", "BTC_USD"]
    snap: dict[str, Any] = {}
    for symbol in keys:
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
# Claude Haiku 프롬프트 (한국어 응답 + 구조화된 JSON 출력)
# ─────────────────────────────────────────────────────────────
BRIEFING_SYSTEM = (
    "당신은 한국 금융 시장 애널리스트입니다. "
    "주어진 경제 뉴스 헤드라인들을 분석해서 오늘의 시장 브리핑을 생성합니다.\n\n"
    "규칙:\n"
    "1. 출력은 반드시 valid JSON. 다른 텍스트 X.\n"
    "2. \"summary\"는 한국어 3-4줄 (각 줄 80자 이내). "
    "오늘 시장의 주요 흐름을 자연스럽게 설명.\n"
    "3. \"keywords\"는 가장 자주 언급되거나 영향력 있는 키워드 6-8개. 각 키워드:\n"
    "   - \"keyword\": 짧은 한국어 단어/구 "
    "(예: \"기준금리\", \"이란전쟁\", \"비트코인\", \"삼성전자 실적\")\n"
    "   - \"category\": 다음 중 하나\n"
    "     · \"monetary\" — 금리/통화정책\n"
    "     · \"war\" — 전쟁/지정학\n"
    "     · \"politics\" — 정치/규제\n"
    "     · \"real_estate\" — 부동산\n"
    "     · \"corporate\" — 기업 실적/이슈\n"
    "     · \"tech\" — 기술/AI/반도체\n"
    "     · \"global\" — 해외 시장 동향\n"
    "     · \"other\" — 기타\n"
    "   - \"headline_count\": 이 키워드가 등장한 헤드라인 추정 개수\n"
    "   - \"article_indexes\": 관련도 높은 헤드라인 인덱스 5개 이하 "
    "(입력 헤드라인의 0-based index)\n"
    "4. 음모론 / 추측성 표현 금지. 객관적 사실 기반.\n"
)


def build_user_prompt(headlines: list[dict[str, Any]], today_kst: str) -> str:
    lines = [f"오늘 날짜: {today_kst}", "", "분석할 헤드라인 목록:"]
    for i, h in enumerate(headlines):
        lines.append(f"[{i}] ({h['source']}) {h['title']}")
    lines.append("")
    lines.append(
        "위 헤드라인들을 분석해서 시장 브리핑을 JSON으로 응답해주세요. "
        '응답은 {"summary": "...", "keywords": [...]} 형식.'
    )
    return "\n".join(lines)


def generate_briefing_with_claude(
    headlines: list[dict[str, Any]],
    today_kst: str,
    logger: Any,
) -> tuple[dict[str, Any], int, int, str]:
    """Claude Haiku로 키워드 + 요약 생성. (parsed, input_tokens, output_tokens, model) 반환."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY env var missing")

    model = "claude-haiku-4-5"
    client = anthropic.Anthropic(api_key=api_key)

    msg = client.messages.create(
        model=model,
        max_tokens=2000,
        system=BRIEFING_SYSTEM,
        messages=[{"role": "user", "content": build_user_prompt(headlines, today_kst)}],
    )

    # Extract text content
    text = ""
    for block in msg.content:
        if hasattr(block, "text"):
            text += block.text
    text = text.strip()

    # JSON 파싱 (혹시 ```json``` 감싸있으면 제거)
    if text.startswith("```"):
        # ```json\n{...}\n``` 형식 제거
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
    """매일 06:30 KST 실행 — 시황 브리핑 생성."""
    kst = ZoneInfo("Asia/Seoul")
    today_kst = datetime.now(kst).date().isoformat()
    logger.info("briefing.start", date=today_kst)

    # 1) 헤드라인 수집
    headlines = fetch_all_headlines(logger)
    if len(headlines) < 10:
        logger.error("briefing.too_few_headlines", count=len(headlines))
        return
    logger.info("briefing.headlines_collected", count=len(headlines))

    # 너무 많으면 자르기 (Claude 입력 비용/속도)
    if len(headlines) > 120:
        headlines = headlines[:120]

    # 2) Claude 호출
    try:
        parsed, in_tok, out_tok, model = generate_briefing_with_claude(
            headlines, today_kst, logger
        )
    except Exception as e:
        logger.error("briefing.claude_fail", error=str(e))
        return

    summary = (parsed.get("summary") or "").strip()
    raw_keywords = parsed.get("keywords") or []
    keywords = enrich_keywords(raw_keywords, headlines)

    if not summary or not keywords:
        logger.error(
            "briefing.empty_result",
            summary_len=len(summary),
            kw_count=len(keywords),
        )
        return

    # 3) Macro snapshot
    macro = fetch_macro_snapshot(supabase)

    # 4) Upsert
    row = {
        "date": today_kst,
        "summary": summary,
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
            input_tokens=in_tok,
            output_tokens=out_tok,
        )
    except Exception as e:
        logger.error("briefing.save_fail", error=str(e))

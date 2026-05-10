"""시가총액 상위 미국 종목 하드코딩 리스트 (수동 큐레이션).

매년/분기마다 갱신. 현재(2026-05) 기준 상위 100.
출처: companiesmarketcap.com 등 공개 데이터 참조.
"""

US_TOP_100: list[str] = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA",
    "BRK-B", "AVGO", "LLY", "JPM", "WMT", "V", "XOM", "ORCL",
    "MA", "UNH", "COST", "HD", "PG", "JNJ", "BAC", "ABBV",
    "NFLX", "CRM", "CVX", "KO", "AMD", "MRK", "PEP", "TMO",
    "LIN", "ACN", "ADBE", "WFC", "MCD", "DIS", "CSCO", "ABT",
    "DHR", "IBM", "GE", "QCOM", "INTU", "AMGN", "AXP", "TXN",
    "VZ", "NOW", "PM", "RTX", "ISRG", "MS", "BX", "CAT",
    "GS", "PFE", "T", "PGR", "BKNG", "NEE", "TMUS", "C",
    "SCHW", "SPGI", "BLK", "HON", "ETN", "BSX", "DE", "ELV",
    "GILD", "BA", "CB", "VRTX", "LMT", "PANW", "ADP", "ANET",
    "MDLZ", "REGN", "MMC", "SYK", "SO", "ICE", "PLD", "MO",
    "CMCSA", "AMT", "ZTS", "DUK", "FI", "INTC", "CME", "EQIX",
    "TJX", "EOG", "AON", "SHW",
]

# 누락 방지를 위한 모듈 로드 시 검증
assert len(US_TOP_100) == 100, f"US_TOP_100 should have exactly 100 entries, got {len(US_TOP_100)}"

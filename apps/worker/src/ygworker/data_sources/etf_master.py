"""Plan #32: 큐레이션된 ETF 마스터 리스트 (KR + US).

각 entry: (symbol, market, name_ko, name_en, currency, category, fund_family)
- category: broad_market / sector / dividend / bond / commodity / thematic /
            leveraged_inverse / international
- name_ko: 한국 ETF는 정식명, 미국 ETF는 한국어 별칭 (없으면 None)
- name_en: 영문명 (KR ETF도 영문명 있으면 표기)

매 분기마다 갱신. 가격/AUM/expense_ratio는 enrich_etfs job이 yfinance에서 fetch.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class EtfMasterEntry:
    symbol: str           # 069500.KS, SPY
    market: str           # KRX_KS / KRX_KQ / NYSE / NASDAQ
    currency: str         # KRW / USD
    name_ko: str | None
    name_en: str
    category: str
    fund_family: str
    underlying_index: str | None = None


# ──────────────────────────── 한국 ETF (Top 30) ────────────────────────────
KR_ETFS: list[EtfMasterEntry] = [
    # ── KOSPI/KOSDAQ 지수 추종 (broad market) ──────────────────────────
    EtfMasterEntry("069500.KS", "KRX_KS", "KRW", "KODEX 200", "KODEX 200 ETF",
                   "broad_market", "KODEX", "KOSPI 200"),
    EtfMasterEntry("102110.KS", "KRX_KS", "KRW", "TIGER 200", "TIGER 200 ETF",
                   "broad_market", "TIGER", "KOSPI 200"),
    EtfMasterEntry("229200.KS", "KRX_KS", "KRW", "KODEX 코스닥150", "KODEX KOSDAQ150",
                   "broad_market", "KODEX", "KOSDAQ 150"),
    EtfMasterEntry("232080.KS", "KRX_KS", "KRW", "TIGER 코스닥150", "TIGER KOSDAQ150",
                   "broad_market", "TIGER", "KOSDAQ 150"),

    # ── 미국 지수 추종 (KR 상장 미국 ETF) ────────────────────────────
    EtfMasterEntry("360750.KS", "KRX_KS", "KRW", "TIGER 미국S&P500", "TIGER US S&P 500",
                   "broad_market", "TIGER", "S&P 500"),
    EtfMasterEntry("379800.KS", "KRX_KS", "KRW", "KODEX 미국S&P500TR", "KODEX US S&P 500 TR",
                   "broad_market", "KODEX", "S&P 500 TR"),
    EtfMasterEntry("133690.KS", "KRX_KS", "KRW", "TIGER 미국나스닥100", "TIGER US NASDAQ 100",
                   "broad_market", "TIGER", "NASDAQ 100"),
    EtfMasterEntry("487230.KS", "KRX_KS", "KRW", "KODEX 미국나스닥100TR", "KODEX US NASDAQ 100 TR",
                   "broad_market", "KODEX", "NASDAQ 100 TR"),

    # ── 반도체 / AI ───────────────────────────────────────────────
    EtfMasterEntry("091160.KS", "KRX_KS", "KRW", "KODEX 반도체", "KODEX Semiconductor",
                   "sector", "KODEX", "KRX 반도체"),
    EtfMasterEntry("139260.KS", "KRX_KS", "KRW", "TIGER 200 IT", "TIGER 200 IT",
                   "sector", "TIGER", "KOSPI 200 IT"),
    EtfMasterEntry("381180.KS", "KRX_KS", "KRW", "TIGER 미국필라델피아반도체나스닥", "TIGER US PHLX Semi",
                   "sector", "TIGER", "PHLX Semiconductor"),
    EtfMasterEntry("469150.KS", "KRX_KS", "KRW", "KODEX 미국AI테크TOP10", "KODEX US AI Tech TOP 10",
                   "thematic", "KODEX", "Solactive US AI Tech TOP 10"),

    # ── 2차전지 / EV ──────────────────────────────────────────────
    EtfMasterEntry("305540.KS", "KRX_KS", "KRW", "TIGER 2차전지테마", "TIGER Battery Theme",
                   "thematic", "TIGER", "KRX 2차전지"),
    EtfMasterEntry("305720.KS", "KRX_KS", "KRW", "KODEX 2차전지산업", "KODEX Battery Industry",
                   "thematic", "KODEX", "KRX 2차전지"),
    EtfMasterEntry("455860.KS", "KRX_KS", "KRW", "TIGER 미국테슬라채권혼합Fn", "TIGER Tesla Bond Mix",
                   "thematic", "TIGER", None),

    # ── 배당 ──────────────────────────────────────────────────────
    EtfMasterEntry("211900.KS", "KRX_KS", "KRW", "KODEX 배당성장", "KODEX Dividend Growth",
                   "dividend", "KODEX", "FnGuide 배당성장"),
    EtfMasterEntry("458730.KS", "KRX_KS", "KRW", "TIGER 미국배당다우존스", "TIGER US Schwab Dividend",
                   "dividend", "TIGER", "Dow Jones US Dividend 100"),
    EtfMasterEntry("466920.KS", "KRX_KS", "KRW", "SOL 미국배당다우존스(H)", "SOL US Dividend Hedged",
                   "dividend", "SOL", "Dow Jones US Dividend 100"),

    # ── 채권 ──────────────────────────────────────────────────────
    EtfMasterEntry("152380.KS", "KRX_KS", "KRW", "KODEX 국고채10년", "KODEX KTB 10Y",
                   "bond", "KODEX", "KAP 10Y KTB"),
    EtfMasterEntry("305080.KS", "KRX_KS", "KRW", "TIGER 미국채10년선물", "TIGER US 10Y T-Note",
                   "bond", "TIGER", "US Treasury 10Y"),
    EtfMasterEntry("305090.KS", "KRX_KS", "KRW", "TIGER 미국달러단기채권액티브", "TIGER USD Short-Term Bond",
                   "bond", "TIGER", None),

    # ── 원자재 ────────────────────────────────────────────────────
    EtfMasterEntry("132030.KS", "KRX_KS", "KRW", "KODEX 골드선물(H)", "KODEX Gold Futures Hedged",
                   "commodity", "KODEX", "S&P GSCI Gold"),
    EtfMasterEntry("261220.KS", "KRX_KS", "KRW", "KODEX WTI원유선물(H)", "KODEX WTI Crude Hedged",
                   "commodity", "KODEX", "S&P GSCI WTI"),
    EtfMasterEntry("130680.KS", "KRX_KS", "KRW", "TIGER 원유선물Enhanced(H)", "TIGER Crude Enhanced",
                   "commodity", "TIGER", None),

    # ── 인버스 / 레버리지 ──────────────────────────────────────────
    EtfMasterEntry("122630.KS", "KRX_KS", "KRW", "KODEX 레버리지", "KODEX Leverage",
                   "leveraged_inverse", "KODEX", "KOSPI 200 2X"),
    EtfMasterEntry("252670.KS", "KRX_KS", "KRW", "KODEX 200선물인버스2X", "KODEX 200 Futures Inverse 2X",
                   "leveraged_inverse", "KODEX", "KOSPI 200 Inverse 2X"),
    EtfMasterEntry("233740.KS", "KRX_KS", "KRW", "KODEX 코스닥150 레버리지", "KODEX KOSDAQ150 Leverage",
                   "leveraged_inverse", "KODEX", "KOSDAQ 150 2X"),

    # ── 헬스케어 / 바이오 ──────────────────────────────────────────
    EtfMasterEntry("266420.KS", "KRX_KS", "KRW", "KODEX 헬스케어", "KODEX Healthcare",
                   "sector", "KODEX", "KRX Healthcare"),

    # ── 글로벌 / 신흥국 ──────────────────────────────────────────
    EtfMasterEntry("195930.KS", "KRX_KS", "KRW", "TIGER 차이나CSI300", "TIGER China CSI300",
                   "international", "TIGER", "CSI 300"),
    EtfMasterEntry("241180.KS", "KRX_KS", "KRW", "TIGER 일본니케이225", "TIGER Japan Nikkei 225",
                   "international", "TIGER", "Nikkei 225"),
]


# ──────────────────────────── 미국 ETF (Top 20) ────────────────────────────
US_ETFS: list[EtfMasterEntry] = [
    # ── Broad market (필수) ───────────────────────────────────────
    EtfMasterEntry("SPY", "NYSE", "USD", "SPDR S&P 500", "SPDR S&P 500 ETF Trust",
                   "broad_market", "SPDR", "S&P 500"),
    EtfMasterEntry("VOO", "NYSE", "USD", "Vanguard S&P 500", "Vanguard S&P 500 ETF",
                   "broad_market", "Vanguard", "S&P 500"),
    EtfMasterEntry("IVV", "NYSE", "USD", "iShares S&P 500", "iShares Core S&P 500 ETF",
                   "broad_market", "iShares", "S&P 500"),
    EtfMasterEntry("VTI", "NYSE", "USD", "Vanguard 토탈마켓", "Vanguard Total Stock Market ETF",
                   "broad_market", "Vanguard", "CRSP US Total Market"),
    EtfMasterEntry("QQQ", "NASDAQ", "USD", "Invesco QQQ", "Invesco QQQ Trust",
                   "broad_market", "Invesco", "NASDAQ 100"),

    # ── Sector / Thematic ─────────────────────────────────────────
    EtfMasterEntry("SOXX", "NASDAQ", "USD", "iShares 반도체", "iShares Semiconductor ETF",
                   "sector", "iShares", "PHLX Semiconductor"),
    EtfMasterEntry("XLK", "NYSE", "USD", "Tech Select Sector", "Technology Select Sector SPDR Fund",
                   "sector", "SPDR", "S&P Tech Select"),
    EtfMasterEntry("XLE", "NYSE", "USD", "Energy Select Sector", "Energy Select Sector SPDR Fund",
                   "sector", "SPDR", "S&P Energy Select"),
    EtfMasterEntry("XLF", "NYSE", "USD", "Financial Select Sector", "Financial Select Sector SPDR Fund",
                   "sector", "SPDR", "S&P Financial Select"),
    EtfMasterEntry("ARKK", "NYSE", "USD", "ARK 혁신 ETF", "ARK Innovation ETF",
                   "thematic", "ARK", None),

    # ── Dividend ──────────────────────────────────────────────────
    EtfMasterEntry("SCHD", "NYSE", "USD", "Schwab 배당", "Schwab US Dividend Equity ETF",
                   "dividend", "Schwab", "Dow Jones US Dividend 100"),
    EtfMasterEntry("VYM", "NYSE", "USD", "Vanguard 고배당", "Vanguard High Dividend Yield ETF",
                   "dividend", "Vanguard", "FTSE High Dividend Yield"),

    # ── International ─────────────────────────────────────────────
    EtfMasterEntry("VEA", "NYSE", "USD", "Vanguard 선진국", "Vanguard FTSE Developed Markets ETF",
                   "international", "Vanguard", "FTSE Developed All Cap ex US"),
    EtfMasterEntry("VWO", "NYSE", "USD", "Vanguard 신흥국", "Vanguard FTSE Emerging Markets ETF",
                   "international", "Vanguard", "FTSE Emerging Markets All Cap"),
    EtfMasterEntry("EWJ", "NYSE", "USD", "iShares 일본", "iShares MSCI Japan ETF",
                   "international", "iShares", "MSCI Japan"),

    # ── Bond ──────────────────────────────────────────────────────
    EtfMasterEntry("AGG", "NYSE", "USD", "iShares Core 채권", "iShares Core US Aggregate Bond ETF",
                   "bond", "iShares", "Bloomberg US Aggregate"),
    EtfMasterEntry("TLT", "NASDAQ", "USD", "iShares 20년+ 국채", "iShares 20+ Year Treasury Bond ETF",
                   "bond", "iShares", "ICE US Treasury 20+"),

    # ── Commodity ─────────────────────────────────────────────────
    EtfMasterEntry("GLD", "NYSE", "USD", "SPDR 금", "SPDR Gold Shares",
                   "commodity", "SPDR", "Gold Spot"),

    # ── Leveraged ─────────────────────────────────────────────────
    EtfMasterEntry("TQQQ", "NASDAQ", "USD", "ProShares 나스닥100 3X", "ProShares UltraPro QQQ",
                   "leveraged_inverse", "ProShares", "NASDAQ 100 3X"),
    EtfMasterEntry("SOXL", "NYSE", "USD", "Direxion 반도체 3X", "Direxion Semiconductor Bull 3X",
                   "leveraged_inverse", "Direxion", "PHLX Semiconductor 3X"),
]


# 통합 export
ALL_ETFS: list[EtfMasterEntry] = KR_ETFS + US_ETFS


def get_curated_etfs() -> list[EtfMasterEntry]:
    """전체 큐레이션 ETF 리스트."""
    return ALL_ETFS


def get_etfs_by_currency(currency: str) -> list[EtfMasterEntry]:
    """통화별 ETF 필터."""
    return [e for e in ALL_ETFS if e.currency == currency]


def get_etfs_by_category(category: str) -> list[EtfMasterEntry]:
    """카테고리별 ETF 필터."""
    return [e for e in ALL_ETFS if e.category == category]

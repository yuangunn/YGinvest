"""Plan #20.2 — sector + name keyword 휴리스틱으로 stock_themes 대량 매핑.

기존 hand-curated 매핑을 유지하면서, 패턴 매칭으로 누락된 종목들 추가.

Heuristics:
1. Korean name keyword → specific sub-theme (가장 신뢰도 높음)
2. yfinance sector → root theme (broad fallback)

idempotent: on_conflict do_nothing.
"""
import io
import os
import sys
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from supabase import create_client

CLOUD_URL = os.environ["CLOUD_URL"]
CLOUD_KEY = os.environ["CLOUD_KEY"]
supabase = create_client(CLOUD_URL, CLOUD_KEY)

# Theme IDs (from migrations)
T = {
    # roots
    "semi": "11111111-1111-1111-1111-000000000001",
    "battery": "11111111-1111-1111-1111-000000000002",
    "ai_sw": "11111111-1111-1111-1111-000000000003",
    "bio": "11111111-1111-1111-1111-000000000004",
    "defense": "11111111-1111-1111-1111-000000000005",
    "kcontent": "11111111-1111-1111-1111-000000000006",
    "mobility": "11111111-1111-1111-1111-000000000007",
    "finance": "11111111-1111-1111-1111-000000000008",
    "shipping_heavy": "aaaaaaaa-0001-0001-0001-000000000000",
    "energy_util": "aaaaaaaa-0002-0002-0002-000000000000",
    "construction": "aaaaaaaa-0003-0003-0003-000000000000",
    "consumer": "aaaaaaaa-0004-0004-0004-000000000000",
    "steel_mat": "aaaaaaaa-0005-0005-0005-000000000000",
    "logistics": "aaaaaaaa-0006-0006-0006-000000000000",
    # semiconductor subs
    "memory": "22222222-2222-2222-2222-000000000001",
    "system_semi": "22222222-2222-2222-2222-000000000002",
    "foundry": "22222222-2222-2222-2222-000000000003",
    "semi_equip": "22222222-2222-2222-2222-000000000004",
    "semi_mat": "22222222-2222-2222-2222-000000000005",
    "hbm_ai": "22222222-2222-2222-2222-000000000006",
    "pcb": "cccccccc-0001-0001-0001-000000000001",
    "semi_test": "cccccccc-0001-0001-0001-000000000002",
    # battery
    "battery_cell": "33333333-3333-3333-3333-000000000001",
    "cathode": "33333333-3333-3333-3333-000000000002",
    "anode": "33333333-3333-3333-3333-000000000003",
    "separator": "33333333-3333-3333-3333-000000000004",
    "electrolyte": "33333333-3333-3333-3333-000000000005",
    "battery_equip": "33333333-3333-3333-3333-000000000006",
    "battery_recycle": "cccccccc-0002-0002-0002-000000000001",
    # AI/SW
    "llm": "44444444-4444-4444-4444-000000000001",
    "cloud": "44444444-4444-4444-4444-000000000002",
    "saas": "44444444-4444-4444-4444-000000000003",
    "cyber": "44444444-4444-4444-4444-000000000004",
    "robotics": "cccccccc-0003-0003-0003-000000000001",
    # bio
    "new_drug": "55555555-5555-5555-5555-000000000001",
    "cmo": "55555555-5555-5555-5555-000000000002",
    "diagnostics": "55555555-5555-5555-5555-000000000003",
    "biosimilar": "55555555-5555-5555-5555-000000000004",
    "medical_aesthetics": "cccccccc-0004-0004-0004-000000000001",
    # defense
    "aerospace_defense": "66666666-6666-6666-6666-000000000001",
    "ground_defense": "66666666-6666-6666-6666-000000000002",
    # k-content
    "k_ent": "77777777-7777-7777-7777-000000000001",
    "gaming": "77777777-7777-7777-7777-000000000002",
    "media_drama": "77777777-7777-7777-7777-000000000003",
    # mobility
    "auto_oem": "88888888-8888-8888-8888-000000000001",
    "auto_parts": "88888888-8888-8888-8888-000000000002",
    "autonomous": "88888888-8888-8888-8888-000000000003",
    # finance
    "banking": "99999999-9999-9999-9999-000000000001",
    "securities": "99999999-9999-9999-9999-000000000002",
    "insurance": "99999999-9999-9999-9999-000000000003",
    # shipping/heavy
    "shipbuilding": "bbbbbbbb-0001-0001-0001-000000000001",
    "heavy_machinery": "bbbbbbbb-0001-0001-0001-000000000002",
    "power_equip": "bbbbbbbb-0001-0001-0001-000000000003",
    # energy/util
    "oil_refining": "bbbbbbbb-0002-0002-0002-000000000001",
    "electric_util": "bbbbbbbb-0002-0002-0002-000000000002",
    "telecom": "bbbbbbbb-0002-0002-0002-000000000003",
    "nuclear": "bbbbbbbb-0002-0002-0002-000000000004",
    "renewable": "bbbbbbbb-0002-0002-0002-000000000005",
    # construction
    "gen_construction": "bbbbbbbb-0003-0003-0003-000000000001",
    "plant_engineering": "bbbbbbbb-0003-0003-0003-000000000002",
    # consumer
    "food_beverage": "bbbbbbbb-0004-0004-0004-000000000001",
    "cosmetics": "bbbbbbbb-0004-0004-0004-000000000002",
    "retail_ecommerce": "bbbbbbbb-0004-0004-0004-000000000003",
    "tobacco_leisure": "bbbbbbbb-0004-0004-0004-000000000004",
    # steel/materials
    "steel": "bbbbbbbb-0005-0005-0005-000000000001",
    "non_ferrous": "bbbbbbbb-0005-0005-0005-000000000002",
    "chemicals": "bbbbbbbb-0005-0005-0005-000000000003",
    # logistics
    "shipping_marine": "bbbbbbbb-0006-0006-0006-000000000001",
    "aviation": "bbbbbbbb-0006-0006-0006-000000000002",
    "logistics_parcel": "bbbbbbbb-0006-0006-0006-000000000003",
}

# (keyword pattern, theme key, weight)
# Order matters: more specific first. 첫 매치만 사용.
KR_NAME_RULES: list[tuple[str, str, float]] = [
    # ─────── 반도체 ───────
    ("HBM|하이닉스|이수페타시스", "hbm_ai", 0.8),
    ("메모리", "memory", 0.9),
    ("파운드리|DB하이텍", "foundry", 1.0),
    ("반도체 장비|반도체장비|솔브레인|원익|한솔케미칼|동진세미켐|티씨케이|미코|코미코|HPSP", "semi_equip", 0.9),
    ("PCB|기판|이수페타시스|대덕전자", "pcb", 0.9),
    ("리노공업|에스에프에이|네패스|티에스이|디아이|엘오티|이오테크닉스", "semi_equip", 0.9),
    ("반도체|시스템반도체|LX세미콘|어보브반도체|넥스트칩|텔레칩스", "system_semi", 0.7),
    # ─────── 2차전지 ───────
    ("LG에너지|삼성SDI|SK이노베이션", "battery_cell", 1.0),
    ("에코프로|포스코퓨처엠|엘앤에프|코스모신소재", "cathode", 1.0),
    ("음극재|SKC", "anode", 0.9),
    ("분리막|SKIET|더블유씨피", "separator", 1.0),
    ("전해액|동화기업|솔브레인", "electrolyte", 0.9),
    ("배터리 장비|배터리장비|피엔티|이노메트리|디이엔티", "battery_equip", 1.0),
    ("2차전지|리튬|배터리|배터리리사이클|성일하이텍", "battery_cell", 0.6),
    # ─────── AI/SW ───────
    ("LLM|AI 솔루션|솔트룩스|코난테크놀로지|뤼튼", "llm", 0.9),
    ("클라우드|메가존|이노그리드", "cloud", 0.9),
    ("로봇|레인보우|에스피지|두산로보틱스|티로보틱스|뉴로메카", "robotics", 1.0),
    ("사이버 보안|보안|안랩|시큐브|이글루코퍼레이션|시큐아이", "cyber", 1.0),
    ("SaaS|소프트웨어|더존비즈온|영림원|티맥스", "saas", 0.7),
    # ─────── 바이오 ───────
    ("CMO|CDMO|삼성바이오로직스|에스티팜", "cmo", 1.0),
    ("진단|랩지노믹스|씨젠|에스디바이오센서|바이오노트|클리노믹스|솔젠트|수젠텍", "diagnostics", 1.0),
    ("바이오시밀러|셀트리온|삼성에피스|알테오젠", "biosimilar", 0.8),
    ("메디톡신|휴젤|메디톡스|클래시스|뷰노|루닛|레이언스|보툴리눔|필러|에이피알", "medical_aesthetics", 1.0),
    ("바이오|제약|신약|HLB|동아ST|유한양행|한미약품|JW중외|일동제약|보령|대웅", "new_drug", 0.8),
    # ─────── 방산 ───────
    ("항공우주|한국항공우주|쎄트렉아이|컨텍|인텔리안", "aerospace_defense", 1.0),
    ("방산|LIG|풍산|한화에어로|현대로템|한화시스템", "ground_defense", 0.9),
    # ─────── K-콘텐츠 ───────
    ("HYBE|JYP|와이지엔터|SM엔터|YG|JYP|와이지|에스엠|키이스트|디어유|YGPLUS", "k_ent", 1.0),
    ("게임|크래프톤|넷마블|엔씨소프트|컴투스|위메이드|펄어비스|카카오게임즈|네오위즈|넥슨", "gaming", 1.0),
    ("드라마|스튜디오드래곤|콘텐트리|에이스토리|초록뱀", "media_drama", 1.0),
    ("엔터테인먼트", "k_ent", 0.7),
    # ─────── 모빌리티 ───────
    ("현대차|기아|쌍용|르노", "auto_oem", 1.0),
    ("자동차 부품|자동차부품|현대모비스|만도|성우하이텍|S&T|상신|새론", "auto_parts", 0.9),
    ("타이어|한국타이어|넥센타이어|금호타이어", "auto_parts", 0.9),
    ("자율주행|현대오토에버|MDS테크", "autonomous", 1.0),
    # ─────── 금융 ───────
    ("은행|뱅크|금융지주|기업은행|KB금융|신한지주|하나금융|우리금융|카카오뱅크|JB|BNK|DGB|토스뱅크", "banking", 1.0),
    ("증권|키움증권|미래에셋증권|삼성증권|NH투자|한국금융|메리츠증권|대신증권|유진투자|교보증권|상상인", "securities", 1.0),
    ("보험|화재|생명|한화생명|삼성생명|한화손해|동양생명|롯데손해|코리안리|메리츠화재|미래에셋생명", "insurance", 1.0),
    # ─────── 조선/중공업 ───────
    ("조선|HD현대|한화오션|삼성중공업|현대미포", "shipbuilding", 1.0),
    ("두산에너빌리티|HD현대일렉트릭|효성중공업|LS ELECTRIC|LS일렉트릭", "power_equip", 1.0),
    ("건설기계|굴삭기|HD현대인프라|현대건설기계|두산밥캣", "heavy_machinery", 1.0),
    ("원자력|SMR|소형모듈|두산에너빌리티", "nuclear", 0.6),
    # ─────── 에너지/유틸리티 ───────
    ("정유|S-Oil|에쓰오일|SK이노베이션|GS|현대오일뱅크", "oil_refining", 1.0),
    ("한국전력|한국가스공사|한전KPS|한전기술|지역난방공사", "electric_util", 1.0),
    ("통신|텔레콤|SK텔레콤|KT|LG유플러스", "telecom", 1.0),
    ("태양광|풍력|신재생|한화솔루션|HD현대에너지|OCI", "renewable", 1.0),
    # ─────── 건설/인프라 ───────
    ("건설|현대건설|GS건설|대우건설|DL이앤씨|HDC|반도건설|동부건설|코오롱글로벌|두산건설|HJ중공업", "gen_construction", 1.0),
    ("플랜트|엔지니어링|삼성E&A|삼성엔지니어링|현대엔지니어링", "plant_engineering", 1.0),
    # ─────── 소비재/유통 ───────
    ("식품|식음료|라면|음료|삼양식품|농심|롯데웰푸드|오리온|동원F&B|풀무원|CJ제일제당|대상|오뚜기|매일유업|남양유업|크라운제과|샘표|하림", "food_beverage", 1.0),
    ("화장품|아모레퍼시픽|LG생활건강|코스맥스|한국콜마|애경산업|토니모리|네이처리퍼블릭|에이블씨엔씨|연우|클리오", "cosmetics", 1.0),
    ("유통|마트|쿠팡|이마트|롯데쇼핑|GS리테일|BGF리테일|현대백화점|신세계", "retail_ecommerce", 1.0),
    ("KT&G|롯데칠성|하이트진로", "tobacco_leisure", 1.0),
    # ─────── 철강/소재 ───────
    ("철강|POSCO|포스코|현대제철|동국제강|세아|KG스틸", "steel", 1.0),
    ("고려아연|풍산|LS MnM|영풍|LX인터내셔널", "non_ferrous", 1.0),
    ("화학|LG화학|롯데케미칼|금호석유|효성화학|코오롱인더|SK이노베이션", "chemicals", 0.8),
    # ─────── 물류/항공/해운 ───────
    ("해운|HMM|팬오션|대한해운|KSS해운", "shipping_marine", 1.0),
    ("항공|대한항공|아시아나|티웨이|제주항공|에어부산|진에어", "aviation", 1.0),
    ("물류|택배|글로비스|CJ대한통운|한진|로젠택배", "logistics_parcel", 1.0),
]

# yfinance sector → root theme (broader fallback when no name match)
SECTOR_ROOT: dict[str, str] = {
    "Technology": "ai_sw",
    "Financial Services": "finance",
    "Healthcare": "bio",
    "Industrials": "shipping_heavy",  # broad — only used if no specific name match
    "Consumer Cyclical": "consumer",
    "Consumer Defensive": "consumer",
    "Communication Services": "ai_sw",
    "Energy": "energy_util",
    "Basic Materials": "steel_mat",
    "Utilities": "energy_util",
    "Real Estate": "construction",
}

# US name → specific theme
US_NAME_RULES: list[tuple[str, str, float]] = [
    # cloud/ai
    (r"\b(Microsoft|Amazon\.com|Alphabet|Google|Oracle)\b", "cloud", 0.7),
    (r"\b(Salesforce|ServiceNow|Workday|HubSpot|Snowflake|MongoDB|Atlassian)\b", "saas", 1.0),
    (r"\b(Cloudflare|CrowdStrike|Palo Alto|Fortinet|Zscaler|Okta)\b", "cyber", 1.0),
    (r"\b(Nvidia|AMD|Intel|Texas Instruments|Broadcom|Qualcomm|Marvell|Analog Devices)\b", "system_semi", 1.0),
    (r"\b(Applied Materials|Lam Research|ASML|KLA|Tokyo Electron)\b", "semi_equip", 1.0),
    # banking/finance
    (r"\b(JPMorgan|Bank of America|Wells Fargo|Citigroup|Goldman Sachs|Morgan Stanley|Bank of New York)\b", "banking", 1.0),
    (r"\b(Berkshire|BlackRock|Schwab|Charles Schwab|Fidelity)\b", "securities", 0.8),
    (r"\b(Insurance|Allstate|Progressive|Chubb|Travelers|Aflac|MetLife|Prudential)\b", "insurance", 1.0),
    # bio
    (r"\b(Pfizer|Merck|Johnson & Johnson|Eli Lilly|AbbVie|Bristol-Myers|GSK|Novo Nordisk)\b", "new_drug", 1.0),
    (r"\b(Moderna|BioNTech|Regeneron|Vertex|Gilead|Amgen|Biogen)\b", "new_drug", 1.0),
    # auto
    (r"\b(Tesla|Ford|General Motors|Stellantis|Rivian|Lucid)\b", "auto_oem", 1.0),
    # energy
    (r"\b(Exxon|Chevron|ConocoPhillips|EOG|Marathon|Occidental|Devon|Pioneer)\b", "oil_refining", 1.0),
    # consumer
    (r"\b(Coca-Cola|PepsiCo|Procter|Walmart|Costco|Target|Kroger|Home Depot|Lowe)\b", "retail_ecommerce", 0.8),
    (r"\b(Altria|Philip Morris|British American)\b", "tobacco_leisure", 1.0),
    # defense
    (r"\b(Lockheed|Raytheon|Northrop|General Dynamics|Boeing|L3Harris)\b", "aerospace_defense", 1.0),
    # k-content equivalent for US
    (r"\b(Disney|Netflix|Warner|Paramount|Sony)\b", "media_drama", 1.0),
    (r"\b(Activision|Electronic Arts|Take-Two|Roblox)\b", "gaming", 1.0),
    # logistics
    (r"\b(FedEx|UPS|United Parcel|XPO|Old Dominion)\b", "logistics_parcel", 1.0),
    (r"\b(Delta|United Airlines|American Airlines|Southwest|JetBlue|Alaska Air)\b", "aviation", 1.0),
    (r"\b(Maersk)\b", "shipping_marine", 1.0),
]

import re


def fetch_all_stocks() -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        batch = (
            supabase.table("stocks")
            .select("symbol, name, name_ko, market, sector")
            .eq("is_active", True)
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


def determine_themes(stock: dict) -> list[tuple[str, float]]:
    """Return list of (theme_key, weight) for this stock."""
    out: list[tuple[str, float]] = []
    name_ko = (stock.get("name_ko") or "").strip()
    name_en = (stock.get("name") or "").strip()
    sector = stock.get("sector")
    is_kr = stock["market"] in ("KRX_KS", "KRX_KQ")

    # 1) Korean name keyword (가장 신뢰)
    if is_kr and name_ko:
        for pattern, key, weight in KR_NAME_RULES:
            if re.search(pattern, name_ko):
                out.append((key, weight))
                break  # 첫 매치만

    # 2) US name keyword
    if not is_kr and name_en:
        for pattern, key, weight in US_NAME_RULES:
            if re.search(pattern, name_en, re.IGNORECASE):
                out.append((key, weight))
                break

    # 3) Sector fallback for ROOT — 종목명 매치 실패 시 sector로 broad 분류
    if not out and sector:
        root_key = SECTOR_ROOT.get(sector)
        if root_key:
            out.append((root_key, 0.5))  # lower weight — broad heuristic

    return out


def main():
    stocks = fetch_all_stocks()
    print(f"Total active stocks: {len(stocks)}")

    new_mappings: list[dict] = []
    no_match = 0
    by_theme: dict[str, int] = {}
    by_source: dict[str, int] = {"name": 0, "sector": 0}

    for stock in stocks:
        themes = determine_themes(stock)
        if not themes:
            no_match += 1
            continue
        for key, weight in themes:
            theme_id = T.get(key)
            if not theme_id:
                continue
            new_mappings.append(
                {
                    "stock_symbol": stock["symbol"],
                    "theme_id": theme_id,
                    "weight": weight,
                }
            )
            by_theme[key] = by_theme.get(key, 0) + 1
            by_source["name" if weight > 0.5 else "sector"] += 1

    print(f"\nMapping candidates: {len(new_mappings)}")
    print(f"  by name: {by_source['name']}")
    print(f"  by sector fallback: {by_source['sector']}")
    print(f"  no match: {no_match}")
    print(f"\nTop themes by hit count:")
    for k, v in sorted(by_theme.items(), key=lambda x: -x[1])[:15]:
        print(f"  {k}: {v}")

    # Insert in chunks
    chunk_size = 200
    inserted = 0
    for i in range(0, len(new_mappings), chunk_size):
        chunk = new_mappings[i:i + chunk_size]
        try:
            supabase.table("stock_themes").upsert(
                chunk, on_conflict="stock_symbol,theme_id"
            ).execute()
            inserted += len(chunk)
        except Exception as exc:
            print(f"  chunk {i} failed: {exc}")

    print(f"\nDONE - upsert {inserted} mappings")


if __name__ == "__main__":
    main()

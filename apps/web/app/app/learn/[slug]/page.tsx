import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Term } from "@/components/term";

type Article = {
  title: string;
  minutes: number;
  body: React.ReactNode;
};

const ARTICLES: Record<string, Article> = {
  "interest-rate-and-stocks": {
    title: "금리와 주식의 관계",
    minutes: 5,
    body: (
      <>
        <p>
          <Term k="interest-rate">금리</Term>는 모든 자산 가격에 가장 영향력이 큰 단일 변수다. 한국에서는 한국은행 금융통화위원회가, 미국에서는 연방준비제도(Fed)가 기준금리를 결정한다.
        </p>
        <h3>왜 금리가 주식에 영향을 줄까?</h3>
        <p>
          주식의 이론 가치는 <strong>미래 현금흐름의 현재가치 합</strong> 으로 계산된다 (DCF, 할인현금흐름). 할인율로 금리를 사용하기 때문에:
        </p>
        <ul>
          <li>금리 ↑ → 할인율 ↑ → 미래 현금흐름의 현재가치 ↓ → 주가 ↓</li>
          <li>금리 ↓ → 할인율 ↓ → 미래 현금흐름의 현재가치 ↑ → 주가 ↑</li>
        </ul>
        <h3>왜 성장주가 더 민감할까?</h3>
        <p>
          <Term k="growth-vs-value">성장주</Term>는 미래 5-10년 이후의 현금흐름 기대치가 가치의 대부분이다. 할인율 변화의 영향을 강하게 받는다. 반면 가치주(은행, 정유 등)는 현재 이익 비중이 크고, 할인율 변동의 영향이 작다.
        </p>
        <h3>2022년의 교훈</h3>
        <p>
          미국 Fed가 2022년 3월부터 2023년 7월까지 금리를 0.25% → 5.5% 로 급격히 올렸을 때:
        </p>
        <ul>
          <li>나스닥 -33% (성장주 폭락)</li>
          <li>KOSPI -25%</li>
          <li>채권도 동시 하락 (TLT -30%) — 인플레이션 + 금리 인상 동시 발생 시 안전자산 효과 실종</li>
          <li>금/원자재만 상대 강세</li>
        </ul>
        <h3>실전 적용</h3>
        <p>
          금리 인상기 → 가치주/배당주 비중 ↑, 현금 보유 ↑<br />
          금리 인하기 → 성장주/모멘텀 종목 비중 ↑, <Term k="bond">채권</Term> 상승 베팅
        </p>
      </>
    ),
  },
  "bond-vs-stock": {
    title: "주식과 채권의 차이",
    minutes: 4,
    body: (
      <>
        <p>
          자산 클래스 중 가장 기본은 주식과 <Term k="bond">채권</Term>이다.
        </p>
        <h3>핵심 차이</h3>
        <table>
          <thead>
            <tr><th></th><th>주식</th><th>채권</th></tr>
          </thead>
          <tbody>
            <tr><td>지위</td><td>회사의 소유권(지분)</td><td>회사에 빌려준 돈(채권자)</td></tr>
            <tr><td>수익</td><td>가격 상승 + 배당 (불확정)</td><td>고정 이자 + 만기 원금</td></tr>
            <tr><td>위험</td><td>회사 도산 시 잔여 자산 마지막 권리</td><td>회사 도산 시 우선 변제권</td></tr>
            <tr><td>변동성</td><td>높음</td><td>낮음</td></tr>
            <tr><td>인플레</td><td>가격 전가력 있는 기업은 hedge</td><td>약함 (고정 이자가 실질 가치 ↓)</td></tr>
          </tbody>
        </table>
        <h3>왜 함께 보유?</h3>
        <p>
          전통적으로 주식과 채권은 <Term k="stock-bond-correlation">반대로 움직인다</Term>:
        </p>
        <ul>
          <li>경기 호황 → 주식 ↑, 채권 ↓ (금리 인상 압력)</li>
          <li>경기 침체/공포 → 주식 ↓, 채권 ↑ (안전자산 선호 + 금리 인하 기대)</li>
        </ul>
        <p>
          그래서 클래식한 60/40 (주식 60% + 채권 40%) 포트폴리오가 변동성을 줄여준다. 다만 2022년처럼 인플레이션 + 금리 급등 시 둘 다 동시 하락하는 예외도 있다.
        </p>
        <h3>한국에서 채권 투자</h3>
        <p>
          개인이 채권에 투자하는 방법:
        </p>
        <ul>
          <li>채권 ETF (KODEX 국고채 등) — 가장 쉬움</li>
          <li>증권사 직접 매수 — 최소 1000만원~</li>
          <li>저축은행/장기예금 — 채권은 아니지만 비슷한 효과</li>
        </ul>
      </>
    ),
  },
  "inflation-assets": {
    title: "인플레이션 시대의 자산 배분",
    minutes: 6,
    body: (
      <>
        <p>
          <Term k="inflation">인플레이션</Term>은 통화 가치 하락 = 같은 돈으로 살 수 있는 양 감소. CPI(소비자물가지수)로 측정한다.
        </p>
        <h3>인플레이션에 약한 자산</h3>
        <ul>
          <li><strong>현금 / 예금</strong>: 명목 수익률이 인플레이션을 못 따라가면 실질 마이너스</li>
          <li><strong>고정금리 <Term k="bond">채권</Term></strong>: 받는 이자가 고정되어 있어 인플레 진행 시 실질 가치 ↓</li>
          <li><strong>가격 전가력 없는 회사 주식</strong>: 원가가 올라도 판매가를 못 올리면 마진 ↓</li>
        </ul>
        <h3>인플레이션 헤지 자산</h3>
        <ul>
          <li><strong>금 / 원자재</strong>: 화폐 가치 하락 시 실물자산 선호</li>
          <li><strong><Term k="real-estate">부동산</Term></strong>: 토지/건물은 인플레와 함께 상승 경향</li>
          <li><strong>가격 전가력 있는 주식</strong>: 코카콜라, P&G 같은 브랜드, 독과점 기업</li>
          <li><strong>물가연동채(TIPS)</strong>: 미국 정부가 발행하는 인플레 보정 채권</li>
        </ul>
        <h3>한국 시장에서의 인플레 hedge</h3>
        <p>
          - 정유주 (S-Oil, SK이노베이션) — 유가 상승 시 마진 확대<br />
          - 식음료 (오리온, 농심) — 가격 인상 가능<br />
          - 부동산 (REIT) — 임대료 인상<br />
          - 금/원자재 ETF
        </p>
        <h3>주의: 스태그플레이션</h3>
        <p>
          경기 침체 + 인플레이션 동반 발생 시 (1970년대 미국, 2022년 부분적) 거의 모든 자산이 동시 하락. 이 시기는 현금 + 단기 채권 + 일부 원자재가 그나마 방어.
        </p>
      </>
    ),
  },
  "real-estate-stock": {
    title: "부동산과 주식의 상관관계",
    minutes: 5,
    body: (
      <>
        <p>
          <Term k="real-estate">부동산</Term>과 주식은 모두 위험자산이지만 성격이 매우 다르다.
        </p>
        <h3>공통점</h3>
        <ul>
          <li>금리에 민감 — 금리 인상 시 둘 다 부담</li>
          <li>경기 사이클 반영 — 호황기 둘 다 상승</li>
          <li>인플레이션 hedge 가능</li>
        </ul>
        <h3>차이점</h3>
        <table>
          <thead><tr><th></th><th>부동산</th><th>주식</th></tr></thead>
          <tbody>
            <tr><td>유동성</td><td>매우 낮음 (매도까지 수개월)</td><td>매우 높음 (즉시 거래)</td></tr>
            <tr><td>거래비용</td><td>취득세 1-4% + 양도세</td><td>수수료 0.015-0.215%</td></tr>
            <tr><td>레버리지</td><td>담보대출 60-80%</td><td>신용거래 가능 (제한적)</td></tr>
            <tr><td>변동성</td><td>낮음 (분기별 시세 변화)</td><td>높음 (일중 ±10%)</td></tr>
            <tr><td>현금흐름</td><td>월세 (수익률 2-4%)</td><td><Term k="dividend">배당</Term> (1-3%)</td></tr>
          </tbody>
        </table>
        <h3>한국 특유의 동학</h3>
        <p>
          한국은 가계 자산의 70%+ 가 부동산. 부동산 가격 상승 시 자산효과로 소비 ↑ → 내수 종목 (롯데, GS리테일) 강세. 반대로 부동산 침체 시 건설주, 가구주, 가전주 동반 부진.
        </p>
        <h3>REIT (부동산투자신탁)</h3>
        <p>
          부동산을 주식처럼 거래할 수 있는 펀드. 한국에는 SK리츠, 롯데리츠, ESR켄달스퀘어 등. 90% 이상 배당 의무 → 고배당 종목.
        </p>
      </>
    ),
  },
  "fx-export-stocks": {
    title: "환율이 수출주에 미치는 영향",
    minutes: 4,
    body: (
      <>
        <p>
          <Term k="fx">환율</Term>은 한국 시장의 핵심 변수다. 한국은 GDP의 35-40%가 수출이라서 원/달러 환율이 KOSPI에 직접 영향을 준다.
        </p>
        <h3>원화 약세 (= 환율 상승)</h3>
        <p>유리한 종목:</p>
        <ul>
          <li>현대차, 기아 — 해외 매출 비중 75%+</li>
          <li>삼성전자, SK하이닉스 — 반도체 95%+ 해외 매출</li>
          <li>현대글로비스, HMM — 운임이 USD</li>
          <li>한미반도체, 리노공업 — 장비 수출</li>
        </ul>
        <p>불리한 종목:</p>
        <ul>
          <li>대한항공, 아시아나항공 — 항공유 USD 결제</li>
          <li>S-Oil, SK이노베이션 — 원유 수입</li>
          <li>외국인 보유 비중 높은 종목 — 외국인 자금 이탈 가능</li>
        </ul>
        <h3>원화 강세 (= 환율 하락)</h3>
        <p>반대로 작용. 외국인 자금 유입 → KOSPI 상승, 수출 마진 ↓ 우려.</p>
        <h3>실전 활용</h3>
        <p>
          - 1100원 → 1300원 같은 큰 폭 환율 변동 시 수출주 / 수입주 sector rotation 발생.<br />
          - YGinvest의 KRW ↔ USD 환전 시뮬은 0.5% 수수료. 환율 헷지 연습 가능.
        </p>
      </>
    ),
  },
  "growth-vs-value": {
    title: "성장주 vs 가치주",
    minutes: 5,
    body: (
      <>
        <p>
          투자 스타일을 분류하는 가장 유명한 이분법. 어느 한쪽이 늘 우월하지 않고, 시기에 따라 번갈아 강세 (Style Rotation).
        </p>
        <h3>성장주 (Growth Stocks)</h3>
        <ul>
          <li>매출/이익이 빠르게 성장 (연 20%+)</li>
          <li>높은 <Term k="per">PER</Term> (20-100+), 배당 거의 없음</li>
          <li>이익을 재투자하며 미래 가치 창출</li>
          <li>예: NVIDIA, Tesla, 삼성바이오로직스, 카카오</li>
          <li>금리 인하기, 유동성 풍부 시기에 강세</li>
        </ul>
        <h3>가치주 (Value Stocks)</h3>
        <ul>
          <li>시장이 저평가했다고 보는 안정적 기업</li>
          <li>낮은 PER (5-15), 높은 <Term k="dividend">배당</Term> (3-6%)</li>
          <li>현재 이익이 크지만 성장률은 둔화</li>
          <li>예: KB금융, 삼성화재, POSCO, 한국전력</li>
          <li>금리 인상기, 경기 회복기에 상대 강세</li>
        </ul>
        <h3>역사적 사이클</h3>
        <ul>
          <li>2010-2020: 성장주 압도적 강세 (저금리 + 빅테크 부상)</li>
          <li>2022: 가치주 부활 (금리 급등 → 성장주 대량 매도)</li>
          <li>2023-2024: AI 붐으로 성장주 재반등 (NVIDIA, Meta 등)</li>
        </ul>
        <h3>실전 팁</h3>
        <p>
          - 한쪽에 100% 베팅보다 50:50 균형이 변동성 ↓<br />
          - 금리 사이클 + 시장 심리에 따라 비중 조정<br />
          - YGinvest 큐레이션의 “Strong Buy” / “저평가 가치주” 카테고리 활용
        </p>
      </>
    ),
  },
  diversification: {
    title: "분산투자의 원리",
    minutes: 4,
    body: (
      <>
        <p>
          <Term k="diversification">분산투자</Term>는 “free lunch in investing” 으로 불리는 유일한 무료 이익이다. 위험을 줄이면서 같은 기대수익을 얻을 수 있다.
        </p>
        <h3>왜 작동하는가?</h3>
        <p>
          서로 다른 자산은 같은 사건에 다르게 반응한다:
        </p>
        <ul>
          <li>유가 ↑ → 정유주 ↑, 항공주 ↓</li>
          <li>금리 ↑ → 채권 ↓, 가치주 ↑, 성장주 ↓</li>
          <li>환율 ↑ → 수출주 ↑, 수입주 ↓</li>
        </ul>
        <p>
          포트폴리오 안의 종목들이 서로 다르게 반응하면 전체 변동성이 평균보다 작아진다 (분산 효과).
        </p>
        <h3>분산의 단계</h3>
        <ol>
          <li><strong>종목 분산</strong>: 10-20개 이상 보유. 단일 종목 5% 이하 권장.</li>
          <li><strong>섹터 분산</strong>: 한 섹터 30% 이하. KOSPI는 IT/반도체에 쏠려 있어서 글로벌 분산 필요.</li>
          <li><strong>지역 분산</strong>: 한국 + 미국 + (유럽 / 신흥국). YGinvest는 KR + US 모두 거래 가능.</li>
          <li><strong>자산 클래스 분산</strong>: 주식 + 채권 + 부동산(REIT) + 현금.</li>
        </ol>
        <h3>한국 투자자의 흔한 실수</h3>
        <ul>
          <li>전부 KOSPI/KOSDAQ에 (홈 바이어스, 한 시장 100%)</li>
          <li>반도체 같은 단일 섹터에 몰빵</li>
          <li>모두 성장주 또는 모두 가치주</li>
          <li>주식 100% (채권/부동산 0%)</li>
        </ul>
        <p>
          분산은 “잃지 않는 투자” 의 핵심. 화려한 수익률보다 꾸준한 복리가 결국 이긴다.
        </p>
      </>
    ),
  },
  "per-pbr-roe": {
    title: "PER · PBR · ROE 완전 이해",
    minutes: 7,
    body: (
      <>
        <p>
          가치평가의 핵심 3대 지표: <Term k="per">PER</Term>, <Term k="pbr">PBR</Term>, <Term k="roe">ROE</Term>. 각각 다른 질문에 답한다.
        </p>
        <h3>PER — 주가가 비싼가?</h3>
        <p>
          주가 ÷ <Term k="eps">EPS</Term>. 1주당 순이익의 몇 배에 거래되는지.
        </p>
        <ul>
          <li>PER 5: 5년이면 이익만으로 투자금 회수 (저평가 또는 위험)</li>
          <li>PER 20: 시장 평균 (한국 KOSPI 평균 ~15)</li>
          <li>PER 50+: 미래 성장 기대 (NVIDIA, 테슬라)</li>
        </ul>
        <p>
          섹터별 평균이 크게 다르므로 <strong>같은 섹터 안에서 비교</strong>해야 한다. 적자 기업은 PER 적용 불가.
        </p>
        <h3>PBR — 자산 대비 비싼가?</h3>
        <p>
          주가 ÷ BPS (Book Value Per Share). 회사 청산 가치 대비.
        </p>
        <ul>
          <li>PBR &lt; 1: 청산가치보다 싸게 거래 (저평가 또는 자산 부실 의심)</li>
          <li>PBR 1-2: 일반</li>
          <li>PBR 5+: IT/플랫폼 기업 흔함</li>
        </ul>
        <p>
          한국 은행주가 PBR 0.3-0.5 인 경우가 흔한데, 이는 “시장이 자산 가치를 의심한다” 는 신호다. 가치 함정(value trap) 주의.
        </p>
        <h3>ROE — 자본을 잘 굴리는가?</h3>
        <p>
          순이익 ÷ 자기자본. 주주의 돈 대비 수익률.
        </p>
        <ul>
          <li>ROE 5%: 평범 (예금 금리 수준)</li>
          <li>ROE 10-15%: 양호</li>
          <li>ROE 20%+: 우수 (애플, 코카콜라급)</li>
        </ul>
        <p>
          단, ROE가 높다고 무조건 좋은 게 아니다. 부채를 많이 끌어다 쓰면 ROE는 부풀려진다. <strong>ROE + 부채비율 + 영업이익률</strong>을 함께 봐야 한다.
        </p>
        <h3>세 지표의 조합</h3>
        <p>
          매력적인 종목의 조건:
        </p>
        <ul>
          <li>PER &lt; 섹터 평균 × 0.8 (저평가)</li>
          <li>PBR 1-2 (자산 건전)</li>
          <li>ROE 15%+ (수익성)</li>
          <li>부채비율 100% 이하</li>
        </ul>
        <p>
          이 조건을 모두 만족하는 종목은 드물지만, 그중 일부는 “숨은 보석”. YGinvest의 큐레이션이 비슷한 알고리즘으로 자동 발굴.
        </p>
      </>
    ),
  },
};

export default async function LearnArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const article = ARTICLES[slug];
  if (!article) notFound();

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link href="/app/learn" className="hover:underline inline-flex items-center gap-0.5">
          <ChevronLeft className="h-3 w-3" />
          학습
        </Link>
      </div>

      <article className="space-y-3">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {article.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{article.minutes}분 읽기</p>
        </header>
        <Card>
          <CardContent>
            <div className="prose prose-sm max-w-none article-body" style={{ wordBreak: "keep-all" }}>
              {article.body}
            </div>
          </CardContent>
        </Card>
      </article>

      <p className="text-xs text-muted-foreground text-center pt-2">
        ⚠️ 일반 교육 목적. 실제 투자 자문이 아닙니다.
      </p>
    </div>
  );
}

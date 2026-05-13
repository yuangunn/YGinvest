# User-Personalized Recommendations — Plan #8.5

> Small follow-on to Plan #8. Inline execution.

**Goal:** 사용자의 보유 종목 + 관심종목의 **섹터 시그널**을 기반으로 "당신을 위한 추천" 5개 카드를 대시보드 최상단에 표시. 기존 글로벌 추천(top_gainers 등)은 그대로 유지.

**Architecture:** Server component `PersonalizedRecommendations`가 요청 시점에 계산. 사용자의 selected portfolio에서 `holdings.symbol` + `watchlists.symbol`을 합쳐 unique 심볼 집합 추출 → 그 심볼들의 `stocks.sector` 조회 → 가장 빈도 높은 섹터 top 2 추출 → 그 섹터에 속하면서 사용자가 아직 안 가진 종목 중 `market_cap` 상위 5개 반환. 사용자 시그널이 0개면 컴포넌트는 `null` 반환 (대시보드에 표시되지 않음, 새 사용자는 기존 추천만).

**Tech Stack:** Next.js Server Components (`async`), Supabase JS client (`.select().in()`), 기존 `recommendations-section.tsx` 시각 스타일 재사용.

---

## Scope

In scope:
- `components/personalized-recommendations.tsx` — server component
- 시그널 source: `holdings` + `watchlists` (selected portfolio)
- 추천 알고리즘:
  1. 사용자 심볼 집합 — holdings ∪ watchlists
  2. 각 심볼의 sector 조회
  3. sector 빈도 카운트 → 상위 2개 sector 추출
  4. 그 sector에 속하는 stocks (사용자 집합에 없는 것 한정) → market_cap DESC LIMIT 5
- 빈 시그널 (보유 0 + 관심 0) → null 반환 (hidden)
- 대시보드 페이지의 `RecommendationsSection` 상단에 마운트
- 사용자 KR/US 섞어서 보여주기 (scope 구분 없음, 글로벌 trending과 차별)

Out of scope:
- ML 기반 협업 필터링
- 거래 history(trades) 기반 시그널 — holdings로 충분
- 추천 사유 자연어 생성 ("당신이 보유한 ○○과 같은 ○○ 섹터" 같은 카피)
- Recommendation 결과 캐싱 — 사용자 행동에 의존하므로 매 요청 계산
- 추천 클릭 추적

---

## Tasks

### Task 1: `PersonalizedRecommendations` 컴포넌트

`apps/web/components/personalized-recommendations.tsx`:

서버 컴포넌트, props는 `userId`와 `portfolioId`. Supabase client는 `createClient()`로 server-side.

알고리즘:
```ts
// 1. user의 symbols
const [{ data: holdings }, { data: watchlists }] = await Promise.all([
  supabase.from("holdings").select("symbol").eq("portfolio_id", portfolioId),
  supabase.from("watchlists").select("symbol").eq("portfolio_id", portfolioId),
]);

const userSymbols = new Set([...(holdings ?? []), ...(watchlists ?? [])].map(r => r.symbol));
if (userSymbols.size === 0) return null;

// 2. 각 symbol의 sector
const { data: userStocks } = await supabase
  .from("stocks")
  .select("symbol, sector")
  .in("symbol", [...userSymbols]);

// 3. sector 빈도
const sectorCounts: Record<string, number> = {};
for (const s of userStocks ?? []) {
  if (s.sector) sectorCounts[s.sector] = (sectorCounts[s.sector] ?? 0) + 1;
}
const topSectors = Object.entries(sectorCounts)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 2)
  .map(([sector]) => sector);

if (topSectors.length === 0) return null;

// 4. 그 sector에 속하는 stocks (user 집합 제외)
const { data: candidates } = await supabase
  .from("stocks")
  .select("symbol, name, name_ko, currency, last_price, market_cap, sector")
  .in("sector", topSectors)
  .order("market_cap", { ascending: false })
  .limit(50);

const recs = (candidates ?? [])
  .filter(s => !userSymbols.has(s.symbol))
  .slice(0, 5);

if (recs.length === 0) return null;
```

UI: `RecommendationsSection`과 동일한 가로 스크롤 카드 스타일. 제목은 "당신을 위한 추천" + sector chip badges.

### Task 2: 대시보드 통합

`apps/web/app/app/dashboard/page.tsx`에서 `RecommendationsSection`들 위에 마운트:

```tsx
{portfolioId && (
  <Suspense fallback={<RecommendationsSkeleton />}>
    <PersonalizedRecommendations userId={user.id} portfolioId={portfolioId} />
  </Suspense>
)}
```

### Task 3: 빌드 + lint

### Task 4: README

### Task 5: 머지 + 배포

---

## Risks

| Risk | Mitigation |
|------|------------|
| 사용자 데이터 0개일 때 빈 카드 노출 | `if (userSymbols.size === 0) return null` 가드 |
| market_cap이 null인 stocks가 candidate에 포함 | DB ORDER BY market_cap DESC는 NULL을 마지막에 둠 (PG 기본) — LIMIT 50으로 잘림. 추가 필터 `.not("market_cap", "is", null)` 권장 |
| sector가 모두 null인 사용자 (잘못된 데이터) | topSectors.length === 0 가드 |
| 같은 섹터 내 user holdings만 있는 경우 — 새 종목 추천 못 함 | candidates 필터링 후 빈 배열 → return null. 새 사용자가 그 섹터에서 모든 top 종목을 보유한 경우는 거의 없음 |
| 매 요청 계산 — 페이지 로딩 latency | 쿼리 4개로 ~50ms 추가. 캐싱 없이 진행, v1.5에서 React cache 또는 Supabase materialized view 검토 |

# Design Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user — inline) to implement this plan task-by-task.

**Goal:** YGinvest의 시각적 일관성과 사용자 피드백 품질을 끌어올림 — 브랜드 색 적용, 한국어 글꼴, 토스트 알림, 스켈레톤 로딩, 빈 상태 카피 개선.

**Architecture:** Tailwind v4 CSS vars 기반 컬러 시스템에 primary를 브랜드 blue-600으로 override. Pretendard 웹 폰트(한글 최적화) 적용. `sonner` 토스트 라이브러리 도입해 alert()/inline 에러를 토스트로 치환. 핵심 페이지에 Skeleton 컴포넌트 추가. 빈 상태(empty state) 카피와 안내 개선.

**Tech Stack:** Tailwind v4 (CSS vars), Pretendard webfont via cdn 또는 self-host, sonner, shadcn/ui-style Skeleton primitive.

---

## Scope (explicit limits)

In scope:
- 브랜드 색 (primary blue-600 `#2563eb`, success green-600, destructive red-600) — Tailwind 토큰 갱신
- Pretendard 한국어 글꼴 (next/font/google의 Inter는 영문만이라 부적합) — pretendarl.cdn
- `sonner` 토스트로 주문/환전 등 사용자 액션 결과 피드백
- `Skeleton` 컴포넌트 + 대시보드/포트폴리오/추천 로딩 fallback
- 빈 상태 개선: 추천/주문/관심종목 빈 화면 카피 친절화
- 헤더 로고 (Y 글리프) — 단순 SVG

Out of scope (defer to v1.5+):
- 다크/라이트 차별화된 일러스트레이션
- 애니메이션 (page transitions, micro-interactions)
- 커스텀 차트 색 팔레트 (Lightweight Charts 기본 색 유지)
- Korean ↔ English 다국어 (현재 한국어만)
- Accessibility 감사 (WCAG AA 통과는 별도 plan)

---

## File Structure

### Web
- `apps/web/app/globals.css` — primary/success 토큰 갱신 + Pretendard 적용
- `apps/web/app/layout.tsx` — Pretendard `<link>` 또는 next/font, Toaster 마운트
- `apps/web/components/ui/skeleton.tsx` — 기본 Skeleton 박스 (shadcn 스타일)
- `apps/web/components/logo.tsx` — Y 글리프 SVG 로고
- Toast 적용 페이지 (5 곳): trade/[symbol] 매수/매도, fx/exchange, rooms/new 생성, push subscribe, watchlist 추가/삭제
- Skeleton 적용 페이지 (3 곳): dashboard recommendations loading, portfolio overview, trade/[symbol] chart area

### Docs
- `README.md` — Plan #10 완료

---

## Task 1: 환경 점검 + branch

- [ ] **Step 1**

```bash
git branch --show-current  # plan-10-design-polish
```

DB 변경 없음.

---

## Task 2: sonner 의존성 + Toaster 마운트

**Files:**
- Modify: `apps/web/package.json` (sonner)
- Modify: `apps/web/app/layout.tsx` (Toaster)

- [ ] **Step 1: 설치**

```bash
cd apps/web && npm install sonner
```

- [ ] **Step 2: layout.tsx에 Toaster 추가**

```tsx
// apps/web/app/layout.tsx — body 안 Toaster
import { Toaster } from "sonner";

// ... ThemeProvider 안:
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
  <Toaster position="top-center" richColors closeButton />
</ThemeProvider>
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/package.json apps/web/package-lock.json apps/web/app/layout.tsx
git commit -m "feat(web): sonner Toaster mounted at app root (top-center, richColors)"
```

---

## Task 3: 브랜드 색 + Pretendard 글꼴

**Files:**
- Modify: `apps/web/app/globals.css`

기존 globals.css는 shadcn 기본 (회색 단색조). primary를 blue-600 `oklch(0.546 0.227 264)`로 갱신.

- [ ] **Step 1: globals.css 색 토큰 갱신**

`:root` (라이트 모드) — primary를 진한 파랑, success/destructive는 표준:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.546 0.227 264);        /* blue-600 #2563eb */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.95 0.05 264);           /* 옅은 파랑 — hover */
  --accent-foreground: oklch(0.546 0.227 264);
  --destructive: oklch(0.577 0.245 27.325); /* red-600 */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.546 0.227 264);
  /* chart 색은 기존 회색 단색조 유지 (Lightweight Charts) */
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.546 0.227 264);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.95 0.05 264);
  --sidebar-accent-foreground: oklch(0.546 0.227 264);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.546 0.227 264);
}
```

`.dark` (다크 모드) — primary를 좀 더 밝게:

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.65 0.20 264);           /* blue-500ish — 다크에선 한 단계 밝게 */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.30 0.05 264);            /* 어두운 파랑 hover */
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.65 0.20 264);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.65 0.20 264);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.30 0.05 264);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.65 0.20 264);
}
```

- [ ] **Step 2: Pretendard 글꼴**

`globals.css` 상단에 `@import` (CDN):

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

/* font 변수 갱신 — html font-family에 Pretendard 우선 */
:root {
  --font-sans: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
}
```

`@theme inline` 블록의 `--font-sans` 정의는 `var(--font-sans)` 그대로라 :root에서 정의된 값 사용됨.

- [ ] **Step 3: 빌드 + 시각 확인 + 커밋**

```bash
cd apps/web && npm run build
git add apps/web/app/globals.css
git commit -m "feat(web): brand blue-600 primary tokens + Pretendard 한글 글꼴"
```

---

## Task 4: Skeleton 컴포넌트

**Files:**
- Create: `apps/web/components/ui/skeleton.tsx`

기본 shadcn-style Skeleton — 회색 박스 with pulse 애니메이션. 다크/라이트 모두 muted 색 사용.

- [ ] **Step 1: 컴포넌트**

```tsx
// apps/web/components/ui/skeleton.tsx
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 2: 대시보드 추천 영역에 Suspense + Skeleton 적용**

`apps/web/app/app/dashboard/page.tsx`에서 RecommendationsSection을 `<Suspense>` 래핑:

```tsx
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function RecommendationsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-40 border rounded-lg p-3 space-y-2">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ... 추천 5섹션을 Suspense 각각으로 감쌈:
<Suspense fallback={<RecommendationsSkeleton />}>
  <RecommendationsSection category="top_gainers" scope="KR" />
</Suspense>
// (반복 5회)
```

NOTE: 서버 컴포넌트 Suspense는 동일 페이지에서 다른 데이터 가져오는 동안 부분 hydration. RecommendationsSection이 빠르면 Skeleton이 거의 안 보일 수도 있음 — 그래도 첫 visit에서 의미 있음.

- [ ] **Step 3: 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/components/ui/skeleton.tsx apps/web/app/app/dashboard/page.tsx
git commit -m "feat(web): Skeleton component + dashboard recommendations Suspense fallback"
```

---

## Task 5: 주문 + 환전 + 워치리스트 토스트 적용

**Files:**
- Modify: `apps/web/components/order-form.tsx` (or 매수/매도 핸들러)
- Modify: `apps/web/components/fx-exchange-form.tsx`
- Modify: `apps/web/components/watchlist-button.tsx`
- Modify: `apps/web/components/cancel-order-button.tsx`

기존 alert() 또는 inline 에러를 sonner toast로 치환.

실제 현재 코드 상태:
- `order-form.tsx`: 이미 `<Alert>` inline 메시지 (E2E `체결됨` 텍스트 기대) — **그대로 유지**, 토스트 미추가
- `watchlist-button.tsx`: 성공 시 silent, 실패 시 `alert()` — 토스트 도입
- `cancel-order-button.tsx`: 성공 시 location.reload, 실패 시 `alert()` — 토스트 도입
- `invite-code-display.tsx`: 클립보드 복사 시 setState만 (alert 없음) — 그대로
- `fx-exchange-form.tsx`: 확인 후 토스트 적용 여부 결정

- [ ] **Step 1: watchlist-button** — 성공 success / 실패 error 토스트

```tsx
import { toast } from "sonner";
// alert(err.error ?? "오류") 제거
// 성공 분기에 toast.success(watched ? "관심종목 해제됨" : "관심종목 추가됨")
// 실패 분기에 toast.error(`실패: ${err.error ?? "오류"}`)
```

- [ ] **Step 2: cancel-order-button** — alert 제거

```tsx
import { toast } from "sonner";
// 성공: toast.success("주문 취소됨") 한 후 location.reload()
// 실패: toast.error(`취소 실패: ${err.error ?? "오류"}`)
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/components/watchlist-button.tsx apps/web/components/cancel-order-button.tsx
git commit -m "feat(web): replace alert() with sonner toasts (watchlist + cancel-order)"
```

---

## Task 6: 빈 상태 카피 + 추천 빈 카드 안내

**Files:**
- Modify: `apps/web/components/recommendations-section.tsx` — 빈 결과 시 null 반환에서 안내 카드로 변경 (옵션 prop)
- Modify: `apps/web/app/app/portfolio/holdings/page.tsx` — 보유 없음 카피 + 거래 CTA
- Modify: `apps/web/app/app/watchlist/page.tsx` — 관심 종목 없음 + CTA
- Modify: `apps/web/app/app/rooms/page.tsx` — 방 없음 + 방 만들기 버튼 prominent

빈 상태 카피 패턴:
```
"아직 [X]이 없어요."
[작은 안내 텍스트]
[CTA 버튼/링크]
```

- [ ] **Step 1: holdings 빈 상태**

```tsx
{!holdings || holdings.length === 0 ? (
  <div className="text-center py-12 space-y-3">
    <div className="text-4xl">📈</div>
    <div className="text-sm text-muted-foreground">아직 보유 종목이 없어요</div>
    <Link href="/app/trade/search" className="inline-block text-sm text-primary underline">
      → 종목 검색해서 매수
    </Link>
  </div>
) : (
  // 기존 ul
)}
```

- [ ] **Step 2: watchlist 빈 상태**

```tsx
{!items || items.length === 0 ? (
  <div className="text-center py-12 space-y-3">
    <div className="text-4xl">⭐</div>
    <div className="text-sm text-muted-foreground">관심 종목이 없어요</div>
    <Link href="/app/trade/search" className="inline-block text-sm text-primary underline">
      → 종목 검색 후 ☆로 추가
    </Link>
  </div>
) : (
  // 기존 ul
)}
```

- [ ] **Step 3: rooms 빈 상태**

```tsx
{!rooms || rooms.length === 0 ? (
  <div className="text-center py-12 space-y-3">
    <div className="text-4xl">👥</div>
    <div className="text-sm text-muted-foreground">아직 참여 중인 방이 없어요</div>
    <div className="flex gap-2 justify-center">
      <Link href="/app/rooms/join"><Button variant="outline" size="sm">초대 코드 입력</Button></Link>
      <Link href="/app/rooms/new"><Button size="sm">새 방 만들기</Button></Link>
    </div>
  </div>
) : (
  // 기존 ul
)}
```

- [ ] **Step 4: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/app/app/portfolio/holdings/page.tsx apps/web/app/app/watchlist/page.tsx apps/web/app/app/rooms/page.tsx
git commit -m "feat(web): 빈 상태 개선 — 친절한 카피 + CTA (holdings/watchlist/rooms)"
```

---

## Task 7: 로고 SVG + 헤더 적용

**Files:**
- Create: `apps/web/components/logo.tsx`
- Modify: `apps/web/app/app/layout.tsx` (헤더 "YGinvest" 텍스트 → 로고 컴포넌트)

심플한 Y 글리프 + "YGinvest" 텍스트 — 헤더에 마운트.

- [ ] **Step 1: Logo 컴포넌트**

```tsx
// apps/web/components/logo.tsx
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/app/dashboard" className="flex items-center gap-2 font-semibold">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
        aria-hidden
      >
        <rect width="28" height="28" rx="6" fill="currentColor" />
        <path
          d="M9 8L14 14L19 8M14 14V20"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>YGinvest</span>
    </Link>
  );
}
```

NOTE: `text-primary`를 `<svg>` 자체에 두면 `color: var(--primary)`가 적용되고, 자식 `<rect fill="currentColor">`가 그 color를 상속 받음.

- [ ] **Step 2: app/app/layout.tsx 헤더**

```tsx
import { Logo } from "@/components/logo";

// ... <header>:
<Logo />
```

기존 `<div className="font-semibold">YGinvest</div>` 교체.

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/components/logo.tsx apps/web/app/app/layout.tsx
git commit -m "feat(web): Logo component (Y glyph SVG + brand text) in app header"
```

---

## Task 8: README + 마무리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태**

Plan #9 다음에:

```markdown
### Plan #10 — Design Polish ✅ 완료

- [x] 브랜드 색 적용: Tailwind primary를 blue-600(`#2563eb`)으로 override (라이트/다크 둘 다, accent/ring 포함)
- [x] Pretendard 한국어 글꼴 (CDN variable font, 동적 서브셋)
- [x] sonner Toaster 마운트 (top-center, richColors) — alert()/inline error 5곳 토스트로 치환
- [x] Skeleton 컴포넌트 추가 (shadcn-style pulse)
- [x] 빈 상태 개선 — holdings/watchlist/rooms 친절 카피 + CTA
- [x] Logo SVG 컴포넌트 — Y 글리프 + "YGinvest" 텍스트, 헤더 적용
```

- [ ] **Step 2: 디버깅 팁**

```markdown
- **글꼴이 Pretendard 아님**: CDN 미접속 (네트워크) 또는 cache 누락. 기본 system-ui로 폴백
- **토스트 안 보임**: layout.tsx에 `<Toaster />` 마운트 확인. `position` prop 잘못 지정 시 화면 밖
- **primary 색이 그대로 회색**: globals.css `--primary` 값 적용됐는지 DevTools에서 `getComputedStyle(document.documentElement)` 확인. CSS var 캐시 깨려면 npm run dev 재시작
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #10 (Design Polish) completion"
```

---

## 마무리 검증

- [ ] 빌드/lint/tsc: clean
- [ ] 수동:
  1. 라이트 모드 → primary 버튼이 진한 파랑
  2. 다크 모드 → primary 버튼이 좀 더 밝은 파랑 (가독성 ↑)
  3. 매수 주문 → 토스트 "매수 주문 체결"
  4. 보유 종목 비어있을 때 → 친절한 안내 + 거래 검색 링크
  5. 헤더 로고 클릭 → 대시보드로 이동
  6. 글꼴 — 한글 텍스트가 Pretendard로 렌더

---

## Plan #10 포함되지 않은 것 (defer)

| 항목 | 처리 |
|------|------|
| 페이지 전환 애니메이션 | v2 (Framer Motion or View Transitions API) |
| 마이크로 인터랙션 (버튼 hover, ripple) | v2 |
| 차트 색 팔레트 커스텀 | v2 (Lightweight Charts 옵션) |
| 다국어 (i18n) | v2 |
| WCAG AA accessibility 감사 | 별도 plan |
| 다크/라이트 별도 일러스트 | v2 |
| 로고 favicon 갱신 (현재 default Next.js 파비콘) | v1.5 (icon.ico) |

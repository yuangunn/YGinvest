# PWA & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user — inline) to implement this plan task-by-task.

**Goal:** YGinvest를 진짜 PWA로 만들어 모바일 홈 화면에 설치 가능하게 + 다크/라이트 토글 + 모바일 하단 네비게이션 추가.

**Architecture:** `manifest.json` + 표준 PWA 메타 태그 + 아이콘(192/512/maskable). 기존 `/sw.js` (Plan #7 push handler)는 그대로 유지하고 install/activate에 client claim만 추가됨. `next-themes`로 다크/라이트 토글 (system 기본). 모바일에서만 보이는 `BottomNav` 컴포넌트 (대시보드/거래/포트폴리오/방/설정 5개 탭).

**Tech Stack:** Next.js 16 metadata API, next-themes (Theme Provider), Pillow (one-shot icon generation), Tailwind v4 (반응형 utilities).

---

## Scope (explicit limits)

In scope:
- **PWA manifest** with name/icons/display/theme_color/start_url
- App icons: 192×192, 512×512, maskable 512×512 — 단순한 brand glyph + 색 배경
- 메타 태그: theme-color, apple-touch-icon, viewport
- **Dark/Light/System** 테마 토글 (next-themes, ClassProvider). 기본 system.
- **BottomNav** 모바일 하단 네비게이션 (5탭, md 이상에서 hidden)
- 기존 `sw.js` (Plan #7 push) 유지 + install/activate skip waiting 코드 정리 (이미 있음)

Out of scope (defer to v1.5+):
- 오프라인 모드 / 캐시 전략 (push-only SW 유지)
- 백그라운드 동기화
- iOS Safari Apple Web App banner UI (manifest만 제공, 사용자가 직접 "홈 화면 추가")
- Splash screen 이미지 (iOS — apple-touch-startup-image)
- 진동 / 햅틱 피드백
- 화면 회전 잠금
- 사용자 정의 테마 색 (브랜드 색만 지원)

---

## File Structure

### Web — public assets (3)
- `apps/web/public/manifest.json` — PWA 매니페스트
- `apps/web/public/icon-192.png` — 192×192 표준 아이콘
- `apps/web/public/icon-512.png` — 512×512 표준 아이콘
- `apps/web/public/icon-maskable-512.png` — 512×512 maskable 안전영역 80% (Android)

### Web — code
- `apps/web/app/layout.tsx` — manifest link + theme-color meta + apple-touch-icon, ThemeProvider 래핑
- `apps/web/components/theme-provider.tsx` — next-themes 래퍼 (Provider client component)
- `apps/web/components/theme-toggle.tsx` — 토글 버튼 (light/dark/system 순환)
- `apps/web/components/bottom-nav.tsx` — 모바일 하단 네비게이션
- `apps/web/app/app/layout.tsx` — BottomNav + ThemeToggle 통합

### Scripts (one-shot)
- `scripts/gen_icons.py` — Pillow로 아이콘 생성 (커밋되지만 일회용)

### Docs
- `README.md` — Plan #9 완료 + PWA 설치 가이드

---

## Task 1: 환경 점검 + branch

- [ ] **Step 1**

```bash
git branch --show-current  # plan-9-pwa-polish
cd apps/web && cat package.json | grep -i next  # Next 16 확인
```

이 plan은 DB 변경 없음.

---

## Task 2: App icons 생성 + 커밋

**Files:**
- Create: `scripts/gen_icons.py`
- Create: `apps/web/public/icon-192.png`
- Create: `apps/web/public/icon-512.png`
- Create: `apps/web/public/icon-maskable-512.png`
- Create: `apps/web/public/apple-touch-icon.png` (180×180 별칭)

심플한 brand glyph: "YG" 텍스트 in 진한 파랑 (#2563eb) 배경 위 흰색 둥근 사각형 카드.

- [ ] **Step 1: 스크립트**

```python
# scripts/gen_icons.py
"""YGinvest 앱 아이콘 일괄 생성 (Pillow).

실행: `cd apps/worker && uv run --with Pillow python ../../scripts/gen_icons.py`
결과: apps/web/public/icon-{192,512,maskable-512}.png + apple-touch-icon.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).parent.parent / "apps" / "web" / "public"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG = (37, 99, 235)        # #2563eb — Tailwind blue-600
FG = (255, 255, 255)


def _render(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # maskable은 safe area 80% — padding 10%씩 둠
    pad = int(size * 0.10) if maskable else int(size * 0.05)
    inner = size - 2 * pad

    # 둥근 흰색 카드
    radius = int(inner * 0.18)
    draw.rounded_rectangle(
        [(pad, pad), (pad + inner, pad + inner)],
        radius=radius,
        fill=FG,
    )

    # "YG" 텍스트 (Pillow 기본 폰트 — 시스템 무관)
    text = "YG"
    font_size = int(inner * 0.5)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1]
    draw.text((tx, ty), text, fill=BG, font=font)
    return img


def main() -> None:
    _render(192).save(OUT_DIR / "icon-192.png")
    _render(512).save(OUT_DIR / "icon-512.png")
    _render(512, maskable=True).save(OUT_DIR / "icon-maskable-512.png")
    _render(180).save(OUT_DIR / "apple-touch-icon.png")
    print("Generated 4 icons in", OUT_DIR)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 실행 + 파일 확인**

```bash
cd apps/worker && uv run --with Pillow python ../../scripts/gen_icons.py
# Expected: "Generated 4 icons in C:\...\apps\web\public"

ls apps/web/public/icon-*.png
ls apps/web/public/apple-touch-icon.png
```

- [ ] **Step 3: 커밋 (PNG는 binary — 한번만 커밋, gen 스크립트는 doc용)**

```bash
git add scripts/gen_icons.py apps/web/public/icon-192.png apps/web/public/icon-512.png apps/web/public/icon-maskable-512.png apps/web/public/apple-touch-icon.png
git commit -m "feat(web): PWA app icons (192/512/maskable) + apple-touch-icon"
```

---

## Task 3: manifest.json + 메타 태그

**Files:**
- Create: `apps/web/public/manifest.json`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: manifest.json**

```json
{
  "name": "YGinvest",
  "short_name": "YGinvest",
  "description": "모의 주식 트레이딩 — 한국·미국 거래소, KRW/USD 분리 계좌, 친구방 리더보드",
  "start_url": "/app/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a0a",
  "theme_color": "#2563eb",
  "lang": "ko",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: layout.tsx 메타 추가 (ThemeProvider는 Task 4에서)**

기존 코드에서 metadata + viewport 부분만 확장. ThemeProvider 래핑은 Task 4에서 한꺼번에 추가.

```tsx
// apps/web/app/layout.tsx (Task 3 부분만 — Task 4에서 ThemeProvider 통합)
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YGinvest",
  description: "모의 주식 트레이딩 — 한국·미국 거래소",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "YGinvest",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // dark 클래스 그대로 유지 (Task 4에서 next-themes 도입 시 제거)
    <html lang="ko" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
# Expected: clean

git add apps/web/public/manifest.json apps/web/app/layout.tsx
git commit -m "feat(web): PWA manifest.json + metadata/viewport (manifest link, theme-color, apple-touch)"
```

---

## Task 4: next-themes + ThemeProvider

**Files:**
- Modify: `apps/web/package.json` (next-themes 추가)
- Create: `apps/web/components/theme-provider.tsx`

- [ ] **Step 1: 의존성 추가**

```bash
cd apps/web && npm install next-themes
```

- [ ] **Step 2: ThemeProvider 컴포넌트**

```tsx
// apps/web/components/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 3: layout.tsx에 ThemeProvider 래핑 + `dark` 클래스 제거**

```tsx
// apps/web/app/layout.tsx — html에서 dark 빼고 body 안을 ThemeProvider로 감쌈
import { ThemeProvider } from "@/components/theme-provider";

// ... metadata + viewport는 그대로 ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/package.json apps/web/package-lock.json apps/web/components/theme-provider.tsx apps/web/app/layout.tsx
git commit -m "feat(web): next-themes integration (system default, attribute=class)"
```

---

## Task 5: ThemeToggle 컴포넌트 + header 통합

**Files:**
- Create: `apps/web/components/theme-toggle.tsx`
- Modify: `apps/web/app/app/layout.tsx` (헤더에 토글 추가)

- [ ] **Step 1: ThemeToggle (lucide-react Sun/Moon/Monitor)**

```tsx
// apps/web/components/theme-toggle.tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // 하이드레이션 mismatch 방지: 마운트 전엔 placeholder
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled aria-label="테마 로딩 중">
        <Monitor className="h-4 w-4" />
      </Button>
    );
  }

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(next)}
      title={`현재: ${theme} → 다음: ${next}`}
      aria-label={`테마: ${theme}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 2: app/app/layout.tsx 헤더에 추가**

기존 헤더 PortfolioSwitcher 옆에 ThemeToggle 노출:

```tsx
import { ThemeToggle } from "@/components/theme-toggle";

// ... <header>:
<div className="flex items-center gap-3 text-sm">
  <PortfolioSwitcher portfolios={portfolios} selectedId={selectedId} />
  <ThemeToggle />
  <span className="text-muted-foreground">{profile?.display_name ?? user.email}</span>
  <LogoutButton />
</div>
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/components/theme-toggle.tsx apps/web/app/app/layout.tsx
git commit -m "feat(web): ThemeToggle button (light/dark/system cycle) in app header"
```

---

## Task 6: BottomNav 모바일 네비게이션

**Files:**
- Create: `apps/web/components/bottom-nav.tsx`
- Modify: `apps/web/app/app/layout.tsx` (BottomNav 통합)

5 탭: 대시보드 / 거래 / 포트폴리오 / 방 / 설정

- [ ] **Step 1: BottomNav 컴포넌트**

```tsx
// apps/web/components/bottom-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/dashboard", label: "홈", icon: "🏠" },
  { href: "/app/trade/search", label: "거래", icon: "💱" },
  { href: "/app/portfolio/overview", label: "자산", icon: "📊" },
  { href: "/app/rooms", label: "방", icon: "👥" },
  { href: "/app/settings", label: "설정", icon: "⚙️" },
];

function _isActive(pathname: string, href: string): boolean {
  if (href === "/app/portfolio/overview") {
    return pathname.startsWith("/app/portfolio");
  }
  if (href === "/app/trade/search") {
    return pathname.startsWith("/app/trade");
  }
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="모바일 하단 네비게이션"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <ul className="flex">
        {TABS.map((t) => {
          const active = _isActive(pathname, t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: app/app/layout.tsx에 통합 + main padding 조정**

```tsx
import { BottomNav } from "@/components/bottom-nav";

return (
  <div className="min-h-dvh flex flex-col">
    <header className="border-b px-4 py-3 flex items-center justify-between">
      {/* ... */}
    </header>
    <main className="flex-1 pb-20 md:pb-0">{children}</main>
    <BottomNav />
  </div>
);
```

`pb-20`로 본문 끝이 BottomNav 뒤로 숨지 않게 + `md:pb-0`로 데스크톱은 패딩 제거.

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/components/bottom-nav.tsx apps/web/app/app/layout.tsx
git commit -m "feat(web): BottomNav (mobile 5-tab fixed footer) — 홈/거래/자산/방/설정"
```

---

## Task 7: README + 마무리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태**

Plan #8 다음에:

```markdown
### Plan #9 — PWA & Polish ✅ 완료

- [x] `manifest.json` + 192/512/maskable PNG 아이콘 + apple-touch-icon (180)
- [x] Next.js metadata API로 manifest link + theme-color + apple-web-app capable + viewport (viewportFit=cover)
- [x] `next-themes` ThemeProvider (attribute=class, system 기본)
- [x] `ThemeToggle` 헤더 버튼 (light/dark/system 순환, 이모지 라벨)
- [x] `BottomNav` 모바일 하단 5탭 (홈/거래/자산/방/설정, md:hidden, safe-area-inset 대응)
- [x] iOS Safari "홈 화면 추가" 후 PWA 모드로 실행 → Web Push 동작 (Plan #7)
```

- [ ] **Step 2: PWA 설치 가이드**

```markdown
### PWA 설치

- **데스크톱 Chrome/Edge**: 주소창 우측의 ⊕ 또는 "앱 설치" 버튼
- **Android Chrome**: 메뉴 → "홈 화면에 추가"
- **iOS Safari 16.4+**: 공유 → "홈 화면에 추가" → PWA 모드 실행 시 Plan #7 Web Push 알림 활성화
```

- [ ] **Step 3: 디버깅 팁**

```markdown
- **PWA "설치" 버튼 안 보임**: 1) `/manifest.json` 200 응답인지 (`curl -I`) 2) HTTPS 필수 (Vercel 자동) 3) DevTools → Application → Manifest 에러 확인
- **테마 토글 후 깜빡임 (FOUC)**: layout.tsx에서 `<html className="dark">` 강제 지정 제거됐는지 확인 — next-themes가 동적 추가
- **BottomNav가 데스크톱에서도 보임**: `md:hidden` 클래스 누락. Tailwind breakpoint md=768px 이상에서 hidden
- **iOS 홈 화면 추가 후 푸시 안 옴**: Safari 16.4+ 필수. 추가 후 PWA 아이콘 탭으로 실행해야 동작 (Safari 탭은 X)
```

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #9 (PWA & Polish) completion"
```

---

## 마무리 검증

- [ ] 빌드/lint/tsc: clean
- [ ] 수동:
  1. `npm run dev` → DevTools → Application → Manifest에 4개 아이콘 보임
  2. 헤더 우측 테마 토글 클릭 → 다크↔라이트 전환 즉시 반영
  3. 모바일 viewport (DevTools 디바이스 모드) → 하단 네비 5탭 보임, 데스크톱(>=md) 에선 숨음
  4. Chrome → 설치 가능 (주소창 ⊕ 표시)
  5. /app/* 경로 모든 페이지에서 BottomNav 표시 + 활성 탭 색 강조

---

## Plan #9 포함되지 않은 것 (defer)

| 항목 | 처리 |
|------|------|
| 오프라인 모드 / 캐시 전략 | v1.5 (Workbox 또는 Serwist 도입) |
| 백그라운드 동기화 | v2 |
| iOS Apple 스플래시 이미지 | v1.5 (apple-touch-startup-image) |
| 진동 / 햅틱 | v2 |
| 사용자 정의 테마 색 | v2 (브랜드 색 고정) |
| Android 설치 prompt UI 커스텀 | v2 (beforeinstallprompt 이벤트 캡처) |

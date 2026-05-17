"use client";

// Plan #45: 풀 차트 상세 (가로 모드).
//
// Plan #46.2 버그 수정:
//   - lightweight-charts canvas는 mount 시 dimensions를 fix함 → orient 변경 시
//     자동 resize 안 됨. key prop으로 강제 remount.
//   - iOS Safari CSS rotate text rendering issue → font-smoothing + GPU 가속.
//   - 가로 모드에서 padding 늘려서 edge-to-edge 안 되게.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartArea } from "@/components/chart-area";
import { YGIcon } from "@/components/yg/icon";
import { fmt } from "@/lib/yg-fmt";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  symbol: string;
  symbolName: string;
  market: string;
  currency: string;
  lastPrice: number | null;
  initialBars: Bar[];
};

type Orient = "portrait" | "landscape";

export function ChartDetailLandscape({
  symbol,
  symbolName,
  market,
  currency,
  lastPrice,
  initialBars,
}: Props) {
  const router = useRouter();
  const [orient, setOrient] = useState<Orient>("landscape");
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 360, h: 640 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const isMobile = vp.w < 768;
  // 실제 device가 이미 landscape인지 (사용자가 폰을 회전시킴)
  const deviceIsLandscape = vp.w > vp.h;

  // Try lock orientation on mount (Android PWA만 동작 — iOS는 silent fail)
  useEffect(() => {
    if (!isMobile || orient !== "landscape") return;
    type LockableOrientation = ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    const scr = window.screen?.orientation as LockableOrientation | undefined;
    if (scr && typeof scr.lock === "function") {
      void scr.lock("landscape").catch(() => {
        /* iOS 등 silent fail */
      });
    }
    return () => {
      const scr = window.screen?.orientation as LockableOrientation | undefined;
      if (scr && typeof scr.unlock === "function") {
        try {
          scr.unlock();
        } catch {
          /* */
        }
      }
    };
  }, [isMobile, orient]);

  // CSS rotation: 모바일 + landscape 모드 + 디바이스가 아직 portrait (= iOS)일 때만.
  // device가 이미 landscape면 CSS rotate 불필요 (자연스럽게 표시됨).
  const useCssRotate =
    mounted && isMobile && orient === "landscape" && !deviceIsLandscape;

  // 회전 후 보이는 영역 크기 (cm)
  const visibleW = useCssRotate ? vp.h : vp.w; // 가로 = portrait 높이
  const visibleH = useCssRotate ? vp.w : vp.h; // 세로 = portrait 너비

  // 가로 모드 스크롤 패딩 (사용자 요청: edge-to-edge 안 되게)
  const SIDE_PADDING = useCssRotate ? 32 : 16;
  const TOP_PADDING = useCssRotate ? 14 : 16;
  const BOTTOM_PADDING = useCssRotate ? 36 : 16;
  const HEADER_HEIGHT = 56;

  // 차트 카드 안쪽 높이 — 헤더 + padding 제외 + 약간의 여백
  const chartCardHeight = useCssRotate
    ? Math.max(280, visibleH - HEADER_HEIGHT - TOP_PADDING - BOTTOM_PADDING - 40)
    : 520;

  // CSS rotation: portrait viewport 안에 landscape 컨테이너를 회전시켜 표시
  const rotatedStyle: React.CSSProperties = useCssRotate
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: vp.h,
        height: vp.w,
        transform: `rotate(90deg) translate(0, -${vp.w}px)`,
        transformOrigin: "top left",
        background: "var(--yg-bg-app)",
        overflowX: "hidden",
        overflowY: "auto",
        zIndex: 50,
        // iOS Safari rotate text rendering 개선
        WebkitOverflowScrolling: "touch",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        willChange: "transform",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }
    : {};

  const priceText = lastPrice
    ? currency === "KRW"
      ? fmt.krw(lastPrice)
      : fmt.usd(lastPrice)
    : "—";

  return (
    <div style={rotatedStyle}>
      {/* Header */}
      <header
        style={{
          padding: "12px 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--yg-bg-card)",
          borderBottom: "1px solid var(--yg-line-faint)",
          paddingTop: useCssRotate ? 12 : "max(env(safe-area-inset-top), 12px)",
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로"
          className="yg-tap"
          style={{
            all: "unset",
            cursor: "pointer",
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
            <YGIcon.ChevronRight s={22} c="var(--yg-fg-primary)" />
          </div>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--yg-fg-primary)",
              lineHeight: 1.2,
            }}
          >
            {symbolName}
          </div>
          <div
            className="yg-num"
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            {symbol} · {market} · 현재 {priceText}
          </div>
        </div>

        {isMobile && (
          <button
            type="button"
            onClick={() =>
              setOrient((o) => (o === "landscape" ? "portrait" : "landscape"))
            }
            className="yg-chip"
            style={{
              background: "var(--yg-bg-tint-ink)",
              color: "var(--yg-fg-secondary)",
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 10px",
              cursor: "pointer",
            }}
            title={orient === "landscape" ? "세로 보기" : "가로 보기"}
          >
            {orient === "landscape" ? "↕ 세로" : "↔ 가로"}
          </button>
        )}
      </header>

      {/* Chart container — 스크롤 padding 적용 */}
      <div
        style={{
          padding: `${TOP_PADDING}px ${SIDE_PADDING}px ${BOTTOM_PADDING}px`,
        }}
      >
        <div
          className="yg-card"
          style={{
            padding: 14,
            // 명시적 height로 lightweight-charts canvas 정상 init
            height: chartCardHeight,
            overflow: "hidden",
          }}
        >
          {/*
            KEY FIX: lightweight-charts canvas는 mount 시점에 size를 정함.
            orient/viewport 변경 시 자동 resize 안 됨 → key로 강제 remount.
          */}
          <ChartArea
            key={`chart-${orient}-${vp.w}x${vp.h}`}
            symbol={symbol}
            initialBars={initialBars}
          />
        </div>
      </div>

      {/* 안내: 세로 모드 + 모바일일 때만 */}
      {isMobile && orient === "portrait" && (
        <div
          style={{
            padding: "0 20px 20px",
            fontSize: 12,
            color: "var(--yg-fg-tertiary)",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          💡 가로로 보면 더 넓게 볼 수 있어요
        </div>
      )}
    </div>
  );
}

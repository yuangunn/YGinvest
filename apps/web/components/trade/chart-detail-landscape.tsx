"use client";

// Plan #45: 풀 차트 상세 (가로 모드).
//
// 모바일: viewport rotate 안내 OR CSS rotate(90deg)로 가로 전환.
// 사용자가 가로/세로 토글 가능. screen.orientation.lock() 시도 (Android Chrome PWA).

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

  useEffect(() => {
    const update = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const isMobile = vp.w < 768;
  // Try lock orientation on mount (가로 모드 강제 — 일부 PWA 환경에서만 동작)
  useEffect(() => {
    if (!isMobile || orient !== "landscape") return;
    type LockableOrientation = ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    const scr = window.screen?.orientation as LockableOrientation | undefined;
    if (scr && typeof scr.lock === "function") {
      void scr.lock("landscape").catch(() => {
        /* lock 권한 없을 수 있음 — silent fail */
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

  // CSS rotation 적용: 모바일 + landscape 모드일 때만 rotate(90deg) + width/height swap
  const useCssRotate = isMobile && orient === "landscape";

  // rotate시 outer width = viewport height, height = viewport width
  const rotatedStyle: React.CSSProperties = useCssRotate
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: vp.h,
        height: vp.w,
        transform: `rotate(90deg) translateY(-${vp.w}px)`,
        transformOrigin: "top left",
        background: "var(--yg-bg-app)",
        overflow: "auto",
        zIndex: 50,
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

      {/* Chart */}
      <div
        style={{
          padding: "16px",
          minHeight: useCssRotate ? vp.w - 60 : undefined,
        }}
      >
        <div
          className="yg-card"
          style={{
            padding: 14,
            // 가로 모드: 차트 영역 풀 화면 (좁아도 폭이 길어짐)
            minHeight: useCssRotate ? vp.w - 100 : 480,
          }}
        >
          <ChartArea symbol={symbol} initialBars={initialBars} />
        </div>
      </div>

      {/* 안내문 (세로 모드 + 모바일일 때만) */}
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

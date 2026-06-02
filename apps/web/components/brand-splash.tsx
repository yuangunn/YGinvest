"use client";

// 앱 첫 진입 시 잠깐 보이는 브랜드 스플래시.
// PWA standalone 실행 시 OS 스플래시(흰 배경+아이콘) 직후, 앱 셸이 그려지기
// 전의 빈/검은 화면 구간을 로고로 덮는다. 하이드레이션 후 페이드아웃되며 사라짐.
//
// sessionStorage로 세션당 1회만 노출 — 페이지 이동마다 깜빡이지 않도록.

import { useEffect, useState } from "react";

const SEEN_KEY = "yg_splash_seen";

export function BrandSplash() {
  // 초기값은 항상 false로 두고 마운트 후 결정 — SSR/CSR 마크업 불일치 방지.
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SEEN_KEY)) return; // 이미 봤으면 스킵

    setShow(true);
    sessionStorage.setItem(SEEN_KEY, "1");

    // 짧게 보여준 뒤 페이드아웃
    const fadeAt = setTimeout(() => setFading(true), 450);
    const hideAt = setTimeout(() => setShow(false), 750);
    return () => {
      clearTimeout(fadeAt);
      clearTimeout(hideAt);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "var(--background, #ffffff)",
        opacity: fading ? 0 : 1,
        transition: "opacity 300ms ease",
        pointerEvents: "none",
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ color: "#2563eb" }}
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
      <span
        style={{
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--foreground, #171717)",
        }}
      >
        YGinvest
      </span>
    </div>
  );
}

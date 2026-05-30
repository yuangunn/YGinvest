"use client";

// 루트 레이아웃 자체에서 에러가 났을 때의 최후 폴백.
// global-error는 root layout을 대체하므로 자체 <html>/<body>를 정의해야 한다.
// 디자인 시스템(CSS 변수)에 의존하지 않도록 인라인 스타일로 자족적으로 작성.

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // 최후의 폴백 — 베스트에포트 리포팅 (실패해도 무시)
    fetch("/api/errors/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        pathname:
          typeof window !== "undefined" ? window.location.pathname : null,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#fafafa",
          color: "#171717",
        }}
      >
        <div style={{ maxWidth: 400, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            앱에 문제가 발생했어요
          </h1>
          <p style={{ fontSize: 14, color: "#737373", margin: "0 0 20px" }}>
            잠시 후 다시 시도해주세요. 문제가 계속되면 새로고침해주세요.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              fontSize: 14,
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#171717",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  );
}

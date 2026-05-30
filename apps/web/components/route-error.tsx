"use client";

// Plan: RSC(서버 컴포넌트) 렌더 에러용 라우트 에러 경계 공용 UI.
//
// 기존 AppErrorBoundary(클래스 컴포넌트)는 클라이언트 렌더 에러만 잡는다.
// App Router에서 서버 컴포넌트 렌더 중 throw된 에러(예: DB 쿼리 실패)는
// error.tsx 라우트 경계만 잡을 수 있어 별도로 둔다. 디자인/리포팅은 통일.

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

let lastReportAt = 0;

async function reportError(error: Error, pathname: string | null) {
  // 클라이언트 측 rate-limit: 60초당 1건 (error-boundary.tsx와 동일 정책)
  const now = Date.now();
  if (now - lastReportAt < 60_000) return;
  lastReportAt = now;
  try {
    await fetch("/api/errors/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        pathname,
      }),
    });
  } catch {
    // ignore — 에러 처리 중 또 에러 내지 말 것
  }
}

type Props = {
  error: Error & { digest?: string };
  /** 이 Next 버전 권장: 재요청 + 재렌더 */
  unstable_retry?: () => void;
  /** 폴백: 에러 상태만 초기화 후 재렌더 */
  reset?: () => void;
};

export function RouteError({ error, unstable_retry, reset }: Props) {
  useEffect(() => {
    reportError(
      error,
      typeof window !== "undefined" ? window.location.pathname : null,
    );
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="max-w-md mx-auto p-6 text-center space-y-4 mt-8">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
      </div>
      <div>
        <h1 className="text-lg font-bold">예상치 못한 오류가 발생했어요</h1>
        <p className="text-sm text-muted-foreground mt-1">
          페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
        </p>
        {error.message && (
          <code className="block mt-3 text-[10px] text-muted-foreground bg-muted rounded px-2 py-1 max-h-20 overflow-y-auto text-left break-words">
            {error.message.slice(0, 200)}
          </code>
        )}
      </div>
      <div className="flex gap-2 justify-center">
        {retry && (
          <Button onClick={() => retry()} variant="outline">
            다시 시도
          </Button>
        )}
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-3 w-3 mr-1" />
          새로고침
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        이 오류는 자동으로 기록되어 개선에 활용됩니다.
      </p>
    </div>
  );
}

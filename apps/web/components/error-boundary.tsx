"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

let lastReportAt = 0;

async function reportError(error: Error) {
  // 클라이언트 사이드 rate-limit: 60초당 1건
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
        pathname:
          typeof window !== "undefined" ? window.location.pathname : null,
      }),
    });
  } catch {
    // ignore — 절대 에러 안에서 에러 띄우지 말 것
  }
}

/**
 * Plan #27 B4: 페이지 다운 방지 + 자체 에러 로깅.
 * /app/* 전체를 감싸는 Error Boundary.
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    reportError(error);
  }

  reset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  override render() {
    if (this.state.hasError) {
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
            {this.state.message && (
              <code className="block mt-3 text-[10px] text-muted-foreground bg-muted rounded px-2 py-1 max-h-20 overflow-y-auto text-left break-words">
                {this.state.message.slice(0, 200)}
              </code>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reset} variant="outline">
              다시 시도
            </Button>
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
    return this.props.children;
  }
}

/**
 * 전역 unhandled promise rejection / window error도 잡아서 로깅.
 */
export function GlobalErrorListener() {
  if (typeof window === "undefined") return null;
  // 모듈 한 번 로드되면 한 번만 attach
  if (!(window as Window & { __ygErrorAttached?: boolean }).__ygErrorAttached) {
    (window as Window & { __ygErrorAttached?: boolean }).__ygErrorAttached = true;
    window.addEventListener("error", (e) => {
      if (e.error) reportError(e.error);
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason;
      if (reason instanceof Error) reportError(reason);
      else if (typeof reason === "string") reportError(new Error(reason));
    });
  }
  return null;
}

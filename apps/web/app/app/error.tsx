"use client";

// /app/* 라우트 세그먼트 에러 경계.
// 서버 컴포넌트 렌더 중 throw된 에러를 잡아 폴백 UI를 보여준다.

import { RouteError } from "@/components/route-error";

export default function AppError(props: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  return <RouteError {...props} />;
}

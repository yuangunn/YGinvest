import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export const dynamic = "force-static";

export const metadata = {
  title: "오프라인 — YGinvest",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-sm text-center space-y-6">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-muted">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">오프라인 상태예요</h1>
          <p className="text-sm text-muted-foreground">
            인터넷 연결이 끊겨 새 데이터를 가져올 수 없어요.
            <br />
            연결이 복구되면 자동으로 다시 불러올게요.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            대시보드로 가기
          </Link>
        </div>
      </div>
    </div>
  );
}

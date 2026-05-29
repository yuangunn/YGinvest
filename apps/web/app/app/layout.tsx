// Plan #42: 앱 shell — YG 디자인 시스템.
// 헤더(상단 single source) + MarketStatusBar + 본문 + 하단 5탭.
// 다이나믹 아일랜드 / 홈 인디케이터 safe-area 적용.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { CommandPalette } from "@/components/command-palette";
import {
  AppErrorBoundary,
  GlobalErrorListener,
} from "@/components/error-boundary";
import { InstallBanner } from "@/components/install-banner";
import { MarketStatusBar } from "@/components/market-status";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { YGAppHeader } from "@/components/layout/yg-app-header";
import { YGBottomNav } from "@/components/layout/yg-bottom-nav";
import { getIsAdmin } from "@/lib/auth-admin";
import changelogData from "@/lib/changelog-data.json";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const isAdmin = await getIsAdmin(supabase, user.id);
  const latestChangelogSha =
    (changelogData as { sha: string }[])[0]?.sha ?? null;

  return (
    <div
      className="yg-surface"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PullToRefresh />
      <GlobalErrorListener />
      <CommandPalette />

      <YGAppHeader
        isAdmin={isAdmin}
        latestChangelogSha={latestChangelogSha}
      />
      <MarketStatusBar />
      <InstallBanner />

      <main
        style={{
          flex: 1,
          // 하단 탭바(약 60px) + safe-area
          paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <AppErrorBoundary>{children}</AppErrorBoundary>
      </main>

      <YGBottomNav />
    </div>
  );
}

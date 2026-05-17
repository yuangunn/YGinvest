// Plan #45: 백테스팅 — YG 디자인.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";
import { BacktestClient } from "@/components/backtest-client";

export default async function BacktestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="백테스팅"
        sub="기술적 지표 기반 매매 신호 시뮬레이션"
      />
      <div style={{ padding: "8px 20px 0" }}>
        <div className="yg-card" style={{ padding: 18 }}>
          <BacktestClient />
        </div>
      </div>
    </div>
  );
}

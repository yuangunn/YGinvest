// Plan #45: 차트 비교 — YG 디자인.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";
import { CompareChartClient } from "@/components/compare-chart-client";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const a = params.a ?? "";
  const b = params.b ?? "";

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="차트 비교"
        sub="두 종목의 시작가 기준 정규화"
      />
      <div style={{ padding: "8px 20px 0" }}>
        <div className="yg-card" style={{ padding: 18 }}>
          <CompareChartClient initialA={a} initialB={b} />
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">차트 비교</h1>
        <p className="text-sm text-muted-foreground mt-1">
          두 종목의 시작가 기준 정규화(100 = 시작) 수익률을 비교합니다.
        </p>
      </div>
      <CompareChartClient initialA={a} initialB={b} />
    </div>
  );
}

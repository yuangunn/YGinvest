import { redirect } from "next/navigation";
import { LineChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BacktestClient } from "@/components/backtest-client";

export default async function BacktestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <LineChart className="h-5 w-5 text-primary" />
          백테스팅 (간이)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          기술적 지표 기반 매매 신호를 과거 데이터에 적용해 수익률 시뮬레이션.
        </p>
      </div>
      <BacktestClient />
    </div>
  );
}

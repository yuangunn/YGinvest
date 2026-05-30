import { redirect } from "next/navigation";
import { GitCompare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { WhatIfClient } from "@/components/whatif-client";

export default async function WhatIfPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          What-If 계산기
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          &quot;그때 NVDA 100만원 샀으면 지금 얼마?&quot; — 과거로 돌아가 가상 매수
          시 현재 가치를 계산. 인덱스 비교와 인플레 보정까지.
        </p>
      </div>
      <WhatIfClient />
    </div>
  );
}

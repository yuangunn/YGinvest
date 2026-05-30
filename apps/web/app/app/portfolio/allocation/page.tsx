import { redirect } from "next/navigation";
import { PieChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { AllocationClient } from "@/components/allocation-client";

export default async function AllocationPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PieChart className="h-5 w-5 text-primary" />
          자산 배분 시뮬레이션
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          유명한 자산배분 전략(60/40, All-Weather)으로 장기 시뮬. 분산의 가치를 체감.
        </p>
      </div>

      <AllocationClient />
    </div>
  );
}

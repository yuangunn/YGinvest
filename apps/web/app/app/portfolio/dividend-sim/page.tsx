import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { DividendSimClient } from "@/components/dividend-sim-client";

export default async function DividendSimPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          배당 + 복리 시뮬레이터
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          배당금을 재투자하면(DRIP) 얼마나 빨리 자산이 늘어날까? 복리의 마법을 체감.
        </p>
      </div>

      <DividendSimClient />
    </div>
  );
}

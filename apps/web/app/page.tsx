import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Landing() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app/dashboard");

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center space-y-6">
      <h1 className="text-4xl font-bold">YGinvest</h1>
      <p className="text-muted-foreground max-w-md">
        모의 주식 트레이딩. 한국·미국 거래소, 친구와 수익률 경쟁.
      </p>
      <Link href="/auth/login">
        <Button>시작하기</Button>
      </Link>
    </main>
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchKeyMetricsViaWorker } from "@/lib/workerRpc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const metrics = await fetchKeyMetricsViaWorker(decodeURIComponent(symbol));
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}

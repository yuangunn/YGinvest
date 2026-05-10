import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchNewsViaWorker } from "@/lib/workerRpc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "10");

  try {
    const news = await fetchNewsViaWorker(decodeURIComponent(symbol), limit);
    return NextResponse.json({ symbol, news });
  } catch {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}

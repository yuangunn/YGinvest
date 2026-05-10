import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupStock } from "@/lib/workerRpc";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const symbol = (body?.symbol ?? "").trim();
  if (symbol.length === 0) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const result = await lookupStock(symbol);
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}

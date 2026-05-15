// Plan #27 C1: 매매일지 CRUD API.
// GET ?symbol=AAPL → 종목별 노트 (또는 portfolio 전체)
// POST { body, symbol?, trade_id? }
// PATCH ?id=... { body }
// DELETE ?id=...

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_BODY = 2000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const limit = Math.min(100, Number(searchParams.get("limit") ?? "20"));

  let q = supabase
    .from("trade_notes")
    .select("id, symbol, trade_id, body, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (symbol) q = q.eq("symbol", symbol);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { body?: string; symbol?: string; trade_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = String(body.body ?? "").trim().slice(0, MAX_BODY);
  if (!text) return NextResponse.json({ error: "empty_body" }, { status: 400 });

  const { data, error } = await supabase
    .from("trade_notes")
    .insert({
      user_id: user.id,
      body: text,
      symbol: body.symbol ?? null,
      trade_id: body.trade_id ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = String(body.body ?? "").trim().slice(0, MAX_BODY);
  if (!text) return NextResponse.json({ error: "empty_body" }, { status: 400 });

  const { data, error } = await supabase
    .from("trade_notes")
    .update({ body: text, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await supabase
    .from("trade_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

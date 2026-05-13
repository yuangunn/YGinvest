import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@/lib/ai-providers";

// Mask key for display (first 7 + last 4)
function maskKey(key: string): string {
  if (key.length < 12) return "***";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("user_ai_keys")
    .select("provider, model, api_key, updated_at")
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // mask api_key in response
  const masked = (data ?? []).map((row) => ({
    provider: row.provider,
    model: row.model,
    api_key_masked: maskKey(row.api_key),
    updated_at: row.updated_at,
  }));
  return NextResponse.json({ keys: masked });
}

type Body = { provider: Provider; api_key: string; model?: string | null };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const { provider, api_key, model } = body;
  if (!provider || !api_key) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (!["anthropic", "openai", "google"].includes(provider)) {
    return NextResponse.json({ error: "invalid_provider" }, { status: 400 });
  }
  const { error } = await supabase.from("user_ai_keys").upsert(
    {
      user_id: user.id,
      provider,
      api_key,
      model: model ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  if (!provider) {
    return NextResponse.json({ error: "provider_required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("user_ai_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

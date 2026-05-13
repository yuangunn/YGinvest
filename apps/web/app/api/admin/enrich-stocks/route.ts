import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin: trigger worker enrichment job to populate sector/PER/52w on all stocks.
 *
 * Auth: requires the caller to be the project admin via X-Admin-Secret header
 *   matching SUPABASE_SERVICE_ROLE_KEY (already in env, no new secret needed).
 *
 * Returns the worker's result summary.
 */
export const maxDuration = 300; // 5 min — yfinance fetching 200+ symbols is slow

export async function POST(request: Request) {
  const adminSecret = request.headers.get("X-Admin-Secret");
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminSecret || !expected || adminSecret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const workerUrl = process.env.WORKER_RPC_URL;
  const workerSecret = process.env.WORKER_RPC_SECRET;
  if (!workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: "worker_not_configured" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${workerUrl}/rpc/enrich_now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": workerSecret,
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "worker_failed", status: res.status },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "network_error" },
      { status: 502 },
    );
  }
}

// Quick check route (HEAD) to verify worker is reachable
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const workerUrl = process.env.WORKER_RPC_URL;
  if (!workerUrl) {
    return NextResponse.json({ configured: false });
  }
  try {
    const res = await fetch(`${workerUrl}/health`);
    return NextResponse.json({
      configured: true,
      worker_ok: res.ok,
      status: res.status,
    });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      worker_ok: false,
      error: err instanceof Error ? err.message : "network_error",
    });
  }
}

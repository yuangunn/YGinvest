import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth-admin";

/**
 * Admin: trigger worker enrichment job to populate sector/PER/52w on all stocks.
 *
 * 보안 강화: 관리자(is_admin)만 호출 가능. 이전에는 인증 없이 누구나 수십 분짜리
 * yfinance 전수 조회를 워커에 띄울 수 있었다 (워커 스레드풀 고갈 → 가격 갱신·매칭 중단).
 *
 * Returns the worker's result summary.
 */
export const maxDuration = 300; // 5 min — yfinance fetching 200+ symbols is slow

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

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

// Quick check route to verify worker is reachable (admin only)
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

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

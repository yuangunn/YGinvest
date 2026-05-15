// Plan #27.4: Admin trigger — Railway worker가 cron을 누락한 경우 수동으로
// 거시경제 지표 fetch를 발동. 호출은 idempotent + 부담 적음 (소수 ticker만).

import { NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST() {
  const workerUrl = process.env.WORKER_RPC_URL;
  const workerSecret = process.env.WORKER_RPC_SECRET;
  if (!workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: "worker_not_configured" },
      { status: 500 },
    );
  }
  try {
    const res = await fetch(`${workerUrl}/rpc/macro_now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": workerSecret,
      },
      signal: AbortSignal.timeout(110_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `worker_${res.status}`, detail: body.slice(0, 200) },
        { status: 502 },
      );
    }
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 502 },
    );
  }
}

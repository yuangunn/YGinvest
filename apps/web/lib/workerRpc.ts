const WORKER_URL = process.env.WORKER_RPC_URL ?? "http://localhost:8080";
const WORKER_SECRET = process.env.WORKER_RPC_SECRET ?? "";

export type WorkerLookupResult = {
  symbol: string;
  name: string;
  market: string;
  currency: string;
  price: number;
  name_ko: string | null;
};

export async function lookupStock(symbol: string): Promise<WorkerLookupResult | null> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Secret": WORKER_SECRET,
    },
    body: JSON.stringify({ symbol }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`worker lookup failed: ${res.status}`);
  }
  return (await res.json()) as WorkerLookupResult;
}

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

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function fetchBarsViaWorker(
  symbol: string,
  interval: string,
  period: string = "60d"
): Promise<Bar[]> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/bars`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Secret": WORKER_SECRET },
    body: JSON.stringify({ symbol, interval, period }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`worker bars failed: ${res.status}`);
  const json = await res.json();
  return json.bars ?? [];
}

export type NewsItem = {
  title: string;
  link: string;
  publisher: string;
  published_at: string | null;
};

export async function fetchNewsViaWorker(symbol: string, limit: number = 10): Promise<NewsItem[]> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/news`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Secret": WORKER_SECRET },
    body: JSON.stringify({ symbol, limit }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`worker news failed: ${res.status}`);
  const json = await res.json();
  return json.news ?? [];
}

export type KeyMetrics = {
  trailing_eps: number | null;
  forward_pe: number | null;
  dividend_yield: number | null;
  beta: number | null;
  profit_margin: number | null;
  roe: number | null;
  debt_to_equity: number | null;
};

export async function fetchKeyMetricsViaWorker(symbol: string): Promise<KeyMetrics> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/financials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Secret": WORKER_SECRET },
    body: JSON.stringify({ symbol }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`worker financials failed: ${res.status}`);
  return await res.json();
}

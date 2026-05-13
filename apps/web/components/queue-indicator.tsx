"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, WifiOff } from "lucide-react";

type QueueCounts = {
  orders: number;
  fx: number;
  watchlist: number;
  total: number;
};

const ZERO: QueueCounts = { orders: 0, fx: 0, watchlist: 0, total: 0 };

function openDb(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function getAllEntries(
  db: IDBDatabase,
  storeName: string,
): Promise<unknown[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function readQueueCounts(): Promise<QueueCounts> {
  if (typeof indexedDB === "undefined") return ZERO;
  const dbs = ["serwist-background-sync", "workbox-background-sync"];
  const counts = { ...ZERO };

  for (const dbName of dbs) {
    const db = await openDb(dbName);
    if (!db) continue;
    try {
      const stores = Array.from(db.objectStoreNames);
      for (const storeName of stores) {
        if (!storeName.toLowerCase().includes("requests")) continue;
        const allEntries = await getAllEntries(db, storeName);
        for (const entry of allEntries) {
          const queueName = (entry as { queueName?: string }).queueName ?? "";
          if (queueName.includes("orders")) counts.orders++;
          else if (queueName.includes("fx")) counts.fx++;
          else if (queueName.includes("watchlist")) counts.watchlist++;
        }
      }
    } finally {
      db.close();
    }
  }
  counts.total = counts.orders + counts.fx + counts.watchlist;
  return counts;
}

export function QueueIndicator() {
  const [counts, setCounts] = useState<QueueCounts>(ZERO);
  // lazy init — `navigator.onLine`은 SSR에서 undefined이므로 typeof 가드
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const refresh = async () => {
      const c = await readQueueCounts();
      if (!cancelled) setCounts(c);
    };
    void refresh();
    const id = setInterval(refresh, 5000);

    const handleOnline = () => {
      setOnline(true);
      void refresh();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (counts.total === 0 && online) return null;

  function showBreakdown() {
    toast.info(
      counts.total === 0
        ? "오프라인 (큐 비어있음)"
        : `대기 중: 주문 ${counts.orders} · 환전 ${counts.fx} · 관심종목 ${counts.watchlist}`,
    );
  }

  return (
    <button
      type="button"
      onClick={showBreakdown}
      className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs hover:bg-primary/10"
      title={
        online
          ? "동기화 대기 중인 요청이 있어요"
          : "오프라인 — 연결 시 자동 동기화"
      }
    >
      {online ? (
        <RefreshCw className="h-3 w-3 text-primary" />
      ) : (
        <WifiOff className="h-3 w-3 text-muted-foreground" />
      )}
      {counts.total > 0 && (
        <span className="font-medium text-primary">{counts.total}</span>
      )}
    </button>
  );
}

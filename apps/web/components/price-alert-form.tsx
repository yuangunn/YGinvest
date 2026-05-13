"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { offlineFetch } from "@/lib/offline-fetch";

type Alert = {
  id: string;
  symbol: string;
  condition: "above" | "below";
  trigger_price: number;
  status: string;
};

type Props = {
  symbol: string;
  currentPrice: number | null;
  currency: string;
  initialAlerts: Alert[];
};

export function PriceAlertForm({
  symbol,
  currentPrice,
  currency,
  initialAlerts,
}: Props) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState(currentPrice ? String(currentPrice) : "");
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const r = await fetch("/api/alerts");
    if (!r.ok) return;
    const json = await r.json();
    setAlerts(
      (json.alerts as Alert[]).filter((a) => a.symbol === symbol),
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!price) return;
    startTransition(async () => {
      const result = await offlineFetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          condition,
          trigger_price: Number(price),
        }),
      });
      if (result.status === "ok") {
        toast.success("알림 설정됨");
        await refresh();
      } else if (result.status === "queued") {
        toast.info("오프라인 — 연결 시 알림 설정됩니다");
      } else {
        toast.error(`실패: ${result.error}`);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await offlineFetch(`/api/alerts?id=${id}`, {
        method: "DELETE",
      });
      if (result.status === "ok") {
        toast.success("알림 삭제됨");
        await refresh();
      } else {
        toast.error("삭제 실패");
      }
    });
  }

  const fmt = currency === "KRW" ? "₩" : "$";

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={condition === "above" ? "default" : "outline"}
            onClick={() => setCondition("above")}
          >
            ↑ 이상
          </Button>
          <Button
            type="button"
            size="sm"
            variant={condition === "below" ? "default" : "outline"}
            onClick={() => setCondition("below")}
          >
            ↓ 이하
          </Button>
        </div>
        <div className="space-y-1 min-w-32">
          <Label htmlFor={`alert-price-${symbol}`} className="text-xs">
            가격
          </Label>
          <Input
            id={`alert-price-${symbol}`}
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={fmt + (currentPrice ?? 0).toLocaleString()}
            required
          />
        </div>
        <Button type="submit" disabled={isPending} size="sm">
          <Bell className="h-3 w-3 mr-1" />
          알림 설정
        </Button>
      </form>

      {alerts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">설정된 알림 ({alerts.length})</p>
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1.5 text-xs"
            >
              <span>
                {a.condition === "above" ? "↑" : "↓"} {fmt}
                {Number(a.trigger_price).toLocaleString()}
                <span
                  className={`ml-2 text-[10px] ${
                    a.status === "triggered" ? "text-green-600" : "text-muted-foreground"
                  }`}
                >
                  {a.status === "triggered"
                    ? "✅ 발동됨"
                    : a.status === "cancelled"
                      ? "취소됨"
                      : "대기"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="삭제"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

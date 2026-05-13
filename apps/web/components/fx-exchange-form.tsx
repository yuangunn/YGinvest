"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { offlineFetch } from "@/lib/offline-fetch";

export function FxExchangeForm({
  portfolioId,
  krwBalance,
  usdBalance,
  rate,
}: {
  portfolioId: string;
  krwBalance: number;
  usdBalance: number;
  rate: number | null;
}) {
  const [direction, setDirection] = useState<"KRW_TO_USD" | "USD_TO_KRW">("KRW_TO_USD");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const [from_currency, to_currency] =
      direction === "KRW_TO_USD" ? ["KRW", "USD"] : ["USD", "KRW"];
    const result = await offlineFetch<{ to_amount: number; rate: number }>(
      "/api/fx/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          from_currency,
          to_currency,
          from_amount: Number(amount),
        }),
      },
    );
    setSubmitting(false);
    if (result.status === "ok") {
      setMessage({
        kind: "ok",
        text: `완료: ${result.data.to_amount} ${to_currency} (rate ${result.data.rate})`,
      });
      setTimeout(() => location.reload(), 1500);
    } else if (result.status === "queued") {
      toast.info("오프라인 — 연결 시 환전 요청 전송됩니다 (그때 환율 적용)");
      setMessage({ kind: "ok", text: "동기화 예약됨" });
    } else {
      setMessage({ kind: "err", text: result.error });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={direction === "KRW_TO_USD" ? "default" : "outline"}
          onClick={() => setDirection("KRW_TO_USD")}
        >
          KRW → USD
        </Button>
        <Button
          type="button"
          variant={direction === "USD_TO_KRW" ? "default" : "outline"}
          onClick={() => setDirection("USD_TO_KRW")}
        >
          USD → KRW
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        잔고: ₩{krwBalance.toLocaleString("ko-KR")} · ${usdBalance.toFixed(2)}
        {rate && <> · 현재 환율 1 USD = ₩{rate}</>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="fx-amount">금액 ({direction === "KRW_TO_USD" ? "KRW" : "USD"})</Label>
        <Input id="fx-amount" type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      {message && (
        <Alert variant={message.kind === "ok" ? "default" : "destructive"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting || !amount} className="w-full">
        환전 (수수료 0.5%)
      </Button>
    </form>
  );
}

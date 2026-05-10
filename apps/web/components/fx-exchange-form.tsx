"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    const [from_currency, to_currency] = direction === "KRW_TO_USD" ? ["KRW", "USD"] : ["USD", "KRW"];
    const res = await fetch("/api/fx/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        from_currency,
        to_currency,
        from_amount: Number(amount),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setMessage({ kind: "ok", text: `완료: ${data.to_amount} ${to_currency} (rate ${data.rate})` });
      setTimeout(() => location.reload(), 1500);
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage({ kind: "err", text: err.error ?? "오류" });
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
        <Label>금액 ({direction === "KRW_TO_USD" ? "KRW" : "USD"})</Label>
        <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
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

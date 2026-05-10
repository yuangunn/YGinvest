"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  portfolioId: string;
  symbol: string;
  currency: string;
  lastPrice: number | null;
};

export function OrderForm({ portfolioId, symbol, currency, lastPrice }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState<string>("1");
  const [limitPrice, setLimitPrice] = useState<string>(lastPrice ? String(lastPrice) : "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const body: Record<string, unknown> = {
      portfolio_id: portfolioId,
      symbol,
      side,
      type,
      quantity: Number(quantity),
    };
    if (type === "limit") body.limit_price = Number(limitPrice);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setMessage({
        kind: "ok",
        text: type === "market"
          ? `체결됨: ${data.filled_avg_price}`
          : "주문 접수됨 (대기)",
      });
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage({ kind: "err", text: err.error ?? "오류 발생" });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={side === "buy" ? "default" : "outline"}
          onClick={() => setSide("buy")}
        >
          매수
        </Button>
        <Button
          type="button"
          variant={side === "sell" ? "default" : "outline"}
          onClick={() => setSide("sell")}
        >
          매도
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={type === "market" ? "default" : "outline"}
          onClick={() => setType("market")}
        >
          시장가
        </Button>
        <Button
          type="button"
          variant={type === "limit" ? "default" : "outline"}
          onClick={() => setType("limit")}
        >
          지정가
        </Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="order-quantity">수량</Label>
        <Input
          id="order-quantity"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </div>
      {type === "limit" && (
        <div className="space-y-1">
          <Label htmlFor="order-limit-price">지정가 ({currency})</Label>
          <Input
            id="order-limit-price"
            type="number"
            min="0.0001"
            step="any"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            required
          />
        </div>
      )}
      {message && (
        <Alert variant={message.kind === "ok" ? "default" : "destructive"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {side === "buy" ? "매수" : "매도"} {type === "market" ? "(시장가)" : "(지정가)"}
      </Button>
    </form>
  );
}

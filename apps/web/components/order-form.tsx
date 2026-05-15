"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { offlineFetch } from "@/lib/offline-fetch";
import { getKrSession } from "@/lib/market-hours";

type Props = {
  portfolioId: string;
  symbol: string;
  currency: string;
  market: string;
  lastPrice: number | null;
  forceSide?: "buy" | "sell";
};

type OrderType = "market" | "limit" | "midpoint";

export function OrderForm({ portfolioId, symbol, currency, market, lastPrice, forceSide }: Props) {
  const [side, setSide] = useState<"buy" | "sell">(forceSide ?? "buy");
  const [type, setType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState<string>("1");
  const [limitPrice, setLimitPrice] = useState<string>(lastPrice ? String(lastPrice) : "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Plan #12: 미드포인트 주문은 KRX + NXT pre/after 세션에만 가능.
  // 컴포넌트 mount 시점에 평가 — sheet 열린 동안 분(minute) 단위 변경은 무시 (실용성 우선).
  // 서버는 PG `_kr_nxt_session()`로 재검증하므로 클라이언트 게이팅은 UX 힌트.
  const isMidpointAvailable = useMemo(() => {
    if (!market.startsWith("KRX_")) return false;
    const s = getKrSession();
    return s === "pre" || s === "after";
  }, [market]);

  // 세션 경계를 넘어 midpoint 선택이 stale해진 경우, PG `_kr_nxt_session()`이
  // `midpoint_session_only_nxt`로 거부 — 추가 클라이언트 사이드 fallback 불필요.

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
    // D4: 거래는 transient 실패(5xx/네트워크 일시) 시 2번 재시도
    const result = await offlineFetch<{ filled_avg_price?: number }>(
      "/api/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { retries: 2 },
    );
    setSubmitting(false);
    if (result.status === "ok") {
      setMessage({
        kind: "ok",
        text:
          type === "limit"
            ? "주문 접수됨 (대기)"
            : `체결됨: ${result.data.filled_avg_price}`,
      });
    } else if (result.status === "queued") {
      const note =
        type === "limit"
          ? "오프라인 — 연결 시 자동 전송됩니다"
          : "오프라인 — 연결 시 자동 전송됩니다 (시장가/미드포인트는 그때 가격으로 체결)";
      toast.info(note);
      setMessage({ kind: "ok", text: "동기화 예약됨" });
    } else {
      setMessage({ kind: "err", text: result.error });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!forceSide && (
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
      )}
      <div className="flex flex-wrap gap-2">
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
        <Button
          type="button"
          variant={type === "midpoint" ? "default" : "outline"}
          onClick={() => setType("midpoint")}
          disabled={!isMidpointAvailable}
          title={
            isMidpointAvailable
              ? "NXT 미드포인트 — spread 없이 체결"
              : "NXT pre/after (08:00–08:50, 15:30–20:00 KST) 한정"
          }
        >
          미드포인트
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
        {side === "buy" ? "매수" : "매도"}{" "}
        {type === "market" ? "(시장가)" : type === "limit" ? "(지정가)" : "(미드포인트)"}
      </Button>
    </form>
  );
}

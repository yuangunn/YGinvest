"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Wallet, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/number-input";
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
  /** Plan #31: 매수/매도 UI에 잔고 + 보유 수량 표시 */
  cashBalance?: number;
  currentQty?: number;
  avgCost?: number | null;
};

type OrderType = "market" | "limit" | "midpoint";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function OrderForm({
  portfolioId,
  symbol,
  currency,
  market,
  lastPrice,
  forceSide,
  cashBalance = 0,
  currentQty = 0,
  avgCost = null,
}: Props) {
  const [side, setSide] = useState<"buy" | "sell">(forceSide ?? "buy");
  const [type, setType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState<number>(lastPrice ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fmt = currency === "KRW" ? KRW : USD;

  // Plan #31: 실시간 총 금액 / 잔고 / 보유 수량 변화 계산.
  //   - 시장가: lastPrice 기준 (실제 체결가는 다를 수 있음 — 추정치임을 명시)
  //   - 지정가: limitPrice 기준
  //   - 미드포인트: 호가 미정이라 lastPrice로 근사 (실제는 NXT mid-quote)
  const referencePrice = useMemo(() => {
    if (type === "limit") return limitPrice > 0 ? limitPrice : (lastPrice ?? 0);
    return lastPrice ?? 0;
  }, [type, limitPrice, lastPrice]);

  const totalCost = useMemo(
    () => (quantity > 0 && referencePrice > 0 ? quantity * referencePrice : 0),
    [quantity, referencePrice],
  );

  const afterBalance = useMemo(() => {
    if (side === "buy") return cashBalance - totalCost;
    return cashBalance + totalCost; // 매도 → 현금 증가
  }, [side, cashBalance, totalCost]);

  const afterQty = useMemo(() => {
    if (side === "buy") return currentQty + quantity;
    return currentQty - quantity;
  }, [side, currentQty, quantity]);

  const insufficientBalance = side === "buy" && totalCost > cashBalance;
  const insufficientQty = side === "sell" && quantity > currentQty;

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
      quantity,
    };
    if (type === "limit") body.limit_price = limitPrice;
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

      {/* Plan #31: 현재 상태 요약 (잔고 + 보유 수량/평단가) */}
      <div className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Wallet className="h-3 w-3" />
            현금 잔고 ({currency})
          </span>
          <span className="font-mono font-medium">{fmt.format(cashBalance)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Coins className="h-3 w-3" />
            보유 수량
          </span>
          <span className="font-mono font-medium">
            {currentQty > 0 ? `${currentQty}주` : "—"}
            {avgCost && currentQty > 0 && (
              <span className="text-muted-foreground ml-1">
                (평단 {fmt.format(avgCost)})
              </span>
            )}
          </span>
        </div>
      </div>

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
        <NumberInput
          id="order-quantity"
          value={quantity}
          onChange={setQuantity}
          placeholder="1"
        />
        {/* Plan #31: 매도 시 "전량 매도" 빠른 버튼 */}
        {side === "sell" && currentQty > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {[0.25, 0.5, 0.75, 1].map((frac) => {
              const qty = Math.floor(currentQty * frac);
              if (qty <= 0) return null;
              const label = frac === 1 ? "전량" : `${frac * 100}%`;
              return (
                <button
                  key={frac}
                  type="button"
                  onClick={() => setQuantity(qty)}
                  className="text-[10px] rounded border px-2 py-0.5 hover:bg-accent hover:border-primary/40 transition-colors"
                >
                  {label} ({qty})
                </button>
              );
            })}
          </div>
        )}
      </div>
      {type === "limit" && (
        <div className="space-y-1">
          <Label htmlFor="order-limit-price">지정가 ({currency})</Label>
          <NumberInput
            id="order-limit-price"
            value={limitPrice}
            onChange={setLimitPrice}
            allowDecimal
            placeholder={lastPrice ? lastPrice.toLocaleString() : "0"}
          />
        </div>
      )}

      {/* Plan #31: 실시간 총 금액 + 매수/매도 후 잔고/보유수량 프리뷰 */}
      {quantity > 0 && referencePrice > 0 && (
        <div className="rounded-lg border bg-card p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              총 {side === "buy" ? "매수" : "매도"} 금액
            </span>
            <span className="font-mono font-semibold text-sm">
              {fmt.format(totalCost)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground -mt-0.5">
            {quantity}주 × {fmt.format(referencePrice)}
            {type === "market" && " (시장가 추정)"}
            {type === "midpoint" && " (미드포인트 근사)"}
          </div>
          <div className="border-t pt-1 mt-1 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {side === "buy" ? "매수" : "매도"} 후 현금
              </span>
              <span
                className={`font-mono ${
                  afterBalance < 0 ? "text-destructive font-semibold" : ""
                }`}
              >
                {fmt.format(afterBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {side === "buy" ? "매수" : "매도"} 후 보유
              </span>
              <span
                className={`font-mono ${
                  afterQty < 0 ? "text-destructive font-semibold" : ""
                }`}
              >
                {afterQty}주
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Plan #31: 부족 경고 — 잔고 / 보유수량 */}
      {(insufficientBalance || insufficientQty) && (
        <div className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {insufficientBalance && (
              <>
                잔고 부족 — {fmt.format(totalCost - cashBalance)} 모자람
              </>
            )}
            {insufficientQty && (
              <>
                보유 수량 부족 — {quantity - currentQty}주 더 필요 (보유:{" "}
                {currentQty}주)
              </>
            )}
          </span>
        </div>
      )}

      {message && (
        <Alert variant={message.kind === "ok" ? "default" : "destructive"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={submitting || insufficientBalance || insufficientQty}
        className="w-full"
      >
        {side === "buy" ? "매수" : "매도"}{" "}
        {type === "market" ? "(시장가)" : type === "limit" ? "(지정가)" : "(미드포인트)"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OrderForm } from "@/components/order-form";

type Props = {
  portfolioId: string;
  symbol: string;
  symbolName: string;
  currency: string;
  market: string;
  lastPrice: number | null;
  /** Plan #31: 매수/매도 UI에 현금 잔고 + 보유 수량 표시 */
  cashBalance: number;
  currentQty: number;
  avgCost: number | null;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function BuySellSheet({
  portfolioId,
  symbol,
  symbolName,
  currency,
  market,
  lastPrice,
  cashBalance,
  currentQty,
  avgCost,
}: Props) {
  const [openSide, setOpenSide] = useState<"buy" | "sell" | null>(null);
  const fmt = currency === "KRW" ? KRW : USD;
  const priceText = lastPrice ? fmt.format(lastPrice) : "—";

  return (
    <div className="grid grid-cols-2 gap-2">
      <Sheet open={openSide === "buy"} onOpenChange={(o) => setOpenSide(o ? "buy" : null)}>
        <SheetTrigger className="w-full inline-flex items-center justify-center h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 font-medium">
          매수
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{symbolName} 매수</SheetTitle>
            <SheetDescription>
              {symbol} · 현재가 {priceText}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <OrderForm
              portfolioId={portfolioId}
              symbol={symbol}
              currency={currency}
              market={market}
              lastPrice={lastPrice}
              cashBalance={cashBalance}
              currentQty={currentQty}
              avgCost={avgCost}
              forceSide="buy"
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={openSide === "sell"} onOpenChange={(o) => setOpenSide(o ? "sell" : null)}>
        <SheetTrigger className="w-full inline-flex items-center justify-center h-10 rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground font-medium">
          매도
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{symbolName} 매도</SheetTitle>
            <SheetDescription>
              {symbol} · 현재가 {priceText}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <OrderForm
              portfolioId={portfolioId}
              symbol={symbol}
              currency={currency}
              market={market}
              lastPrice={lastPrice}
              cashBalance={cashBalance}
              currentQty={currentQty}
              avgCost={avgCost}
              forceSide="sell"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

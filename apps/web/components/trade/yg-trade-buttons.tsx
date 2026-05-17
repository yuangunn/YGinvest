"use client";

// Plan #44: 매수/매도 버튼 카드 — 잔고 + 보유 + 평단가 요약.
// 클릭 시 BuySellSheet (바텀 시트) 트리거.

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OrderForm } from "@/components/order-form";
import { TickerBadge } from "@/components/yg/ticker-badge";
import { DeltaText } from "@/components/yg/delta-text";
import { fmt } from "@/lib/yg-fmt";

type Props = {
  portfolioId: string;
  symbol: string;
  symbolName: string;
  market: string;
  currency: string;
  lastPrice: number | null;
  cashBalance: number;
  currentQty: number;
  avgCost: number | null;
};

export function YGTradeButtons({
  portfolioId,
  symbol,
  symbolName,
  market,
  currency,
  lastPrice,
  cashBalance,
  currentQty,
  avgCost,
}: Props) {
  const [openSide, setOpenSide] = useState<"buy" | "sell" | null>(null);

  const isKRW = currency === "KRW";
  // 보유 수익률 계산
  const heldValue = lastPrice ? lastPrice * currentQty : 0;
  const costBasis = avgCost ? avgCost * currentQty : 0;
  const pnl = heldValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  return (
    <div
      className="yg-card"
      style={{ padding: 18, margin: "12px 20px 0", width: "auto" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Sheet
          open={openSide === "buy"}
          onOpenChange={(o) => setOpenSide(o ? "buy" : null)}
        >
          <SheetTrigger
            className="yg-btn yg-btn-up"
            style={{ width: "100%" }}
          >
            매수하기
          </SheetTrigger>
          <SheetContent
            side="bottom"
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: "8px 0 0",
              maxHeight: "94vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                background: "var(--yg-line-strong)",
                borderRadius: 99,
                margin: "6px auto 12px",
              }}
            />
            <div style={{ padding: "0 20px 22px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <TickerBadge symbol={symbol.slice(0, 3)} size={36} />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "var(--yg-fg-primary)",
                    }}
                  >
                    {symbolName}{" "}
                    <span style={{ color: "var(--yg-up-deep)" }}>매수</span>
                  </div>
                  <div
                    className="yg-num"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--yg-fg-tertiary)",
                    }}
                  >
                    {symbol} · {market}
                  </div>
                </div>
              </div>
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

        <Sheet
          open={openSide === "sell"}
          onOpenChange={(o) => setOpenSide(o ? "sell" : null)}
        >
          <SheetTrigger
            className="yg-btn yg-btn-down"
            style={{ width: "100%" }}
          >
            매도하기
          </SheetTrigger>
          <SheetContent
            side="bottom"
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: "8px 0 0",
              maxHeight: "94vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                background: "var(--yg-line-strong)",
                borderRadius: 99,
                margin: "6px auto 12px",
              }}
            />
            <div style={{ padding: "0 20px 22px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <TickerBadge symbol={symbol.slice(0, 3)} size={36} />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "var(--yg-fg-primary)",
                    }}
                  >
                    {symbolName}{" "}
                    <span style={{ color: "var(--yg-down-deep)" }}>매도</span>
                  </div>
                  <div
                    className="yg-num"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--yg-fg-tertiary)",
                    }}
                  >
                    {symbol} · {market}
                  </div>
                </div>
              </div>
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

      {/* 잔고 + 보유 + 평단 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          padding: "12px 0 0",
          gap: 6,
          borderTop: "1px solid var(--yg-line-faint)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            주문가능
          </div>
          <div
            className="yg-num"
            style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}
          >
            {fmt.krwShort(cashBalance)}원
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            보유
          </div>
          <div
            className="yg-num"
            style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}
          >
            {currentQty > 0 ? `${currentQty}주` : "—"}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            평단가
          </div>
          <div
            className="yg-num"
            style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}
          >
            {avgCost ? (isKRW ? fmt.krw(avgCost) : fmt.usd(avgCost)) : "—"}
          </div>
        </div>
      </div>

      {/* 보유 수익률 */}
      {currentQty > 0 && avgCost && lastPrice && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: pnl >= 0 ? "var(--yg-bg-tint-red)" : "var(--yg-bg-tint-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: pnl >= 0 ? "var(--yg-up-deep)" : "var(--yg-down-deep)",
            }}
          >
            보유 수익
          </div>
          <DeltaText pct={pnlPct} abs={pnl} size={14} />
        </div>
      )}
    </div>
  );
}

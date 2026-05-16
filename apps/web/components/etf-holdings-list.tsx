// Plan #32: ETF 구성 종목 Top N 표시.

import Link from "next/link";
import { PieChart, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatWeight } from "@/lib/etf-labels";

type Props = {
  etfSymbol: string;
};

export async function EtfHoldingsList({ etfSymbol }: Props) {
  const supabase = await createClient();
  const { data: holdings } = await supabase
    .from("etf_holdings")
    .select("rank, holding_symbol, holding_name, weight")
    .eq("etf_symbol", etfSymbol)
    .order("rank", { ascending: true })
    .limit(10);

  type Holding = NonNullable<typeof holdings>[number];
  const list: Holding[] = holdings ?? [];

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            구성 종목 Top 10
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            아직 수집되지 않음. 매일 05:45 KST에 자동 fetch.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 보유 종목 중 우리 stocks 테이블에도 있는 것은 link 가능
  const linkableSymbols = list
    .map((h) => h.holding_symbol)
    .filter((s): s is string => s !== null);
  const { data: stocksFound } = linkableSymbols.length
    ? await supabase
        .from("stocks")
        .select("symbol")
        .in("symbol", linkableSymbols)
    : { data: [] };
  const linkable = new Set((stocksFound ?? []).map((s) => s.symbol));

  const totalWeight = list.reduce((sum, h) => sum + Number(h.weight), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          구성 종목 Top {list.length}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Top {list.length}이 전체의 {formatWeight(totalWeight)}을 차지
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {list.map((h) => {
            const canLink = h.holding_symbol && linkable.has(h.holding_symbol);
            const inner = (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground tabular-nums w-5 flex-shrink-0">
                    {h.rank}
                  </span>
                  <span className="font-medium text-sm truncate">
                    {h.holding_name}
                  </span>
                  {h.holding_symbol && (
                    <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                      {h.holding_symbol}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, (Number(h.weight) / Math.max(...list.map((x) => Number(x.weight)))) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-sm tabular-nums w-14 text-right">
                    {formatWeight(h.weight)}
                  </span>
                </div>
              </>
            );

            return canLink ? (
              <Link
                key={h.rank}
                href={`/app/trade/${encodeURIComponent(h.holding_symbol!)}`}
                className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-accent transition-colors"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={h.rank}
                className="flex items-center justify-between gap-2 rounded-md p-2"
              >
                {inner}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          파란색 종목은 클릭해서 상세보기 가능 (DB에 등록된 종목)
        </p>
      </CardContent>
    </Card>
  );
}

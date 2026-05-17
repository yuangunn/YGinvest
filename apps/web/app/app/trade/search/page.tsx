// Plan #44: YG 검색 페이지 — Toss 스타일.
// 검색 인풋 + 전체/주식/ETF 필터 + 카테고리별 거래대금 상위.

import { PageHeader } from "@/components/yg/page-header";
import { YGStockSearch } from "@/components/search/yg-stock-search";
import { createClient } from "@/lib/supabase/server";
import { getTradingLeaders } from "@/lib/trading-leaders";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const supabase = await createClient();

  const [
    krStockTop5,
    usStockTop5,
    krEtfTop5,
    usEtfTop5,
    krStockTop3,
    usStockTop3,
    krEtfTop3,
    usEtfTop3,
  ] = await Promise.all([
    getTradingLeaders(supabase, { scope: "KR", instrument: "stock", limit: 5 }),
    getTradingLeaders(supabase, { scope: "US", instrument: "stock", limit: 5 }),
    getTradingLeaders(supabase, { scope: "KR", instrument: "etf", limit: 5 }),
    getTradingLeaders(supabase, { scope: "US", instrument: "etf", limit: 5 }),
    getTradingLeaders(supabase, { scope: "KR", instrument: "stock", limit: 3 }),
    getTradingLeaders(supabase, { scope: "US", instrument: "stock", limit: 3 }),
    getTradingLeaders(supabase, { scope: "KR", instrument: "etf", limit: 3 }),
    getTradingLeaders(supabase, { scope: "US", instrument: "etf", limit: 3 }),
  ]);

  return (
    <div>
      <PageHeader title="종목 검색" />
      <YGStockSearch
        trending={{
          all: {
            krStock: krStockTop3,
            usStock: usStockTop3,
            krEtf: krEtfTop3,
            usEtf: usEtfTop3,
          },
          stock: { kr: krStockTop5, us: usStockTop5 },
          etf: { kr: krEtfTop5, us: usEtfTop5 },
        }}
      />
    </div>
  );
}

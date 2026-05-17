// Plan #32a: 검색 페이지 — 비검색 상태에서 카테고리별 거래대금 상위 표시.
//
// 전체: KR주식 / US주식 / KR ETF / US ETF 각 3개씩
// 주식: KR주식 5 + US주식 5
// ETF: KR ETF 5 + US ETF 5
//
// 클라이언트는 instrument 토글하면 props 데이터 안에서 필터.

import { StockSearch } from "@/components/stock-search";
import { createClient } from "@/lib/supabase/server";
import { getTradingLeaders } from "@/lib/trading-leaders";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const supabase = await createClient();

  // 6번의 fetch를 병렬로 — 한 페이지 로드에 모두 미리 준비
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
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">종목 검색</h1>
      <StockSearch
        trending={{
          all: {
            krStock: krStockTop3,
            usStock: usStockTop3,
            krEtf: krEtfTop3,
            usEtf: usEtfTop3,
          },
          stock: {
            kr: krStockTop5,
            us: usStockTop5,
          },
          etf: {
            kr: krEtfTop5,
            us: usEtfTop5,
          },
        }}
      />
    </div>
  );
}

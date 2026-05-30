// 환율(USD→KRW) 단일 소스.
//
// 그동안 환율 상수가 코드 곳곳에 흩어져 화면마다 값이 달랐다:
//   - 포트폴리오(dashboard/overview): 실시간 fx_rates (폴백 1395)
//   - what-if / scenarios: 정적 1400
//   - 게임(trade/rebirth/achievements/stock-trader): 정적 1300
// 같은 USD 종목이 화면마다 다른 원화 가치로 계산되는 불일치가 있었다.
//
// 이 파일이 "의미"별 단일 기준을 제공한다:
//   1) 실거래/포트폴리오 → 실시간 환율(fetchUsdKrwRate) 사용, 못 구하면 PORTFOLIO_FX_FALLBACK
//   2) 게임 → 의도적으로 고정 환율(GAME_FX_USD_KRW). 게임 규칙의 일부라 실시간과 분리.

import type { SupabaseClient } from "@supabase/supabase-js";

/** 포트폴리오/실거래 화면에서 실시간 환율을 못 구했을 때의 폴백. */
export const PORTFOLIO_FX_FALLBACK = 1395;

/**
 * 게임 내 고정 환율. 게임은 KRW 단일 통화로 단순화하며, USD 종목은
 * 이 고정 비율로 환산한다. (실시간 환율과 의도적으로 분리 — 게임 밸런스 일관성)
 */
export const GAME_FX_USD_KRW = 1300;

/**
 * 최신 USD→KRW 환율을 fx_rates 테이블에서 조회.
 * 행이 없거나 조회 실패 시 PORTFOLIO_FX_FALLBACK 반환.
 *
 * 포트폴리오 평가액 등 "실거래" 계산에 사용. 게임에는 쓰지 않는다.
 */
export async function fetchUsdKrwRate(
  supabase: SupabaseClient,
): Promise<number> {
  const { data } = await supabase
    .from("fx_rates")
    .select("rate")
    .eq("base", "USD")
    .eq("quote", "KRW")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.rate ? Number(data.rate) : PORTFOLIO_FX_FALLBACK;
}

/** 통화 기준 금액을 KRW로 환산 (KRW는 그대로, USD는 rate 곱). */
export function toKrw(
  value: number,
  currency: string,
  rate: number,
): number {
  return currency === "KRW" ? value : value * rate;
}

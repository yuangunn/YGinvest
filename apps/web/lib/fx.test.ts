import { describe, it, expect } from "vitest";
import {
  toKrw,
  fetchUsdKrwRate,
  PORTFOLIO_FX_FALLBACK,
  GAME_FX_USD_KRW,
} from "./fx";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("toKrw", () => {
  it("KRW는 환율 무관하게 그대로", () => {
    expect(toKrw(10000, "KRW", 1400)).toBe(10000);
  });
  it("USD는 환율 곱", () => {
    expect(toKrw(100, "USD", 1300)).toBe(130000);
  });
});

describe("상수", () => {
  it("게임 고정 환율 = 1300", () => {
    expect(GAME_FX_USD_KRW).toBe(1300);
  });
  it("포트폴리오 폴백 = 1395", () => {
    expect(PORTFOLIO_FX_FALLBACK).toBe(1395);
  });
});

// fx_rates 조회를 흉내내는 최소 mock 빌더
function mockSupabase(rateRow: { rate: number } | null): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: rateRow }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("fetchUsdKrwRate", () => {
  it("행이 있으면 그 환율 반환", async () => {
    const rate = await fetchUsdKrwRate(mockSupabase({ rate: 1372 }));
    expect(rate).toBe(1372);
  });
  it("행이 없으면 폴백 반환", async () => {
    const rate = await fetchUsdKrwRate(mockSupabase(null));
    expect(rate).toBe(PORTFOLIO_FX_FALLBACK);
  });
});

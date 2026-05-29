import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

const COOKIE_NAME = "yginvest_portfolio";

/**
 * 사용자가 선택한 포트폴리오 ID 조회.
 * 우선순위:
 *   1. 쿠키에 있고 사용자의 포트폴리오 중 하나라면 그 값
 *   2. 없거나 검증 실패 → 글로벌 포트폴리오 (room_id IS NULL)
 *   3. 글로벌도 없음 → null
 *
 * React `cache()`로 요청 단위 메모이즈 — createClient()가 캐시되어 같은 요청에선
 * 동일 supabase 인스턴스가 전달되므로, 여러 컴포넌트가 호출해도 조회는 1회만.
 */
export const getSelectedPortfolioId = cache(async function getSelectedPortfolioId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(COOKIE_NAME)?.value;

  if (cookieVal) {
    // 쿠키 값 검증 — 사용자의 포트폴리오 중 하나여야
    const { data } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", cookieVal)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data.id;
  }

  // 폴백: 글로벌
  const { data: global } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .is("room_id", null)
    .maybeSingle();
  return global?.id ?? null;
});

/**
 * 사용자의 모든 활성/종료 포트폴리오 목록 (스위처용).
 * 글로벌 + 가입한 방들의 portfolio가 함께 반환됨.
 */
export async function listUserPortfolios(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data } = await supabase
    .from("portfolios")
    .select("id, room_id, status, rooms(name)")
    .eq("user_id", userId)
    .order("started_at", { ascending: true });
  return data ?? [];
}

export const PORTFOLIO_COOKIE_NAME = COOKIE_NAME;

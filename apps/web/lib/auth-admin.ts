// Plan #29: 관리자 권한 체크 헬퍼.
// 서버 컴포넌트 / API route에서 사용.

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 주어진 user의 is_admin 여부 조회.
 * profile 행 없거나 is_admin=false면 false.
 *
 * React `cache()`로 요청 단위 메모이즈 — createClient()가 캐시되어 같은 요청에선
 * 동일한 supabase 인스턴스가 전달되므로, layout과 page가 각각 호출해도
 * profiles 조회는 1회만 일어난다.
 */
export const getIsAdmin = cache(async function getIsAdmin(
  supabase: SupabaseClient,
  userId: string | undefined | null,
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return !!data.is_admin;
});

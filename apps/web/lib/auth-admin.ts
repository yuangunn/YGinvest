// Plan #29: 관리자 권한 체크 헬퍼.
// 서버 컴포넌트 / API route에서 사용.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 주어진 user의 is_admin 여부 조회.
 * profile 행 없거나 is_admin=false면 false.
 */
export async function getIsAdmin(
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
}

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// 요청(렌더) 단위로 메모이즈된 인증 사용자 조회.
//
// supabase.auth.getUser()는 매번 Supabase Auth 서버에 토큰 검증 요청을 보내는
// 네트워크 왕복이다. layout과 page가 각각 호출하면 한 번의 화면 이동에
// 동일한 왕복이 중복으로 쌓인다. React `cache()`로 감싸면 같은 요청 안에서는
// 첫 호출 결과를 재사용하므로 왕복이 1회로 줄어든다.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { clearAppCaches } from "@/lib/sw-cache";

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Plan #11: 다음 사용자에게 전 사용자의 페이지/API 캐시가 새지 않도록 정리
    await clearAppCaches();
    window.location.href = "/";
  }
  return (
    <Button variant="ghost" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}

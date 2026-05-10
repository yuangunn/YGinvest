"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  return (
    <Button variant="ghost" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}

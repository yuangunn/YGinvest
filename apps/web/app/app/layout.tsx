import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { LogoutButton } from "@/components/logout-button";
import { PortfolioSwitcher } from "@/components/portfolio-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getSelectedPortfolioId,
  listUserPortfolios,
} from "@/lib/portfolio-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, portfolios, selectedId] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single(),
    listUserPortfolios(supabase, user.id),
    getSelectedPortfolioId(supabase, user.id),
  ]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="font-semibold">YGinvest</div>
        <div className="flex items-center gap-3 text-sm">
          <PortfolioSwitcher portfolios={portfolios} selectedId={selectedId} />
          <ThemeToggle />
          <span className="text-muted-foreground hidden sm:inline">
            {profile?.display_name ?? user.email}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}

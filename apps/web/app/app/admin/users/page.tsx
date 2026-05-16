import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIsAdmin } from "@/lib/auth-admin";
import { AdminUserRow } from "@/components/admin-user-row";

type Profile = {
  id: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const isAdmin = await getIsAdmin(supabase, user.id);
  if (!isAdmin) redirect("/app/dashboard");

  // 모든 profile 조회 (RLS로 admin만 가능)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, is_admin, created_at")
    .order("created_at", { ascending: false });

  const rows = (profiles as Profile[] | null) ?? [];
  const adminCount = rows.filter((p) => p.is_admin).length;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link
          href="/app/health"
          className="hover:underline inline-flex items-center gap-0.5"
        >
          <ChevronLeft className="h-3 w-3" />
          시스템 상태
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          사용자 관리
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          전체 {rows.length}명 · 관리자 {adminCount}명
        </p>
      </div>

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">⚠️ 관리자 권한</p>
          <p>
            관리자는 시스템 상태 페이지의 전체 진단 정보를 볼 수 있고, 다른
            사용자에게도 관리자 권한 부여/회수가 가능합니다.
          </p>
          <p>
            <strong>주의</strong>: 본인의 관리자 권한을 회수하면 다시 부여하려면
            다른 관리자가 해주거나 Supabase Dashboard에서 직접 SQL 실행 필요.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            사용자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              사용자가 없습니다
            </p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((p) => (
                <AdminUserRow
                  key={p.id}
                  userId={p.id}
                  displayName={p.display_name ?? "이름 미설정"}
                  isAdmin={p.is_admin}
                  isSelf={p.id === user.id}
                  createdAt={p.created_at}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">📝 메모</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              사용자 가입 시 자동으로 <code className="font-mono bg-muted px-1">profiles</code> 행 생성, <code>is_admin = false</code>로 시작.
            </li>
            <li>
              여기서 권한 부여 → 그 사용자가 다음 새로고침부터 admin view 접근 가능.
            </li>
            <li>
              긴급 시 Supabase Dashboard → SQL Editor:
              <pre className="bg-muted/50 rounded p-2 mt-1 text-[10px]">
{`update public.profiles set is_admin = true
where id in (
  select id from auth.users where email = '<이메일>'
);`}
              </pre>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

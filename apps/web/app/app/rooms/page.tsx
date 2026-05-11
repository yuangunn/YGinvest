import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function RoomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, host_id, status, starts_at, ends_at, max_members")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">친구방</h1>
        <div className="flex gap-2">
          <Link href="/app/rooms/join">
            <Button variant="outline">가입</Button>
          </Link>
          <Link href="/app/rooms/new">
            <Button>방 만들기</Button>
          </Link>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          {!rooms || rooms.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="text-4xl" aria-hidden>👥</div>
              <div className="text-sm text-muted-foreground">아직 참여 중인 방이 없어요</div>
              <div className="flex gap-2 justify-center">
                <Link href="/app/rooms/join">
                  <Button variant="outline" size="sm">초대 코드 입력</Button>
                </Link>
                <Link href="/app/rooms/new">
                  <Button size="sm">새 방 만들기</Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {rooms.map((r) => (
                <li key={r.id} className="border-b pb-2">
                  <Link
                    href={`/app/rooms/${r.id}`}
                    className="block hover:bg-muted/30 p-2 rounded"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          상태: {r.status} ·{" "}
                          {r.host_id === user.id ? "호스트" : "멤버"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.ends_at
                          ? `~${new Date(r.ends_at).toLocaleDateString("ko-KR")}`
                          : "무제한"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

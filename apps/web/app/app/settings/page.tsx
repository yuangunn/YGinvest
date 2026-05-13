import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushToggle } from "@/components/push-toggle";
import { NotificationTypeToggle } from "@/components/notification-type-toggle";

const TYPES: Array<[string, string]> = [
  ["order_filled", "지정가 주문 체결"],
  ["order_expiring_soon", "주문 만료 24시간 전"],
  ["room_starting", "방 시작 24시간 전"],
  ["room_ending", "방 종료 24시간 전"],
  ["dividend_received", "배당 입금"],
  ["corporate_action_applied", "분할/병합 적용"],
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">설정</h1>

      <Link href="/app/settings/ai">
        <Card className="hover:border-primary/40 transition-colors lift">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">AI 분석 키 (BYOK)</div>
                <div className="text-xs text-muted-foreground">
                  Claude / OpenAI / Gemini 본인 키 등록
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">푸시 알림</CardTitle>
        </CardHeader>
        <CardContent>
          <PushToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">알림 종류</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {TYPES.map(([key, label]) => (
            <NotificationTypeToggle
              key={key}
              type={key}
              label={label}
              defaultChecked={
                settings ? Boolean(settings[key as keyof typeof settings]) : true
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

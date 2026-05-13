import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiKeysForm } from "@/components/ai-keys-form";

export default async function AiSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: keys } = await supabase
    .from("user_ai_keys")
    .select("provider, model, api_key, updated_at")
    .eq("user_id", user.id);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link href="/app/settings" className="hover:underline inline-flex items-center gap-0.5">
          <ChevronLeft className="h-3 w-3" />
          설정
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI 분석 — API 키 등록 (BYOK)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          본인 명의의 AI provider API 키를 등록하면 종목 분석을 받을 수 있어요.
          비용은 등록한 키 명의로 발생합니다.
        </p>
      </div>

      <Card className="border-yellow-500/40 bg-yellow-500/5">
        <CardContent className="text-xs text-foreground space-y-2 py-3">
          <p>
            <strong>🔒 보안 안내</strong>
          </p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>키는 본인 계정에 RLS 적용되어 다른 사용자가 볼 수 없습니다.</li>
            <li>키는 평문으로 저장됩니다 (TLS로 전송). 매우 민감하면 본인 책임 하에 사용.</li>
            <li>UI에는 마스킹되어 표시 (예: <code>sk-ant-…AbCd</code>).</li>
            <li>사용량/비용은 각 provider 콘솔에서 직접 모니터링하세요.</li>
            <li>언제든지 키 삭제 가능.</li>
          </ul>
        </CardContent>
      </Card>

      <AiKeysForm initialKeys={keys ?? []} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">💡 사용 가이드</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>키 등록 후 종목 상세 페이지에서 <strong>“AI 분석 받기”</strong> 버튼이 활성화됩니다.</p>
          <p>여러 provider를 등록할 경우, 분석 받을 때 어느 provider를 사용할지 고를 수 있어요.</p>
          <p className="text-muted-foreground">권장 모델 (저렴 + 빠름):</p>
          <ul className="text-xs text-muted-foreground list-disc ml-4">
            <li>Anthropic: <code>claude-3-5-haiku-latest</code> (~$1/1M tokens)</li>
            <li>OpenAI: <code>gpt-4o-mini</code> (~$0.15/1M input)</li>
            <li>Google: <code>gemini-1.5-flash-latest</code> (무료 한도 있음)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

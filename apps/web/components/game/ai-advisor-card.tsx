"use client";

// Plan #40: AI 인생 어드바이저 카드.

import { useState } from "react";
import Link from "next/link";
import { Brain, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AiAdvisorCard() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needKey, setNeedKey] = useState(false);

  async function ask() {
    setLoading(true);
    setAdvice(null);
    setNeedKey(false);
    try {
      const res = await fetch("/api/game/advisor", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_api_key") {
          setNeedKey(true);
        } else {
          toast.error(`분석 실패: ${data.error}`);
        }
        return;
      }
      setAdvice(data.advice);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Brain className="h-4 w-4 text-purple-500" />
          AI 인생 어드바이저
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!advice && !needKey && (
          <>
            <p className="text-xs text-muted-foreground">
              현재 캐릭터 + 최근 일기 + 환생 기록을 AI에게 보여주고 조언 받기.
              모드 적정성, 환생 페이스, 다음 우선순위, 매도 트레이닝 평가.
            </p>
            <Button onClick={ask} disabled={loading} size="sm" className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  분석 중...
                </>
              ) : (
                "AI에게 물어보기"
              )}
            </Button>
          </>
        )}
        {needKey && (
          <div className="text-xs space-y-1.5">
            <p>AI 키 등록이 필요해요.</p>
            <Link
              href="/app/settings/ai"
              className="text-primary hover:underline"
            >
              → 설정 → AI 키 등록
            </Link>
          </div>
        )}
        {advice && (
          <div className="space-y-2">
            <div className="text-xs whitespace-pre-wrap bg-muted/30 rounded p-2.5">
              {advice}
            </div>
            <Button variant="outline" size="sm" onClick={ask} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "다시 분석"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

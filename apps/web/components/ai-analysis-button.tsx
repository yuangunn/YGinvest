"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PROVIDER_LABEL, type Provider } from "@/lib/ai-providers";

type Props = {
  symbol: string;
  registeredProviders: Provider[]; // 사용자가 등록한 provider 목록
};

export function AiAnalysisButton({ symbol, registeredProviders }: Props) {
  const [analysis, setAnalysis] = useState<{
    text: string;
    provider: string;
    model: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<Provider | "">(
    registeredProviders[0] ?? "",
  );

  if (registeredProviders.length === 0) {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="py-4 text-sm">
          <p className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <strong>AI 분석 활성화</strong>
          </p>
          <p className="text-muted-foreground text-xs mb-2">
            Claude / OpenAI / Gemini 중 본인의 API 키를 등록하면 이 종목에 대한 AI
            분석을 받을 수 있어요. 비용은 본인 계정으로 발생.
          </p>
          <Link
            href="/app/settings/ai"
            className="text-xs text-primary hover:underline"
          >
            설정 → AI 키 등록 →
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function analyze() {
    if (!provider) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? "분석 실패");
        setLoading(false);
        return;
      }
      setAnalysis({
        text: data.text,
        provider: data.provider,
        model: data.model,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI 분석
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!analysis ? (
          <div className="flex flex-wrap gap-2 items-center">
            {registeredProviders.length > 1 && (
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="h-9 px-2 rounded-md border bg-background text-sm"
              >
                {registeredProviders.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={analyze} disabled={loading} size="sm">
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI 분석 받기
                </>
              )}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {registeredProviders.length === 1
                ? PROVIDER_LABEL[registeredProviders[0]]
                : "선택"}
              으로 분석 (사용자 키)
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              <strong>{PROVIDER_LABEL[analysis.provider as Provider]}</strong> ·{" "}
              <code>{analysis.model}</code>
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ wordBreak: "keep-all" }}
            >
              {analysis.text}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAnalysis(null)}
            >
              다시 분석
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

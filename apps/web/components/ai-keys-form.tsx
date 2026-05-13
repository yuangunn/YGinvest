"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROVIDER_INFO, PROVIDER_LABEL, type Provider } from "@/lib/ai-providers";

type KeyRow = {
  provider: string;
  model: string | null;
  api_key: string;
  updated_at: string;
};

function maskKey(key: string): string {
  if (key.length < 12) return "***";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export function AiKeysForm({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const res = await fetch("/api/ai/keys");
    if (!res.ok) return;
    const data = await res.json();
    setKeys(
      (data.keys as { provider: string; api_key_masked: string; model: string | null; updated_at: string }[]).map(
        (k) => ({
          provider: k.provider,
          model: k.model,
          api_key: k.api_key_masked,
          updated_at: k.updated_at,
        }),
      ),
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: apiKey.trim(),
          model: model.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success(`${PROVIDER_LABEL[provider]} 키 저장됨`);
        setApiKey("");
        setModel("");
        await refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(`저장 실패: ${j.error ?? "오류"}`);
      }
    });
  }

  function remove(prov: string) {
    startTransition(async () => {
      const res = await fetch(`/api/ai/keys?provider=${prov}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("삭제됨");
        await refresh();
      } else {
        toast.error("삭제 실패");
      }
    });
  }

  const info = PROVIDER_INFO[provider];

  return (
    <>
      {keys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">등록된 키 ({keys.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.provider}
                  className="flex items-center justify-between gap-2 border rounded p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {PROVIDER_LABEL[k.provider as Provider]}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {k.api_key.startsWith("sk-") || k.api_key.startsWith("AIza")
                        ? maskKey(k.api_key)
                        : k.api_key}
                      {k.model && ` · ${k.model}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(k.provider)}
                    className="text-muted-foreground hover:text-destructive p-1.5"
                    aria-label="삭제"
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 키 추가 / 갱신</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="provider">AI Provider</Label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="w-full h-10 px-3 rounded-md border bg-background"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="google">Google (Gemini)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                <Link
                  href={info.url}
                  target="_blank"
                  rel="noopener"
                  className="hover:underline inline-flex items-center gap-0.5 text-primary"
                >
                  {PROVIDER_LABEL[provider]} 키 발급 받기
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <span className="ml-2 font-mono">(형식: {info.keyFormat})</span>
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="apikey">API Key</Label>
              <Input
                id="apikey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={info.keyFormat}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="model">모델 (선택)</Label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background"
              >
                <option value="">기본 ({info.defaultModel})</option>
                {info.modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              저장
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

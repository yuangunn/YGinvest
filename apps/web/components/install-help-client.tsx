"use client";

import { useEffect, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  detectPwaEnv,
  type BeforeInstallPromptEvent,
  type PwaPlatform,
} from "@/lib/pwa-detect";

const LABEL: Record<PwaPlatform, string> = {
  "android-pwa": "Android (Chrome / 삼성 인터넷)",
  "android-firefox": "Android Firefox",
  "ios-safari": "iOS (Safari / Chrome iOS)",
  inapp: "인앱 브라우저",
  "desktop-chrome": "데스크탑 Chrome/Edge",
  "desktop-other": "데스크탑 브라우저",
  unknown: "알 수 없음",
};

const SECTION_HASH: Record<PwaPlatform, string> = {
  "android-pwa": "#chrome",
  "android-firefox": "#chrome",
  "ios-safari": "#ios",
  inapp: "#inapp",
  "desktop-chrome": "#chrome",
  "desktop-other": "#chrome",
  unknown: "#chrome",
};

/**
 * 현재 환경 표시 + (가능 시) 즉시 설치 버튼.
 * SSR 시에는 placeholder 출력 후 client에서 갱신.
 */
export function InstallHelpClient() {
  const [platform, setPlatform] = useState<PwaPlatform>("unknown");
  const [inappName, setInappName] = useState<string | undefined>();
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);

    const t = setTimeout(() => {
      const env = detectPwaEnv();
      setPlatform(env.platform);
      setInappName(env.inappName);
      setStandalone(env.isStandalone);
      setReady(true);
    }, 0);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(t);
    };
  }, []);

  async function tryInstall() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // ignore
    } finally {
      setDeferred(null);
    }
  }

  if (!ready) {
    return null;
  }

  if (standalone) {
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardContent className="py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span>
            이미 앱으로 실행 중입니다 — 별도 설치 불필요!
          </span>
        </CardContent>
      </Card>
    );
  }

  const platformLabel =
    platform === "inapp" && inappName
      ? `${inappName} 인앱 브라우저`
      : LABEL[platform];
  const sectionAnchor = SECTION_HASH[platform];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            현재 환경:{" "}
            <strong className="text-foreground">{platformLabel}</strong>
          </div>
          <a
            href={sectionAnchor}
            className="text-xs text-primary hover:underline"
          >
            ↓ 해당 가이드로 이동
          </a>
        </div>
        {deferred && (
          <button
            type="button"
            onClick={tryInstall}
            className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            지금 설치하기 (네이티브 prompt)
          </button>
        )}
        {!deferred && platform === "android-pwa" && (
          <p className="text-[10px] text-muted-foreground">
            💡 페이지를 잠시 둘러보고 다시 오면 &quot;지금 설치&quot; 버튼이
            나타날 수 있습니다. 또는 아래 가이드대로 메뉴에서 직접 설치.
          </p>
        )}
        {platform === "inapp" && (
          <p className="text-[10px] text-amber-500">
            ⚠️ 인앱 브라우저는 PWA 설치를 지원하지 않습니다. 아래 가이드대로
            외부 브라우저로 옮긴 후 설치하세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

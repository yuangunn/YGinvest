"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, X, ExternalLink } from "lucide-react";
import {
  detectPwaEnv,
  isBannerDismissed,
  markBannerDismissed,
  type BeforeInstallPromptEvent,
  type PwaPlatform,
} from "@/lib/pwa-detect";

/**
 * PWA 설치 안내 배너 — /app/* 라우트에서 상단에 표시.
 *
 * - Chrome/Samsung Internet/Edge: beforeinstallprompt 이벤트로 네이티브 설치 prompt
 * - iOS Safari: 수동 안내 (Safari 공유 → 홈 화면에 추가)
 * - 인앱 브라우저(카카오톡/네이버/인스타 등): "외부 브라우저로 열기" 안내
 * - Firefox: 수동 메뉴 안내
 * - 이미 설치됨(standalone) / 최근 14일 내 dismiss → 표시 안함
 */
export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>("unknown");
  const [inappName, setInappName] = useState<string | undefined>();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);

    function onInstalled() {
      // 설치 완료 후 배너 즉시 숨김
      setVisible(false);
      setDeferred(null);
    }
    window.addEventListener("appinstalled", onInstalled);

    // 환경 감지 + 표시 여부 결정 (setState는 setTimeout 안에서 — react-hooks/set-state-in-effect 회피)
    const t = setTimeout(() => {
      const env = detectPwaEnv();
      setPlatform(env.platform);
      setInappName(env.inappName);
      if (env.isStandalone) return; // 이미 설치된 PWA로 실행 중
      if (isBannerDismissed()) return;
      // beforeinstallprompt-capable 플랫폼은 이벤트 fire를 기다리지만,
      // 일부 환경에선 fire 안 될 수도 있어 짧은 fallback 후 generic 배너 표시.
      if (env.platform === "android-pwa" || env.platform === "desktop-chrome") {
        const inner = setTimeout(() => setVisible(true), 1800);
        return () => clearTimeout(inner);
      }
      // iOS/Firefox/in-app/desktop-other — 즉시 표시
      setVisible(true);
    }, 0);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    markBannerDismissed();
    setVisible(false);
  }

  async function install() {
    if (!deferred) {
      // No prompt available → 도움말 페이지로 이동
      window.location.href = "/app/help/install";
      return;
    }
    deferred.prompt();
    try {
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      }
    } catch {
      // ignore
    } finally {
      setDeferred(null);
    }
  }

  // 플랫폼별 메시지 + 액션 결정
  let titleText: string;
  let descText: string;
  let primaryLabel: string;
  let primaryAction: () => void;

  if (platform === "inapp") {
    titleText = `${inappName ?? "인앱"} 브라우저에서는 설치할 수 없어요`;
    descText = "Chrome/삼성 인터넷에서 열면 앱처럼 설치 가능";
    primaryLabel = "방법 보기";
    primaryAction = () => {
      window.location.href = "/app/help/install#inapp";
    };
  } else if (platform === "ios-safari") {
    titleText = "홈 화면에 추가하기";
    descText = "Safari 공유 버튼 → \"홈 화면에 추가\"";
    primaryLabel = "방법 보기";
    primaryAction = () => {
      window.location.href = "/app/help/install#ios";
    };
  } else if (platform === "android-pwa" || platform === "desktop-chrome") {
    titleText = "앱처럼 설치하기";
    descText = "홈 화면에 추가하면 더 빠르고 알림도 받을 수 있어요";
    if (deferred) {
      primaryLabel = "지금 설치";
      primaryAction = install;
    } else {
      primaryLabel = "방법 보기";
      primaryAction = () => {
        window.location.href = "/app/help/install";
      };
    }
  } else {
    titleText = "앱처럼 설치하기";
    descText = "홈 화면 / 작업표시줄에 추가하면 더 편리";
    primaryLabel = "방법 보기";
    primaryAction = () => {
      window.location.href = "/app/help/install";
    };
  }

  return (
    <div
      role="region"
      aria-label="앱 설치 안내"
      className="border-b border-primary/20 bg-primary/10 px-4 py-2.5"
    >
      <div className="max-w-3xl mx-auto flex items-center gap-3 text-sm">
        <Download
          className="h-4 w-4 text-primary flex-shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{titleText}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {descText}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0 items-center">
          <button
            type="button"
            onClick={primaryAction}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium inline-flex items-center gap-1"
          >
            {primaryLabel}
            {primaryLabel === "방법 보기" && (
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
          <Link
            href="/app/help/install"
            className="hidden sm:inline-flex text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            자세히
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="배너 닫기"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

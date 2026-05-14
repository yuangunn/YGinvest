// PWA 설치 가능 환경 감지 — 모든 platform 대응.

export type PwaPlatform =
  | "android-pwa" // Chrome/Edge/Samsung Internet on Android — beforeinstallprompt 지원
  | "android-firefox" // Firefox on Android — 수동 메뉴
  | "ios-safari" // iOS Safari (또는 Chrome iOS — 같은 WebKit) — 공유 메뉴 → 홈 화면에 추가
  | "inapp" // 카카오톡/네이버/인스타/라인/페이스북/X — PWA 설치 불가
  | "desktop-chrome" // Chrome/Edge desktop — beforeinstallprompt 지원
  | "desktop-other" // Firefox/Safari desktop — 수동 또는 미지원
  | "unknown";

export type Detected = {
  platform: PwaPlatform;
  inappName?: string;
  isStandalone: boolean;
};

const INAPP_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "카카오톡", re: /KAKAOTALK/i },
  { name: "네이버", re: /naver(?:\(inapp|app)/i },
  { name: "인스타그램", re: /Instagram/i },
  { name: "라인", re: /Line\//i },
  { name: "페이스북", re: /FB(?:AV|AN|IOS)/i },
  { name: "트위터/X", re: /Twitter(?:for|Android)/i },
];

export function detectPwaEnv(): Detected {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { platform: "unknown", isStandalone: false };
  }

  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;

  // 1) 인앱 브라우저 검출 (우선 — Chrome/Safari engine 사용해도 PWA 설치 차단됨)
  for (const p of INAPP_PATTERNS) {
    if (p.re.test(ua)) {
      return { platform: "inapp", inappName: p.name, isStandalone: standalone };
    }
  }

  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/i.test(ua);

  if (isIOS) {
    return { platform: "ios-safari", isStandalone: standalone };
  }

  if (isAndroid) {
    if (/Firefox|FxiOS/i.test(ua)) {
      return { platform: "android-firefox", isStandalone: standalone };
    }
    // Chrome / Edge / Samsung Internet 모두 beforeinstallprompt 지원
    return { platform: "android-pwa", isStandalone: standalone };
  }

  // Desktop
  if (/Chrome|Edg/i.test(ua) && !/OPR/i.test(ua)) {
    return { platform: "desktop-chrome", isStandalone: standalone };
  }
  return { platform: "desktop-other", isStandalone: standalone };
}

// beforeinstallprompt 이벤트 type
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "yg-install-banner-dismissed";
const DISMISS_DAYS = 14;

export function isBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = Number(v);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

export function markBannerDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore (private mode)
  }
}

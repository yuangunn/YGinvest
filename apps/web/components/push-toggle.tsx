"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getCurrentSubscription,
  isPushSupported,
  subscribeUser,
  unsubscribeUser,
} from "@/lib/push";

type State =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "ready"; subscribed: boolean };

export function PushToggle() {
  // 첫 렌더에 supported 여부 평가 (lazy init — useState 콜백은 1회만 실행)
  // "use client" 컴포넌트는 client에서만 mount되므로 window 안전.
  const [state, setState] = useState<State>(() =>
    isPushSupported() ? { kind: "checking" } : { kind: "unsupported" },
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.kind !== "checking") return;
    let cancelled = false;
    getCurrentSubscription()
      .then((sub) => {
        if (!cancelled) setState({ kind: "ready", subscribed: !!sub });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "ready", subscribed: false });
      });
    return () => {
      cancelled = true;
    };
  }, [state.kind]);

  if (state.kind === "unsupported") {
    return (
      <div className="text-sm text-muted-foreground">
        이 브라우저는 푸시 알림을 지원하지 않습니다. (iOS Safari는 홈 화면 추가 필요)
      </div>
    );
  }

  const subscribed = state.kind === "ready" ? state.subscribed : null;

  async function toggle() {
    setError(null);
    setLoading(true);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setError("VAPID public key 미설정");
        return;
      }
      if (subscribed) {
        await unsubscribeUser();
        setState({ kind: "ready", subscribed: false });
      } else {
        await subscribeUser(key);
        setState({ kind: "ready", subscribed: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={toggle} disabled={loading || subscribed === null}>
        {subscribed ? "푸시 알림 끄기" : "푸시 알림 켜기"}
      </Button>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="text-xs text-muted-foreground">
        상태: {subscribed === null ? "확인 중" : subscribed ? "구독됨" : "구독 없음"}
      </div>
    </div>
  );
}

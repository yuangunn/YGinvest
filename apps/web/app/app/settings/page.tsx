// Plan #45: 설정 — YG 디자인.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ChevronRight, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { PageHeader } from "@/components/yg/page-header";
import { PushToggle } from "@/components/push-toggle";
import { NotificationTypeToggle } from "@/components/notification-type-toggle";
import { LeaderboardOptIn } from "@/components/leaderboard/leaderboard-opt-in";

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
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader title="설정" sub="알림 · AI · 푸시" />

      <div
        style={{
          padding: "8px 20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* AI 키 BYOK */}
        <Link
          href="/app/settings/ai"
          className="yg-card yg-tap"
          style={{
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--yg-bg-tint-red)",
                color: "var(--yg-up-deep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                }}
              >
                AI 분석 키 (BYOK)
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                Claude / OpenAI / Gemini 본인 키 등록
              </div>
            </div>
          </div>
          <ChevronRight
            className="h-4 w-4"
            style={{ color: "var(--yg-fg-tertiary)" }}
          />
        </Link>

        {/* Plan #46: 글로벌 리더보드 참여 */}
        <div className="yg-card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Trophy
              className="h-4 w-4"
              style={{ color: "var(--yg-up-deep)" }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              글로벌 리더보드
            </h3>
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              margin: "0 0 14px",
              lineHeight: 1.5,
            }}
          >
            본명은 절대 공개되지 않아요. 닉네임 또는 익명으로 참여할 수 있어요.
          </p>
          <LeaderboardOptIn />
        </div>

        {/* 푸시 알림 */}
        <div className="yg-card" style={{ padding: 18 }}>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            푸시 알림
          </h3>
          <PushToggle />
        </div>

        {/* 알림 종류 */}
        <div className="yg-card" style={{ padding: 18 }}>
          <h3
            style={{
              margin: "0 0 4px",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            알림 종류
          </h3>
          <div>
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
          </div>
        </div>

        {/* 외부 링크 */}
        <Link
          href="/app/changelog"
          className="yg-card yg-tap"
          style={{
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>변경 기록</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              최근 업데이트 및 새 기능
            </div>
          </div>
          <ChevronRight
            className="h-4 w-4"
            style={{ color: "var(--yg-fg-tertiary)" }}
          />
        </Link>
        <Link
          href="/app/help"
          className="yg-card yg-tap"
          style={{
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>도움말 / FAQ</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              자주 묻는 질문 · 사용법
            </div>
          </div>
          <ChevronRight
            className="h-4 w-4"
            style={{ color: "var(--yg-fg-tertiary)" }}
          />
        </Link>
      </div>
    </div>
  );
}

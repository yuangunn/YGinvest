// Plan #41: YG Game CTA — 다크 그라데이션 카드, 동등한 무게.

import Link from "next/link";
import { PixelAvatar } from "@/components/game/pixel-avatar";

type Props = {
  hasCharacter: boolean;
  characterName?: string | null;
  gender?: string | null;
  jobType?: "unemployed" | "parttime" | "fulltime" | null;
  jobTitle?: string | null;
  educationLevel?: "highschool" | "bachelor" | null;
  currentDay?: number | null;
  progressPct?: number | null; // 0-100
};

export function YGGameCTA({
  hasCharacter,
  gender,
  jobType,
  jobTitle,
  educationLevel,
  currentDay,
  progressPct,
}: Props) {
  const pct = progressPct ?? 0;
  return (
    <Link
      href="/app/roguelike"
      className="yg-card yg-card-lg yg-tap"
      style={{
        padding: 20,
        display: "flex",
        gap: 16,
        background: "linear-gradient(150deg, #15171D 0%, #0F1115 65%)",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        textDecoration: "none",
      }}
    >
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center" }}>
        {hasCharacter ? (
          <PixelAvatar
            gender={gender ?? "other"}
            jobType={jobType ?? "unemployed"}
            jobTitle={jobTitle ?? null}
            educationLevel={educationLevel ?? "highschool"}
            size={68}
          />
        ) : (
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🧑
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              background: "rgba(255,255,255,0.12)",
              padding: "3px 7px",
              borderRadius: 5,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            BETA
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
            {hasCharacter ? `인생 시뮬 · D+${currentDay ?? 0}` : "인생 시뮬"}
          </span>
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
          }}
        >
          {hasCharacter
            ? "매도 타이밍, 게임으로 훈련해요"
            : "매도 타이밍을 게임으로 시작하기"}
        </div>
        {hasCharacter ? (
          <>
            <div
              style={{
                marginTop: 6,
                height: 6,
                borderRadius: 99,
                background: "rgba(255,255,255,0.14)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  background: "var(--yg-up)",
                  borderRadius: 99,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 2,
              }}
            >
              <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>
                환생 진행도
              </span>
              <span className="yg-num" style={{ fontSize: 11, fontWeight: 800 }}>
                {pct.toFixed(1)}% · 5% 목표
              </span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            지금 시작하기 →
          </div>
        )}
      </div>
    </Link>
  );
}

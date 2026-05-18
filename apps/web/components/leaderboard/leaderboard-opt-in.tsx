"use client";

// Plan #46: 글로벌 리더보드 opt-in UI (설정 페이지용).
//
// 3-tier 공개 모드:
// - hidden (default): 노출 안 함
// - anonymous: 등수 + 수익률만 (닉네임 "익명")
// - public: 닉네임 + 수익률 공개

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Visibility = "hidden" | "anonymous" | "public";

type Profile = {
  visibility: Visibility;
  nickname: string | null;
  opted_in_at: string | null;
  last_nickname_change_at: string | null;
};

export function LeaderboardOptIn() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");

  useEffect(() => {
    void fetch("/api/leaderboard/profile")
      .then((r) => r.json())
      .then((j: { profile: Profile }) => {
        setProfile(j.profile);
        setNicknameDraft(j.profile.nickname ?? "");
      })
      .catch(() => toast.error("프로필 로드 실패"))
      .finally(() => setLoading(false));
  }, []);

  async function save(nextVisibility: Visibility, nextNickname?: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/leaderboard/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: nextVisibility,
          nickname:
            nextNickname !== undefined
              ? nextNickname
              : profile?.nickname ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? `오류 (${res.status})`);
        return;
      }
      setProfile(data.profile);
      setNicknameDraft(data.profile.nickname ?? "");
      const labels: Record<Visibility, string> = {
        hidden: "리더보드 비공개로 설정했어요",
        anonymous: "익명으로 리더보드에 참여해요",
        public: `'${data.profile.nickname}' 닉네임으로 참여해요`,
      };
      toast.success(labels[nextVisibility]);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          fontSize: 13,
          color: "var(--yg-fg-tertiary)",
          fontWeight: 600,
          padding: 8,
        }}
      >
        로딩…
      </div>
    );
  }
  if (!profile) return null;

  const v = profile.visibility;

  return (
    <div>
      {/* 3개 모드 카드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <ModeCard
          active={v === "hidden"}
          icon="🔒"
          label="비공개"
          desc="기본값"
          onClick={() => void save("hidden")}
          disabled={saving}
        />
        <ModeCard
          active={v === "anonymous"}
          icon="👤"
          label="익명"
          desc="등수만"
          onClick={() => void save("anonymous")}
          disabled={saving}
        />
        <ModeCard
          active={v === "public"}
          icon="✨"
          label="닉네임"
          desc="공개"
          onClick={() => {
            if (!profile.nickname) {
              // 닉네임 없으면 폼에 포커스 — 자동 save 하지 않음
              const el = document.getElementById("yg-nickname-input");
              if (el) (el as HTMLInputElement).focus();
              toast.info("닉네임을 입력하고 저장 버튼을 눌러주세요");
              return;
            }
            void save("public");
          }}
          disabled={saving}
        />
      </div>

      {/* 모드별 안내 */}
      {v === "hidden" && (
        <div
          style={{
            fontSize: 12,
            color: "var(--yg-fg-tertiary)",
            fontWeight: 600,
            padding: "8px 10px",
            background: "var(--yg-bg-sub)",
            borderRadius: 10,
            lineHeight: 1.5,
          }}
        >
          🔒 리더보드에 나타나지 않아요. 본인 등수도 볼 수 없어요.
        </div>
      )}
      {v === "anonymous" && (
        <div
          style={{
            fontSize: 12,
            color: "var(--yg-fg-secondary)",
            fontWeight: 600,
            padding: "8px 10px",
            background: "var(--yg-bg-tint-ink)",
            borderRadius: 10,
            lineHeight: 1.5,
          }}
        >
          👤 닉네임 없이 &quot;익명&quot;으로 등수와 수익률만 공개돼요.
        </div>
      )}
      {v === "public" && (
        <div
          style={{
            fontSize: 12,
            color: "var(--yg-up-deep)",
            fontWeight: 700,
            padding: "8px 10px",
            background: "var(--yg-bg-tint-red)",
            borderRadius: 10,
            lineHeight: 1.5,
          }}
        >
          ✨ 닉네임 <strong>{profile.nickname}</strong>(으)로 공개돼요.
        </div>
      )}

      {/* 닉네임 입력 (anonymous/public 일 때 노출 — 미리 등록 가능) */}
      {v !== "hidden" && (
        <div style={{ marginTop: 12 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--yg-fg-tertiary)",
              display: "block",
              marginBottom: 6,
            }}
          >
            닉네임 (2~20자, 한글/영문/숫자/_)
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              id="yg-nickname-input"
              type="text"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder="투자고수123"
              maxLength={20}
              disabled={saving}
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 700,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--yg-line-strong)",
                background: "var(--yg-bg-card)",
                color: "var(--yg-fg-primary)",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => {
                const t = nicknameDraft.trim();
                if (!t) {
                  toast.error("닉네임을 입력해주세요");
                  return;
                }
                // public 으로 저장 (anonymous에서 입력만 미리 해놓고 public 전환 가능)
                void save("public", t);
              }}
              disabled={saving || !nicknameDraft.trim()}
              className="yg-btn"
              style={{
                height: 42,
                fontSize: 13,
                padding: "0 16px",
                background: nicknameDraft.trim()
                  ? "var(--yg-brand)"
                  : "var(--yg-bg-tint-ink)",
                color: nicknameDraft.trim()
                  ? "var(--yg-fg-on-brand)"
                  : "var(--yg-fg-tertiary)",
                cursor: nicknameDraft.trim() ? "pointer" : "not-allowed",
              }}
            >
              저장
            </button>
          </div>
          {profile.last_nickname_change_at && (
            <div
              style={{
                fontSize: 10,
                color: "var(--yg-fg-tertiary)",
                marginTop: 6,
                fontWeight: 600,
              }}
            >
              ⓘ 닉네임은 30일에 한 번만 변경 가능해요
            </div>
          )}
        </div>
      )}

      {/* Plan #47.8: 자격 조건 안내 (항상 표시) */}
      <div
        style={{
          marginTop: 14,
          padding: "12px 14px",
          background: "var(--yg-bg-sub)",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--yg-fg-tertiary)",
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}
        >
          📋 리더보드 등재 조건
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 12,
            color: "var(--yg-fg-secondary)",
            fontWeight: 600,
            lineHeight: 1.7,
          }}
        >
          <li>
            <strong>거래 5건 이상</strong> (매수/매도 합산)
          </li>
          <li>
            <strong>종합 / 꾸준함</strong> 카테고리: 가입 30일 이상
          </li>
          <li>
            <strong>이번 달</strong> 카테고리: 가입 기간 제한 없음
          </li>
          <li>
            매일 새벽 04:00 KST 갱신 (자격 충족 즉시 X)
          </li>
        </ul>
      </div>

      {/* Plan #47.8: 리더보드 보기 CTA — opt-in 했을 때만 */}
      {v !== "hidden" && (
        <Link
          href="/app/leaderboard"
          className="yg-btn"
          style={{
            display: "flex",
            width: "100%",
            marginTop: 10,
            height: 44,
            background: "var(--yg-bg-tint-ink)",
            color: "var(--yg-fg-primary)",
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
          }}
        >
          🏆 리더보드 보러 가기 →
        </Link>
      )}
    </div>
  );
}

function ModeCard({
  active,
  icon,
  label,
  desc,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: string;
  label: string;
  desc: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="yg-tap"
      style={{
        all: "unset",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "12px 8px",
        borderRadius: 12,
        textAlign: "center",
        background: active ? "var(--yg-brand)" : "var(--yg-bg-tint-ink)",
        color: active ? "var(--yg-fg-on-brand)" : "var(--yg-fg-primary)",
        border: active ? "none" : "1px solid var(--yg-line)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          marginTop: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          opacity: active ? 0.8 : 0.6,
          marginTop: 1,
        }}
      >
        {desc}
      </div>
    </button>
  );
}

// Plan #45: 친구방 — YG 디자인.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { PageHeader } from "@/components/yg/page-header";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기 중",
  active: "진행 중",
  ended: "종료",
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: {
    bg: "var(--yg-bg-tint-ink)",
    fg: "var(--yg-fg-secondary)",
  },
  active: {
    bg: "var(--yg-bg-tint-red)",
    fg: "var(--yg-up-deep)",
  },
  ended: {
    bg: "var(--yg-bg-tint-blue)",
    fg: "var(--yg-down-deep)",
  },
};

export default async function RoomsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, host_id, status, starts_at, ends_at, max_members")
    .order("created_at", { ascending: false });

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="친구방"
        sub={`${rooms?.length ?? 0}개 방 참여 중`}
        right={
          <div style={{ display: "flex", gap: 6 }}>
            <Link
              href="/app/rooms/join"
              className="yg-chip"
              style={{
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              가입
            </Link>
            <Link
              href="/app/rooms/new"
              className="yg-chip yg-chip-brand"
              style={{
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              + 방 만들기
            </Link>
          </div>
        }
      />

      <div style={{ padding: "8px 20px 0" }}>
        <div
          className="yg-card"
          style={{ padding: !rooms || rooms.length === 0 ? 36 : 18 }}
        >
          {!rooms || rooms.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>
                👥
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--yg-fg-secondary)",
                  marginBottom: 6,
                }}
              >
                아직 참여 중인 방이 없어요
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                초대 코드를 받았거나 새 방을 만들어보세요
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/app/rooms/join"
                  className="yg-chip"
                  style={{
                    background: "var(--yg-bg-tint-ink)",
                    color: "var(--yg-fg-secondary)",
                    textDecoration: "none",
                    padding: "8px 14px",
                    fontSize: 12,
                  }}
                >
                  초대 코드 입력
                </Link>
                <Link
                  href="/app/rooms/new"
                  className="yg-chip"
                  style={{
                    background: "var(--yg-brand)",
                    color: "var(--yg-fg-on-brand)",
                    textDecoration: "none",
                    padding: "8px 14px",
                    fontSize: 12,
                  }}
                >
                  새 방 만들기
                </Link>
              </div>
            </div>
          ) : (
            rooms.map((r, i) => {
              const isLast = i === rooms.length - 1;
              const tone =
                STATUS_TONE[r.status as keyof typeof STATUS_TONE] ??
                STATUS_TONE.pending;
              return (
                <Link
                  key={r.id}
                  href={`/app/rooms/${r.id}`}
                  className="yg-tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 0",
                    borderBottom: isLast
                      ? 0
                      : "1px solid var(--yg-line-faint)",
                    textDecoration: "none",
                    color: "var(--yg-fg-primary)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: "var(--yg-bg-tint-ink)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    👥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {r.name}
                      {r.host_id === user.id && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 5px",
                            background: "var(--yg-brand)",
                            color: "var(--yg-fg-on-brand)",
                            borderRadius: 4,
                            letterSpacing: "0.04em",
                          }}
                        >
                          HOST
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--yg-fg-tertiary)",
                        fontWeight: 600,
                        marginTop: 2,
                      }}
                    >
                      {r.ends_at
                        ? `~${new Date(r.ends_at).toLocaleDateString("ko-KR")}`
                        : "무제한"}{" "}
                      · 최대 {r.max_members}명
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 99,
                      background: tone.bg,
                      color: tone.fg,
                    }}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

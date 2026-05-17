// Plan #46: 본인 leaderboard_profiles (opt-in / nickname).
//
// GET  : 현재 설정 반환
// PUT  : visibility + nickname 업데이트
// DELETE: row 삭제 (= visibility hidden 로 reset)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Visibility = "hidden" | "anonymous" | "public";
const VALID = new Set<Visibility>(["hidden", "anonymous", "public"]);

// 닉네임 변경 쿨다운: 30일 (실명 가까운 거 자주 바꾸는 트롤링 방지)
const NICKNAME_CHANGE_COOLDOWN_DAYS = 30;

const RESERVED = new Set([
  "익명",
  "admin",
  "anonymous",
  "yginvest",
  "관리자",
  "운영자",
  "system",
]);

const BLOCKED_PATTERNS = [/씨발/, /병신/, /개새/, /fuck/i, /shit/i, /asshole/i];

function validateNickname(nick: string): string | null {
  if (nick.length < 2 || nick.length > 20)
    return "닉네임은 2~20자여야 해요";
  if (!/^[A-Za-z0-9가-힣_]+$/.test(nick))
    return "한글/영문/숫자/_ 만 사용 가능";
  if (RESERVED.has(nick.toLowerCase())) return "사용할 수 없는 닉네임이에요";
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(nick)) return "비속어는 사용할 수 없어요";
  }
  return null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data } = await supabase
    .from("leaderboard_profiles")
    .select(
      "visibility, nickname, opted_in_at, last_nickname_change_at, created_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    profile: data ?? {
      visibility: "hidden" as Visibility,
      nickname: null,
      opted_in_at: null,
      last_nickname_change_at: null,
      created_at: null,
    },
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    visibility?: string;
    nickname?: string | null;
  } | null;
  if (!body)
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const visibility = body.visibility as Visibility | undefined;
  if (!visibility || !VALID.has(visibility))
    return NextResponse.json({ error: "invalid_visibility" }, { status: 400 });

  const nicknameRaw = body.nickname?.trim() ?? null;

  // public 모드는 닉네임 필수
  if (visibility === "public" && !nicknameRaw) {
    return NextResponse.json(
      { error: "nickname_required", message: "공개 모드는 닉네임이 필요해요" },
      { status: 400 },
    );
  }

  if (nicknameRaw) {
    const validation = validateNickname(nicknameRaw);
    if (validation) {
      return NextResponse.json(
        { error: "invalid_nickname", message: validation },
        { status: 400 },
      );
    }
  }

  // 기존 row 조회 — 닉네임 변경 쿨다운 체크
  const { data: existing } = await supabase
    .from("leaderboard_profiles")
    .select("nickname, last_nickname_change_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    existing &&
    nicknameRaw &&
    existing.nickname &&
    existing.nickname !== nicknameRaw &&
    existing.last_nickname_change_at
  ) {
    const lastChange = new Date(existing.last_nickname_change_at).getTime();
    const elapsedDays = (Date.now() - lastChange) / 86400000;
    if (elapsedDays < NICKNAME_CHANGE_COOLDOWN_DAYS) {
      const remaining = Math.ceil(
        NICKNAME_CHANGE_COOLDOWN_DAYS - elapsedDays,
      );
      return NextResponse.json(
        {
          error: "nickname_cooldown",
          message: `닉네임은 ${NICKNAME_CHANGE_COOLDOWN_DAYS}일에 한 번만 변경할 수 있어요 (${remaining}일 남음)`,
        },
        { status: 429 },
      );
    }
  }

  // upsert
  const { data, error } = await supabase
    .from("leaderboard_profiles")
    .upsert(
      {
        user_id: user.id,
        visibility,
        // visibility가 hidden이면 nickname은 그대로 유지 (다시 켤 때 재사용)
        // anonymous/public에서 nickname을 null로 두는 건 anonymous일 때만 허용
        nickname: visibility === "hidden" ? (existing?.nickname ?? null) : nicknameRaw,
      },
      { onConflict: "user_id" },
    )
    .select("visibility, nickname, opted_in_at, last_nickname_change_at")
    .single();

  if (error) {
    // unique violation = 닉네임 중복
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: "nickname_taken",
          message: "이미 사용 중인 닉네임이에요",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // soft reset: visibility hidden + nickname 유지 (재가입시 재사용 가능)
  const { error } = await supabase
    .from("leaderboard_profiles")
    .update({ visibility: "hidden" })
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

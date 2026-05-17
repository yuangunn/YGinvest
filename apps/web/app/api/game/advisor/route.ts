// Plan #40: AI 인생 어드바이저 — 게임 상태 + 매도 패턴 → Claude/AI 분석.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, type Provider } from "@/lib/ai-providers";
import { PLAY_MODES } from "@/lib/game/constants";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // AI 키 확인
  const { data: keys } = await supabase
    .from("user_ai_keys")
    .select("provider, model, api_key")
    .eq("user_id", user.id);
  if (!keys || keys.length === 0) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "설정 → AI 키 등록 후 사용 가능",
        setup_url: "/app/settings/ai",
      },
      { status: 400 },
    );
  }
  const selected = keys[0];

  // 게임 데이터 수집
  const [
    { data: character },
    { data: profile },
    { data: recentDiary },
    { data: rebirths },
  ] = await Promise.all([
    supabase.from("game_characters").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("game_points, game_rebirth_count, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("game_diary")
      .select("entry_type, emoji, summary, cash_delta, game_day")
      .eq("user_id", user.id)
      .order("game_day", { ascending: false })
      .limit(30),
    supabase
      .from("game_rebirths")
      .select("rebirth_number, return_pct, days_played, points_earned")
      .eq("user_id", user.id)
      .order("rebirth_number", { ascending: false })
      .limit(5),
  ]);

  if (!character) {
    return NextResponse.json({ error: "no_character" }, { status: 404 });
  }

  // 프롬프트 구성
  const mode = PLAY_MODES[character.play_mode as keyof typeof PLAY_MODES];
  const diaryText = (recentDiary ?? [])
    .reverse()
    .map((d) => `D+${d.game_day} ${d.emoji} ${d.summary}`)
    .join("\n");
  const rebirthText = (rebirths ?? [])
    .map(
      (r) =>
        `#${r.rebirth_number}: ${(Number(r.return_pct) * 100).toFixed(1)}% 수익, ${r.days_played}일, +${r.points_earned}pt`,
    )
    .join("\n");

  const prompt = `너는 모의투자 게임 인생 어드바이저야. 사용자의 게임 진행 데이터를 보고 짧고 직설적인 조언을 한국어로 줘.

## 현재 캐릭터
- 이름: ${character.name}
- 학력: ${character.education_level === "bachelor" ? "대졸" : "고졸"}
- 직업: ${character.job_type === "fulltime" ? `정규직 ${character.job_title ?? "사원"}` : character.job_type === "parttime" ? "알바" : "무직"}
- 현금: ${Number(character.cash).toLocaleString()}원
- 지력: ${character.intelligence}
- 결혼: ${character.is_married ? "기혼" : "미혼"}, 자녀 ${character.children_count}명
- 현재 게임 ${character.current_day}일차
- 시작 자본: ${Number(character.starting_cash).toLocaleString()}원
- 모드: ${mode.label} (${mode.description})

## 누적 환생 ${profile?.game_rebirth_count ?? 0}회 · 보유 포인트 ${profile?.game_points ?? 0}pt

## 최근 환생 기록
${rebirthText || "(아직 환생 없음)"}

## 최근 일기 (30개, 시간순)
${diaryText || "(일기 없음)"}

## 요청
다음을 평가하고 짧게 조언해줘:
1. **현재 모드가 적절한가?** (학습/수입/균형 중 다른 게 나을지)
2. **환생 페이스가 빠른가/느린가?** (목표는 5% 수익으로 매도)
3. **다음 우선순위는?** (학력 진보 / 정규직 / 결혼 / 부동산 / 환생 등)
4. **본 앱 매도 트레이닝 측면에서 한 마디**

답변은 4개 섹션, 각 1~2문장으로 간결하게. 마크다운 사용.`;

  const provider = selected.provider as Provider;
  const systemPrompt = "너는 모의투자 게임의 인생 어드바이저야. 한국어로 직설적이고 짧게 조언해.";
  let response;
  try {
    response = await callAI(
      provider,
      selected.api_key,
      selected.model,
      systemPrompt,
      prompt,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "ai_call_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    advice: response.text,
    provider,
    model: response.model,
  });
}

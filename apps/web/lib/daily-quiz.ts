// Plan #27 C5: 일일 퀴즈 시스템.
// 금융용어 사전(glossary.ts)을 기반으로 매일 1문제 생성.
// 결정성: 날짜 시드 기반이라 같은 날엔 모두 같은 문제.

import { GLOSSARY, type GlossaryEntry } from "@/lib/glossary";

export type Quiz = {
  date: string; // YYYY-MM-DD
  question: string;
  choices: { key: string; label: string }[];
  answer: string; // glossary key
};

// 간단한 mulberry32 PRNG (seed 기반 결정적 random)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(d: Date): number {
  // YYYYMMDD를 number로 사용 (KST 기준)
  const kst = new Date(d.getTime() + 9 * 3600_000);
  return (
    kst.getUTCFullYear() * 10000 +
    (kst.getUTCMonth() + 1) * 100 +
    kst.getUTCDate()
  );
}

function dateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 3600_000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

export function getTodayQuiz(now: Date = new Date()): Quiz {
  const seed = dateSeed(now);
  const rand = mulberry32(seed);
  const keys = Object.keys(GLOSSARY);
  // 정답 key 선택
  const answerIdx = Math.floor(rand() * keys.length);
  const answerKey = keys[answerIdx];
  const answer = GLOSSARY[answerKey];

  // 오답 후보 3개 (정답과 중복 없이)
  const distractors: string[] = [];
  while (distractors.length < 3) {
    const idx = Math.floor(rand() * keys.length);
    const k = keys[idx];
    if (k !== answerKey && !distractors.includes(k)) distractors.push(k);
  }

  // 선택지 섞기
  const choiceKeys = [answerKey, ...distractors];
  for (let i = choiceKeys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choiceKeys[i], choiceKeys[j]] = [choiceKeys[j], choiceKeys[i]];
  }

  // 질문 양식: "다음 설명에 해당하는 용어는?" + answer.short
  const question = `"${answer.short}" — 이 설명에 해당하는 용어는?`;

  return {
    date: dateString(now),
    question,
    choices: choiceKeys.map((k) => ({
      key: k,
      label: (GLOSSARY[k] as GlossaryEntry).term,
    })),
    answer: answerKey,
  };
}

const STATUS_KEY = "yg-quiz-history";
const STREAK_KEY = "yg-quiz-streak";

export type QuizHistoryEntry = {
  date: string;
  correct: boolean;
};

export function getQuizHistory(): QuizHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function recordQuizResult(date: string, correct: boolean) {
  if (typeof window === "undefined") return;
  try {
    const list = getQuizHistory();
    if (list.some((e) => e.date === date)) return; // 이미 응답
    list.push({ date, correct });
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(list.slice(-90)));
    // streak 업데이트
    if (correct) {
      const prev = Number(window.localStorage.getItem(STREAK_KEY) ?? "0");
      window.localStorage.setItem(STREAK_KEY, String(prev + 1));
    } else {
      window.localStorage.setItem(STREAK_KEY, "0");
    }
  } catch {
    // ignore
  }
}

export function getCurrentStreak(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(STREAK_KEY) ?? "0");
  } catch {
    return 0;
  }
}

export function getTodayAnswered(): QuizHistoryEntry | null {
  if (typeof window === "undefined") return null;
  const today = dateString(new Date());
  const list = getQuizHistory();
  return list.find((e) => e.date === today) ?? null;
}

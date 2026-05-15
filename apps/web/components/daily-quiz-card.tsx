"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Check, X, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTodayQuiz,
  getTodayAnswered,
  recordQuizResult,
  getCurrentStreak,
  type Quiz,
} from "@/lib/daily-quiz";
import { GLOSSARY } from "@/lib/glossary";

/**
 * Plan #27 C5: 대시보드에 표시되는 일일 퀴즈.
 * - 같은 날엔 모두 같은 문제
 * - 한 번 응답하면 다음 날까지 결과 표시
 * - localStorage에 streak (연속 정답일수) 기록
 */
export function DailyQuizCard() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState<{ correct: boolean } | null>(null);
  const [streak, setStreak] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = getTodayQuiz();
      setQuiz(q);
      const prev = getTodayAnswered();
      if (prev) setAnswered({ correct: prev.correct });
      setStreak(getCurrentStreak());
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function choose(key: string) {
    if (!quiz || answered) return;
    setSelected(key);
    const correct = key === quiz.answer;
    recordQuizResult(quiz.date, correct);
    setAnswered({ correct });
    setStreak(getCurrentStreak());
  }

  if (!ready || !quiz) return null;

  const answerEntry = GLOSSARY[quiz.answer];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            오늘의 금융 퀴즈
          </span>
          {streak > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
              <Flame className="h-3 w-3" />
              {streak}일 연속
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{quiz.question}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {quiz.choices.map((c) => {
            const isAnswer = c.key === quiz.answer;
            const isSelected = c.key === selected;
            let cls = "border hover:bg-accent";
            if (answered) {
              if (isAnswer) cls = "border-green-500 bg-green-500/10 text-green-600 dark:text-green-500";
              else if (isSelected) cls = "border-red-500 bg-red-500/10 text-red-600 dark:text-red-500";
              else cls = "border opacity-50";
            }
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => choose(c.key)}
                disabled={!!answered}
                className={`text-left rounded-md px-2.5 py-2 text-xs ${cls} disabled:cursor-default flex items-center gap-2`}
              >
                {answered && isAnswer && <Check className="h-3 w-3 flex-shrink-0" />}
                {answered && isSelected && !isAnswer && <X className="h-3 w-3 flex-shrink-0" />}
                <span className="flex-1 truncate">{c.label}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="text-xs text-muted-foreground pt-1 border-t mt-2 space-y-1">
            <p>
              {answered.correct ? (
                <span className="text-green-600 dark:text-green-500 font-medium">
                  ✓ 정답!
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-500 font-medium">
                  ✗ 정답: {answerEntry?.term}
                </span>
              )}
            </p>
            {answerEntry && (
              <p className="text-[11px] leading-relaxed line-clamp-3">
                {answerEntry.detail.split("\n")[0]}
              </p>
            )}
            <Link
              href="/app/learn/glossary"
              className="inline-block text-[10px] text-primary hover:underline"
            >
              전체 용어사전 보기 →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

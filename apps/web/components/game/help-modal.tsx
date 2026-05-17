"use client";

// Plan #40: 게임 헬프 — 메커니즘 1페이지 설명.

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export function HelpModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        title="게임 메커니즘 도움말"
      >
        <HelpCircle className="h-2.5 w-2.5" />
        도움말
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">🎮 게임 가이드</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs space-y-2.5">
              <div>
                <div className="font-semibold mb-0.5">⏰ 시간</div>
                실제 1시간 = 게임 1일. 들어와있지 않아도 진행됩니다.
                다음 진입 시 밀린 일기 일괄 작성.
              </div>

              <div>
                <div className="font-semibold mb-0.5">🎯 모드 (시간 할당)</div>
                매일 시간을 어떻게 쓸지 비율로 결정:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>📚 학습 30/공부 70: 지력 빠름, 수입 적음</li>
                  <li>⚖️ 균형 50/50: 안정</li>
                  <li>💰 수입 100/0: 빠른 환생, 학력 X</li>
                </ul>
              </div>

              <div>
                <div className="font-semibold mb-0.5">🎓 자동 진행</div>
                지력 200 → 검정고시, 600 → 대학, 1500 → 사무직 자동.
                정규직 180일마다 자동 승진.
              </div>

              <div>
                <div className="font-semibold mb-0.5">🌅 환생</div>
                총자산이 시작의 +5%면 환생 가능. 빠를수록 포인트 ↑.
                포인트로 영구 업그레이드 구매.
              </div>

              <div>
                <div className="font-semibold mb-0.5">📊 주식</div>
                본 앱 종목 시세 그대로 사용. 게임 잔고는 분리 (사행성 X).
                <strong> 매도가 핵심</strong> — 게임으로 매도 타이밍 연습.
              </div>

              <div>
                <div className="font-semibold mb-0.5">🏆 업적/미션</div>
                30+개 업적 + 매일 3개 미션. 자동 추적, 포인트 보상.
              </div>

              <div>
                <div className="font-semibold mb-0.5">🏡 인생 단계</div>
                결혼 (지력 300+ 자산 3천만+) → 자녀 (60일 후) → 은퇴 연금.
                자녀는 매일 양육비 +5천원.
              </div>

              <div className="pt-2 border-t text-[10px] text-muted-foreground">
                💡 핵심: 게임에서 매도 감각 익히고 본 앱에서도 같은 타이밍 잡기.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

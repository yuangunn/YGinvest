import { describe, it, expect } from "vitest";
import {
  calculateRebirthPoints,
  canMarry,
  modeIncomeEstimate,
  PARTTIME_DAILY_WAGE,
} from "./constants";

describe("calculateRebirthPoints", () => {
  it("수익률 포인트 + 빠른 클리어(≤100일) 보너스 20", () => {
    // floor(0.5 * 100 * 10) = 500, +20
    expect(calculateRebirthPoints(0.5, 50)).toBe(520);
  });
  it("≤200일이면 보너스 10", () => {
    expect(calculateRebirthPoints(1.0, 150)).toBe(1010);
  });
  it("200일 초과면 보너스 없음", () => {
    expect(calculateRebirthPoints(0.1, 300)).toBe(100);
  });
});

describe("canMarry", () => {
  it("지력·현금 충족 + 미혼이면 가능", () => {
    expect(canMarry(300, 30_000_000, false)).toBe(true);
  });
  it("지력 부족이면 불가", () => {
    expect(canMarry(299, 30_000_000, false)).toBe(false);
  });
  it("현금 부족이면 불가", () => {
    expect(canMarry(300, 29_999_999, false)).toBe(false);
  });
  it("이미 기혼이면 불가", () => {
    expect(canMarry(300, 30_000_000, true)).toBe(false);
  });
});

describe("modeIncomeEstimate", () => {
  it("최저임금 일급 상수 검증", () => {
    expect(PARTTIME_DAILY_WAGE).toBe(82_400);
  });

  it("수입 중심 모드: 알바 풀타임, 공부 0", () => {
    const est = modeIncomeEstimate("income", {});
    expect(est.parttimeDaily).toBe(82_400);
    expect(est.dailyIntelligence).toBe(0);
    expect(est.weeklyParttime).toBe(82_400 * 7);
  });

  it("학습 중심 모드: 일 30% / 공부 70%", () => {
    const est = modeIncomeEstimate("learning", {});
    expect(est.parttimeDaily).toBe(Math.floor(82_400 * 0.3));
    expect(est.dailyIntelligence).toBe(4); // round(5 * 0.7)
  });

  it("알바 보너스 unlock 적용", () => {
    const est = modeIncomeEstimate("income", { parttime_bonus: 2 });
    // 1 + 2*0.1 = 1.2배
    expect(est.parttimeDaily).toBe(Math.floor(82_400 * 1.2));
  });
});

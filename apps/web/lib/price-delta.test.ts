import { describe, it, expect } from "vitest";
import { previousClose, priceDelta } from "./price-delta";

describe("previousClose", () => {
  it("마지막 봉이 오늘(현재가와 동일)이면 직전 봉을 전일 종가로", () => {
    const bars = [{ close: 100 }, { close: 105 }, { close: 110 }];
    expect(previousClose(bars, 110)).toBe(105);
  });

  it("마지막 봉이 현재가와 다르면 마지막 봉이 전일 종가", () => {
    const bars = [{ close: 100 }, { close: 105 }];
    expect(previousClose(bars, 108)).toBe(105);
  });

  it("봉이 1개뿐이고 그게 오늘이면 null", () => {
    expect(previousClose([{ close: 110 }], 110)).toBeNull();
  });

  it("봉이 없으면 null", () => {
    expect(previousClose([], 110)).toBeNull();
  });

  it("현재가 없으면 null", () => {
    expect(previousClose([{ close: 100 }], null)).toBeNull();
  });

  it("close가 문자열이어도 숫자로 처리", () => {
    expect(previousClose([{ close: "100" }, { close: "105" }], 108)).toBe(105);
  });
});

describe("priceDelta", () => {
  it("상승: 양수 abs/pct", () => {
    const d = priceDelta(110, 100);
    expect(d).toEqual({ abs: 10, pct: 10 });
  });

  it("하락: 음수 abs/pct", () => {
    const d = priceDelta(95, 100);
    expect(d?.abs).toBe(-5);
    expect(d?.pct).toBeCloseTo(-5);
  });

  it("전일 종가 0이면 null (0 나눗셈 방지)", () => {
    expect(priceDelta(100, 0)).toBeNull();
  });

  it("값 없으면 null", () => {
    expect(priceDelta(null, 100)).toBeNull();
    expect(priceDelta(100, null)).toBeNull();
  });
});

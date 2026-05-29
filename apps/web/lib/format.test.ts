import { describe, it, expect } from "vitest";
import { formatMarketCap, formatVolume } from "./format";

describe("formatMarketCap", () => {
  it("KRW: 조 단위", () => {
    expect(formatMarketCap(2e12, "KRW")).toBe("2.0조원");
  });
  it("KRW: 억 단위", () => {
    expect(formatMarketCap(5e8, "KRW")).toBe("5억원");
  });
  it("USD: T 단위", () => {
    expect(formatMarketCap(3e12, "USD")).toBe("$3.00T");
  });
  it("USD: B 단위", () => {
    expect(formatMarketCap(2.5e9, "USD")).toBe("$2.50B");
  });
  it("USD: M 단위", () => {
    expect(formatMarketCap(4e6, "USD")).toBe("$4.0M");
  });
});

describe("formatVolume", () => {
  it("10억 이상은 B", () => {
    expect(formatVolume(1.5e9)).toBe("1.5B");
  });
  it("100만 이상은 M", () => {
    expect(formatVolume(2e6)).toBe("2.0M");
  });
  it("1천 이상은 K", () => {
    expect(formatVolume(3500)).toBe("3.5K");
  });
  it("1천 미만은 그대로", () => {
    expect(formatVolume(500)).toBe("500");
  });
});

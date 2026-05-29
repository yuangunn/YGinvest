import { describe, it, expect } from "vitest";
import { sensitivityForSector, SECTOR_SENSITIVITY } from "./macro-sensitivity";

describe("sensitivityForSector", () => {
  it("null이면 general 기본값", () => {
    expect(sensitivityForSector(null)).toBe(SECTOR_SENSITIVITY.general);
  });

  it("한글 '반도체' → semiconductors", () => {
    expect(sensitivityForSector("반도체")).toBe(SECTOR_SENSITIVITY.semiconductors);
  });

  it("영문 'Semiconductor' (대소문자 무관) → semiconductors", () => {
    expect(sensitivityForSector("Semiconductor")).toBe(
      SECTOR_SENSITIVITY.semiconductors,
    );
  });

  it("'은행' → banks (financial보다 우선 매칭)", () => {
    expect(sensitivityForSector("은행")).toBe(SECTOR_SENSITIVITY.banks);
  });

  it("'Energy' → energy", () => {
    expect(sensitivityForSector("Energy")).toBe(SECTOR_SENSITIVITY.energy);
  });

  it("매칭 안 되는 섹터 → general", () => {
    expect(sensitivityForSector("뜬금없는섹터")).toBe(SECTOR_SENSITIVITY.general);
  });
});

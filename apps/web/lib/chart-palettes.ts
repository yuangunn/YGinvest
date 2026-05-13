/**
 * Chart color palettes (Plan #13).
 *
 * 4가지 프리셋:
 * - classic: 서양식 (green up / red down) — 글로벌 기본
 * - korean: 한국식 (red up / blue down) — KOSPI/KOSDAQ 관행
 * - mono: 미니멀 흑백 — 강조 없는 차분한 차트
 * - colorblind: blue up / orange down (deuteranopia/protanopia safe)
 *
 * Palette는 localStorage `yginvest:chart-palette`에 저장 (theme 토글과 분리).
 */

export type PaletteId = "classic" | "korean" | "mono" | "colorblind";

export type ChartPalette = {
  id: PaletteId;
  name: string;
  up: string; // candle up + wick up
  down: string; // candle down + wick down
  ma20: string;
  ma60: string;
  bbBand: string; // bollinger upper/lower
  bbMid: string; // bollinger middle (=MA20 in calc)
};

export const PALETTES: Record<PaletteId, ChartPalette> = {
  classic: {
    id: "classic",
    name: "Classic (글로벌)",
    up: "#26a69a",
    down: "#ef5350",
    ma20: "#f59e0b",
    ma60: "#a78bfa",
    bbBand: "#fbbf24",
    bbMid: "#a78bfa",
  },
  korean: {
    id: "korean",
    name: "Korean (한국)",
    up: "#dc2626", // red = 상승
    down: "#2563eb", // blue = 하락
    ma20: "#f59e0b",
    ma60: "#a78bfa",
    bbBand: "#fbbf24",
    bbMid: "#a78bfa",
  },
  mono: {
    id: "mono",
    name: "Mono (미니멀)",
    up: "#e5e5e5",
    down: "#737373",
    ma20: "#a3a3a3",
    ma60: "#525252",
    bbBand: "#737373",
    bbMid: "#a3a3a3",
  },
  colorblind: {
    id: "colorblind",
    name: "Colorblind (색약)",
    up: "#0ea5e9", // blue = up (deuteranopia-safe)
    down: "#f97316", // orange = down
    ma20: "#eab308",
    ma60: "#a78bfa",
    bbBand: "#eab308",
    bbMid: "#a78bfa",
  },
};

export const DEFAULT_PALETTE_ID: PaletteId = "classic";

const STORAGE_KEY = "yginvest:chart-palette";

export function loadPaletteId(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE_ID;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored in PALETTES) return stored as PaletteId;
  } catch {
    // SSR or localStorage 막힌 환경
  }
  return DEFAULT_PALETTE_ID;
}

export function savePaletteId(id: PaletteId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

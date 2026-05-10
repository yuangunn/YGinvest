// KR/US 장 운영 시간 판정. spec §6.3 기준.
// 휴장일 정확도는 워커의 pandas-market-calendars가 더 정확하지만
// 클라이언트/서버 즉시 판정이 필요해 간단한 요일 기반 체크.

export type MarketEnum = "KRX_KS" | "KRX_KQ" | "NASDAQ" | "NYSE";

const KR_OPEN_HOUR = 9;
const KR_CLOSE_HOUR = 15;
const KR_CLOSE_MIN = 30;

export function isKrOpenAt(date: Date): boolean {
  // KST = UTC+9
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return false;
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  if (h < KR_OPEN_HOUR) return false;
  if (h > KR_CLOSE_HOUR) return false;
  if (h === KR_CLOSE_HOUR && m > KR_CLOSE_MIN) return false;
  return true;
}

export function isUsOpenAt(date: Date): boolean {
  // US ET = UTC-5(표준시) 또는 UTC-4(서머타임). 정확도 위해 Intl.DateTimeFormat 사용.
  const tz = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = tz.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  if (weekday === "Sat" || weekday === "Sun") return false;
  // 09:30 ≤ time < 16:00
  const total = hour * 60 + minute;
  return total >= 9 * 60 + 30 && total < 16 * 60;
}

export function isMarketOpenForSymbol(market: MarketEnum, when: Date = new Date()): boolean {
  if (market === "KRX_KS" || market === "KRX_KQ") return isKrOpenAt(when);
  if (market === "NASDAQ" || market === "NYSE") return isUsOpenAt(when);
  return false;
}

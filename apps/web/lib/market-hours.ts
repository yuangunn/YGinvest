// KR/US 장 운영 시간 판정. spec §6.3 + Plan #7.5 NXT 확장.
// 휴장일 정확도는 워커의 pandas-market-calendars가 더 정확하지만
// 클라이언트/서버 즉시 판정이 필요해 간단한 요일 기반 체크.
// KR 공휴일 정확도는 워커가 가격 갱신 차단으로 보완 (price_stale 가드).

export type MarketEnum = "KRX_KS" | "KRX_KQ" | "NASDAQ" | "NYSE";
export type KrSession = "pre" | "regular" | "after" | "closed";

function _kstParts(date: Date): { day: number; minutes: number } {
  // KST = UTC+9. getUTC*는 사용자 로컬 TZ 무관하게 UTC 기준이므로
  // (utc + 9h)의 UTC 메소드로 KST 시각 추출.
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    day: kst.getUTCDay(), // 0=Sun, 6=Sat
    minutes: kst.getUTCHours() * 60 + kst.getUTCMinutes(),
  };
}

export function getKrSession(date: Date = new Date()): KrSession {
  const { day, minutes } = _kstParts(date);
  if (day === 0 || day === 6) return "closed";
  // half-open intervals — end excluded (08:50, 15:20, 20:00 → closed)
  if (minutes >= 8 * 60 && minutes < 8 * 60 + 50) return "pre";
  if (minutes >= 9 * 60 && minutes < 15 * 60 + 20) return "regular";
  if (minutes >= 15 * 60 + 30 && minutes < 20 * 60) return "after";
  return "closed";
}

export function isKrOpenAt(date: Date): boolean {
  return getKrSession(date) !== "closed";
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

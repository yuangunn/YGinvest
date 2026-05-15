// Plan #27 B2: 클라이언트 사이드 마켓 상태 계산.
// KR: 평일 09:00-15:30 KST (점심시간 없음, 단일세션)
// US: 평일 23:30-06:00 KST (EST 09:30-16:00, DST 시 KST 22:30-05:00)
//
// 정확한 휴장일(설날·추수감사절 등)은 반영하지 않음. 학습 시뮬레이션 용도라 충분.

export type MarketStatus = {
  market: "KR" | "US";
  state: "pre" | "open" | "after" | "closed_weekend";
  /** 현재 상태가 끝나기까지 남은 분 */
  minutesUntilNext: number;
  /** 다음 상태 (open/closed) */
  nextLabel: string;
  /** 사람이 읽기 좋은 메시지 */
  message: string;
};

function getKstParts(now: Date) {
  // KST = UTC+9. Date.UTC를 통해 KST 시각 컴포넌트 추출
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  return {
    dow: d.getUTCDay(), // 0=Sun ... 6=Sat
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function getUsParts(now: Date) {
  // America/New_York 기준 (EST/EDT 자동)
  const ny = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => ny.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const hour = parseInt(get("hour") || "0", 10);
  const minute = parseInt(get("minute") || "0", 10);
  return {
    dow: weekdayMap[get("weekday")] ?? 0,
    hour: hour === 24 ? 0 : hour, // en-US 24h는 가끔 24를 반환
    minute,
    minutesOfDay: (hour === 24 ? 0 : hour) * 60 + minute,
  };
}

const KR_OPEN = 9 * 60; // 540
const KR_CLOSE = 15 * 60 + 30; // 930
const US_OPEN = 9 * 60 + 30; // 570
const US_CLOSE = 16 * 60; // 960

function fmtMinutes(m: number): string {
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}

export function getKrMarketStatus(now: Date = new Date()): MarketStatus {
  const { dow, minutesOfDay } = getKstParts(now);
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend) {
    return {
      market: "KR",
      state: "closed_weekend",
      minutesUntilNext: 0,
      nextLabel: "월요일 개장",
      message: "주말 휴장",
    };
  }
  if (minutesOfDay < KR_OPEN) {
    const mins = KR_OPEN - minutesOfDay;
    return {
      market: "KR",
      state: "pre",
      minutesUntilNext: mins,
      nextLabel: "장 시작",
      message: `장 시작까지 ${fmtMinutes(mins)}`,
    };
  }
  if (minutesOfDay < KR_CLOSE) {
    const mins = KR_CLOSE - minutesOfDay;
    return {
      market: "KR",
      state: "open",
      minutesUntilNext: mins,
      nextLabel: "장 마감",
      message: `장중 (마감 ${fmtMinutes(mins)} 전)`,
    };
  }
  return {
    market: "KR",
    state: "after",
    minutesUntilNext: 0,
    nextLabel: "다음 영업일 개장",
    message: "장 마감",
  };
}

export function getUsMarketStatus(now: Date = new Date()): MarketStatus {
  const { dow, minutesOfDay } = getUsParts(now);
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend) {
    return {
      market: "US",
      state: "closed_weekend",
      minutesUntilNext: 0,
      nextLabel: "월요일 개장",
      message: "주말 휴장",
    };
  }
  if (minutesOfDay < US_OPEN) {
    const mins = US_OPEN - minutesOfDay;
    return {
      market: "US",
      state: "pre",
      minutesUntilNext: mins,
      nextLabel: "장 시작",
      message: `장 시작까지 ${fmtMinutes(mins)}`,
    };
  }
  if (minutesOfDay < US_CLOSE) {
    const mins = US_CLOSE - minutesOfDay;
    return {
      market: "US",
      state: "open",
      minutesUntilNext: mins,
      nextLabel: "장 마감",
      message: `장중 (마감 ${fmtMinutes(mins)} 전)`,
    };
  }
  return {
    market: "US",
    state: "after",
    minutesUntilNext: 0,
    nextLabel: "다음 영업일 개장",
    message: "장 마감",
  };
}

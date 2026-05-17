// Plan #37: 픽셀 도트 아바타 — 직업/모드에 따라 다른 외형.
// 16×16 grid SVG. 픽셀 데이터를 array로 만들고 한 번에 map.

type Props = {
  gender: string;
  jobType: "unemployed" | "parttime" | "fulltime";
  jobTitle: string | null;
  educationLevel: "highschool" | "bachelor";
  size?: number;
};

type Pixel = { x: number; y: number; color: string };

const JOB_COLORS: Record<string, { shirt: string; accent: string }> = {
  unemployed: { shirt: "#9ca3af", accent: "#6b7280" },
  parttime: { shirt: "#f59e0b", accent: "#d97706" },
  fulltime_사원: { shirt: "#3b82f6", accent: "#2563eb" },
  fulltime_대리: { shirt: "#2563eb", accent: "#1d4ed8" },
  fulltime_과장: { shirt: "#7c3aed", accent: "#6d28d9" },
  fulltime_차장: { shirt: "#a855f7", accent: "#9333ea" },
  fulltime_부장: { shirt: "#dc2626", accent: "#b91c1c" },
};

function getColors(jobType: string, jobTitle: string | null) {
  if (jobType === "fulltime" && jobTitle) {
    return JOB_COLORS[`fulltime_${jobTitle}`] ?? JOB_COLORS["fulltime_사원"];
  }
  return JOB_COLORS[jobType] ?? JOB_COLORS["unemployed"];
}

function buildPixels(
  gender: string,
  jobType: string,
  jobTitle: string | null,
  educationLevel: "highschool" | "bachelor",
): Pixel[] {
  const { shirt, accent } = getColors(jobType, jobTitle);
  const skin = "#fbbf77";
  const skinShade = "#e89b5a";
  const hair = gender === "female" ? "#7c2d12" : "#1f2937";
  const hairLight = gender === "female" ? "#9a3412" : "#374151";
  const isFemale = gender === "female";
  const isBachelor = educationLevel === "bachelor";

  const pixels: Pixel[] = [];

  // 머리카락 - 윗머리
  for (let x = 4; x <= 11; x++) pixels.push({ x, y: 2, color: hair });
  for (let x = 3; x <= 12; x++) pixels.push({ x, y: 3, color: hair });
  // 옆머리
  pixels.push({ x: 3, y: 4, color: hair }, { x: 12, y: 4, color: hair });
  pixels.push({ x: 3, y: 5, color: hairLight }, { x: 12, y: 5, color: hairLight });
  if (isFemale) {
    pixels.push(
      { x: 3, y: 6, color: hair }, { x: 12, y: 6, color: hair },
      { x: 3, y: 7, color: hair }, { x: 12, y: 7, color: hair },
      { x: 2, y: 8, color: hairLight }, { x: 13, y: 8, color: hairLight },
    );
  }

  // 학사모 (대졸)
  if (isBachelor) {
    for (let x = 4; x <= 11; x++) pixels.push({ x, y: 1, color: "#000" });
    pixels.push({ x: 3, y: 2, color: "#000" }, { x: 12, y: 2, color: "#000" });
    pixels.push({ x: 12, y: 1, color: "#fbbf24" }); // 술
  }

  // 얼굴
  for (let x = 5; x <= 10; x++) pixels.push({ x, y: 4, color: skin });
  for (let x = 4; x <= 11; x++) pixels.push({ x, y: 5, color: skin });
  for (let x = 4; x <= 11; x++) pixels.push({ x, y: 6, color: skin });
  for (let x = 4; x <= 11; x++) pixels.push({ x, y: 7, color: skin });
  for (let x = 5; x <= 9; x++) pixels.push({ x, y: 8, color: skin });
  pixels.push({ x: 10, y: 8, color: skinShade });

  // 눈
  pixels.push({ x: 6, y: 6, color: "#1f2937" });
  pixels.push({ x: 9, y: 6, color: "#1f2937" });

  // 입
  pixels.push({ x: 7, y: 8, color: skinShade });
  pixels.push({ x: 8, y: 8, color: skinShade });

  // 목
  pixels.push({ x: 7, y: 9, color: skinShade });
  pixels.push({ x: 8, y: 9, color: skinShade });

  // 옷 (어깨~몸통)
  for (let x = 4; x <= 11; x++) pixels.push({ x, y: 10, color: shirt });
  for (let x = 3; x <= 12; x++) {
    const c = x === 6 || x === 7 || x === 8 || x === 9 ? accent : shirt;
    pixels.push({ x, y: 11, color: c });
  }
  for (let x = 3; x <= 12; x++) {
    const c = x === 7 || x === 8 ? accent : shirt;
    pixels.push({ x, y: 12, color: c });
  }
  for (let x = 3; x <= 12; x++) {
    const c = x === 3 || x === 12 ? accent : shirt;
    pixels.push({ x, y: 13, color: c });
  }

  // 직급 명찰 (정규직만)
  if (jobType === "fulltime") {
    pixels.push({ x: 9, y: 12, color: "#fcd34d" });
    pixels.push({ x: 10, y: 12, color: "#fcd34d" });
  }

  // 바지
  for (let x = 4; x <= 11; x++) pixels.push({ x, y: 14, color: "#1e293b" });
  for (const x of [4, 5, 6, 9, 10, 11]) pixels.push({ x, y: 15, color: "#0f172a" });

  return pixels;
}

export function PixelAvatar({
  gender,
  jobType,
  jobTitle,
  educationLevel,
  size = 64,
}: Props) {
  const pixels = buildPixels(gender, jobType, jobTitle, educationLevel);
  const px = size / 16;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ imageRendering: "pixelated" }}
      shapeRendering="crispEdges"
    >
      {pixels.map((p, i) => (
        <rect
          key={i}
          x={p.x * px}
          y={p.y * px}
          width={px}
          height={px}
          fill={p.color}
        />
      ))}
    </svg>
  );
}

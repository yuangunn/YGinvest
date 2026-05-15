/**
 * Plan #27.4: 'YGI' 앱 아이콘 생성.
 *
 * - 테두리 없음, OS 곡률에 맡김 (maskable purpose 사용)
 * - 안전 영역(중앙 80%)에 'YGI' 텍스트 배치 → 원형 클립에도 잘림 X
 * - background: primary blue (#2563eb)
 * - SVG → PNG (sharp 사용)
 *
 * 출력 (apps/web/public/):
 *   icon-192.png      192x192   purpose=any
 *   icon-512.png      512x512   purpose=any
 *   icon-maskable-512.png  512x512  purpose=maskable (safe zone applied)
 *   apple-touch-icon.png   180x180
 *
 * 사용: `node scripts/generate-icons.mjs`
 */
import sharp from "sharp";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, "../public");

const PRIMARY = "#2563eb";
const PRIMARY_DARK = "#1d4ed8";

// "any" 아이콘: 텍스트가 가장자리에 가깝게 (시각적으로 크게)
function svgFull(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <text x="256" y="256"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-weight="900"
        font-size="220"
        letter-spacing="-8"
        fill="white">YGI</text>
</svg>`;
}

// maskable 아이콘: OS가 원/스쿼클 등으로 클립할 수 있어 안전영역에 텍스트.
// W3C 권고: 중앙 80% (= 양쪽 10% 패딩)만 안전.
// 실용적으로는 좀 더 보수적으로 65-70%만 사용.
function svgMaskable(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bgm)"/>
  <text x="256" y="256"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-weight="900"
        font-size="160"
        letter-spacing="-5"
        fill="white">YGI</text>
</svg>`;
}

async function render(svg, size, outFile) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9, palette: false })
    .toFile(resolve(PUBLIC, outFile));
  console.log(`  ✓ ${outFile} (${size}x${size})`);
}

async function main() {
  console.log("[icons] generating YGI icons...");
  await render(svgFull(192), 192, "icon-192.png");
  await render(svgFull(512), 512, "icon-512.png");
  await render(svgMaskable(512), 512, "icon-maskable-512.png");
  await render(svgFull(180), 180, "apple-touch-icon.png");
  // favicon용 32x32
  await render(svgFull(32), 32, "icon-32.png");
  console.log("[icons] done.");
}

main().catch((e) => {
  console.error("[icons] failed:", e);
  process.exit(1);
});

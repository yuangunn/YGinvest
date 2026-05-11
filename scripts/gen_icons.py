"""YGinvest 앱 아이콘 일괄 생성 (Pillow).

실행:
  cd apps/worker && uv run --with Pillow python ../../scripts/gen_icons.py

결과:
  apps/web/public/icon-192.png
  apps/web/public/icon-512.png
  apps/web/public/icon-maskable-512.png
  apps/web/public/apple-touch-icon.png (180×180)

단순한 brand glyph: 진한 파랑(#2563eb) 배경 + 둥근 흰색 카드 + "YG" 텍스트.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).resolve().parent.parent / "apps" / "web" / "public"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG = (37, 99, 235)  # #2563eb — Tailwind blue-600
FG = (255, 255, 255)


def _font(size: int) -> ImageFont.FreeTypeFont:
    # Pillow가 항상 번들하는 DejaVu (cross-platform)
    candidates = [
        "DejaVuSans-Bold.ttf",
        "arial.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _render(size: int, *, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # maskable은 안전영역 80% — padding 10%씩
    pad = int(size * 0.10) if maskable else int(size * 0.05)
    inner = size - 2 * pad

    # 둥근 흰색 카드
    radius = int(inner * 0.18)
    draw.rounded_rectangle(
        [(pad, pad), (pad + inner, pad + inner)],
        radius=radius,
        fill=FG,
    )

    # "YG" 텍스트
    text = "YG"
    font_size = int(inner * 0.5)
    font = _font(font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1]
    draw.text((tx, ty), text, fill=BG, font=font)
    return img


def main() -> None:
    _render(192).save(OUT_DIR / "icon-192.png")
    _render(512).save(OUT_DIR / "icon-512.png")
    _render(512, maskable=True).save(OUT_DIR / "icon-maskable-512.png")
    _render(180).save(OUT_DIR / "apple-touch-icon.png")
    print("Generated 4 icons in", OUT_DIR)


if __name__ == "__main__":
    main()

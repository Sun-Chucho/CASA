from __future__ import annotations

import csv
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from generate_barcode_labels import CSV_PATH, encode_code128


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "test-barcode-label.png"
TEST_BARCODE = "6200100260026"
DPI = 203
WIDTH_PX = 384  # ~48 mm printable width at 203 dpi
HEIGHT_PX = 240  # ~30 mm label height at 203 dpi
QUIET_ZONE = 16
BAR_TOP = 52
BAR_HEIGHT = 104


def pick_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def fetch_test_item() -> tuple[str, str]:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if (row.get("Barcode") or "").strip() == TEST_BARCODE:
                title = f"{(row.get('Item') or '').strip()} {(row.get('Size') or '').strip()}".strip()
                return title, TEST_BARCODE
    raise SystemExit(f"Barcode {TEST_BARCODE} not found")


def draw_centered(draw: ImageDraw.ImageDraw, text: str, y: int, font: ImageFont.ImageFont) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    x = max((WIDTH_PX - text_w) // 2, 0)
    draw.text((x, y), text, fill=0, font=font)


def draw_barcode(draw: ImageDraw.ImageDraw, barcode: str) -> None:
    pattern = encode_code128(barcode)
    available_width = WIDTH_PX - (QUIET_ZONE * 2)
    module_width = max(1, available_width // len(pattern))
    used_width = module_width * len(pattern)
    start_x = (WIDTH_PX - used_width) // 2

    x = start_x
    for bit in pattern:
        if bit == "1":
            draw.rectangle([x, BAR_TOP, x + module_width - 1, BAR_TOP + BAR_HEIGHT], fill=0)
        x += module_width


def main() -> None:
    title, barcode = fetch_test_item()
    image = Image.new("1", (WIDTH_PX, HEIGHT_PX), 1)
    draw = ImageDraw.Draw(image)

    name_font = pick_font(24, bold=True)
    number_font = pick_font(26, bold=True)

    draw_centered(draw, title, 10, name_font)
    draw_barcode(draw, barcode)
    draw_centered(draw, barcode, 175, number_font)

    image.save(OUTPUT_PATH, dpi=(DPI, DPI))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

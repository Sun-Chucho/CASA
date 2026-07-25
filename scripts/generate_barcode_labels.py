from __future__ import annotations

import csv
import html
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "barcodes-to-print.csv"
OUTPUT_PATH = ROOT / "print-ready-barcodes.html"


CODE128_PATTERNS = [
    "11011001100",
    "11001101100",
    "11001100110",
    "10010011000",
    "10010001100",
    "10001001100",
    "10011001000",
    "10011000100",
    "10001100100",
    "11001001000",
    "11001000100",
    "11000100100",
    "10110011100",
    "10011011100",
    "10011001110",
    "10111001100",
    "10011101100",
    "10011100110",
    "11001110010",
    "11001011100",
    "11001001110",
    "11011100100",
    "11001110100",
    "11101101110",
    "11101001100",
    "11100101100",
    "11100100110",
    "11101100100",
    "11100110100",
    "11100110010",
    "11011011000",
    "11011000110",
    "11000110110",
    "10100011000",
    "10001011000",
    "10001000110",
    "10110001000",
    "10001101000",
    "10001100010",
    "11010001000",
    "11000101000",
    "11000100010",
    "10110111000",
    "10110001110",
    "10001101110",
    "10111011000",
    "10111000110",
    "10001110110",
    "11101110110",
    "11010001110",
    "11000101110",
    "11011101000",
    "11011100010",
    "11011101110",
    "11101011000",
    "11101000110",
    "11100010110",
    "11101101000",
    "11101100010",
    "11100011010",
    "11101111010",
    "11001000010",
    "11110001010",
    "10100110000",
    "10100001100",
    "10010110000",
    "10010000110",
    "10000101100",
    "10000100110",
    "10110010000",
    "10110000100",
    "10011010000",
    "10011000010",
    "10000110100",
    "10000110010",
    "11000010010",
    "11001010000",
    "11110111010",
    "11000010100",
    "10001111010",
    "10100111100",
    "10010111100",
    "10010011110",
    "10111100100",
    "10011110100",
    "10011110010",
    "11110100100",
    "11110010100",
    "11110010010",
    "11011011110",
    "11011110110",
    "11110110110",
    "10101111000",
    "10100011110",
    "10001011110",
    "10111101000",
    "10111100010",
    "11110101000",
    "11110100010",
    "10111011110",
    "10111101110",
    "11101011110",
    "11110101110",
    "11010000100",
    "11010010000",
    "11010011100",
    "1100011101011",
]


def encode_code128(value: str) -> str:
    if not value:
        raise ValueError("Barcode value cannot be empty")

    values: list[int] = []
    if value.isdigit():
        if len(value) % 2 == 0:
            values.append(105)
            values.extend(int(value[index : index + 2]) for index in range(0, len(value), 2))
        else:
            values.append(104)
            values.append(ord(value[0]) - 32)
            values.append(99)
            values.extend(int(value[index : index + 2]) for index in range(1, len(value), 2))
    else:
        values.append(104)
        values.extend(ord(char) - 32 for char in value)

    checksum = values[0]
    for position, code in enumerate(values[1:], start=1):
        checksum += code * position
    values.append(checksum % 103)
    values.append(106)
    return "".join(CODE128_PATTERNS[code] for code in values)


def barcode_svg(value: str) -> str:
    pattern = encode_code128(value)
    module_width = 2
    quiet_zone = 18
    height = 96
    total_width = quiet_zone * 2 + len(pattern) * module_width
    x = quiet_zone
    bars: list[str] = []

    for bit in pattern:
        if bit == "1":
            bars.append(
                f'<rect x="{x}" y="0" width="{module_width}" height="{height}" fill="#000" />'
            )
        x += module_width

    return (
        f'<svg viewBox="0 0 {total_width} {height}" xmlns="http://www.w3.org/2000/svg" '
        'preserveAspectRatio="none" aria-hidden="true">'
        + "".join(bars)
        + "</svg>"
    )


def read_rows() -> list[dict[str, str]]:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def expanded_labels(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    labels: list[dict[str, str]] = []
    for row in rows:
        qty = int((row.get("Qty") or "0").strip() or "0")
        barcode = (row.get("Barcode") or "").strip()
        item = (row.get("Item") or "").strip()
        size = (row.get("Size") or "").strip()
        if not barcode or qty <= 0:
            continue
        title = f"{item} {size}".strip()
        for _ in range(qty):
            labels.append({"title": title, "barcode": barcode})
    return labels


def build_html(labels: list[dict[str, str]]) -> str:
    cards: list[str] = []
    for label in labels:
        title = html.escape(label["title"])
        barcode = html.escape(label["barcode"])
        cards.append(
            "<section class=\"label\">"
            f"<div class=\"name\">{title}</div>"
            f"<div class=\"bars\">{barcode_svg(label['barcode'])}</div>"
            f"<div class=\"number\">{barcode}</div>"
            "</section>"
        )

    body = "\n".join(cards)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Orange Hotel Barcode Labels</title>
  <style>
    :root {{
      --paper-width: 58mm;
      --print-width: 48mm;
      --label-height: 30mm;
      --gap: 0mm;
    }}

    * {{
      box-sizing: border-box;
    }}

    html, body {{
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
    }}

    body {{
      width: var(--paper-width);
      margin: 0 auto;
    }}

    .sheet {{
      width: var(--paper-width);
      margin: 0 auto;
      padding: 0;
    }}

    .label {{
      width: var(--print-width);
      min-height: var(--label-height);
      margin: 0 auto var(--gap);
      padding: 1.4mm 0 1.2mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .name {{
      width: 100%;
      font-size: 9pt;
      font-weight: 700;
      line-height: 1.05;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 1.1mm;
    }}

    .bars {{
      width: 100%;
      height: 12.5mm;
      display: flex;
      align-items: stretch;
      justify-content: center;
    }}

    .bars svg {{
      width: 100%;
      height: 100%;
      display: block;
    }}

    .number {{
      margin-top: 1mm;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.35mm;
      text-align: center;
      white-space: nowrap;
    }}

    @page {{
      size: 58mm auto;
      margin: 0;
    }}

    @media print {{
      html, body {{
        width: 58mm;
      }}
    }}
  </style>
</head>
<body>
  <main class="sheet">
    {body}
  </main>
</body>
</html>
"""


def main() -> None:
    rows = read_rows()
    labels = expanded_labels(rows)
    OUTPUT_PATH.write_text(build_html(labels), encoding="utf-8")
    print(f"Wrote {len(labels)} labels to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

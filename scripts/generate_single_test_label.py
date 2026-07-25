from __future__ import annotations

import csv
from pathlib import Path

from generate_barcode_labels import CSV_PATH, ROOT, build_html


OUTPUT_PATH = ROOT / "test-barcode-label.html"
TEST_BARCODE = "6200100260026"


def main() -> None:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if (row.get("Barcode") or "").strip() != TEST_BARCODE:
                continue

            title = f"{(row.get('Item') or '').strip()} {(row.get('Size') or '').strip()}".strip()
            html = build_html([{"title": title, "barcode": TEST_BARCODE}])
            OUTPUT_PATH.write_text(html, encoding="utf-8")
            print(f"Wrote test label to {OUTPUT_PATH}")
            return

    raise SystemExit(f"Barcode {TEST_BARCODE} not found in {CSV_PATH}")


if __name__ == "__main__":
    main()

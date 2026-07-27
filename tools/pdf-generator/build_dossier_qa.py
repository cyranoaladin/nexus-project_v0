#!/usr/bin/env python3
"""Phase 8 visual QA for the 4 parent dossiers: structural checks (qpdf, fonts,
links, overflow, blank pages) + a 200dpi contact sheet per dossier and a global
one. Writes a JSON report next to the images. Read-only against the dossiers;
does not regenerate them.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DOCUMENTS_FINAL = REPO_ROOT / "assets" / "campaigns" / "pre-rentree-2026" / "documents-final"
QA_DIR = DOCUMENTS_FINAL / "visual-review-v2"
QA_DIR.mkdir(parents=True, exist_ok=True)

DOSSIER_FILES = [
    "NexusReussite_PreRentree2026_Programme_3e.pdf",
    "NexusReussite_PreRentree2026_Programme_Seconde.pdf",
    "NexusReussite_PreRentree2026_Programme_Premiere.pdf",
    "NexusReussite_PreRentree2026_Programme_Terminale.pdf",
]


def check_dossier(filename: str) -> dict:
    path = DOCUMENTS_FINAL / filename
    result = subprocess.run(["qpdf", "--check", str(path)], capture_output=True, text=True)
    report = {
        "fileName": filename,
        "bytes": path.stat().st_size,
        "qpdfCheckPassed": result.returncode == 0,
    }
    with fitz.open(path) as document:
        report["pageCount"] = document.page_count
        page_rect = document[0].rect
        overflow = 0
        blank_pages = []
        fonts = set()
        links = []
        for page in document:
            for block in page.get_text("blocks"):
                x0, y0, x1, y1 = block[0], block[1], block[2], block[3]
                if x0 < -1 or y0 < -1 or x1 > page_rect.width + 1 or y1 > page_rect.height + 1:
                    overflow += 1
            if len(page.get_text().strip()) < 80:
                blank_pages.append(page.number + 1)
            for font in page.get_fonts():
                fonts.add(font[3])
            for link in page.get_links():
                if link.get("uri"):
                    links.append(link["uri"])
        report["overflowBlocks"] = overflow
        report["nearBlankPages"] = blank_pages
        report["fontsUsed"] = sorted(fonts)
        report["hasFraunces"] = any("Fraunces" in f for f in fonts)
        report["hasDMSans"] = any("DM-Sans" in f or "DMSans" in f for f in fonts)
        report["hasDejaVuFallback"] = any("DejaVu" in f for f in fonts)
        report["linkCount"] = len(links)
        report["links"] = links
    return report


def build_contact_sheet(filename: str) -> Path:
    stem = Path(filename).stem
    pages = sorted(QA_DIR.glob(f"{stem}-*.png"))
    if not pages:
        raise RuntimeError(f"No 200dpi renders found for {filename}; run pdftoppm first")
    columns = 4
    cell_width, cell_height = 260, 370
    rows = (len(pages) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#F7F4ED")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=13)
    for index, page_path in enumerate(pages):
        with Image.open(page_path) as img:
            thumb = img.convert("RGB")
            thumb.thumbnail((cell_width - 20, cell_height - 40), Image.Resampling.LANCZOS)
            x = (index % columns) * cell_width
            y = (index // columns) * cell_height
            image_x = x + (cell_width - thumb.width) // 2
            sheet.paste(thumb, (image_x, y + 8))
            draw.text((x + 10, y + cell_height - 24), f"p.{index + 1}", fill="#071A3A", font=font)
    out_path = QA_DIR / f"{stem}-contact-sheet.png"
    sheet.save(out_path, format="PNG", optimize=True)
    return out_path


def main() -> None:
    reports = []
    for filename in DOSSIER_FILES:
        reports.append(check_dossier(filename))
        contact_sheet = build_contact_sheet(filename)
        print(f"  {filename}: qpdf={'OK' if reports[-1]['qpdfCheckPassed'] else 'FAIL'}, "
              f"{reports[-1]['pageCount']} pages, contact sheet -> {contact_sheet.name}")

    report_path = QA_DIR / "qa-report.json"
    report_path.write_text(json.dumps({"dossiers": reports}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nQA report written to {report_path}")


if __name__ == "__main__":
    main()

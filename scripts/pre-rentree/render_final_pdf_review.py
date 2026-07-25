#!/usr/bin/env python3
"""Rasterize every final campaign PDF and build a deterministic contact sheet."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools" / "pdf-generator"))
from pre_rentree_data import LEVEL_ORDER, PreRentreeData  # noqa: E402

PUBLIC_DOCUMENT_FILENAMES = {
    "NexusReussite_PreRentree2026_FlyerEssentiel.pdf",
    "NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf",
    "NexusReussite_PreRentree2026_Programme_3e.pdf",
    "NexusReussite_PreRentree2026_Programme_Premiere.pdf",
    "NexusReussite_PreRentree2026_Programme_Seconde.pdf",
    "NexusReussite_PreRentree2026_Programme_Terminale.pdf",
    "NexusReussite_PreRentree2026_Tarifs.pdf",
}

# Historic public filenames use "Premiere"/"3e" without the accent (see
# tools/pdf-generator/generate_level_dossiers.py::generate_dossier_pdf).
_FILENAME_BY_LEVEL = {"3e": "TROISIEME", "Seconde": "SECONDE", "Premiere": "PREMIERE", "Terminale": "TERMINALE"}


def _level_dossier_public_status() -> dict[str, bool]:
    """Derive per-level dossier PUBLIC/REVIEW status from the SAME canonical source
    the generator itself uses (modules.json publicationStatus + gap detection) —
    never from a filename heuristic, so it generalizes beyond SVT to any subject."""
    data = PreRentreeData(REPO_ROOT)
    is_public_by_filename_level = {}
    for filename_level, level_code in _FILENAME_BY_LEVEL.items():
        assert level_code in LEVEL_ORDER
        is_public_by_filename_level[filename_level] = data.level_dossier(level_code).is_public
    return is_public_by_filename_level


DOSSIER_PUBLIC_STATUS = _level_dossier_public_status()


def _document_status(filename: str) -> str:
    prefix = "NexusReussite_PreRentree2026_Programme_"
    if filename.startswith(prefix):
        filename_level = filename[len(prefix):-len(".pdf")]
        if filename_level in DOSSIER_PUBLIC_STATUS:
            return "PUBLIC_FINAL" if DOSSIER_PUBLIC_STATUS[filename_level] else "REVIEW_PENDING_PEDAGOGICAL_VALIDATION"
    return "PUBLIC_FINAL" if filename in PUBLIC_DOCUMENT_FILENAMES else "INTERNAL_REVIEW"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def render_review(pdf_directory: Path, public_directory: Path) -> dict:
    pdf_directory = pdf_directory.resolve()
    public_directory = public_directory.resolve()
    public_directory.mkdir(parents=True, exist_ok=True)
    for existing_pdf in public_directory.glob("*.pdf"):
        if existing_pdf.name not in PUBLIC_DOCUMENT_FILENAMES:
            existing_pdf.unlink()
    rendered_root = pdf_directory / "rendered"
    visual_review_root = pdf_directory / "visual-review"
    for target in (rendered_root, visual_review_root):
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True)

    page_records = []
    document_records = []
    thumbnails: list[tuple[str, Image.Image]] = []
    for pdf_path in sorted(pdf_directory.glob("*.pdf")):
        document_directory = rendered_root / pdf_path.stem
        document_directory.mkdir()
        with fitz.open(pdf_path) as document:
            document_records.append({
                "fileName": pdf_path.name,
                "bytes": pdf_path.stat().st_size,
                "sizeLabel": f"{pdf_path.stat().st_size // 1024} Ko",
                "sha256": sha256(pdf_path),
                "pageCount": document.page_count,
                "publicDownloadCandidate": pdf_path.name in PUBLIC_DOCUMENT_FILENAMES,
                "publicationStatus": _document_status(pdf_path.name),
            })
            for page_number, page in enumerate(document, start=1):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                output = document_directory / f"page-{page_number:02d}.png"
                pixmap.save(output)
                page_records.append({
                    "pdf": pdf_path.name,
                    "page": page_number,
                    "path": output.relative_to(pdf_directory).as_posix(),
                    "width": pixmap.width,
                    "height": pixmap.height,
                    "bytes": output.stat().st_size,
                    "sha256": sha256(output),
                })
                with Image.open(output) as rendered:
                    thumbnail = rendered.convert("RGB")
                    thumbnail.thumbnail((260, 370), Image.Resampling.LANCZOS)
                    thumbnails.append((f"{pdf_path.stem} · p. {page_number}", thumbnail.copy()))

    if not thumbnails:
        raise RuntimeError("No PDF found to rasterize")

    columns = 4
    cell_width = 300
    cell_height = 430
    rows = (len(thumbnails) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#F7F4ED")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for index, (label, thumbnail) in enumerate(thumbnails):
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        image_x = x + (cell_width - thumbnail.width) // 2
        sheet.paste(thumbnail, (image_x, y + 12))
        abbreviated = label if len(label) <= 38 else f"{label[:35]}…"
        draw.text((x + 16, y + 392), abbreviated, fill="#071A3A", font=font)

    contact_sheet = visual_review_root / "documents-final-contact-sheet.png"
    sheet.save(contact_sheet, format="PNG", optimize=True)
    manifest = {
        "schemaVersion": "1.0.0",
        "campaignId": "pre-rentree-2026",
        "purpose": "REVIEW_ONLY",
        "pdfCount": len(list(pdf_directory.glob("*.pdf"))),
        "pageCount": len(page_records),
        "documents": document_records,
        "contactSheet": {
            "path": contact_sheet.relative_to(pdf_directory).as_posix(),
            "width": sheet.width,
            "height": sheet.height,
            "bytes": contact_sheet.stat().st_size,
            "sha256": sha256(contact_sheet),
        },
        "pages": page_records,
    }
    manifest_path = visual_review_root / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (pdf_directory / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for document in document_records:
        if document["publicDownloadCandidate"]:
            shutil.copyfile(
                pdf_directory / document["fileName"],
                public_directory / document["fileName"],
            )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf-directory", type=Path, required=True)
    parser.add_argument("--public-directory", type=Path, required=True)
    args = parser.parse_args()
    manifest = render_review(args.pdf_directory, args.public_directory)
    print(json.dumps({
        "status": "REVIEW_RENDERED",
        "pdfCount": manifest["pdfCount"],
        "pageCount": manifest["pageCount"],
    }))


if __name__ == "__main__":
    main()

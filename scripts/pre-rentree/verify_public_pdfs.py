#!/usr/bin/env python3
"""Fail-closed verification of the seven Pré-rentrée PDFs served from /public."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

import fitz


EXPECTED_PUBLIC_FILES = {
    "NexusReussite_PreRentree2026_FlyerEssentiel.pdf",
    "NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf",
    "NexusReussite_PreRentree2026_Programme_3e.pdf",
    "NexusReussite_PreRentree2026_Programme_Premiere.pdf",
    "NexusReussite_PreRentree2026_Programme_Seconde.pdf",
    "NexusReussite_PreRentree2026_Programme_Terminale.pdf",
    "NexusReussite_PreRentree2026_Tarifs.pdf",
}
INTERNAL_FILE = "NexusReussite_PreRentree2026_DossierAccueil_PRINT.pdf"
FORBIDDEN_PUBLIC_COPY = (
    re.compile(r"DOCUMENT\s+DE\s+REVUE", re.IGNORECASE),
    re.compile(r"DIFFUSION\s+INTERDITE", re.IGNORECASE),
    re.compile(r"\bDRAFT\b", re.IGNORECASE),
    re.compile(r"\bPROPOSAL\b", re.IGNORECASE),
    re.compile(r"\bPROPOSITION\b", re.IGNORECASE),
    re.compile(r"PROGRAMME\s+ET\s+INSCRIPTION", re.IGNORECASE),
    re.compile(r"\bPR[ÉE]-?INSCRIRE\b", re.IGNORECASE),
    re.compile(r"\bR[ÉE]SERVER\b", re.IGNORECASE),
    re.compile(r"\bPAYER\b", re.IGNORECASE),
    re.compile(r"10\s+S[ÉE]ANCES\s*[·\-]\s*20\s*H", re.IGNORECASE),
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def verify_pdf(path: Path, rooms_public: bool) -> dict:
    require(path.read_bytes()[:5] == b"%PDF-", f"{path.name}: missing %PDF- signature")
    mime = subprocess.run(
        ["file", "--brief", "--mime-type", str(path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    require(mime == "application/pdf", f"{path.name}: unexpected MIME {mime}")
    subprocess.run(["qpdf", "--check", str(path)], check=True, capture_output=True, text=True)

    text_parts: list[str] = []
    links: set[str] = set()
    embedded_font_count = 0
    with fitz.open(path) as document:
        require(document.page_count > 0, f"{path.name}: empty document")
        for page in document:
            page_text = page.get_text().strip()
            require(len(page_text) >= 40, f"{path.name}: blank or near-blank page {page.number + 1}")
            text_parts.append(page_text)
            rect = page.rect
            for block in page.get_text("blocks"):
                x0, y0, x1, y1 = block[:4]
                require(
                    x0 >= -1 and y0 >= -1 and x1 <= rect.width + 1 and y1 <= rect.height + 1,
                    f"{path.name}: text overflow on page {page.number + 1}",
                )
            for link in page.get_links():
                uri = link.get("uri")
                if uri:
                    links.add(uri)
            for font in page.get_fonts(full=True):
                xref = font[0]
                if not xref:
                    continue
                extracted = document.extract_font(xref)
                if extracted and extracted[-1]:
                    embedded_font_count += 1

    require(embedded_font_count > 0, f"{path.name}: no embedded font")
    for scheme in ("tel:", "mailto:", "https:"):
        require(any(link.startswith(scheme) for link in links), f"{path.name}: missing {scheme} link")

    text = "\n".join(text_parts)
    require(
        "Demander les informations et vérifier les disponibilités" in text,
        f"{path.name}: missing canonical availability CTA",
    )
    for forbidden in FORBIDDEN_PUBLIC_COPY:
        require(not forbidden.search(text), f"{path.name}: forbidden public copy {forbidden.pattern!r}")
    if not rooms_public:
        require(not re.search(r"\bSalle\s+\d+\b", text, re.IGNORECASE), f"{path.name}: unvalidated room number")
    if path.name.endswith("_Programme_Seconde.pdf"):
        require("Physique-Chimie" not in text, f"{path.name}: stale Physique-Chimie claim for Seconde")

    return {
        "fileName": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "mime": mime,
        "links": sorted(links),
        "embeddedFontReferences": embedded_font_count,
    }


def verify(pdf_directory: Path, public_directory: Path) -> dict:
    manifest_path = pdf_directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest["purpose"] == "PUBLIC_RELEASE_CANDIDATE", "public manifest purpose mismatch")
    require(manifest["pdfCount"] == 7, "public manifest must announce seven PDFs")
    records = {record["fileName"]: record for record in manifest["documents"]}
    public_records = {
        name for name, record in records.items()
        if record["publicDownloadCandidate"]
    }
    require(public_records == EXPECTED_PUBLIC_FILES, "public manifest allowlist mismatch")
    require(
        records.get(INTERNAL_FILE, {}).get("publicationStatus") == "INTERNAL_REVIEW"
        and not records[INTERNAL_FILE]["publicDownloadCandidate"],
        "internal family intake dossier must remain INTERNAL_REVIEW",
    )
    actual_public_files = {path.name for path in public_directory.glob("*.pdf")}
    require(actual_public_files == EXPECTED_PUBLIC_FILES, "served public PDF set mismatch")

    campaign = json.loads(
        (pdf_directory.parents[3] / "data/campaigns/pre-rentree-2026.json").read_text(encoding="utf-8")
    )
    rooms_public = campaign["operationalGates"]["roomAssignmentsValidated"]
    reports = []
    for name in sorted(EXPECTED_PUBLIC_FILES):
        asset = pdf_directory / name
        served = public_directory / name
        require(asset.is_file() and served.is_file(), f"{name}: missing asset or public copy")
        require(asset.read_bytes() == served.read_bytes(), f"{name}: public copy differs from generated asset")
        digest = sha256(served)
        require(records[name]["sha256"] == digest, f"{name}: manifest checksum mismatch")
        require(records[name]["publicationStatus"] == "PUBLIC_FINAL", f"{name}: not PUBLIC_FINAL")
        reports.append(verify_pdf(served, rooms_public))

    return {
        "status": "PUBLIC_PDFS_VERIFIED",
        "publicPdfCount": len(reports),
        "roomsPubliclyConfirmed": rooms_public,
        "documents": reports,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf-directory", type=Path, required=True)
    parser.add_argument("--public-directory", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(
        verify(args.pdf_directory.resolve(), args.public_directory.resolve()),
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()

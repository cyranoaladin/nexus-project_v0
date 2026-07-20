#!/usr/bin/env python3
"""Build deterministic parent and owner-review ZIP archives."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import zipfile
from datetime import date
from pathlib import Path
from typing import Iterable


PARENT_PACKAGE = "NexusReussite_PreRentree2026_PARENT_PACKAGE.zip"
REVIEW_PACKAGE = "NexusReussite_PreRentree2026_REVIEW_PACKAGE.zip"
DOCUMENTATION_FILES = (
    "PARENT-GUIDE-SOURCE-MAP.md",
    "PARCOURS360-CAPABILITY-MATRIX.md",
    "SOURCE-OF-TRUTH-MAP.md",
    "COMPLIANCE-GAPS.md",
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _zip_info(name: str, edition: date) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, (edition.year, edition.month, edition.day, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    return info


def _write_zip(destination: Path, entries: Iterable[tuple[str, bytes]], edition: date) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, content in sorted(entries):
                archive.writestr(_zip_info(name, edition), content, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def _files(root: Path) -> Iterable[Path]:
    return (path for path in sorted(root.rglob("*")) if path.is_file())


def _relative_entries(root: Path, prefix: str = "") -> list[tuple[str, bytes]]:
    return [
        (f"{prefix}{path.relative_to(root).as_posix()}", path.read_bytes())
        for path in _files(root)
    ]


def package_documents(artifact_root: Path, output: Path, repo_root: Path) -> dict[str, dict[str, int | str]]:
    artifact_root = Path(artifact_root).resolve()
    output = Path(output).resolve()
    repo_root = Path(repo_root).resolve()
    public = artifact_root / "PUBLIC"
    review = artifact_root / "REVIEW"
    if not public.is_dir() or not review.is_dir():
        raise FileNotFoundError("Audited PUBLIC and REVIEW directories are required")

    snapshot_path = repo_root / "generated/pre-rentree-2026/publication.snapshot.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    edition = date.fromisoformat(snapshot["document"]["documentEditionDate"])
    parent_path = output / PARENT_PACKAGE
    review_path = output / REVIEW_PACKAGE

    expected_pdf = set(snapshot["document"]["outputs"]["publicPdf"].values())
    expected_html = set(snapshot["document"]["outputs"]["publicHtml"].values())
    if {path.name for path in public.glob("*.pdf")} != expected_pdf:
        raise ValueError("Public PDF inventory differs from the snapshot")
    if {path.name for path in (public / "HTML").glob("*.html")} != expected_html:
        raise ValueError("Public HTML inventory differs from the snapshot")

    readme = (
        "Nexus Réussite — Stages de pré-rentrée 2026\n"
        "Ouvrez en priorité le Guide Parents complet. Les six autres documents sont des annexes.\n"
        "La pré-inscription ne réserve pas de place et ne forme pas un contrat.\n"
    ).encode("utf-8")
    parent_entries = [(path.name, path.read_bytes()) for path in sorted(public.glob("*.pdf"))]
    parent_entries += _relative_entries(public / "HTML", "HTML/")
    parent_entries += _relative_entries(public / "ASSETS", "ASSETS/")
    parent_entries.append(("LISEZ-MOI.txt", readme))
    _write_zip(parent_path, parent_entries, edition)

    documentation_root = repo_root / "docs/campaigns/pre-rentree-2026"
    documentation = []
    for filename in DOCUMENTATION_FILES:
        source = documentation_root / filename
        if not source.is_file():
            raise FileNotFoundError(f"Missing review documentation: {source}")
        documentation.append((f"DOCUMENTATION/{filename}", source.read_bytes()))
    review_entries = [(PARENT_PACKAGE, parent_path.read_bytes())]
    review_entries += _relative_entries(review, "REVIEW/")
    review_entries += _relative_entries(public / "SOCIAL", "PUBLIC/SOCIAL/")
    review_entries += documentation
    _write_zip(review_path, review_entries, edition)

    return {
        "parent": {"file": parent_path.name, "sha256": _sha256(parent_path), "fileSize": parent_path.stat().st_size},
        "review": {"file": review_path.name, "sha256": _sha256(review_path), "fileSize": review_path.stat().st_size},
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    return parser


def main() -> None:
    args = build_parser().parse_args()
    result = package_documents(args.artifact_root, args.output, args.repo_root)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

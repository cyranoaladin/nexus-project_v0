from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from package_documents import package_documents  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _fixture(root: Path) -> Path:
    artifact = root / "artifact"
    snapshot = json.loads((REPO_ROOT / ".artifacts/pre-rentree-2026/publication.snapshot.json").read_text(encoding="utf-8"))
    public = artifact / "PUBLIC"
    for name in snapshot["document"]["outputs"]["publicPdf"].values():
        (public / name).parent.mkdir(parents=True, exist_ok=True)
        (public / name).write_bytes(f"pdf:{name}".encode())
    for name in snapshot["document"]["outputs"]["publicHtml"].values():
        path = public / "HTML" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'<html lang="fr"><title>{name}</title></html>', encoding="utf-8")
    for name in ("document.css", "logo-slogan.png", "qr-canonical.png"):
        path = public / "ASSETS" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"asset:{name}".encode())
    social = public / "SOCIAL/feed.png"
    social.parent.mkdir(parents=True, exist_ok=True)
    social.write_bytes(b"social")
    audit = artifact / "REVIEW/AUDIT/final-report.json"
    audit.parent.mkdir(parents=True, exist_ok=True)
    audit.write_text('{"PUBLIC_STATUS":"PDF_PACKAGE_READY_FOR_OWNER_REVIEW"}\n', encoding="utf-8")
    visual = artifact / "REVIEW/VISUAL/visual-contact-sheet.png"
    visual.parent.mkdir(parents=True, exist_ok=True)
    visual.write_bytes(b"contact-sheet")
    return artifact


def test_packages_exact_parent_surface_and_review_evidence_deterministically(tmp_path: Path):
    artifact = _fixture(tmp_path)
    first = tmp_path / "first"
    second = tmp_path / "second"

    first_result = package_documents(artifact, first, REPO_ROOT)
    second_result = package_documents(artifact, second, REPO_ROOT)

    assert first_result["parent"]["sha256"] == second_result["parent"]["sha256"]
    assert first_result["review"]["sha256"] == second_result["review"]["sha256"]
    assert first_result["parent"]["sha256"] == _sha(first / "NexusReussite_PreRentree2026_PARENT_PACKAGE.zip")
    assert first_result["review"]["sha256"] == _sha(first / "NexusReussite_PreRentree2026_REVIEW_PACKAGE.zip")

    with zipfile.ZipFile(first / "NexusReussite_PreRentree2026_PARENT_PACKAGE.zip") as archive:
        names = set(archive.namelist())
        assert "LISEZ-MOI.txt" in names
        assert len([name for name in names if name.endswith(".pdf")]) == 11
        assert len([name for name in names if name.endswith(".html")]) == 11
        assert "ASSETS/document.css" in names
        assert "THIRD_PARTY_NOTICES.md" in names
        assert "LICENSES/OFL-1.1.txt" in names
        assert "package-manifest.json" in names
        assert not any(name.startswith("REVIEW/") or name.startswith("SOCIAL/") for name in names)
        assert not any(name.endswith((".py", ".ts", ".tsx")) for name in names)

    with zipfile.ZipFile(first / "NexusReussite_PreRentree2026_REVIEW_PACKAGE.zip") as archive:
        names = set(archive.namelist())
        assert "NexusReussite_PreRentree2026_PARENT_PACKAGE.zip" in names
        assert "REVIEW/AUDIT/final-report.json" in names
        assert "REVIEW/VISUAL/visual-contact-sheet.png" in names
        assert "DOCUMENTATION/PARENT-GUIDE-SOURCE-MAP.md" in names
        assert "DOCUMENTATION/PARCOURS360-CAPABILITY-MATRIX.md" in names
        assert "DOCUMENTATION/VALUE-PROOF-MATRIX.md" in names
        assert "DOCUMENTATION/STAFFING-MATRIX.md" in names
        assert "PUBLIC/SOCIAL/feed.png" in names
        assert "package-manifest.json" in names
        assert not any(name.endswith((".py", ".ts", ".tsx")) for name in names)
        assert not any("PRIVATE" in name.upper() for name in names)

    assert first_result["parent"]["fileCount"] == len(zipfile.ZipFile(first / "NexusReussite_PreRentree2026_PARENT_PACKAGE.zip").namelist())
    assert first_result["review"]["fileCount"] == len(zipfile.ZipFile(first / "NexusReussite_PreRentree2026_REVIEW_PACKAGE.zip").namelist())
    index = json.loads((first / "package-index.json").read_text(encoding="utf-8"))
    assert [item["file"] for item in index["packages"]] == [
        "NexusReussite_PreRentree2026_PARENT_PACKAGE.zip",
        "NexusReussite_PreRentree2026_REVIEW_PACKAGE.zip",
    ]
    assert all(len(item["sha256"]) == 64 for item in index["packages"])

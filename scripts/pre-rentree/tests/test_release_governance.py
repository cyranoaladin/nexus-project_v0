import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest


SCRIPT_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = SCRIPT_DIR / "release_governance.py"


def _load_module():
    assert MODULE_PATH.is_file(), "release_governance.py must exist"
    spec = importlib.util.spec_from_file_location("release_governance", MODULE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    assert hasattr(module, "build_review_manifest")
    return module


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


@pytest.fixture()
def review_package(tmp_path: Path) -> Path:
    package = tmp_path / "outputs-v5-canonical"
    pdf = package / "PUBLIC/Nexus_Public.pdf"
    html = package / "PUBLIC/HTML/Nexus_Public.html"
    feed = package / "PUBLIC/SOCIAL/feed.png"
    alt = package / "PUBLIC/SOCIAL/alt.json"
    generator = package / "SOURCES/GENERATOR/generate_documents.py"
    contact_sheet = package / "AUDIT/VISUAL/visual-contact-sheet.png"
    comparison_sheet = package / "AUDIT/VISUAL/v4-v5-comparison-sheet.png"

    for path, content in (
        (pdf, b"canonical-pdf"),
        (html, b"<html lang='fr'><h1>Document</h1></html>"),
        (feed, b"social-image"),
        (alt, b'{"feed":"Texte alternatif"}\n'),
        (generator, b"print('generator')\n"),
        (contact_sheet, b"contact-sheet"),
        (comparison_sheet, b"comparison-sheet"),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    snapshot = package / "SOURCES/publication.snapshot.json"
    _write_json(
        snapshot,
        {
            "campaign": {"id": "pre-rentree-2026"},
            "document": {
                "version": "v5-canonical",
                "outputs": {
                    "publicPdf": {"essential": pdf.name},
                    "publicHtml": {"essential": html.name},
                    "social": {"feed": feed.name, "altText": alt.name},
                },
            },
        },
    )
    _write_json(
        package / "AUDIT/document-build-manifest.json",
        {
            "REPO_SHA": "a" * 40,
            "SNAPSHOT_SHA256": _sha256(snapshot),
            "GENERATOR_SHA256": _sha256(generator),
            "DOCUMENT_VERSION": "v5-canonical",
            "PDF_FILES": [{"PDF_FILE": pdf.name, "PDF_SHA256": _sha256(pdf)}],
        },
    )
    _write_json(
        package / "AUDIT/final-report.json",
        {
            "PUBLIC_STATUS": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW",
            "PRIVATE_STATUS": "BLOCKED_BY_LEGAL_TERMS",
            "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": True,
        },
    )
    for name in (
        "content-gate-report.json",
        "pdf-qa-report.json",
        "visual-qa-report.json",
        "social-visual-qa-report.json",
        "accessibility-report.json",
    ):
        _write_json(package / "AUDIT" / name, {})
    _write_json(
        package / "AUDIT/manual-visual-review.json",
        {
            "CONTACT_SHEET_SHA256": _sha256(contact_sheet),
            "V4_V5_COMPARISON_SHEET_SHA256": _sha256(comparison_sheet),
        },
    )
    return package


def test_build_review_manifest_is_complete_sorted_and_hash_bound(review_package: Path):
    module = _load_module()

    manifest = module.build_review_manifest(review_package)

    paths = [item["path"] for item in manifest["artifacts"]]
    assert manifest["schemaVersion"] == "1.0.0"
    assert manifest["campaignId"] == "pre-rentree-2026"
    assert manifest["publicStatus"] == "PDF_PACKAGE_READY_FOR_OWNER_REVIEW"
    assert manifest["privateStatus"] == "BLOCKED_BY_LEGAL_TERMS"
    assert paths == sorted(paths)
    assert {
        "PUBLIC/Nexus_Public.pdf",
        "PUBLIC/HTML/Nexus_Public.html",
        "PUBLIC/SOCIAL/feed.png",
        "PUBLIC/SOCIAL/alt.json",
        "SOURCES/publication.snapshot.json",
        "SOURCES/GENERATOR/generate_documents.py",
        "AUDIT/VISUAL/visual-contact-sheet.png",
        "AUDIT/VISUAL/v4-v5-comparison-sheet.png",
        "AUDIT/document-build-manifest.json",
        "AUDIT/final-report.json",
    } <= set(paths)
    assert all(item["sha256"] == _sha256(review_package / item["path"]) for item in manifest["artifacts"])


def test_build_review_manifest_rejects_missing_required_artifact(review_package: Path):
    module = _load_module()
    (review_package / "PUBLIC/HTML/Nexus_Public.html").unlink()

    with pytest.raises(FileNotFoundError, match="Missing review artifact"):
        module.build_review_manifest(review_package)


def test_build_review_manifest_rejects_pdf_hash_drift(review_package: Path):
    module = _load_module()
    (review_package / "PUBLIC/Nexus_Public.pdf").write_bytes(b"tampered")

    with pytest.raises(ValueError, match="PDF hash mismatch"):
        module.build_review_manifest(review_package)


def test_build_review_manifest_rejects_symlinked_artifact(review_package: Path, tmp_path: Path):
    module = _load_module()
    feed = review_package / "PUBLIC/SOCIAL/feed.png"
    outside = tmp_path / "outside.png"
    outside.write_bytes(b"outside")
    feed.unlink()
    feed.symlink_to(outside)

    with pytest.raises(ValueError, match="Symbolic links are not allowed"):
        module.build_review_manifest(review_package)

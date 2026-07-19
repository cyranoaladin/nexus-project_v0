import json
import shutil
import sys
from pathlib import Path

import pytest

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from document_assets import generate_qr, prepare_assets  # noqa: E402
from document_audit import (  # noqa: E402
    audit_html_accessibility,
    audit_pdf,
    audit_stylesheet_accessibility,
    build_content_gate_report,
    build_document_manifest,
    scan_blocked_public_terms,
)
from document_model import load_snapshot  # noqa: E402
from document_renderer import render_public_pdfs, write_public_html  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT_PATH = REPO_ROOT / "generated/pre-rentree-2026-publication.snapshot.json"
SCHEMA_PATH = REPO_ROOT / "scripts/pre-rentree/publication-snapshot.schema.json"
SNAPSHOT = load_snapshot(SNAPSHOT_PATH, SCHEMA_PATH)


@pytest.fixture(scope="module")
def package(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("document-audit")
    assets = root / "SOURCES/ASSETS"
    css = root / "SOURCES/CSS"
    html = root / "PUBLIC/HTML"
    prepare_assets(SNAPSHOT, REPO_ROOT, assets)
    generate_qr(SNAPSHOT, assets)
    css.mkdir(parents=True)
    shutil.copyfile(SCRIPT_DIR / "templates/document.css", css / "document.css")
    write_public_html(SNAPSHOT, html)
    render_public_pdfs(SNAPSHOT, html, root / "PUBLIC")
    return root


def test_audits_pdf_metadata_language_fonts_links_and_text(package: Path):
    pdf_name = SNAPSHOT["document"]["outputs"]["publicPdf"]["essential"]
    record = audit_pdf(package / "PUBLIC" / pdf_name, SNAPSHOT)

    assert record["PDF_FILE"] == pdf_name
    assert len(record["PDF_SHA256"]) == 64
    assert record["PAGE_COUNT"] >= 1
    assert record["FILE_SIZE"] > 10_000
    assert record["LANGUAGE"].casefold().startswith("fr")
    assert record["A4_PAGE_COUNT"] == record["PAGE_COUNT"]
    assert record["TEXT_EXTRACTABLE"] is True
    assert record["TAGGED_PDF"] is True
    assert record["BROKEN_GLYPH_COUNT"] == 0
    assert record["FONT_IDENTIFIERS"]
    assert record["LINK_TARGETS"]
    assert SNAPSHOT["contact"]["canonicalUrl"] in record["LINK_TARGETS"]
    assert record["SECRET_FINDING_COUNT"] == 0
    assert record["PII_TEST_FINDING_COUNT"] == 0


def test_accessible_html_has_no_structural_issue(package: Path):
    for filename in SNAPSHOT["document"]["outputs"]["publicHtml"].values():
        issues = audit_html_accessibility(package / "PUBLIC/HTML" / filename)
        assert issues == [], (filename, issues)



def test_stylesheet_contrast_type_size_and_keyboard_focus():
    stylesheet = audit_stylesheet_accessibility(SCRIPT_DIR / "templates/document.css")
    assert stylesheet["CONTRAST_FAILURE_COUNT"] == 0
    assert stylesheet["MINIMUM_DECLARED_FONT_SIZE_PT"] >= 8
    assert stylesheet["FOCUS_INDICATOR_PRESENT"] is True


def test_public_package_has_no_blocked_term_or_internal_token(package: Path):
    findings = scan_blocked_public_terms(package / "PUBLIC")
    assert findings == []


def test_content_gates_are_computed_from_rendered_documents(package: Path):
    report = build_content_gate_report(SNAPSHOT, package, SCRIPT_DIR)
    expected_zero = (
        "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT",
        "UNMAPPED_PUBLIC_CLAIM_COUNT",
        "MODULE_SESSION_MISMATCH_COUNT",
        "MODULE_ID_MISMATCH_COUNT",
        "SESSION_TITLE_MISMATCH_COUNT",
        "SESSION_OBJECTIVE_MISMATCH_COUNT",
        "SESSION_TOPIC_MISMATCH_COUNT",
        "SESSION_DELIVERABLE_MISMATCH_COUNT",
        "PRICE_MISMATCH_COUNT",
        "SCHEDULE_MISMATCH_COUNT",
        "CONTACT_MISMATCH_COUNT",
        "LEGAL_POLICY_CONFLICT_COUNT",
        "HARDCODED_BUSINESS_VALUE_COUNT",
        "HARDCODED_CAMPAIGN_VALUE_COUNT",
        "HARDCODED_PRICE_COUNT",
        "HARDCODED_SCHEDULE_SLOT_COUNT",
        "HARDCODED_PROGRAM_SESSION_COUNT",
        "DEPOSIT_LABEL_MISMATCH_COUNT",
        "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT",
        "QR_LINK_MISMATCH_COUNT",
    )
    assert {key: report[key] for key in expected_zero} == {key: 0 for key in expected_zero}
    assert report["MODULE_COUNT"] == 12
    assert report["SESSION_COUNT"] == 60
    assert report["CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED"] is True
    assert [report[f"PRICE_{index}"] for index in range(1, 5)] == [480, 900, 1350, 1800]
    assert [report[f"DEPOSIT_{index}"] for index in range(1, 5)] == [140, 270, 410, 540]
    assert [report[f"BALANCE_{index}"] for index in range(1, 5)] == [340, 630, 940, 1260]
    assert [report[f"PRICE_PER_HOUR_{index}"] for index in range(1, 5)] == [48, 45, 45, 45]


def test_build_manifest_records_every_public_pdf(package: Path, tmp_path: Path):
    manifest_path = tmp_path / "document-build-manifest.json"
    manifest = build_document_manifest(SNAPSHOT, package, manifest_path)

    assert manifest_path.is_file()
    assert manifest["REPO_SHA"] == SNAPSHOT["sourceRepoSha"]
    assert len(manifest["PDF_FILES"]) == 6
    assert all(len(record["PDF_SHA256"]) == 64 for record in manifest["PDF_FILES"])
    assert all(record["PUBLIC_OR_PRIVATE"] == "PUBLIC" for record in manifest["PDF_FILES"])
    assert manifest["ALL_PDF_SHA256_RECORDED"] is True
    assert json.loads(manifest_path.read_text(encoding="utf-8")) == manifest

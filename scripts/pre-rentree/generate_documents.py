#!/usr/bin/env python3
"""Build the canonical Pré-rentrée package atomically from one snapshot."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any

from audit_v4 import build_v4_audit
from document_assets import generate_qr, generate_social_visuals, prepare_assets
from document_audit import (
    audit_html_accessibility,
    audit_pdf,
    audit_social_visuals,
    audit_stylesheet_accessibility,
    build_content_gate_report,
    build_document_manifest,
    build_visual_qa,
)
from document_model import load_snapshot
from document_renderer import render_public_pdfs, write_public_html
from document_templates import render_private_structural_template


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
SCHEMA_PATH = SCRIPT_DIR / "schemas/publication-snapshot.schema.json"
V4_ROOT = REPO_ROOT.parent

REPRODUCIBLE_PYTHON_SOURCES = (
    "audit_v4.py",
    "document_assets.py",
    "document_audit.py",
    "document_model.py",
    "document_renderer.py",
    "document_templates.py",
    "generate_documents.py",
)

REPRODUCIBLE_TYPESCRIPT_SOURCES = (
    "build-publication-snapshot.ts",
    "publication-derivations.ts",
    "publication-snapshot-schema.ts",
    "publication-sources.ts",
)

REPRODUCIBLE_TEST_SOURCES = (
    "test_audit_v4.py",
    "test_document_assets.py",
    "test_document_audit.py",
    "test_document_model.py",
    "test_document_renderer.py",
    "test_document_templates.py",
    "test_generate_documents.py",
    "test_visual_audit.py",
)


def _atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with temporary.open("rb") as handle:
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def _resolve_from_repo(path: Path) -> Path:
    return path.resolve() if path.is_absolute() else (REPO_ROOT / path).resolve()


def _validate_output_target(output: Path) -> None:
    forbidden = {
        REPO_ROOT.resolve(),
        V4_ROOT.resolve(),
        (V4_ROOT / "outputs").resolve(),
        (REPO_ROOT / ".git").resolve(),
    }
    if output in forbidden or output in REPO_ROOT.parents or output in V4_ROOT.parents:
        raise ValueError(f"Unsafe output target: {output}")
    if output.is_relative_to(REPO_ROOT / ".git"):
        raise ValueError(f"Unsafe output target: {output}")
    if output.is_relative_to(V4_ROOT / "outputs"):
        raise ValueError("The v4 output tree is read-only")


def _copy_reproducible_sources(snapshot_path: Path, package_root: Path) -> None:
    sources = package_root / "SOURCES"
    (sources / "GENERATOR").mkdir(parents=True, exist_ok=True)
    (sources / "CSS").mkdir(parents=True, exist_ok=True)
    (sources / "TESTS").mkdir(parents=True, exist_ok=True)
    (sources / "HTML/PRIVATE_TEMPLATE").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(snapshot_path, sources / "publication.snapshot.json")
    shutil.copyfile(SCHEMA_PATH, sources / "publication-snapshot.schema.json")
    shutil.copyfile(SCRIPT_DIR / "templates/document.css", sources / "CSS/document.css")
    shutil.copyfile(SCRIPT_DIR / "requirements.lock", sources / "requirements.lock")
    for filename in (*REPRODUCIBLE_PYTHON_SOURCES, *REPRODUCIBLE_TYPESCRIPT_SOURCES):
        source = SCRIPT_DIR / filename
        if not source.is_file():
            raise FileNotFoundError(f"Missing reproducible generator source: {source}")
        shutil.copyfile(source, sources / "GENERATOR" / filename)
    for filename in REPRODUCIBLE_TEST_SOURCES:
        source = SCRIPT_DIR / "tests" / filename
        if not source.is_file():
            raise FileNotFoundError(f"Missing reproducible generator test: {source}")
        shutil.copyfile(source, sources / "TESTS" / filename)


def _write_private_block(snapshot: dict[str, Any], package_root: Path) -> None:
    private = package_root / "PRIVATE"
    private.mkdir(parents=True, exist_ok=True)
    _atomic_json(
        private / "publication-blocked.json",
        {
            "STATUS": "BLOCKED_BY_LEGAL_TERMS",
            "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": True,
            "LEGAL_SOURCE_STATUS": snapshot["legal"]["status"],
            "COMMERCIAL_TERMS_PATH": snapshot["legal"]["commercialTermsPath"],
            "TERMS_VERSION": snapshot["legal"]["termsVersion"],
            "EFFECTIVE_DATE": snapshot["legal"]["effectiveDate"],
            "OWNER_APPROVAL_REFERENCE": snapshot["legal"]["ownerApprovalReference"],
            "LEGAL_APPROVAL_REFERENCE": snapshot["legal"]["legalApprovalReference"],
            "PDF_FILES_PRODUCED": [],
        },
    )
    structural_path = package_root / "SOURCES/HTML/PRIVATE_TEMPLATE/DossierConfirmation_STRUCTURE_NON_PUBLIABLE.html"
    structural_path.write_text(render_private_structural_template(snapshot), encoding="utf-8")


def _accessibility_report(snapshot: dict[str, Any], package_root: Path) -> dict[str, Any]:
    records = []
    for filename in snapshot["document"]["outputs"]["publicHtml"].values():
        issues = audit_html_accessibility(package_root / "PUBLIC/HTML" / filename)
        records.append({"HTML_FILE": filename, "ISSUES": issues})
    stylesheet = audit_stylesheet_accessibility(package_root / "SOURCES/CSS/document.css")
    issue_count = sum(len(record["ISSUES"]) for record in records)
    issue_count += stylesheet["CONTRAST_FAILURE_COUNT"]
    issue_count += int(not stylesheet["MINIMUM_FONT_SIZE_PASS"])
    issue_count += int(not stylesheet["FOCUS_INDICATOR_PRESENT"])
    issue_count += int(not stylesheet["PRINT_AND_SCREEN_STYLES_PRESENT"])
    return {
        "HTML_DOCUMENT_COUNT": len(records),
        "ACCESSIBILITY_ISSUE_COUNT": issue_count,
        "DOCUMENTS": records,
        "STYLESHEET": stylesheet,
        "PDF_IS_NOT_THE_ONLY_ACCESS_PATH": len(records) == 6,
    }


def _build_in_staging(snapshot_path: Path, package_root: Path) -> dict[str, Any]:
    snapshot = load_snapshot(snapshot_path, SCHEMA_PATH)
    public = package_root / "PUBLIC"
    html = public / "HTML"
    assets = package_root / "SOURCES/ASSETS"
    audit = package_root / "AUDIT"

    _copy_reproducible_sources(snapshot_path, package_root)
    prepare_assets(snapshot, REPO_ROOT, assets)
    generate_qr(snapshot, assets)
    write_public_html(snapshot, html)
    render_public_pdfs(snapshot, html, public)
    generate_social_visuals(snapshot, assets, public / "SOCIAL")
    _write_private_block(snapshot, package_root)

    build_v4_audit(REPO_ROOT, V4_ROOT, snapshot_path, audit)
    content_report = build_content_gate_report(snapshot, package_root, SCRIPT_DIR)
    _atomic_json(audit / "content-gate-report.json", content_report)
    accessibility = _accessibility_report(snapshot, package_root)
    _atomic_json(audit / "accessibility-report.json", accessibility)
    pdf_report = {
        "PDF_DOCUMENT_COUNT": 6,
        "DOCUMENTS": [
            audit_pdf(public / filename, snapshot)
            for filename in snapshot["document"]["outputs"]["publicPdf"].values()
        ],
    }
    _atomic_json(audit / "pdf-qa-report.json", pdf_report)
    visual = build_visual_qa(
        snapshot,
        public,
        V4_ROOT / "outputs",
        audit / "VISUAL",
        dpi=200,
    )
    _atomic_json(audit / "visual-qa-report.json", visual)
    social_visual = audit_social_visuals(snapshot, public / "SOCIAL")
    _atomic_json(audit / "social-visual-qa-report.json", social_visual)
    manifest = build_document_manifest(
        snapshot,
        package_root,
        audit / "document-build-manifest.json",
        snapshot_path=snapshot_path,
        generator_path=SCRIPT_DIR / "generate_documents.py",
    )

    expected_files = [
        *(public / name for name in snapshot["document"]["outputs"]["publicPdf"].values()),
        *(html / name for name in snapshot["document"]["outputs"]["publicHtml"].values()),
        *(public / "SOCIAL" / name for name in snapshot["document"]["outputs"]["social"].values()),
        audit / "pdf-claim-matrix.csv",
        audit / "v4-content-diff.json",
        audit / "v4-input-manifest.json",
        audit / "content-gate-report.json",
        audit / "accessibility-report.json",
        audit / "pdf-qa-report.json",
        audit / "visual-qa-report.json",
        audit / "social-visual-qa-report.json",
        audit / "document-build-manifest.json",
    ]
    zero_gate_names = (
        "MODULE_SESSION_MISMATCH_COUNT",
        "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT",
        "LEGAL_POLICY_CONFLICT_COUNT",
        "HARDCODED_BUSINESS_VALUE_COUNT",
        "PRICE_MISMATCH_COUNT",
        "DEPOSIT_LABEL_MISMATCH_COUNT",
        "SCHEDULE_MISMATCH_COUNT",
        "CONTACT_MISMATCH_COUNT",
        "QR_LINK_MISMATCH_COUNT",
        "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT",
    )
    public_gates_pass = (
        all(content_report[name] == 0 for name in zero_gate_names)
        and visual["VISUAL_DEFECT_COUNT"] + social_visual["SOCIAL_VISUAL_DEFECT_COUNT"] == 0
        and accessibility["ACCESSIBILITY_ISSUE_COUNT"] == 0
        and manifest["ALL_PDF_SHA256_RECORDED"]
        and all(path.is_file() for path in expected_files)
    )
    final_report = {
        **content_report,
        "PDF_VISUAL_DEFECT_COUNT": visual["VISUAL_DEFECT_COUNT"],
        "SOCIAL_VISUAL_DEFECT_COUNT": social_visual["SOCIAL_VISUAL_DEFECT_COUNT"],
        "VISUAL_DEFECT_COUNT": visual["VISUAL_DEFECT_COUNT"] + social_visual["SOCIAL_VISUAL_DEFECT_COUNT"],
        "ACCESSIBILITY_ISSUE_COUNT": accessibility["ACCESSIBILITY_ISSUE_COUNT"],
        "OUTPUT_MANIFEST_COMPLETE": all(path.is_file() for path in expected_files),
        "ALL_PDF_SHA256_RECORDED": manifest["ALL_PDF_SHA256_RECORDED"],
        "PUBLIC_STATUS": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW" if public_gates_pass else "BLOCKED_BY_REPRODUCIBILITY",
        "PRIVATE_STATUS": "BLOCKED_BY_LEGAL_TERMS",
        "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": True,
    }
    _atomic_json(audit / "final-report.json", final_report)
    if not public_gates_pass:
        raise RuntimeError("One or more public publication gates failed")
    return final_report


def _publish_staging(staging: Path, output: Path) -> None:
    backup: Path | None = None
    if output.exists():
        backup = output.with_name(f".{output.name}.previous-{uuid.uuid4().hex}")
        os.replace(output, backup)
    try:
        os.replace(staging, output)
    except BaseException:
        if backup is not None and backup.exists() and not output.exists():
            os.replace(backup, output)
        raise
    if backup is not None:
        shutil.rmtree(backup)


def build_package(snapshot_path: Path, output_path: Path) -> dict[str, Any]:
    snapshot_path = _resolve_from_repo(Path(snapshot_path))
    output = _resolve_from_repo(Path(output_path))
    _validate_output_target(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output.name}.tmp-", dir=output.parent))
    try:
        final_report = _build_in_staging(snapshot_path, staging)
        _publish_staging(staging, output)
        return final_report
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = build_package(args.snapshot, args.output)
    print(report["PUBLIC_STATUS"])
    print(report["PRIVATE_STATUS"])


if __name__ == "__main__":
    main()

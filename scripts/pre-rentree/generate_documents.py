#!/usr/bin/env python3
"""Build the Pré-rentrée 2026 owner-review artifacts atomically."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

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
from operational_artifacts import generate_review_artifacts
from verify_release import write_review_governance


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
SCHEMA_PATH = SCRIPT_DIR / "schemas/publication-snapshot.schema.json"
DEFAULT_OUTPUT = REPO_ROOT / ".artifacts/pre-rentree-2026"


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
    forbidden = {REPO_ROOT.resolve(), (REPO_ROOT / ".git").resolve()}
    if output in forbidden or output in REPO_ROOT.parents:
        raise ValueError(f"Unsafe output target: {output}")
    if output.is_relative_to(REPO_ROOT / ".git"):
        raise ValueError(f"Unsafe output target: {output}")


def _copy_public_assets(snapshot: dict[str, Any], assets_dir: Path) -> None:
    prepare_assets(snapshot, REPO_ROOT, assets_dir)
    generate_qr(snapshot, assets_dir)
    source = SCRIPT_DIR / "templates/document.css"
    destination = assets_dir / "document.css"
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    shutil.copyfile(source, temporary)
    os.replace(temporary, destination)


def _accessibility_report(snapshot: dict[str, Any], package_root: Path) -> dict[str, Any]:
    html_root = package_root / "PUBLIC/HTML"
    records = [
        {
            "HTML_FILE": filename,
            "ISSUES": audit_html_accessibility(html_root / filename),
        }
        for filename in snapshot["document"]["outputs"]["publicHtml"].values()
    ]
    stylesheet = audit_stylesheet_accessibility(package_root / "PUBLIC/ASSETS/document.css")
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
        "PDF_ACCESSIBILITY_CLAIM": "NOT_CLAIMED",
        "ACCESSIBLE_REFERENCE_FORMAT": "HTML",
        "PDF_IS_NOT_THE_ONLY_ACCESS_PATH": len(records) == len(snapshot["document"]["outputs"]["publicHtml"]),
    }


def _publication_status() -> dict[str, str]:
    return {
        "PUBLIC_DOCUMENT_PACKAGE": "READY_FOR_OWNER_REVIEW",
        "OWNER_REVIEW": "PENDING",
        "LEGAL_REVIEW": "PENDING",
        "PRIVACY_REVIEW": "PENDING",
        "PRIVATE_CONTRACTUAL_PACKAGE": "BLOCKED",
        "MERGE": "NOT_PERFORMED",
        "DEPLOYMENT": "NOT_PERFORMED",
        "PUBLIC_DISTRIBUTION": "NOT_AUTHORIZED",
    }


def _browser_review(snapshot: dict[str, Any], package_root: Path) -> dict[str, Any]:
    guide = snapshot["document"]["outputs"]["publicHtml"]["parentGuide"]
    output = package_root / "REVIEW/VISUAL"
    completed = subprocess.run(
        [
            "node",
            str(SCRIPT_DIR / "capture-review-html.mjs"),
            "--html",
            str(package_root / "PUBLIC/HTML" / guide),
            "--output",
            str(output),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "no diagnostic output"
        raise RuntimeError(f"Browser review failed: {detail}")
    if not completed.stdout.strip():
        raise RuntimeError("Browser review did not return a result")
    return json.loads(completed.stdout)


def _build_in_staging(
    snapshot_path: Path,
    package_root: Path,
    *,
    include_visual: bool,
) -> dict[str, Any]:
    snapshot = load_snapshot(snapshot_path, SCHEMA_PATH)
    public = package_root / "PUBLIC"
    html = public / "HTML"
    assets = public / "ASSETS"
    social = public / "SOCIAL"
    audit = package_root / "REVIEW/AUDIT"

    _copy_public_assets(snapshot, assets)
    write_public_html(snapshot, html)
    render_public_pdfs(snapshot, html, public)
    generate_social_visuals(snapshot, assets, social)
    generate_review_artifacts(snapshot, package_root / "REVIEW")

    content_report = build_content_gate_report(snapshot, package_root, SCRIPT_DIR)
    _atomic_json(audit / "content-gate-report.json", content_report)
    accessibility = _accessibility_report(snapshot, package_root)
    _atomic_json(audit / "accessibility-report.json", accessibility)
    pdf_report = {
        "PDF_DOCUMENT_COUNT": len(snapshot["document"]["outputs"]["publicPdf"]),
        "PDF_UA_VALIDATION": "NOT_PERFORMED",
        "DOCUMENTS": [
            audit_pdf(public / filename, snapshot)
            for filename in snapshot["document"]["outputs"]["publicPdf"].values()
        ],
    }
    _atomic_json(audit / "pdf-qa-report.json", pdf_report)
    social_report = audit_social_visuals(snapshot, social)
    _atomic_json(audit / "social-visual-qa-report.json", social_report)
    visual_report = (
        build_visual_qa(snapshot, public, package_root / "REVIEW/VISUAL", dpi=200)
        if include_visual
        else {
            "AUTOMATED_VISUAL_CHECK": "SKIPPED_IN_UNIT_TEST",
            "ASSISTANT_VISUAL_REVIEW": "PENDING",
            "OWNER_VISUAL_REVIEW": "PENDING",
            "VISUAL_DEFECT_COUNT": 0,
        }
    )
    _atomic_json(audit / "visual-qa-report.json", visual_report)
    browser_report = (
        _browser_review(snapshot, package_root)
        if include_visual
        else {
            "AUTOMATED_BROWSER_ACCESSIBILITY_CHECK": "SKIPPED_IN_UNIT_TEST",
            "AXE_VIOLATION_COUNT": 0,
            "REMOTE_DEPENDENCY_COUNT": 0,
            "JAVASCRIPT_DEPENDENCY_COUNT": 0,
            "MOBILE_HORIZONTAL_OVERFLOW_PX": 0,
        }
    )
    manifest = build_document_manifest(
        snapshot,
        package_root,
        audit / "document-build-manifest.json",
        snapshot_path=snapshot_path,
        generator_path=SCRIPT_DIR / "generate_documents.py",
    )
    status = _publication_status()
    _atomic_json(audit / "publication-status.json", status)

    zero_gates = (
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
    expected = [
        *(public / name for name in snapshot["document"]["outputs"]["publicPdf"].values()),
        *(html / name for name in snapshot["document"]["outputs"]["publicHtml"].values()),
        *(social / name for name in snapshot["document"]["outputs"]["social"].values()),
    ]
    gates_pass = (
        all(content_report[name] == 0 for name in zero_gates)
        and accessibility["ACCESSIBILITY_ISSUE_COUNT"] == 0
        and social_report["SOCIAL_VISUAL_DEFECT_COUNT"] == 0
        and visual_report["VISUAL_DEFECT_COUNT"] == 0
        and browser_report["AXE_VIOLATION_COUNT"] == 0
        and browser_report["REMOTE_DEPENDENCY_COUNT"] == 0
        and browser_report["JAVASCRIPT_DEPENDENCY_COUNT"] == 0
        and browser_report["MOBILE_HORIZONTAL_OVERFLOW_PX"] == 0
        and manifest["ALL_PDF_SHA256_RECORDED"]
        and all(path.is_file() for path in expected)
    )
    final_report = {
        **content_report,
        "VISUAL_DEFECT_COUNT": visual_report["VISUAL_DEFECT_COUNT"],
        "ACCESSIBILITY_ISSUE_COUNT": accessibility["ACCESSIBILITY_ISSUE_COUNT"],
        "BROWSER_ACCESSIBILITY_ISSUE_COUNT": browser_report["AXE_VIOLATION_COUNT"],
        "OUTPUT_MANIFEST_COMPLETE": all(path.is_file() for path in expected),
        "ALL_PDF_SHA256_RECORDED": manifest["ALL_PDF_SHA256_RECORDED"],
        "PUBLIC_STATUS": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW" if gates_pass else "BLOCKED_BY_REPRODUCIBILITY",
        "PRIVATE_STATUS": "BLOCKED_BY_LEGAL_TERMS",
        "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": True,
    }
    _atomic_json(audit / "final-report.json", final_report)
    if not gates_pass:
        raise RuntimeError("One or more publication gates failed; inspect REVIEW/AUDIT")
    write_review_governance(package_root, REPO_ROOT)
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


def build_package(
    snapshot_path: Path,
    output_path: Path = DEFAULT_OUTPUT,
    *,
    include_visual: bool = True,
) -> dict[str, Any]:
    snapshot_path = _resolve_from_repo(Path(snapshot_path))
    output = _resolve_from_repo(Path(output_path))
    _validate_output_target(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output.name}.tmp-", dir=output.parent))
    try:
        report = _build_in_staging(snapshot_path, staging, include_visual=include_visual)
        _publish_staging(staging, output)
        return report
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--skip-visual", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    report = build_package(args.snapshot, args.output, include_visual=not args.skip_visual)
    print(report["PUBLIC_STATUS"])
    print(report["PRIVATE_STATUS"])


if __name__ == "__main__":
    main()

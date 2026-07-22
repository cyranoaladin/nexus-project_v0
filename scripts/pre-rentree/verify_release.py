#!/usr/bin/env python3
"""Verify and hash-bind the complete Pré-rentrée 2026 review tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


SCRIPT_DIR = Path(__file__).resolve().parent
REVIEW_SCHEMA = SCRIPT_DIR / "schemas/review-manifest.schema.json"
APPROVAL_SCHEMA = SCRIPT_DIR / "schemas/owner-approval.schema.json"
ZERO_GATES = (
    "ACCESSIBILITY_ISSUE_COUNT",
    "BROWSER_ACCESSIBILITY_ISSUE_COUNT",
    "CONTACT_MISMATCH_COUNT",
    "DEPOSIT_LABEL_MISMATCH_COUNT",
    "HARDCODED_BUSINESS_VALUE_COUNT",
    "LEGAL_POLICY_CONFLICT_COUNT",
    "LIGATURE_CORRUPTION_COUNT",
    "MODULE_SESSION_MISMATCH_COUNT",
    "PRICE_MISMATCH_COUNT",
    "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT",
    "QR_LINK_MISMATCH_COUNT",
    "SCHEDULE_MISMATCH_COUNT",
    "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT",
    "VISUAL_DEFECT_COUNT",
)
PRIVATE_KEY_MARKER = b"".join((
    b"-----BEGIN ",
    b"(?:RSA |EC |OPENSSH )?",
    b"PRIVATE",
    b" KEY-----",
))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def _manifest_bytes(manifest: dict[str, Any]) -> bytes:
    return (json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def review_manifest_sha256(manifest: dict[str, Any]) -> str:
    return hashlib.sha256(_manifest_bytes(manifest)).hexdigest()


def _role(relative: str) -> str:
    if relative.endswith(".pdf"):
        return "PUBLIC_PDF"
    if relative.startswith("PUBLIC/HTML/"):
        return "ACCESSIBLE_HTML"
    if relative.startswith("PUBLIC/ASSETS/"):
        return "PUBLIC_ASSET"
    if relative.startswith("PUBLIC/SOCIAL/"):
        return "SOCIAL_ASSET"
    if relative.startswith("REVIEW/VISUAL/"):
        return "VISUAL_EVIDENCE"
    return "AUDIT_EVIDENCE"


def _safe_artifact_files(root: Path) -> list[Path]:
    files = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Symbolic link not allowed in review artifact: {path.relative_to(root)}")
        if path.is_file():
            files.append(path)
    return files


def _validate_final_report(root: Path) -> dict[str, Any]:
    report = _json(root / "REVIEW/AUDIT/final-report.json")
    if report.get("PUBLIC_STATUS") != "PDF_PACKAGE_READY_FOR_OWNER_REVIEW":
        raise ValueError("Public package is not ready for owner review")
    if report.get("PRIVATE_STATUS") != "BLOCKED_BY_LEGAL_TERMS":
        raise ValueError("Private contractual package must remain blocked")
    for gate in ZERO_GATES:
        if report.get(gate) != 0:
            raise ValueError(f"Final report gate failed: {gate}")
    for gate in ("OUTPUT_MANIFEST_COMPLETE", "ALL_PDF_SHA256_RECORDED"):
        if report.get(gate) is not True:
            raise ValueError(f"Final report gate failed: {gate}")
    return report


def build_review_manifest(artifact_root: Path, repo_root: Path) -> dict[str, Any]:
    artifact_root = Path(artifact_root).resolve()
    repo_root = Path(repo_root).resolve()
    _validate_final_report(artifact_root)
    snapshot_path = repo_root / "generated/pre-rentree-2026/publication.snapshot.json"
    snapshot = _json(snapshot_path)
    excluded = {
        "REVIEW/AUDIT/review-manifest.json",
        "REVIEW/AUDIT/owner-approval.template.json",
        "REVIEW/AUDIT/owner-approval.json",
    }
    artifacts = []
    for path in _safe_artifact_files(artifact_root):
        relative = path.relative_to(artifact_root).as_posix()
        if relative in excluded:
            continue
        artifacts.append({
            "path": relative,
            "role": _role(relative),
            "sha256": _sha256(path),
            "fileSize": path.stat().st_size,
        })
    manifest = {
        "schemaVersion": "1.0.0",
        "campaignId": snapshot["campaign"]["id"],
        "documentPackageVersion": snapshot["document"]["documentPackageVersion"],
        "repoSha": subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=repo_root, check=True, capture_output=True, text=True,
        ).stdout.strip(),
        "sourceRepoSha": snapshot["sourceRepoSha"],
        "snapshotSha256": _sha256(snapshot_path),
        "generatorSha256": _sha256(SCRIPT_DIR / "generate_documents.py"),
        "approvalSchemaSha256": _sha256(APPROVAL_SCHEMA),
        "publicStatus": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW",
        "privateStatus": "BLOCKED_BY_LEGAL_TERMS",
        "ownerReview": "PENDING",
        "legalReview": "PENDING",
        "privacyReview": "PENDING",
        "artifactCount": len(artifacts),
        "artifacts": artifacts,
    }
    schema = _json(REVIEW_SCHEMA)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(manifest)
    return manifest


def build_pending_approval_template(manifest: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "campaignId": manifest["campaignId"],
        "decision": "PENDING",
        "reviewManifestSha256": review_manifest_sha256(manifest),
        "repoSha": manifest["repoSha"],
        "snapshotSha256": manifest["snapshotSha256"],
        "generatorSha256": manifest["generatorSha256"],
        "reviewedBy": None,
        "reviewerRole": None,
        "decidedAt": None,
        "decisionReference": None,
        "findings": [],
    }


def evaluate_owner_approval(
    manifest: dict[str, Any], approval: dict[str, Any] | None,
) -> dict[str, Any]:
    base = {
        "PUBLIC_STATUS": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW",
        "PRIVATE_STATUS": "BLOCKED_BY_LEGAL_TERMS",
        "REVIEW_MANIFEST_SHA256": review_manifest_sha256(manifest),
        "APPROVAL_RECORD_PRESENT": approval is not None,
        "APPROVAL_RECORD_VALID": False,
        "VALIDATION_ERRORS": [],
    }
    if approval is None:
        return {**base, "OWNER_REVIEW_DECISION": "PENDING"}
    schema = _json(APPROVAL_SCHEMA)
    errors = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(approval),
        key=lambda error: list(error.path),
    )
    if errors:
        return {
            **base,
            "OWNER_REVIEW_DECISION": "INVALID",
            "VALIDATION_ERRORS": [error.message for error in errors],
        }
    bindings = {
        "reviewManifestSha256": review_manifest_sha256(manifest),
        "repoSha": manifest["repoSha"],
        "snapshotSha256": manifest["snapshotSha256"],
        "generatorSha256": manifest["generatorSha256"],
    }
    if any(approval.get(field) != value for field, value in bindings.items()):
        return {**base, "OWNER_REVIEW_DECISION": "STALE"}
    return {
        **base,
        "OWNER_REVIEW_DECISION": approval["decision"],
        "APPROVAL_RECORD_VALID": approval["decision"] in {"APPROVED", "REJECTED"},
    }


def _atomic_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        temporary.write_bytes(content)
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def write_review_governance(artifact_root: Path, repo_root: Path) -> dict[str, Any]:
    artifact_root = Path(artifact_root).resolve()
    audit = artifact_root / "REVIEW/AUDIT"
    manifest = build_review_manifest(artifact_root, repo_root)
    _atomic_bytes(audit / "review-manifest.json", _manifest_bytes(manifest))
    template = build_pending_approval_template(manifest)
    _atomic_bytes(
        audit / "owner-approval.template.json",
        (json.dumps(template, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )
    return manifest


def verify_artifact_release(artifact_root: Path, repo_root: Path) -> dict[str, Any]:
    artifact_root = Path(artifact_root).resolve()
    _validate_final_report(artifact_root)
    status = _json(artifact_root / "REVIEW/AUDIT/publication-status.json")
    browser = _json(artifact_root / "REVIEW/VISUAL/browser-accessibility-report.json")
    reproducibility = _json(artifact_root / "REVIEW/AUDIT/reproducibility-report.json")
    if browser.get("AUTOMATED_BROWSER_ACCESSIBILITY_CHECK") != "PASS":
        raise ValueError("Browser accessibility and responsive review did not pass")
    if reproducibility.get("REPRODUCIBLE_PUBLIC_BUILD") is not True:
        raise ValueError("Public document build is not reproducible")
    files = _safe_artifact_files(artifact_root)
    forbidden_sources = [path for path in files if path.suffix.lower() in {".py", ".ts", ".tsx", ".zip"}]
    forbidden_private = [
        path for path in files
        if any(part.upper() == "PRIVATE" for part in path.relative_to(artifact_root).parts)
        or "DOSSIERCONFIRMATION" in path.name.upper()
    ]
    secret_pattern = re.compile(b"|".join((
        PRIVATE_KEY_MARKER,
        rb"\bAKIA[0-9A-Z]{16}\b",
        rb"\b(?:ghp|sk)_[A-Za-z0-9]{20,}\b",
        rb"/home/[^/\s]+/",
    )))
    secret_findings = [path for path in files if secret_pattern.search(path.read_bytes())]
    if forbidden_sources or forbidden_private or secret_findings:
        raise ValueError("Release artifact contains a forbidden source, private path, or secret pattern")
    manifest = build_review_manifest(artifact_root, repo_root)
    current_path = artifact_root / "REVIEW/AUDIT/review-manifest.json"
    if current_path.is_file() and current_path.read_bytes() != _manifest_bytes(manifest):
        raise ValueError("Review manifest is stale")
    return {
        **status,
        "FORBIDDEN_SOURCE_COPY_COUNT": len(forbidden_sources),
        "FORBIDDEN_PRIVATE_PATH_COUNT": len(forbidden_private),
        "SECRET_FINDING_COUNT": len(secret_findings),
        "REPRODUCIBLE_PUBLIC_BUILD": True,
        "AUTOMATED_BROWSER_ACCESSIBILITY_CHECK": "PASS",
        "REVIEW_MANIFEST_SHA256": review_manifest_sha256(manifest),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--write-governance", action="store_true")
    parser.add_argument("--owner-approval", type=Path)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.write_governance:
        write_review_governance(args.artifact_root, args.repo_root)
    report = verify_artifact_release(args.artifact_root, args.repo_root)
    if args.owner_approval:
        manifest = build_review_manifest(args.artifact_root, args.repo_root)
        report["OWNER_APPROVAL"] = evaluate_owner_approval(manifest, _json(args.owner_approval))
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

"""Hash-bound governance helpers for the Pré-rentrée owner review."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path
from typing import Any, Iterable

from jsonschema import Draft202012Validator, FormatChecker


SCRIPT_DIR = Path(__file__).resolve().parent
GOVERNANCE_MODULE_PATH = SCRIPT_DIR / "release_governance.py"
GOVERNANCE_CLI_PATH = SCRIPT_DIR / "verify_release_approvals.py"
APPROVAL_SCHEMA_PATH = SCRIPT_DIR / "owner-approval.schema.json"

REQUIRED_AUDIT_FILES = (
    "AUDIT/accessibility-report.json",
    "AUDIT/content-gate-report.json",
    "AUDIT/document-build-manifest.json",
    "AUDIT/final-report.json",
    "AUDIT/manual-visual-review.json",
    "AUDIT/pdf-qa-report.json",
    "AUDIT/reproducibility-report.json",
    "AUDIT/social-visual-qa-report.json",
    "AUDIT/visual-qa-report.json",
)

REQUIRED_VISUAL_FILES = (
    "AUDIT/VISUAL/v4-v5-comparison-sheet.png",
    "AUDIT/VISUAL/visual-contact-sheet.png",
)

REQUIRED_ZERO_GATES = (
    "ACCESSIBILITY_ISSUE_COUNT",
    "CONTACT_MISMATCH_COUNT",
    "DEPOSIT_LABEL_MISMATCH_COUNT",
    "HARDCODED_BUSINESS_VALUE_COUNT",
    "LEGAL_POLICY_CONFLICT_COUNT",
    "MODULE_SESSION_MISMATCH_COUNT",
    "PRICE_MISMATCH_COUNT",
    "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT",
    "QR_LINK_MISMATCH_COUNT",
    "SCHEDULE_MISMATCH_COUNT",
    "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT",
    "VISUAL_DEFECT_COUNT",
)

REQUIRED_TRUE_GATES = (
    "ALL_PDF_SHA256_RECORDED",
    "OUTPUT_MANIFEST_COMPLETE",
)

EXPECTED_PUBLIC_DOCUMENT_KEYS = {
    "essential",
    "planning",
    "programPremiere",
    "programSeconde",
    "programTerminale",
    "pricing",
}

EXPECTED_SOCIAL_KEYS = {
    "altText",
    "feed",
    "monochrome",
    "story",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def _safe_file(package_root: Path, relative_path: str) -> Path:
    if not relative_path or Path(relative_path).is_absolute():
        raise ValueError(f"Invalid review artifact path: {relative_path}")
    candidate = package_root / relative_path
    current = package_root
    for part in Path(relative_path).parts:
        if part in {"", ".", ".."}:
            raise ValueError(f"Invalid review artifact path: {relative_path}")
        current = current / part
        if current.is_symlink():
            raise ValueError(f"Symbolic links are not allowed: {relative_path}")
    resolved = candidate.resolve()
    if not resolved.is_relative_to(package_root):
        raise ValueError(f"Review artifact escapes package root: {relative_path}")
    if not resolved.is_file():
        raise FileNotFoundError(f"Missing review artifact: {relative_path}")
    return resolved


def _values(mapping: Any, label: str, expected_keys: set[str]) -> tuple[str, ...]:
    if not isinstance(mapping, dict) or not mapping:
        raise ValueError(f"Snapshot has no {label} outputs")
    if set(mapping) != expected_keys:
        raise ValueError(f"Unexpected {label} output keys")
    values = tuple(mapping.values())
    if not all(isinstance(value, str) and value for value in values):
        raise ValueError(f"Snapshot has invalid {label} output names")
    if len(set(values)) != len(values):
        raise ValueError(f"Snapshot has duplicate {label} output names")
    return values


def required_review_paths(
    package_root: Path,
    snapshot: dict[str, Any],
    document_manifest: dict[str, Any],
) -> tuple[str, ...]:
    del package_root
    outputs = snapshot.get("document", {}).get("outputs", {})
    pdf_names = _values(
        outputs.get("publicPdf"),
        "public PDF",
        EXPECTED_PUBLIC_DOCUMENT_KEYS,
    )
    html_names = _values(
        outputs.get("publicHtml"),
        "public HTML",
        EXPECTED_PUBLIC_DOCUMENT_KEYS,
    )
    social_names = _values(outputs.get("social"), "social", EXPECTED_SOCIAL_KEYS)
    manifest_pdf_names = tuple(
        record.get("PDF_FILE", "")
        for record in document_manifest.get("PDF_FILES", [])
        if isinstance(record, dict)
    )
    if set(pdf_names) != set(manifest_pdf_names):
        raise ValueError("Snapshot and build manifest PDF inventories differ")
    paths: Iterable[str] = (
        *(f"PUBLIC/{name}" for name in pdf_names),
        *(f"PUBLIC/HTML/{name}" for name in html_names),
        *(f"PUBLIC/SOCIAL/{name}" for name in social_names),
        "SOURCES/publication.snapshot.json",
        "SOURCES/GENERATOR/generate_documents.py",
        *REQUIRED_AUDIT_FILES,
        *REQUIRED_VISUAL_FILES,
    )
    return tuple(sorted(set(paths)))


def _role_for_path(relative_path: str) -> str:
    if relative_path.endswith(".pdf"):
        return "PUBLIC_PDF"
    if relative_path.startswith("PUBLIC/HTML/"):
        return "ACCESSIBLE_HTML"
    if relative_path.startswith("PUBLIC/SOCIAL/"):
        return "SOCIAL_ASSET"
    if relative_path.startswith("AUDIT/VISUAL/"):
        return "VISUAL_EVIDENCE"
    if relative_path.startswith("AUDIT/"):
        return "AUDIT_EVIDENCE"
    return "REPRODUCIBILITY_SOURCE"


def build_review_manifest(package_root: Path) -> dict[str, Any]:
    package_root = Path(package_root).resolve()
    if not package_root.is_dir():
        raise FileNotFoundError(f"Missing package root: {package_root}")

    snapshot_path = _safe_file(package_root, "SOURCES/publication.snapshot.json")
    generator_path = _safe_file(package_root, "SOURCES/GENERATOR/generate_documents.py")
    build_manifest_path = _safe_file(package_root, "AUDIT/document-build-manifest.json")
    final_report_path = _safe_file(package_root, "AUDIT/final-report.json")
    snapshot = _load_json(snapshot_path)
    build_manifest = _load_json(build_manifest_path)
    final_report = _load_json(final_report_path)

    public_status = final_report.get("PUBLIC_STATUS")
    private_status = final_report.get("PRIVATE_STATUS")
    if public_status != "PDF_PACKAGE_READY_FOR_OWNER_REVIEW":
        raise ValueError(f"Unexpected public package status: {public_status}")
    if private_status != "BLOCKED_BY_LEGAL_TERMS":
        raise ValueError(f"Unexpected private package status: {private_status}")
    if final_report.get("CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED") is not True:
        raise ValueError("Private contractual dossier must remain blocked")
    for gate in REQUIRED_ZERO_GATES:
        if final_report.get(gate) != 0:
            raise ValueError(f"Final report gate failed: {gate}")
    for gate in REQUIRED_TRUE_GATES:
        if final_report.get(gate) is not True:
            raise ValueError(f"Final report gate failed: {gate}")

    snapshot_hash = sha256_file(snapshot_path)
    generator_hash = sha256_file(generator_path)
    if snapshot_hash != build_manifest.get("SNAPSHOT_SHA256"):
        raise ValueError("Snapshot hash mismatch")
    if generator_hash != build_manifest.get("GENERATOR_SHA256"):
        raise ValueError("Generator hash mismatch")

    review_paths = required_review_paths(package_root, snapshot, build_manifest)
    resolved = {relative: _safe_file(package_root, relative) for relative in review_paths}
    pdf_hashes = {
        record["PDF_FILE"]: record["PDF_SHA256"]
        for record in build_manifest.get("PDF_FILES", [])
        if isinstance(record, dict) and record.get("PDF_FILE") and record.get("PDF_SHA256")
    }
    for name, expected_hash in pdf_hashes.items():
        if sha256_file(resolved[f"PUBLIC/{name}"]) != expected_hash:
            raise ValueError(f"PDF hash mismatch: {name}")

    manual_visual = _load_json(resolved["AUDIT/manual-visual-review.json"])
    visual_bindings = {
        "CONTACT_SHEET_SHA256": "AUDIT/VISUAL/visual-contact-sheet.png",
        "V4_V5_COMPARISON_SHEET_SHA256": "AUDIT/VISUAL/v4-v5-comparison-sheet.png",
    }
    for field, relative_path in visual_bindings.items():
        if manual_visual.get(field) != sha256_file(resolved[relative_path]):
            raise ValueError(f"Manual visual hash mismatch: {field}")

    social_hashes = manual_visual.get("SOCIAL_SHA256")
    if not isinstance(social_hashes, dict):
        raise ValueError("Manual social hash evidence is missing")
    social_outputs = snapshot["document"]["outputs"]["social"]
    for key in ("feed", "story", "monochrome"):
        relative_path = f"PUBLIC/SOCIAL/{social_outputs[key]}"
        if social_hashes.get(key) != sha256_file(resolved[relative_path]):
            raise ValueError(f"Manual social hash mismatch: {key}")

    artifacts = [
        {
            "path": relative,
            "role": _role_for_path(relative),
            "sha256": sha256_file(path),
            "fileSize": path.stat().st_size,
        }
        for relative, path in sorted(resolved.items())
    ]
    return {
        "schemaVersion": "1.0.0",
        "campaignId": snapshot.get("campaign", {}).get("id"),
        "documentVersion": build_manifest.get("DOCUMENT_VERSION"),
        "repoSha": build_manifest.get("REPO_SHA"),
        "snapshotSha256": snapshot_hash,
        "generatorSha256": generator_hash,
        "governanceModuleSha256": sha256_file(GOVERNANCE_MODULE_PATH),
        "governanceCliSha256": sha256_file(GOVERNANCE_CLI_PATH),
        "approvalSchemaSha256": sha256_file(APPROVAL_SCHEMA_PATH),
        "publicStatus": public_status,
        "privateStatus": private_status,
        "contractualDossierPublicationBlocked": True,
        "artifactCount": len(artifacts),
        "artifacts": artifacts,
    }


def _json_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def review_manifest_sha256(manifest: dict[str, Any]) -> str:
    return hashlib.sha256(_json_bytes(manifest)).hexdigest()


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


def _decision_report(
    manifest: dict[str, Any],
    owner_decision: str,
    present: bool,
    valid: bool,
    errors: list[str],
    decision_reference: str | None = None,
) -> dict[str, Any]:
    return {
        "OWNER_REVIEW_DECISION": owner_decision,
        "PUBLIC_STATUS": manifest["publicStatus"],
        "PRIVATE_STATUS": manifest["privateStatus"],
        "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": manifest[
            "contractualDossierPublicationBlocked"
        ],
        "REVIEW_MANIFEST_SHA256": review_manifest_sha256(manifest),
        "APPROVAL_RECORD_PRESENT": present,
        "APPROVAL_RECORD_VALID": valid,
        "APPROVAL_DECISION_REFERENCE": decision_reference,
        "VALIDATION_ERRORS": errors,
    }


def evaluate_owner_approval(
    manifest: dict[str, Any],
    approval: dict[str, Any] | None,
    schema: dict[str, Any],
) -> dict[str, Any]:
    if approval is None:
        return _decision_report(manifest, "PENDING", False, False, [])

    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    schema_errors = sorted(validator.iter_errors(approval), key=lambda error: list(error.path))
    if schema_errors:
        errors = [
            f"/{'/'.join(str(part) for part in error.path)}: {error.message}"
            for error in schema_errors
        ]
        return _decision_report(manifest, "INVALID", True, False, errors)

    expected_bindings = {
        "campaignId": manifest["campaignId"],
        "reviewManifestSha256": review_manifest_sha256(manifest),
        "repoSha": manifest["repoSha"],
        "snapshotSha256": manifest["snapshotSha256"],
        "generatorSha256": manifest["generatorSha256"],
    }
    stale_fields = [
        field for field, expected in expected_bindings.items() if approval.get(field) != expected
    ]
    if stale_fields:
        return _decision_report(
            manifest,
            "STALE",
            True,
            False,
            [f"Approval binding mismatch: {field}" for field in stale_fields],
        )

    decision = approval["decision"]
    if decision == "PENDING":
        return _decision_report(manifest, "PENDING", True, False, [])
    return _decision_report(
        manifest,
        decision,
        True,
        True,
        [],
        decision_reference=approval["decisionReference"],
    )


def _atomic_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        temporary.write_bytes(content)
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    _atomic_bytes(Path(path), _json_bytes(value))


def write_governance_bundle(package_root: Path, schema_path: Path) -> dict[str, Any]:
    package_root = Path(package_root).resolve()
    schema_path = Path(schema_path).resolve()
    if schema_path.is_symlink() or not schema_path.is_file():
        raise FileNotFoundError(f"Missing approval schema: {schema_path}")

    manifest = build_review_manifest(package_root)
    if sha256_file(schema_path) != manifest["approvalSchemaSha256"]:
        raise ValueError("Approval schema hash mismatch")
    schema = _load_json(schema_path)
    governance_root = package_root / "AUDIT/GOVERNANCE"
    approval_path = governance_root / "owner-approval.json"
    if approval_path.is_symlink():
        raise ValueError("Symbolic links are not allowed for owner-approval.json")
    approval: dict[str, Any] | None = None
    approval_error: str | None = None
    if approval_path.exists() and not approval_path.is_file():
        approval_error = "owner-approval.json is not a regular file"
    elif approval_path.is_file():
        try:
            approval = _load_json(approval_path)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            approval_error = f"Invalid owner-approval.json: {error}"
    decision = (
        _decision_report(manifest, "INVALID", True, False, [approval_error])
        if approval_error
        else evaluate_owner_approval(manifest, approval, schema)
    )

    atomic_json(governance_root / "review-manifest.json", manifest)
    atomic_json(
        governance_root / "owner-approval.template.json",
        build_pending_approval_template(manifest),
    )
    schema_destination = governance_root / "owner-approval.schema.json"
    temporary_schema = schema_destination.with_name(
        f".{schema_destination.name}.copy-{os.getpid()}"
    )
    try:
        schema_destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(schema_path, temporary_schema)
        with temporary_schema.open("rb") as handle:
            os.fsync(handle.fileno())
        os.replace(temporary_schema, schema_destination)
    except BaseException:
        temporary_schema.unlink(missing_ok=True)
        raise
    atomic_json(governance_root / "release-decision.json", decision)
    return decision

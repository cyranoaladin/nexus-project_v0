from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from verify_release import (  # noqa: E402
    build_pending_approval_template,
    build_review_manifest,
    evaluate_owner_approval,
    review_manifest_sha256,
    verify_artifact_release,
)


REPO_ROOT = Path(__file__).resolve().parents[3]


def _write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _artifact(root: Path) -> Path:
    artifact = root / "artifact"
    (artifact / "PUBLIC/guide.pdf").parent.mkdir(parents=True)
    (artifact / "PUBLIC/guide.pdf").write_bytes(b"pdf")
    (artifact / "PUBLIC/HTML/guide.html").parent.mkdir(parents=True)
    (artifact / "PUBLIC/HTML/guide.html").write_text('<html lang="fr"></html>', encoding="utf-8")
    (artifact / "PUBLIC/ASSETS/document.css").parent.mkdir(parents=True)
    (artifact / "PUBLIC/ASSETS/document.css").write_text("body{}", encoding="utf-8")
    gates = {
        key: 0 for key in (
            "ACCESSIBILITY_ISSUE_COUNT", "CONTACT_MISMATCH_COUNT", "DEPOSIT_LABEL_MISMATCH_COUNT",
            "HARDCODED_BUSINESS_VALUE_COUNT", "LEGAL_POLICY_CONFLICT_COUNT", "MODULE_SESSION_MISMATCH_COUNT",
            "PRICE_MISMATCH_COUNT", "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT", "QR_LINK_MISMATCH_COUNT",
            "SCHEDULE_MISMATCH_COUNT", "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT", "VISUAL_DEFECT_COUNT",
        )
    }
    _write(artifact / "REVIEW/AUDIT/final-report.json", {
        **gates,
        "OUTPUT_MANIFEST_COMPLETE": True,
        "ALL_PDF_SHA256_RECORDED": True,
        "PUBLIC_STATUS": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW",
        "PRIVATE_STATUS": "BLOCKED_BY_LEGAL_TERMS",
    })
    _write(artifact / "REVIEW/AUDIT/publication-status.json", {
        "PUBLIC_DOCUMENT_PACKAGE": "READY_FOR_OWNER_REVIEW",
        "OWNER_REVIEW": "PENDING",
        "LEGAL_REVIEW": "PENDING",
        "PRIVACY_REVIEW": "PENDING",
        "PRIVATE_CONTRACTUAL_PACKAGE": "BLOCKED",
        "MERGE": "NOT_PERFORMED",
        "DEPLOYMENT": "NOT_PERFORMED",
        "PUBLIC_DISTRIBUTION": "NOT_AUTHORIZED",
    })
    return artifact


def test_review_manifest_is_sorted_hash_bound_and_excludes_itself(tmp_path: Path):
    artifact = _artifact(tmp_path)
    manifest = build_review_manifest(artifact, REPO_ROOT)

    paths = [item["path"] for item in manifest["artifacts"]]
    assert paths == sorted(paths)
    assert "REVIEW/AUDIT/review-manifest.json" not in paths
    assert manifest["artifactCount"] == len(paths)
    assert manifest["repoSha"] == __import__("subprocess").run(
        ["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, check=True, capture_output=True, text=True,
    ).stdout.strip()
    assert all(len(item["sha256"]) == 64 for item in manifest["artifacts"])


def test_pending_template_is_not_an_approval_and_has_no_identity(tmp_path: Path):
    manifest = build_review_manifest(_artifact(tmp_path), REPO_ROOT)
    template = build_pending_approval_template(manifest)
    decision = evaluate_owner_approval(manifest, None)

    assert template["decision"] == "PENDING"
    assert template["reviewedBy"] is None
    assert template["reviewerRole"] is None
    assert template["reviewManifestSha256"] == review_manifest_sha256(manifest)
    assert decision["OWNER_REVIEW_DECISION"] == "PENDING"
    assert decision["APPROVAL_RECORD_VALID"] is False


def test_changed_manifest_invalidates_a_prior_owner_approval(tmp_path: Path):
    manifest = build_review_manifest(_artifact(tmp_path), REPO_ROOT)
    approval = build_pending_approval_template(manifest)
    approval.update({
        "decision": "APPROVED",
        "reviewedBy": "Responsable Nexus",
        "reviewerRole": "Propriétaire",
        "decidedAt": "2026-07-20T12:00:00+01:00",
        "decisionReference": "OWNER-2026-001",
    })
    assert evaluate_owner_approval(manifest, approval)["OWNER_REVIEW_DECISION"] == "APPROVED"
    manifest["artifacts"][0]["sha256"] = "f" * 64
    assert evaluate_owner_approval(manifest, approval)["OWNER_REVIEW_DECISION"] == "STALE"


def test_release_verifier_keeps_external_reviews_pending(tmp_path: Path):
    artifact = _artifact(tmp_path)
    report = verify_artifact_release(artifact, REPO_ROOT)

    assert report["PUBLIC_DOCUMENT_PACKAGE"] == "READY_FOR_OWNER_REVIEW"
    assert report["OWNER_REVIEW"] == "PENDING"
    assert report["LEGAL_REVIEW"] == "PENDING"
    assert report["PRIVACY_REVIEW"] == "PENDING"
    assert report["PRIVATE_CONTRACTUAL_PACKAGE"] == "BLOCKED"
    assert report["FORBIDDEN_SOURCE_COPY_COUNT"] == 0
    assert report["FORBIDDEN_PRIVATE_PATH_COUNT"] == 0

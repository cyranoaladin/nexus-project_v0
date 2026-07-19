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


def _require(module, name: str):
    assert hasattr(module, name), f"release_governance.{name} must exist"
    return getattr(module, name)


def _load_approval_schema() -> dict:
    path = SCRIPT_DIR / "owner-approval.schema.json"
    assert path.is_file(), "owner-approval.schema.json must exist"
    return json.loads(path.read_text(encoding="utf-8"))


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


def _final_approval(module, manifest: dict, decision: str = "APPROVED") -> dict:
    manifest_hash = _require(module, "review_manifest_sha256")(manifest)
    return {
        "schemaVersion": "1.0.0",
        "campaignId": manifest["campaignId"],
        "decision": decision,
        "reviewManifestSha256": manifest_hash,
        "repoSha": manifest["repoSha"],
        "snapshotSha256": manifest["snapshotSha256"],
        "generatorSha256": manifest["generatorSha256"],
        "reviewedBy": "Responsable Nexus",
        "reviewerRole": "Propriétaire",
        "decidedAt": "2026-07-19T18:00:00+01:00",
        "decisionReference": "OWNER-PRERENTREE-2026-001",
        "findings": [],
    }


def test_absent_approval_is_pending_and_template_is_not_an_approval(review_package: Path):
    module = _load_module()
    manifest = module.build_review_manifest(review_package)
    template = _require(module, "build_pending_approval_template")(manifest)
    evaluate = _require(module, "evaluate_owner_approval")
    schema = _load_approval_schema()

    decision = evaluate(manifest, None, schema)

    assert template["decision"] == "PENDING"
    assert template["reviewedBy"] is None
    assert template["reviewManifestSha256"] == module.review_manifest_sha256(manifest)
    assert decision == {
        "OWNER_REVIEW_DECISION": "PENDING",
        "PUBLIC_STATUS": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW",
        "PRIVATE_STATUS": "BLOCKED_BY_LEGAL_TERMS",
        "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": True,
        "APPROVAL_RECORD_PRESENT": False,
        "APPROVAL_RECORD_VALID": False,
        "VALIDATION_ERRORS": [],
    }


def test_approved_owner_record_is_valid_only_for_current_manifest(review_package: Path):
    module = _load_module()
    manifest = module.build_review_manifest(review_package)
    schema = _load_approval_schema()
    approval = _final_approval(module, manifest)

    decision = module.evaluate_owner_approval(manifest, approval, schema)

    assert decision["OWNER_REVIEW_DECISION"] == "APPROVED"
    assert decision["APPROVAL_RECORD_VALID"] is True
    assert decision["PUBLIC_STATUS"] == "PDF_PACKAGE_READY_FOR_OWNER_REVIEW"
    assert decision["PRIVATE_STATUS"] == "BLOCKED_BY_LEGAL_TERMS"


def test_changed_manifest_makes_prior_approval_stale(review_package: Path):
    module = _load_module()
    manifest = module.build_review_manifest(review_package)
    schema = _load_approval_schema()
    approval = _final_approval(module, manifest)
    manifest["artifacts"][0]["sha256"] = "f" * 64

    decision = module.evaluate_owner_approval(manifest, approval, schema)

    assert decision["OWNER_REVIEW_DECISION"] == "STALE"
    assert decision["APPROVAL_RECORD_VALID"] is False


def test_rejected_and_invalid_owner_records_remain_non_approvals(review_package: Path):
    module = _load_module()
    manifest = module.build_review_manifest(review_package)
    schema = _load_approval_schema()
    rejected = _final_approval(module, manifest, decision="REJECTED")
    invalid = _final_approval(module, manifest)
    invalid["reviewedBy"] = ""

    rejected_decision = module.evaluate_owner_approval(manifest, rejected, schema)
    invalid_decision = module.evaluate_owner_approval(manifest, invalid, schema)

    assert rejected_decision["OWNER_REVIEW_DECISION"] == "REJECTED"
    assert rejected_decision["APPROVAL_RECORD_VALID"] is True
    assert invalid_decision["OWNER_REVIEW_DECISION"] == "INVALID"
    assert invalid_decision["APPROVAL_RECORD_VALID"] is False
    assert invalid_decision["VALIDATION_ERRORS"]


def test_decision_report_never_claims_automatic_distribution_authority(review_package: Path):
    module = _load_module()
    manifest = module.build_review_manifest(review_package)
    schema = _load_approval_schema()
    report = json.dumps(
        module.evaluate_owner_approval(manifest, _final_approval(module, manifest), schema),
        ensure_ascii=False,
    ).casefold()

    assert "ready_to_distribute" not in report
    assert "distribution_authorized" not in report
    assert "prêt à diffuser" not in report

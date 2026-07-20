import hashlib
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


SCRIPT_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = SCRIPT_DIR / "release_governance.py"
CLI_PATH = SCRIPT_DIR / "verify_release_approvals.py"


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
    path = SCRIPT_DIR / "schemas/owner-approval.schema.json"
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
    public_pdf = {
        "essential": "Nexus_Public.pdf",
        "planning": "Nexus_Planning.pdf",
        "programSeconde": "Nexus_Seconde.pdf",
        "programPremiere": "Nexus_Premiere.pdf",
        "programTerminale": "Nexus_Terminale.pdf",
        "pricing": "Nexus_Tarifs.pdf",
    }
    public_html = {
        key: filename.removesuffix(".pdf") + ".html"
        for key, filename in public_pdf.items()
    }
    social = {
        "feed": "feed.png",
        "story": "story.png",
        "monochrome": "monochrome.png",
        "altText": "alt.json",
    }
    pdf = package / "PUBLIC" / public_pdf["essential"]
    html = package / "PUBLIC/HTML" / public_html["essential"]
    feed = package / "PUBLIC/SOCIAL" / social["feed"]
    alt = package / "PUBLIC/SOCIAL" / social["altText"]
    generator = package / "SOURCES/GENERATOR/generate_documents.py"
    contact_sheet = package / "AUDIT/VISUAL/visual-contact-sheet.png"
    comparison_sheet = package / "AUDIT/VISUAL/v4-v5-comparison-sheet.png"

    for filename in public_pdf.values():
        path = package / "PUBLIC" / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"canonical-pdf:{filename}".encode("utf-8"))
    for filename in public_html.values():
        path = package / "PUBLIC/HTML" / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"<html lang='fr'><h1>{filename}</h1></html>".encode("utf-8"))
    for filename in social.values():
        path = package / "PUBLIC/SOCIAL" / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"social:{filename}".encode("utf-8"))

    for path, content in (
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
                    "publicPdf": public_pdf,
                    "publicHtml": public_html,
                    "social": social,
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
            "PDF_FILES": [
                {
                    "PDF_FILE": filename,
                    "PDF_SHA256": _sha256(package / "PUBLIC" / filename),
                }
                for filename in public_pdf.values()
            ],
        },
    )
    _write_json(
        package / "AUDIT/final-report.json",
        {
            "PUBLIC_STATUS": "PDF_PACKAGE_READY_FOR_OWNER_REVIEW",
            "PRIVATE_STATUS": "BLOCKED_BY_LEGAL_TERMS",
            "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": True,
            "MODULE_SESSION_MISMATCH_COUNT": 0,
            "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT": 0,
            "LEGAL_POLICY_CONFLICT_COUNT": 0,
            "HARDCODED_BUSINESS_VALUE_COUNT": 0,
            "PRICE_MISMATCH_COUNT": 0,
            "DEPOSIT_LABEL_MISMATCH_COUNT": 0,
            "SCHEDULE_MISMATCH_COUNT": 0,
            "CONTACT_MISMATCH_COUNT": 0,
            "QR_LINK_MISMATCH_COUNT": 0,
            "VISUAL_DEFECT_COUNT": 0,
            "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT": 0,
            "ACCESSIBILITY_ISSUE_COUNT": 0,
            "OUTPUT_MANIFEST_COMPLETE": True,
            "ALL_PDF_SHA256_RECORDED": True,
        },
    )
    for name in (
        "content-gate-report.json",
        "pdf-qa-report.json",
        "reproducibility-report.json",
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
            "SOCIAL_SHA256": {
                key: _sha256(package / "PUBLIC/SOCIAL" / social[key])
                for key in ("feed", "story", "monochrome")
            },
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
    assert manifest["governanceModuleSha256"] == _sha256(MODULE_PATH)
    assert manifest["governanceCliSha256"] == _sha256(CLI_PATH)
    assert manifest["approvalSchemaSha256"] == _sha256(
        SCRIPT_DIR / "schemas/owner-approval.schema.json"
    )
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
        "AUDIT/reproducibility-report.json",
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


def test_build_review_manifest_rejects_failed_public_gate(review_package: Path):
    module = _load_module()
    final_report_path = review_package / "AUDIT/final-report.json"
    final_report = json.loads(final_report_path.read_text(encoding="utf-8"))
    final_report["PRICE_MISMATCH_COUNT"] = 1
    _write_json(final_report_path, final_report)

    with pytest.raises(ValueError, match="Final report gate failed: PRICE_MISMATCH_COUNT"):
        module.build_review_manifest(review_package)


def test_build_review_manifest_requires_exact_public_output_keys(review_package: Path):
    module = _load_module()
    snapshot_path = review_package / "SOURCES/publication.snapshot.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    snapshot["document"]["outputs"]["publicHtml"].pop("programTerminale")
    _write_json(snapshot_path, snapshot)
    build_manifest_path = review_package / "AUDIT/document-build-manifest.json"
    build_manifest = json.loads(build_manifest_path.read_text(encoding="utf-8"))
    build_manifest["SNAPSHOT_SHA256"] = _sha256(snapshot_path)
    _write_json(build_manifest_path, build_manifest)

    with pytest.raises(ValueError, match="Unexpected public HTML output keys"):
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


def test_build_review_manifest_rejects_stale_manual_visual_evidence(review_package: Path):
    module = _load_module()
    (review_package / "AUDIT/VISUAL/visual-contact-sheet.png").write_bytes(b"changed")

    with pytest.raises(ValueError, match="Manual visual hash mismatch"):
        module.build_review_manifest(review_package)


def test_build_review_manifest_rejects_stale_manual_social_evidence(review_package: Path):
    module = _load_module()
    (review_package / "PUBLIC/SOCIAL/feed.png").write_bytes(b"changed")

    with pytest.raises(ValueError, match="Manual social hash mismatch: feed"):
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
        "REVIEW_MANIFEST_SHA256": module.review_manifest_sha256(manifest),
        "APPROVAL_RECORD_PRESENT": False,
        "APPROVAL_RECORD_VALID": False,
        "APPROVAL_DECISION_REFERENCE": None,
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
    assert decision["APPROVAL_DECISION_REFERENCE"] == "OWNER-PRERENTREE-2026-001"
    assert decision["REVIEW_MANIFEST_SHA256"] == module.review_manifest_sha256(manifest)
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


def test_writes_pending_governance_bundle_without_human_approval(review_package: Path):
    module = _load_module()
    write_bundle = _require(module, "write_governance_bundle")

    decision = write_bundle(review_package, SCRIPT_DIR / "schemas/owner-approval.schema.json")

    governance = review_package / "AUDIT/GOVERNANCE"
    assert decision["OWNER_REVIEW_DECISION"] == "PENDING"
    assert {
        "review-manifest.json",
        "owner-approval.template.json",
        "owner-approval.schema.json",
        "release-decision.json",
    } == {path.name for path in governance.iterdir()}
    assert json.loads((governance / "owner-approval.template.json").read_text(encoding="utf-8"))[
        "decision"
    ] == "PENDING"


def test_approval_binding_is_the_sha256_of_the_exact_review_manifest_file(review_package: Path):
    module = _load_module()
    module.write_governance_bundle(review_package, SCRIPT_DIR / "schemas/owner-approval.schema.json")
    governance = review_package / "AUDIT/GOVERNANCE"
    template = json.loads(
        (governance / "owner-approval.template.json").read_text(encoding="utf-8")
    )

    assert template["reviewManifestSha256"] == _sha256(
        governance / "review-manifest.json"
    )


def test_governance_bundle_never_overwrites_human_approval(review_package: Path):
    module = _load_module()
    manifest = module.build_review_manifest(review_package)
    governance = review_package / "AUDIT/GOVERNANCE"
    approval_path = governance / "owner-approval.json"
    approval = _final_approval(module, manifest)
    _write_json(approval_path, approval)
    before = approval_path.read_bytes()

    decision = module.write_governance_bundle(
        review_package,
        SCRIPT_DIR / "schemas/owner-approval.schema.json",
    )

    assert approval_path.read_bytes() == before
    assert decision["OWNER_REVIEW_DECISION"] == "APPROVED"


def test_malformed_human_approval_is_reported_invalid_without_overwrite(review_package: Path):
    module = _load_module()
    approval_path = review_package / "AUDIT/GOVERNANCE/owner-approval.json"
    approval_path.parent.mkdir(parents=True, exist_ok=True)
    approval_path.write_text("{not-json", encoding="utf-8")
    before = approval_path.read_bytes()

    decision = module.write_governance_bundle(
        review_package,
        SCRIPT_DIR / "schemas/owner-approval.schema.json",
    )

    assert decision["OWNER_REVIEW_DECISION"] == "INVALID"
    assert decision["APPROVAL_RECORD_PRESENT"] is True
    assert decision["VALIDATION_ERRORS"]
    assert approval_path.read_bytes() == before


def test_governance_bundle_rejects_unbound_approval_schema(review_package: Path, tmp_path: Path):
    module = _load_module()
    alternate_schema = tmp_path / "alternate.schema.json"
    alternate_schema.write_text('{"type":"object"}\n', encoding="utf-8")

    with pytest.raises(ValueError, match="Approval schema hash mismatch"):
        module.write_governance_bundle(review_package, alternate_schema)


def test_atomic_json_cleans_temporary_file_when_replace_fails(tmp_path: Path, monkeypatch):
    module = _load_module()
    atomic_json = _require(module, "atomic_json")
    destination = tmp_path / "record.json"

    def fail_replace(_source, _destination):
        raise OSError("replace failed")

    monkeypatch.setattr(module.os, "replace", fail_replace)
    with pytest.raises(OSError, match="replace failed"):
        atomic_json(destination, {"value": 1})

    assert not list(tmp_path.glob(".record.json.tmp-*"))


def test_cli_is_cwd_independent_and_strict_mode_blocks_pending(
    review_package: Path,
    tmp_path: Path,
):
    assert CLI_PATH.is_file(), "verify_release_approvals.py must exist"
    package_from_repo = os.path.relpath(review_package, REPO_ROOT)
    command = [sys.executable, str(CLI_PATH), "--package", package_from_repo]

    normal = subprocess.run(command, cwd=tmp_path, capture_output=True, text=True)
    strict = subprocess.run(
        [*command, "--require-owner-approval"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )

    assert normal.returncode == 0
    assert "OWNER_REVIEW_DECISION=PENDING" in normal.stdout
    assert strict.returncode == 3
    assert "OWNER_REVIEW_DECISION=PENDING" in strict.stdout


def test_cli_strict_mode_accepts_current_approved_record(review_package: Path, tmp_path: Path):
    assert CLI_PATH.is_file(), "verify_release_approvals.py must exist"
    module = _load_module()
    manifest = module.build_review_manifest(review_package)
    _write_json(
        review_package / "AUDIT/GOVERNANCE/owner-approval.json",
        _final_approval(module, manifest),
    )
    package_from_repo = os.path.relpath(review_package, REPO_ROOT)

    completed = subprocess.run(
        [
            sys.executable,
            str(CLI_PATH),
            "--package",
            package_from_repo,
            "--require-owner-approval",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0
    assert "OWNER_REVIEW_DECISION=APPROVED" in completed.stdout


def test_operational_review_kit_is_explicitly_non_public_and_not_approved():
    operations = REPO_ROOT / "docs/operations/pre-rentree-2026"
    expected = {
        "README.md",
        "owner-review-checklist.md",
        "legal-review-request.md",
        "privacy-review-request.md",
    }
    assert operations.is_dir(), "operational review kit must exist"
    assert expected == {path.name for path in operations.iterdir() if path.is_file()}
    for name in expected:
        text = (operations / name).read_text(encoding="utf-8")
        assert "NON PUBLIC" in text
        assert "STATUS: APPROVED" not in text


def test_owner_checklist_covers_every_public_output_and_hash_bound_decision():
    checklist = (
        REPO_ROOT / "docs/operations/pre-rentree-2026/owner-review-checklist.md"
    ).read_text(encoding="utf-8")
    snapshot = json.loads(
        (REPO_ROOT / "generated/pre-rentree-2026-publication.snapshot.json").read_text(
            encoding="utf-8"
        )
    )

    for group in ("publicPdf", "publicHtml", "social"):
        for filename in snapshot["document"]["outputs"][group].values():
            assert filename in checklist
    assert "reviewManifestSha256" in checklist
    assert "owner-approval.json" in checklist


def test_legal_request_lists_decision_options_and_required_approval_metadata():
    request = (
        REPO_ROOT / "docs/operations/pre-rentree-2026/legal-review-request.md"
    ).read_text(encoding="utf-8")

    for marker in ("À APPROUVER", "À CORRIGER", "À REFUSER"):
        assert marker in request
    for field in (
        "TERMS_VERSION",
        "EFFECTIVE_DATE",
        "OWNER_APPROVAL_REFERENCE",
        "LEGAL_APPROVAL_REFERENCE",
    ):
        assert field in request
    assert "NON CANONIQUE" in request


def test_privacy_request_covers_complete_versioned_notice_fields():
    request = (
        REPO_ROOT / "docs/operations/pre-rentree-2026/privacy-review-request.md"
    ).read_text(encoding="utf-8").casefold()

    for expected in (
        "responsable de traitement",
        "finalités",
        "base juridique",
        "obligatoire ou facultatif",
        "destinataires",
        "durée de conservation",
        "droits",
        "contact",
        "version",
    ):
        assert expected in request


def test_review_kit_does_not_create_missing_canonical_legal_source():
    assert not (
        REPO_ROOT / "docs/legal/pre-rentree-2026-commercial-terms-gap-analysis.md"
    ).exists()

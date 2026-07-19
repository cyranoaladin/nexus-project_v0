import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from generate_documents import (  # noqa: E402
    _copy_reproducible_sources,
    _validate_output_target,
    build_package,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = REPO_ROOT / "generated/pre-rentree-2026-publication.snapshot.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture(scope="module")
def built_package(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("atomic-build") / "outputs-v5-canonical"
    before = {path.name: sha256(path) for path in sorted((REPO_ROOT.parent / "outputs").glob("*.pdf"))}
    build_package(SNAPSHOT, output)
    assert {path.name: sha256(path) for path in sorted((REPO_ROOT.parent / "outputs").glob("*.pdf"))} == before
    return output


def test_builds_complete_public_tree_and_legally_blocks_private_pdfs(built_package: Path):
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))

    assert {path.name for path in (built_package / "PUBLIC").glob("*.pdf")} == set(
        snapshot["document"]["outputs"]["publicPdf"].values()
    )
    assert {path.name for path in (built_package / "PUBLIC/HTML").glob("*.html")} == set(
        snapshot["document"]["outputs"]["publicHtml"].values()
    )
    assert {path.name for path in (built_package / "PUBLIC/SOCIAL").iterdir()} == set(
        snapshot["document"]["outputs"]["social"].values()
    )
    assert not list((built_package / "PRIVATE").glob("*.pdf"))
    private_status = json.loads((built_package / "PRIVATE/publication-blocked.json").read_text(encoding="utf-8"))
    assert private_status["CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED"] is True
    assert private_status["STATUS"] == "BLOCKED_BY_LEGAL_TERMS"


def test_copies_reproducible_sources_and_records_all_final_gates(built_package: Path):
    required_sources = (
        "publication.snapshot.json",
        "publication-snapshot.schema.json",
        "GENERATOR/generate_documents.py",
        "CSS/document.css",
        "HTML/PRIVATE_TEMPLATE/DossierConfirmation_STRUCTURE_NON_PUBLIABLE.html",
        "requirements.lock",
    )
    assert all((built_package / "SOURCES" / relative).is_file() for relative in required_sources)
    assert any((built_package / "SOURCES/TESTS").glob("test_*.py"))
    assert {
        "build-publication-snapshot.ts",
        "publication-derivations.ts",
        "publication-snapshot-schema.ts",
        "publication-sources.ts",
    } <= {path.name for path in (built_package / "SOURCES/GENERATOR").glob("*.ts")}

    final_report = json.loads((built_package / "AUDIT/final-report.json").read_text(encoding="utf-8"))
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
        "VISUAL_DEFECT_COUNT",
        "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT",
        "ACCESSIBILITY_ISSUE_COUNT",
    )
    assert {key: final_report[key] for key in zero_gates} == {key: 0 for key in zero_gates}
    assert final_report["OUTPUT_MANIFEST_COMPLETE"] is True
    assert final_report["ALL_PDF_SHA256_RECORDED"] is True
    assert final_report["PUBLIC_STATUS"] == "PDF_PACKAGE_READY_FOR_OWNER_REVIEW"
    assert final_report["PRIVATE_STATUS"] == "BLOCKED_BY_LEGAL_TERMS"


def test_cli_is_independent_of_current_working_directory(tmp_path: Path):
    output = tmp_path / "cli-output"
    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_DIR / "generate_documents.py"),
            "--snapshot",
            "generated/pre-rentree-2026-publication.snapshot.json",
            "--output",
            str(output),
        ],
        cwd=tmp_path,
        check=True,
        capture_output=True,
        text=True,
    )
    assert output.is_dir()
    assert "PDF_PACKAGE_READY_FOR_OWNER_REVIEW" in completed.stdout


def test_failed_build_cleans_temporary_directories_and_preserves_existing_output(tmp_path: Path):
    invalid_snapshot = tmp_path / "invalid.json"
    invalid_snapshot.write_text("{}", encoding="utf-8")
    output = tmp_path / "existing-output"
    output.mkdir()
    sentinel = output / "sentinel.txt"
    sentinel.write_text("unchanged", encoding="utf-8")

    with pytest.raises(Exception):
        build_package(invalid_snapshot, output)

    assert sentinel.read_text(encoding="utf-8") == "unchanged"
    assert not list(tmp_path.glob(".existing-output.tmp-*"))


def test_rejects_output_anywhere_inside_git_metadata():
    with pytest.raises(ValueError, match="Unsafe output target"):
        _validate_output_target(REPO_ROOT / ".git" / "nested-output")


def test_reproducible_source_inventory_is_explicit_and_excludes_governance_sidecars(
    tmp_path: Path,
):
    package = tmp_path / "package"

    _copy_reproducible_sources(SNAPSHOT, package)

    assert {path.name for path in (package / "SOURCES/GENERATOR").glob("*.py")} == {
        "audit_v4.py",
        "document_assets.py",
        "document_audit.py",
        "document_model.py",
        "document_renderer.py",
        "document_templates.py",
        "generate_documents.py",
    }
    assert {path.name for path in (package / "SOURCES/GENERATOR").glob("*.ts")} == {
        "build-publication-snapshot.ts",
        "publication-derivations.ts",
        "publication-snapshot-schema.ts",
        "publication-sources.ts",
    }
    assert {path.name for path in (package / "SOURCES/TESTS").glob("test_*.py")} == {
        "test_audit_v4.py",
        "test_document_assets.py",
        "test_document_audit.py",
        "test_document_model.py",
        "test_document_renderer.py",
        "test_document_templates.py",
        "test_generate_documents.py",
        "test_visual_audit.py",
    }

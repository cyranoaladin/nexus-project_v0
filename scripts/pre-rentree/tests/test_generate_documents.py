import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from generate_documents import (  # noqa: E402
    _validate_output_target,
    build_package,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = REPO_ROOT / "generated/pre-rentree-2026/publication.snapshot.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture(scope="module")
def built_package(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("atomic-build") / "pre-rentree-2026"
    before = {path.name: sha256(path) for path in sorted((REPO_ROOT.parent / "outputs").glob("*.pdf"))}
    build_package(SNAPSHOT, output, include_visual=False)
    assert {path.name: sha256(path) for path in sorted((REPO_ROOT.parent / "outputs").glob("*.pdf"))} == before
    return output


def test_builds_complete_public_tree_and_records_private_package_block(built_package: Path):
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
    assert (built_package / "PUBLIC/ASSETS/document.css").is_file()
    assert not (built_package / "SOURCES").exists()
    assert not (built_package / "PRIVATE").exists()
    assert not list(built_package.rglob("*DossierConfirmation*"))
    status = json.loads((built_package / "REVIEW/AUDIT/publication-status.json").read_text(encoding="utf-8"))
    assert status["PUBLIC_DOCUMENT_PACKAGE"] == "READY_FOR_OWNER_REVIEW"
    assert status["OWNER_REVIEW"] == "PENDING"
    assert status["LEGAL_REVIEW"] == "PENDING"
    assert status["PRIVACY_REVIEW"] == "PENDING"
    assert status["PRIVATE_CONTRACTUAL_PACKAGE"] == "BLOCKED"
    assert status["MERGE"] == "NOT_PERFORMED"
    assert status["DEPLOYMENT"] == "NOT_PERFORMED"
    assert status["PUBLIC_DISTRIBUTION"] == "NOT_AUTHORIZED"


def test_records_all_final_gates_without_copying_repository_sources(built_package: Path):
    final_report = json.loads((built_package / "REVIEW/AUDIT/final-report.json").read_text(encoding="utf-8"))
    zero_gates = (
        "MODULE_SESSION_MISMATCH_COUNT",
        "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT",
        "LEGAL_POLICY_CONFLICT_COUNT",
        "LIGATURE_CORRUPTION_COUNT",
        "HARDCODED_BUSINESS_VALUE_COUNT",
        "PRICE_MISMATCH_COUNT",
        "DEPOSIT_LABEL_MISMATCH_COUNT",
        "SCHEDULE_MISMATCH_COUNT",
        "CONTACT_MISMATCH_COUNT",
        "QR_LINK_MISMATCH_COUNT",
        "VISUAL_DEFECT_COUNT",
        "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT",
        "ACCESSIBILITY_ISSUE_COUNT",
        "BROWSER_ACCESSIBILITY_ISSUE_COUNT",
    )
    assert {key: final_report[key] for key in zero_gates} == {key: 0 for key in zero_gates}
    assert final_report["OUTPUT_MANIFEST_COMPLETE"] is True
    assert final_report["ALL_PDF_SHA256_RECORDED"] is True
    assert final_report["PUBLIC_STATUS"] == "PDF_PACKAGE_READY_FOR_OWNER_REVIEW"
    assert final_report["PRIVATE_STATUS"] == "BLOCKED_BY_LEGAL_TERMS"
    forbidden_suffixes = {".py", ".ts", ".tsx", ".jsonc"}
    copied_source_files = [path for path in built_package.rglob("*") if path.suffix in forbidden_suffixes]
    assert copied_source_files == []


def test_cli_is_independent_of_current_working_directory(tmp_path: Path):
    output = tmp_path / "cli-output"
    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_DIR / "generate_documents.py"),
            "--snapshot",
            "generated/pre-rentree-2026/publication.snapshot.json",
            "--output",
            str(output),
            "--skip-visual",
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


def test_build_contains_no_duplicate_generator_test_or_css_copy(built_package: Path):
    assert not list(built_package.rglob("*.py"))
    assert not list(built_package.rglob("*.ts"))
    assert list(built_package.rglob("document.css")) == [built_package / "PUBLIC/ASSETS/document.css"]

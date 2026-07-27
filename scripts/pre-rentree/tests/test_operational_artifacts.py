import csv
import json
import sys
import zipfile
from pathlib import Path

import pytest

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from generate_documents import build_package  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = REPO_ROOT / ".artifacts/pre-rentree-2026/publication.snapshot.json"


@pytest.fixture(scope="module")
def review_build(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("operations-build") / "review"
    build_package(SNAPSHOT, output, include_visual=False)
    return output


def test_materializes_all_pedagogy_review_artifacts(review_build: Path):
    pedagogy = review_build / "REVIEW/PEDAGOGY"
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    expected_module_count = len(snapshot["modules"])
    expected_session_count = sum(len(module["sessions"]) for module in snapshot["modules"])
    assert len(list((pedagogy / "POSITIONING_TESTS").glob("*.html"))) == expected_module_count
    assert len(list((pedagogy / "QUICK_ASSESSMENTS").glob("*.html"))) == expected_session_count
    assert len(list((pedagogy / "SESSION_DELIVERABLES").glob("*.html"))) == expected_session_count
    manifest = json.loads((pedagogy / "pedagogy-artifact-manifest.json").read_text(encoding="utf-8"))
    assert manifest["POSITIONING_TEST_COUNT"] == expected_module_count
    assert manifest["QUICK_ASSESSMENT_COUNT"] == expected_session_count
    assert manifest["SESSION_DELIVERABLE_COUNT"] == expected_session_count
    assert manifest["CONTAINS_REAL_PII"] is False


def test_generates_review_only_communication_and_anonymous_workflow_assets(review_build: Path):
    communication = review_build / "REVIEW/COMMUNICATION"
    operations = review_build / "REVIEW/OPERATIONS"
    assert (communication / "Kit_WhatsApp_PreRentree2026.html").is_file()
    assert (communication / "Kit_Facebook_Instagram_PreRentree2026.html").is_file()
    manifest = json.loads((communication / "communication-manifest.json").read_text(encoding="utf-8"))
    assert manifest == {
        "WHATSAPP_SCRIPT_COUNT": 24,
        "PUBLICATION_COUNT": 13,
        "CAROUSEL_COUNT": 8,
        "STORY_COUNT": 12,
        "REEL_COUNT": 3,
        "PUBLICATION_AUTHORIZED": False,
    }
    forms = (operations / "Dossier_Inscription_Confirmation_REVIEW.html").read_text(encoding="utf-8")
    assert forms.count('class="review-form"') == 11
    assert "Aucune donnée nominative réelle" in forms
    assert not (review_build / "PRIVATE").exists()


def test_generates_blank_crm_template_and_explicit_economic_workbook(review_build: Path):
    operations = review_build / "REVIEW/OPERATIONS"
    crm_path = operations / "CRM_PreRentree2026_TEMPLATE.csv"
    with crm_path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))
    assert len(rows) == 1
    assert {"leadId", "status", "expectedDeposit", "receivedDeposit", "manualDelivered"}.issubset(rows[0])

    workbook = operations / "Modele_economique_prerentree_Nexus_2026_v2.xlsx"
    assert workbook.is_file()
    with zipfile.ZipFile(workbook) as archive:
        names = set(archive.namelist())
        assert {
            "xl/worksheets/sheet1.xml",
            "xl/worksheets/sheet2.xml",
            "xl/worksheets/sheet3.xml",
            "xl/workbook.xml",
        }.issubset(names)
        hypotheses = archive.read("xl/worksheets/sheet1.xml").decode("utf-8")
        scenarios = archive.read("xl/worksheets/sheet3.xml").decode("utf-8")
    assert "À renseigner" in hypotheses
    assert hypotheses.count("À renseigner") >= 15
    assert scenarios.count("&lt;f&gt;") == 0
    assert scenarios.count("<f>") >= 10


def test_records_structural_dry_run_without_claiming_operational_readiness(review_build: Path):
    report = json.loads(
        (review_build / "REVIEW/OPERATIONS/anonymous-dry-run-report.json").read_text(encoding="utf-8")
    )
    assert report["ANONYMOUS_STRUCTURAL_DRY_RUN"] == "PASS"
    assert report["REAL_STUDENT_DRY_RUN"] == "NOT_PERFORMED"
    assert report["OPERATIONALLY_READY"] is False
    assert report["OWNER_APPROVED"] is False
    assert report["PRIVACY_APPROVED"] is False

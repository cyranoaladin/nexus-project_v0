import csv
import hashlib
import json
import sys
from pathlib import Path

import pytest

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from audit_v4 import REQUIRED_CLAIM_TYPES, build_v4_audit  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]
V4_ROOT = REPO_ROOT.parent
SNAPSHOT = REPO_ROOT / "generated/pre-rentree-2026/publication.snapshot.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_builds_exact_v4_manifest_without_changing_inputs(tmp_path: Path):
    pdfs = sorted((V4_ROOT / "outputs").glob("*.pdf"))
    before = {path.name: sha256(path) for path in pdfs}

    result = build_v4_audit(REPO_ROOT, V4_ROOT, SNAPSHOT, tmp_path)

    manifest = json.loads(result.manifest_path.read_text(encoding="utf-8"))
    assert manifest["REPO_SHA"] == "a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0"
    assert manifest["CAMPAIGN_VERSION"] == "1.0.0"
    assert manifest["MODULES_VERSION"] == "2026-pre-rentree-v1"
    assert manifest["PRICING_VERSION"] == "2026-2027.2"
    assert manifest["LEGAL_SOURCE_STATUS"] == "MISSING_APPROVED_COMMERCIAL_TERMS"
    assert manifest["V4_ARTIFACT_COUNT"] == 7
    assert len(manifest["v4Pdfs"]) == 7
    assert all(len(item["sha256"]) == 64 for item in manifest["v4Pdfs"])
    assert {item["role"] for item in manifest["v4Generators"]} == {
        "PRIMARY_GENERATOR",
        "SEPARATE_ESSENTIEL_PIPELINE",
    }
    assert {path.name: sha256(path) for path in pdfs} == before


def test_claim_matrix_has_required_columns_pages_and_claim_type_coverage(tmp_path: Path):
    result = build_v4_audit(REPO_ROOT, V4_ROOT, SNAPSHOT, tmp_path)

    with result.claim_matrix_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    assert rows
    assert list(rows[0]) == [
        "DOCUMENT",
        "PAGE",
        "CLAIM",
        "CLAIM_TYPE",
        "CANONICAL_SOURCE",
        "CANONICAL_VALUE",
        "MATCH",
        "SEVERITY",
        "ACTION",
    ]
    assert {row["CLAIM_TYPE"] for row in rows}.issuperset(REQUIRED_CLAIM_TYPES)
    assert all(row["DOCUMENT"] for row in rows)
    assert all(row["PAGE"].isdigit() for row in rows)
    assert any(row["MATCH"] == "false" and row["SEVERITY"] == "CRITICAL" for row in rows)
    assert any("Réserver" in row["CLAIM"] or "réserver" in row["CLAIM"] for row in rows)


def test_claim_matrix_is_deterministic(tmp_path: Path):
    first = build_v4_audit(REPO_ROOT, V4_ROOT, SNAPSHOT, tmp_path / "first")
    second = build_v4_audit(REPO_ROOT, V4_ROOT, SNAPSHOT, tmp_path / "second")

    assert first.claim_matrix_path.read_bytes() == second.claim_matrix_path.read_bytes()


def test_rejects_an_incomplete_v4_directory(tmp_path: Path):
    with pytest.raises(ValueError, match="exactly seven v4 PDFs"):
        build_v4_audit(REPO_ROOT, tmp_path, SNAPSHOT, tmp_path / "audit")

import csv
import json
import os
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
PEDAGOGY_SCRIPTS = REPO_ROOT / "scripts/pre-rentree/pedagogy"
sys.path.insert(0, str(PEDAGOGY_SCRIPTS))

from build_pedagogy_manifest import (
    FINAL_CSV_NAME,
    FINAL_JSON_NAME,
    MACHINE_DECISIONS_NAME,
    build_pedagogy_manifest,
    compare_candidate_group,
    find_exact_duplicate_groups,
    normalized_content,
    write_manifest_outputs,
)
from classification import FINAL_CLASSIFICATIONS, PENDING_DEDUPLICATION
from import_pedagogy_corpus import build_inventory


def test_normalized_comparisons_cover_structured_csv_and_markdown_content(tmp_path: Path):
    yaml_a = tmp_path / "a.yaml"
    yaml_b = tmp_path / "b.yaml"
    yaml_a.write_text("module: maths\nitems:\n  - id: 1\n    valid: true\n", encoding="utf-8")
    yaml_b.write_text("items: [{valid: true, id: 1}]\nmodule: maths\n", encoding="utf-8")

    json_a = tmp_path / "a.json"
    json_b = tmp_path / "b.json"
    json_a.write_text('{"modules":[{"id":"a"}],"version":1}\n', encoding="utf-8")
    json_b.write_text('{"version":1,"modules":[{"id":"a"}]}\n', encoding="utf-8")

    csv_a = tmp_path / "a.csv"
    csv_b = tmp_path / "b.csv"
    csv_a.write_text(" id ,level \na,4e\nb,3e\n", encoding="utf-8")
    csv_b.write_text("level,id\n3e,b\n4e,a\n", encoding="utf-8")

    markdown_a = tmp_path / "a.md"
    markdown_b = tmp_path / "b.md"
    markdown_a.write_bytes("# Titre  \r\n\r\nTexte\r\n".encode())
    markdown_b.write_text("# Titre\n\nTexte\n", encoding="utf-8")

    assert normalized_content(yaml_a) == normalized_content(yaml_b)
    assert normalized_content(json_a) == normalized_content(json_b)
    assert normalized_content(csv_a) == normalized_content(csv_b)
    assert normalized_content(markdown_a) == normalized_content(markdown_b)


def test_exact_duplicate_groups_are_derived_from_hashes_not_fixed_counts(tmp_path: Path):
    import_root = tmp_path / "import"
    package = import_root / "package"
    package.mkdir(parents=True)
    (package / "a.md").write_text("same\n", encoding="utf-8")
    (package / "b.md").write_text("same\n", encoding="utf-8")
    (package / "c.md").write_text("same\n", encoding="utf-8")
    (package / "different.md").write_text("different\n", encoding="utf-8")
    inventory = build_inventory(import_root)

    groups = find_exact_duplicate_groups(inventory["files"])

    assert len(groups) == 1
    assert groups[0]["member_count"] == 3
    assert groups[0]["excess_copy_count"] == 2
    assert groups[0]["members"] == [
        "package/a.md",
        "package/b.md",
        "package/c.md",
    ]


def test_divergent_candidates_require_explicit_evidence_before_selection(tmp_path: Path):
    old = tmp_path / "old" / "module.yaml"
    candidate = tmp_path / "candidate" / "module.yaml"
    old.parent.mkdir()
    candidate.parent.mkdir()
    old.write_text("id: module\nstatus: historical\n", encoding="utf-8")
    candidate.write_text("id: module\nstatus: corrected\n", encoding="utf-8")

    unresolved = compare_candidate_group([old, candidate])

    assert unresolved["selected"] is None
    assert unresolved["classification"] == "CONFLICT_REVIEW_REQUIRED"
    assert unresolved["comparison"] == "DIVERGENT"

    resolved = compare_candidate_group(
        [old, candidate],
        preferred_path=candidate,
        evidence={
            "structural_validation": "PASS",
            "qa_reference": "fixture QA",
            "diff_summary": {"status": ["historical", "corrected"]},
        },
    )

    assert resolved["selected"] == candidate.as_posix()
    assert resolved["classification"] == "CANONICAL_SOURCE"
    assert resolved["comparison"] == "DIVERGENT_WITH_SELECTION_EVIDENCE"


def _historical_root() -> Path:
    configured = os.environ.get("PRE_RENTREE_PEDAGOGY_IMPORT_ROOT")
    if not configured:
        pytest.skip("PRE_RENTREE_PEDAGOGY_IMPORT_ROOT is required for the real-corpus check")
    root = Path(configured)
    if not root.is_dir():
        pytest.skip("configured historical corpus is unavailable")
    return root


def test_real_corpus_finalizes_all_534_rows_with_proven_decisions(tmp_path: Path):
    import_root = _historical_root()
    inventory_path = (
        REPO_ROOT
        / ".artifacts/pre-rentree-2026/pedagogy/import/INVENTAIRE-IMPORT.json"
    )
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))

    result = build_pedagogy_manifest(
        inventory=inventory,
        import_root=import_root,
        repo_root=REPO_ROOT,
    )
    summary = result["decisions"]["summary"]
    final_rows = result["inventory"]["files"]

    assert summary["file_count"] == 534
    assert summary["exact_duplicate_group_count"] == 27
    assert summary["exact_duplicate_excess_count"] == 29
    assert summary["class_matrix"] == {
        "CANONICAL_SOURCE": 378,
        "GENERATOR": 2,
        "VALIDATOR": 2,
        "GENERATED_OUTPUT": 103,
        "HISTORICAL_VERSION": 18,
        "ARCHIVE_PACKAGE": 1,
        "DUPLICATE_IDENTICAL": 30,
        "CONFLICT_REVIEW_REQUIRED": 0,
        "UNCLASSIFIED": 0,
    }
    assert sum(summary["class_matrix"].values()) == 534
    assert all(row["final_classification"] in FINAL_CLASSIFICATIONS for row in final_rows)
    assert all(row["final_classification"] != "UNCLASSIFIED" for row in final_rows)
    assert all(
        row["final_classification"] != PENDING_DEDUPLICATION
        for row in final_rows
    )
    first_pending_path = next(
        (
            row["relative_path"]
            for row in final_rows
            if row.get("provisional_classification") == PENDING_DEDUPLICATION
        ),
        None,
    )
    assert first_pending_path is None

    session_summary = result["decisions"]["session_sources"]
    assert session_summary == {
        "unit_file_count": 340,
        "module_readme_count": 17,
        "manifest_count": 1,
        "compiled_output_count": 34,
        "selection_status": "CANDIDATE_CANONICAL",
    }
    assert result["decisions"]["catalogue_comparison"]["normalized_identical"] is True
    assert result["decisions"]["catalogue_comparison"]["classification"] == "DUPLICATE_IDENTICAL"

    math_evidence = result["decisions"]["v3_math_corrections"]
    assert math_evidence["historical_pair_count"] == 5
    assert math_evidence["missing_obstacle_targets_before"] == 100
    assert math_evidence["missing_obstacle_targets_after"] == 0
    assert math_evidence["palier_corrections"] == [
        {
            "module": "maths-entree-troisieme",
            "item": "n10-i1",
            "before": "B",
            "after": "A",
        }
    ]
    assert math_evidence["correct_answer_positions_before"] == {"A": 120}
    assert math_evidence["correct_answer_positions_after"] == {
        "A": 30,
        "B": 30,
        "C": 30,
        "D": 30,
    }
    assert math_evidence["status_before"] == {"ABSENT": 5}
    assert math_evidence["status_after"] == {"HUMAN_VALIDATION_REQUIRED": 5}

    scripts = {
        Path(item["relative_path"]).name: item
        for item in result["decisions"]["script_assessments"]
    }
    assert scripts["generate_operational_resources.py"]["final_classification"] == "GENERATOR"
    assert scripts["generate_session_kits.py"]["final_classification"] == "GENERATOR"
    assert scripts["validate_cps.py"]["final_classification"] == "VALIDATOR"
    assert scripts["validate_session_kits.py"]["final_classification"] == "VALIDATOR"
    for historical_name in (
        "balance_answer_positions.py",
        "generate_missing_cps.py",
        "repair_math_cps.py",
    ):
        assert scripts[historical_name]["final_classification"] == "HISTORICAL_VERSION"
    assert all(
        {
            "dependencies",
            "inputs",
            "outputs",
            "side_effects",
            "reproducibility",
            "test_coverage",
        }
        <= item.keys()
        for item in scripts.values()
    )
    assert scripts["generate_session_kits.py"]["portability_status"] == (
        "REQUIRES_PATH_ADAPTATION"
    )
    assert scripts["validate_session_kits.py"]["portability_status"] == (
        "REQUIRES_PATH_ADAPTATION"
    )
    assert scripts["generate_session_kits.py"]["delivered_package_status"] == (
        "FAIL_PATH_LAYOUT"
    )
    assert scripts["validate_session_kits.py"]["delivered_package_status"] == (
        "FAIL_PATH_LAYOUT"
    )
    assert scripts["generate_session_kits.py"]["isolated_execution_status"] == "PASS"
    assert scripts["validate_session_kits.py"]["isolated_execution_status"] == "PASS"

    toolchains = result["decisions"]["toolchain_evaluations"]
    session_tools = toolchains["session_kits"]
    assert session_tools["portability_status"] == "REQUIRES_PATH_ADAPTATION"
    assert session_tools["delivered_package"]["status"] == "FAIL_PATH_LAYOUT"
    assert session_tools["delivered_package"]["generator"]["exception_type"] == (
        "FileNotFoundError"
    )
    assert session_tools["delivered_package"]["validator"]["exception_type"] == (
        "FileNotFoundError"
    )
    assert session_tools["delivered_package"]["missing_expected_paths"] == [
        "Nexus-PreRentree-2026-85-seances/outils/corpus-85-seances",
        "Nexus-PreRentree-2026-85-seances/outils/curriculum-anchors.yaml",
        "Nexus-PreRentree-2026-85-seances/outils/source-modules.json",
        "Nexus-PreRentree-2026-85-seances/positionnement",
    ]
    assert session_tools["isolated_execution"]["status"] == "PASS"
    assert session_tools["isolated_execution"]["generator_returncode"] == 0
    assert session_tools["isolated_execution"]["validator_returncode"] == 0
    assert session_tools["isolated_execution"]["comparison"] == {
        "status": "IDENTICAL_SHA256",
        "generated_file_count": 393,
        "imported_file_count": 393,
        "identical_file_count": 393,
        "missing_file_count": 0,
        "extra_file_count": 0,
        "content_mismatch_count": 0,
    }

    positioning_tools = toolchains["positioning_resources"]
    assert positioning_tools["portability_status"] == "LAYOUT_COMPATIBLE"
    assert positioning_tools["isolated_execution"]["status"] == "PASS"
    assert positioning_tools["isolated_execution"]["validator_returncode"] == 0
    assert positioning_tools["isolated_execution"]["generator_returncode"] == 0
    assert positioning_tools["isolated_execution"]["comparison"] == {
        "status": "IDENTICAL_SHA256",
        "generated_file_count": 69,
        "imported_file_count": 69,
        "identical_file_count": 69,
        "missing_file_count": 0,
        "extra_file_count": 0,
        "content_mismatch_count": 0,
    }
    assert toolchains["source_integrity"] == {
        "before_sha256": "077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005",
        "after_sha256": "077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005",
        "unchanged": True,
        "execution_policy": "GENERATORS_EXECUTED_ONLY_FROM_TEMPORARY_COPIES",
    }

    assert result["decisions"]["human_validation"]["required"] is True
    assert result["decisions"]["human_validation"]["publication_approved"] is False
    assert result["decisions"]["missing_modules"] == [
        {
            "module": "seconde-physique-chimie",
            "status": "INTENTIONALLY_BLOCKED",
            "reason": "absent du catalogue 17 modules et du corpus ; aucune création implicite",
        }
    ]

    write_manifest_outputs(result, tmp_path)
    assert sorted(path.name for path in tmp_path.iterdir()) == sorted(
        [FINAL_CSV_NAME, FINAL_JSON_NAME, MACHINE_DECISIONS_NAME]
    )
    written_json = json.loads((tmp_path / FINAL_JSON_NAME).read_text(encoding="utf-8"))
    written_decisions = json.loads(
        (tmp_path / MACHINE_DECISIONS_NAME).read_text(encoding="utf-8")
    )
    with (tmp_path / FINAL_CSV_NAME).open(encoding="utf-8", newline="") as handle:
        written_csv = list(csv.DictReader(handle))
    assert len(written_json["files"]) == len(written_csv) == 534
    assert written_decisions["summary"]["class_matrix"] == summary["class_matrix"]


def test_reports_disclose_session_tool_path_adaptation_and_isolated_proof():
    report_root = (
        REPO_ROOT / "docs/campaigns/pre-rentree-2026/pedagogy"
    )
    deduplication = (
        report_root / "DEDUPLICATION-REPORT.md"
    ).read_text(encoding="utf-8")
    conflicts = (report_root / "CONFLICTS.md").read_text(encoding="utf-8")

    for report in (deduplication, conflicts):
        assert "REQUIRES_PATH_ADAPTATION" in report
        assert "FAIL_PATH_LAYOUT" in report
        assert "copie temporaire" in report
    assert "393" in deduplication
    assert "69" in deduplication
    assert "FileNotFoundError" in deduplication

import csv
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pytest
import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
PEDAGOGY_SCRIPTS = REPO_ROOT / "scripts/pre-rentree/pedagogy"
MANIFEST_SCRIPT = PEDAGOGY_SCRIPTS / "build_pedagogy_manifest.py"
sys.path.insert(0, str(PEDAGOGY_SCRIPTS))

import build_pedagogy_manifest as manifest_builder
import sandbox_runner
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
from classification import (
    FINAL_CLASSIFICATIONS,
    HISTORICAL_PACKAGES,
    PENDING_DEDUPLICATION,
)
from cps_diff import compute_v3_diffs
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


def test_csv_normalization_rejects_headers_that_collide_after_trimming(tmp_path: Path):
    ambiguous = tmp_path / "ambiguous.csv"
    ambiguous.write_text("id, id \na,b\n", encoding="utf-8")

    with pytest.raises(ValueError, match="duplicate normalized CSV headers"):
        normalized_content(ambiguous)


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
            "structural_validation_passed": True,
            "qa_report": {
                "inventory_present": True,
                "sha256_matches": True,
                "assertions_verified": True,
            },
            "computed_diff": {
                "computed": True,
                "unexpected_change_count": 0,
            },
        },
    )

    assert resolved["selected"] == candidate.as_posix()
    assert resolved["classification"] == "CANONICAL_SOURCE"
    assert resolved["comparison"] == "DIVERGENT_WITH_SELECTION_EVIDENCE"


def test_truthy_labels_cannot_authorize_a_divergent_selection(tmp_path: Path):
    old = tmp_path / "old.yaml"
    candidate = tmp_path / "candidate.yaml"
    old.write_text("status: old\n", encoding="utf-8")
    candidate.write_text("status: new\n", encoding="utf-8")

    result = compare_candidate_group(
        [old, candidate],
        preferred_path=candidate,
        evidence={
            "structural_validation": "PASS",
            "qa_reference": "report.md",
            "diff_summary": {"claimed": "safe"},
        },
    )

    assert result["selected"] is None
    assert result["classification"] == "CONFLICT_REVIEW_REQUIRED"


def test_cps_diff_reports_changes_outside_the_allow_list(tmp_path: Path):
    v2 = tmp_path / "v2"
    v3 = tmp_path / "v3"
    v2.mkdir()
    v3.mkdir()
    source = {
        "id": "module",
        "titre": "Titre stable",
        "noeuds": [
            {
                "id": "n1",
                "items": [
                    {
                        "id": "n1-i1",
                        "palier": "A",
                        "propositions": [
                            {"texte": "Réponse A", "correcte": True},
                            {"texte": "Réponse B", "correcte": False},
                        ],
                    }
                ],
            }
        ],
    }
    candidate = {
        **source,
        "titre": "Titre modifié hors allow-list",
        "statutValidation": "HUMAN_VALIDATION_REQUIRED",
    }
    (v2 / "module.yaml").write_text(
        yaml.safe_dump(source, allow_unicode=True),
        encoding="utf-8",
    )
    (v3 / "module.yaml").write_text(
        yaml.safe_dump(candidate, allow_unicode=True),
        encoding="utf-8",
    )

    diff = compute_v3_diffs(
        tmp_path,
        v2_package="v2",
        v3_package="v3",
    )

    assert diff["allowed_change_counts"] == {"status_added": 1}
    assert diff["unexpected_change_count"] == 1
    assert diff["unexpected_paths"] == ["module.yaml:root.titre"]


def test_cps_diff_fails_closed_when_the_proven_v2_set_is_absent(tmp_path: Path):
    (tmp_path / "v3").mkdir()

    diff = compute_v3_diffs(
        tmp_path,
        v2_package="missing-v2",
        v3_package="v3",
    )

    assert diff["computed"] is False
    assert diff["unexpected_change_count"] > 0
    assert any("missing-v2" in path for path in diff["unexpected_paths"])


def test_divergent_cps_outside_the_nine_proven_modules_is_a_conflict(
    tmp_path: Path,
):
    old = tmp_path / "old.yaml"
    candidate = tmp_path / "candidate.yaml"
    old.write_text("id: nsi\nversion: 2\n", encoding="utf-8")
    candidate.write_text("id: nsi\nversion: 3\n", encoding="utf-8")
    fallback = manifest_builder._diff_evidence_for_module(
        {},
        "nsi-entree-premiere",
    )

    result = compare_candidate_group(
        [old, candidate],
        preferred_path=candidate,
        evidence={
            "structural_validation_passed": True,
            "qa_report": {
                "inventory_present": True,
                "sha256_matches": True,
                "assertions_verified": True,
            },
            "computed_diff": fallback,
        },
    )

    assert fallback["computed"] is False
    assert fallback["unexpected_change_count"] > 0
    assert result["selected"] is None
    assert result["classification"] == "CONFLICT_REVIEW_REQUIRED"


def test_bubblewrap_probe_clears_environment_blocks_network_and_outside_writes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    marker = "nexus-sandbox-child-survival-check"
    script = workspace / "malicious.py"
    script.write_text(
        "\n".join(
            [
                "import json, os, socket, subprocess, time",
                "from pathlib import Path",
                "network = False",
                "try:",
                "    socket.create_connection(('198.51.100.1', 80), timeout=0.2)",
                "    network = True",
                "except OSError:",
                "    pass",
                "outside = False",
                "try:",
                "    Path('/escape-from-sandbox').write_text('bad')",
                "    outside = True",
                "except OSError:",
                "    pass",
                "child_code = \"import time; from pathlib import Path; \"",
                "child_code += \"time.sleep(2); Path('/workspace/child-survived').write_text('bad')\"",
                f"subprocess.Popen(['/usr/bin/python3', '-c', child_code, '{marker}'])",
                "Path('/workspace/result.json').write_text(json.dumps({",
                "    'secret': os.getenv('PEDAGOGY_TEST_SECRET'),",
                "    'network': network,",
                "    'outside': outside,",
                "}))",
                "while True:",
                "    print('x' * 4096, flush=True)",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    forbidden_root = tmp_path / "forbidden-import"
    forbidden_root.mkdir()
    monkeypatch.setenv("PEDAGOGY_TEST_SECRET", "must-not-cross-clearenv")

    result = sandbox_runner.run_copied_python_tool(
        script,
        workspace=workspace,
        forbidden_root=forbidden_root,
        timeout_seconds=2,
    )

    if not Path("/usr/bin/bwrap").is_file():
        assert result["status"] == "FAIL_CLOSED_SANDBOX_UNAVAILABLE"
        return
    observed = json.loads((workspace / "result.json").read_text(encoding="utf-8"))
    assert observed == {"secret": None, "network": False, "outside": False}
    assert result["sandbox_backend"] == "bubblewrap"
    assert result["sandbox_status"] == "PASS"
    assert result["stdout_bytes"] <= result["resource_limits"]["file_size_bytes"]
    time.sleep(2.2)
    assert not (workspace / "child-survived").exists()
    assert not Path("/escape-from-sandbox").exists()


def test_sandbox_capture_descriptors_cannot_be_replaced_with_workspace_fifos(
    tmp_path: Path,
):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    script = workspace / "replace-captures.py"
    script.write_text(
        "\n".join(
            [
                "import os",
                "from pathlib import Path",
                "for path in Path('/workspace').glob('.sandbox-*.log'):",
                "    path.unlink()",
                "    os.mkfifo(path)",
                "print('completed', flush=True)",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    forbidden_root = tmp_path / "forbidden-import"
    forbidden_root.mkdir()
    driver = tmp_path / "driver.py"
    driver.write_text(
        "\n".join(
            [
                "import json, sys",
                "from pathlib import Path",
                f"sys.path.insert(0, {str(PEDAGOGY_SCRIPTS)!r})",
                "import sandbox_runner",
                "result = sandbox_runner.run_copied_python_tool(",
                f"    Path({str(script)!r}),",
                f"    workspace=Path({str(workspace)!r}),",
                f"    forbidden_root=Path({str(forbidden_root)!r}),",
                "    timeout_seconds=2,",
                ")",
                "print(json.dumps(result))",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    try:
        completed = subprocess.run(
            [sys.executable, str(driver)],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except subprocess.TimeoutExpired:
        pytest.fail("workspace FIFO replacement blocked sandbox output collection")

    assert completed.returncode == 0, completed.stderr
    result = json.loads(completed.stdout)
    if not Path("/usr/bin/bwrap").is_file():
        assert result["status"] == "FAIL_CLOSED_SANDBOX_UNAVAILABLE"
        return
    assert result["status"] == "PASS"
    assert not list(workspace.glob(".sandbox-*.log"))


def test_aggregate_resource_violation_checks_each_limit():
    limits = sandbox_runner.AGGREGATE_LIMITS
    within_limits = {
        "workspace_bytes": limits["workspace_bytes"],
        "process_count": limits["process_count"],
        "rss_bytes": limits["rss_bytes"],
        "cpu_seconds": limits["cpu_seconds"],
    }
    assert sandbox_runner._resource_violation(within_limits, limits) is None

    for metric in within_limits:
        exceeded = {**within_limits, metric: limits[metric] + 1}
        assert sandbox_runner._resource_violation(exceeded, limits) == metric


def test_proc_stat_parser_aggregates_live_and_reaped_child_cpu():
    fields = ["S", "1", "321", *(["0"] * 19)]
    fields[11] = "10"
    fields[12] = "20"
    fields[13] = "30"
    fields[14] = "40"
    fields[21] = "5"
    raw = f"123 (worker with spaces) {' '.join(fields)}"

    assert sandbox_runner._parse_proc_stat(raw) == (1, 321, 100, 5)


def test_sandbox_kills_a_real_workspace_size_storm(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    script = workspace / "workspace-storm.py"
    script.write_text(
        "\n".join(
            [
                "import time",
                "from pathlib import Path",
                "payload = b'x' * (128 * 1024)",
                "for index in range(10):",
                "    Path(f'/workspace/storm-{index}.bin').write_bytes(payload)",
                "    time.sleep(0.02)",
                "time.sleep(10)",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    forbidden_root = tmp_path / "forbidden-import"
    forbidden_root.mkdir()
    monkeypatch.setattr(
        sandbox_runner,
        "AGGREGATE_LIMITS",
        {
            **sandbox_runner.AGGREGATE_LIMITS,
            "workspace_bytes": 512 * 1024,
        },
    )

    result = sandbox_runner.run_copied_python_tool(
        script,
        workspace=workspace,
        forbidden_root=forbidden_root,
        timeout_seconds=2,
    )

    if not Path("/usr/bin/bwrap").is_file():
        assert result["status"] == "FAIL_CLOSED_SANDBOX_UNAVAILABLE"
        return
    assert result["status"] == "FAIL_RESOURCE_LIMIT"
    assert result["resource_violation"] == "workspace_bytes"


def test_bubblewrap_absence_fails_closed_without_running_script(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    script = workspace / "must-not-run.py"
    script.write_text(
        "from pathlib import Path\nPath('/workspace/ran').write_text('bad')\n",
        encoding="utf-8",
    )
    forbidden_root = tmp_path / "import"
    forbidden_root.mkdir()
    monkeypatch.setattr(
        sandbox_runner,
        "BWRAP_PATH",
        tmp_path / "missing-bwrap",
        raising=False,
    )

    result = sandbox_runner.run_copied_python_tool(
        script,
        workspace=workspace,
        forbidden_root=forbidden_root,
        timeout_seconds=1,
    )

    assert result["status"] == "FAIL_CLOSED_SANDBOX_UNAVAILABLE"
    assert not (workspace / "ran").exists()


def _make_complete_synthetic_import(import_root: Path) -> None:
    for package_name in HISTORICAL_PACKAGES:
        package = import_root / package_name
        package.mkdir(parents=True)
        (package / "fixture.md").write_text(f"# {package_name}\n", encoding="utf-8")


@pytest.mark.parametrize("added_kind", ["file", "symlink", "directory"])
def test_inventory_tree_reconciliation_rejects_added_entries(
    tmp_path: Path,
    added_kind: str,
):
    import_root = tmp_path / "import"
    package = import_root / "package"
    package.mkdir(parents=True)
    source = package / "source.md"
    source.write_text("source\n", encoding="utf-8")
    inventory = build_inventory(import_root)
    added = package / f"added-{added_kind}"
    if added_kind == "file":
        added.write_text("unexpected\n", encoding="utf-8")
    elif added_kind == "symlink":
        added.symlink_to(source.name)
    else:
        added.mkdir()

    with pytest.raises(ValueError, match="inventory/tree mismatch"):
        manifest_builder._verify_inventory_tree(inventory, import_root)


def _run_manifest_cli(
    import_root: Path,
    output_root: Path,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(MANIFEST_SCRIPT),
            "--import-root",
            str(import_root),
            "--repo-root",
            str(REPO_ROOT),
            "--output-root",
            str(output_root),
        ],
        capture_output=True,
        text=True,
    )


def test_cli_rejects_output_equal_to_or_resolving_inside_import_root(tmp_path: Path):
    import_root = tmp_path / "import"
    _make_complete_synthetic_import(import_root)

    equal_result = _run_manifest_cli(import_root, import_root)
    symlink_output = tmp_path / "linked-output"
    symlink_output.symlink_to(import_root / HISTORICAL_PACKAGES[0], target_is_directory=True)
    linked_result = _run_manifest_cli(import_root, symlink_output)

    assert equal_result.returncode != 0
    assert "outside --import-root" in equal_result.stderr
    assert linked_result.returncode != 0
    assert "outside --import-root" in linked_result.stderr


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
    inventory = (
        json.loads(inventory_path.read_text(encoding="utf-8"))
        if inventory_path.is_file()
        else build_inventory(import_root)
    )

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
    assert session_tools["isolated_execution"]["run_count"] == 2
    assert all(
        run["generator_returncode"] == run["validator_returncode"] == 0
        for run in session_tools["isolated_execution"]["runs"]
    )
    expected_session_comparison = {
        "status": "IDENTICAL_SHA256",
        "generated_file_count": 393,
        "imported_file_count": 393,
        "identical_file_count": 393,
        "missing_file_count": 0,
        "extra_file_count": 0,
        "content_mismatch_count": 0,
    }
    assert (
        session_tools["isolated_execution"]["comparison_to_import"]
        == expected_session_comparison
    )
    assert (
        session_tools["isolated_execution"]["reproducibility_comparison"]
        == expected_session_comparison
    )

    positioning_tools = toolchains["positioning_resources"]
    assert positioning_tools["portability_status"] == "LAYOUT_COMPATIBLE"
    assert positioning_tools["isolated_execution"]["status"] == "PASS"
    assert positioning_tools["isolated_execution"]["run_count"] == 2
    assert all(
        run["generator_returncode"] == run["validator_returncode"] == 0
        for run in positioning_tools["isolated_execution"]["runs"]
    )
    expected_positioning_comparison = {
        "status": "IDENTICAL_SHA256",
        "generated_file_count": 69,
        "imported_file_count": 69,
        "identical_file_count": 69,
        "missing_file_count": 0,
        "extra_file_count": 0,
        "content_mismatch_count": 0,
    }
    assert (
        positioning_tools["isolated_execution"]["comparison_to_import"]
        == expected_positioning_comparison
    )
    assert (
        positioning_tools["isolated_execution"]["reproducibility_comparison"]
        == expected_positioning_comparison
    )

    source_integrity = toolchains["source_integrity"]
    assert source_integrity["manifest_before_sha256"] == (
        "077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005"
    )
    assert source_integrity["manifest_after_sha256"] == (
        source_integrity["manifest_before_sha256"]
    )
    assert source_integrity["complete_tree_before"] == (
        source_integrity["complete_tree_after"]
    )
    assert source_integrity["complete_tree_before"]["directory_count"] == 119
    assert source_integrity["complete_tree_before"]["file_count"] == 534
    assert source_integrity["complete_tree_before"]["symlink_count"] == 0
    assert source_integrity["complete_tree_before"]["other_count"] == 0
    assert source_integrity["unchanged"] is True
    assert source_integrity["execution_policy"] == (
        "GENERATORS_EXECUTED_ONLY_IN_BWRAP_TEMPORARY_WORKSPACES"
    )

    selection_evidence = result["decisions"]["v3_selection_evidence"]
    qa = selection_evidence["qa_report"]
    assert qa["inventory_present"] is True
    assert qa["sha256_matches"] is True
    assert qa["assertions_verified"] is True
    assert qa["sha256"] == (
        "2396a31357e8eb39fa011556e1cc25968428f3f4839d980d0afb4e476fc42340"
    )
    assert all(qa["assertions"].values())
    computed_diffs = selection_evidence["computed_diffs"]
    assert computed_diffs["module_count"] == 9
    assert computed_diffs["allowed_change_counts"] == {
        "status_added": 9,
        "proposition_order_changed": 153,
        "obstacle_vise_added": 100,
        "palier_n10_i1_corrected": 1,
    }
    assert computed_diffs["unexpected_change_count"] == 0
    assert computed_diffs["unexpected_paths"] == []
    divergent_groups = [
        group
        for group in result["decisions"]["logical_group_decisions"]
        if group["comparison"] == "DIVERGENT_WITH_SELECTION_EVIDENCE"
    ]
    assert len(divergent_groups) == 9
    assert all(
        group["selection_evidence"]["structural_validation_passed"] is True
        and group["selection_evidence"]["qa_report"]["sha256_matches"] is True
        and group["selection_evidence"]["qa_report"]["assertions_verified"] is True
        and group["selection_evidence"]["computed_diff"]["computed"] is True
        and group["selection_evidence"]["computed_diff"][
            "unexpected_change_count"
        ]
        == 0
        for group in divergent_groups
    )

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
    for expected in (
        "/usr/bin/bwrap",
        "--unshare-all",
        "--clearenv",
        "deux exécutions",
        "digest de l’arbre complet",
        "153",
        "changements inattendus : 0",
        "PRE_RENTREE_PEDAGOGY_IMPORT_ROOT",
        "n’est pas un gate CI autonome",
        "fichiers anonymes",
        "64 Mio",
        "32 processus",
        "1 Gio de RSS",
        "30 secondes de CPU",
        "fichiers réguliers, répertoires et liens symboliques",
        "`computed: false`",
    ):
        assert expected in deduplication

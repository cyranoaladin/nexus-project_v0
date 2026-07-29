from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

import jsonschema
import pytest
import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
PEDAGOGY_ROOT = REPO_ROOT / "content/pre-rentree-2026/pedagogy"
POSITIONING_ROOT = PEDAGOGY_ROOT / "positioning"
SCHEMA_ROOT = REPO_ROOT / "scripts/pre-rentree/pedagogy/schemas"


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def module_catalog() -> dict:
    return json.loads(
        (REPO_ROOT / "content/pre-rentree-2026/modules.json").read_text(encoding="utf-8")
    )


def expected_modules() -> dict[str, dict]:
    return {module["id"]: module for module in module_catalog()["modules"]}


def reference() -> dict:
    return load_yaml(POSITIONING_ROOT / "REFERENTIEL-CANONIQUE-2026.yaml")


def cps_documents() -> list[tuple[dict, dict]]:
    docs = []
    for entry in reference()["modules"]:
        docs.append((entry, load_yaml(POSITIONING_ROOT / "cps" / entry["cps"])))
    return docs


def test_canonical_positioning_sources_cover_the_exact_module_catalog() -> None:
    modules = expected_modules()
    assert len(modules) == 17
    assert "seconde-physique-chimie" not in modules

    ref = reference()
    referenced = {entry["moduleId"] for entry in ref["modules"]}
    assert referenced == set(modules)
    assert len(list((POSITIONING_ROOT / "cps").glob("*.yaml"))) == 17

    for entry, cps in cps_documents():
        module = modules[entry["moduleId"]]
        assert cps["niveauEntree"] == module["level"] == entry["niveau"]
        assert cps["matiere"] == module["subjectId"] == entry["matiere"]
        assert cps["statutValidation"] == "HUMAN_VALIDATION_REQUIRED"


def test_cps_schema_and_contractual_counts() -> None:
    schema = json.loads((SCHEMA_ROOT / "cps.schema.json").read_text(encoding="utf-8"))
    totals = {"nodes": 0, "evaluated": 0, "items": 0, "manual": 0}
    correct_positions: list[int] = []

    for _entry, cps in cps_documents():
        jsonschema.Draft202012Validator(schema).validate(cps)
        nodes = cps["noeuds"]
        evaluated = [node for node in nodes if node["evalueParTest"]]
        totals["nodes"] += len(nodes)
        totals["evaluated"] += len(evaluated)
        assert len(evaluated) == 8

        seen_items: set[str] = set()
        for node in nodes:
            if node["evalueParTest"]:
                assert 1 <= node["seanceRattachement"] <= 5
                assert [item["palier"] for item in node["items"]] == ["A", "B", "C"]
            else:
                assert not node.get("items")
                assert node.get("motifNonEvalue")

            for item in node.get("items", []):
                assert item["id"] not in seen_items
                seen_items.add(item["id"])
                totals["items"] += 1
                if item["type"] == "reponse_courte":
                    totals["manual"] += 1
                    assert item["correctionManuelle"] is True
                    assert item["excluScoringAutomatique"] is True
                    assert "propositions" not in item
                else:
                    propositions = item["propositions"]
                    correct = [index for index, prop in enumerate(propositions) if prop["correcte"]]
                    assert len(correct) == 1
                    correct_positions.append(correct[0])
                    for proposition in propositions:
                        if not proposition["correcte"]:
                            assert 0 <= proposition["obstacleVise"] < len(node["obstacles"])

    assert totals == {"nodes": 141, "evaluated": 136, "items": 408, "manual": 33}
    assert set(correct_positions) == {0, 1, 2, 3}


def test_historical_palier_anomaly_is_corrected_in_v3() -> None:
    cps = load_yaml(POSITIONING_ROOT / "cps/maths-entree-troisieme.yaml")
    item = next(
        item
        for node in cps["noeuds"]
        for item in node.get("items", [])
        if item["id"] == "n10-i1"
    )
    assert item["palier"] == "A"


def test_cps_and_manifest_schemas_reject_unknown_fields() -> None:
    cps_schema = json.loads((SCHEMA_ROOT / "cps.schema.json").read_text(encoding="utf-8"))
    _entry, source_cps = cps_documents()[0]
    unknown_cps = deepcopy(source_cps)
    unknown_cps["automaticApproval"] = True
    assert list(jsonschema.Draft202012Validator(cps_schema).iter_errors(unknown_cps))

    manifest_schema = json.loads(
        (SCHEMA_ROOT / "pedagogy-manifest.schema.json").read_text(encoding="utf-8")
    )
    unknown_manifest = load_yaml(PEDAGOGY_ROOT / "manifest.yaml")
    unknown_manifest["publicationApproved"] = True
    assert list(jsonschema.Draft202012Validator(manifest_schema).iter_errors(unknown_manifest))


def test_manifest_is_strict_complete_and_hashes_every_source() -> None:
    manifest = load_yaml(PEDAGOGY_ROOT / "manifest.yaml")
    schema = json.loads(
        (SCHEMA_ROOT / "pedagogy-manifest.schema.json").read_text(encoding="utf-8")
    )
    jsonschema.Draft202012Validator(schema).validate(manifest)

    assert manifest["campaignId"] == "pre-rentree-2026"
    assert manifest["moduleCatalog"] == "content/pre-rentree-2026/modules.json"
    assert manifest["generatedRoot"] == ".artifacts/pre-rentree-2026/pedagogy"
    assert manifest["counts"] == {
        "modules": 17,
        "sessions": 85,
        "cps": 17,
        "nodes": 141,
        "evaluatedNodes": 136,
        "items": 408,
        "manualResponses": 33,
        "sessionUnitFiles": 340,
    }
    assert manifest["humanValidation"]["status"] == "HUMAN_VALIDATION_REQUIRED"
    assert manifest["humanValidation"]["reviewer"] is None
    assert manifest["humanValidation"]["validatedAt"] is None

    assert {entry["id"] for entry in manifest["modules"]} == set(expected_modules())
    for module in manifest["modules"]:
        assert module["editorialStatus"] == "HUMAN_VALIDATION_REQUIRED"
        assert module["humanValidation"]["reviewer"] is None
        assert module["humanValidation"]["validatedAt"] is None
        assert len(module["sessions"]) == 5
        for source in [module["cps"], *module["sessions"]]:
            path = REPO_ROOT / source["path"]
            assert path.is_file() if source is module["cps"] else path.is_dir()
            if path.is_file():
                assert hashlib.sha256(path.read_bytes()).hexdigest() == source["sha256"]
            else:
                for file_entry in source["files"]:
                    file_path = REPO_ROOT / file_entry["path"]
                    assert hashlib.sha256(file_path.read_bytes()).hexdigest() == file_entry["sha256"]


def test_cps_validator_cli_passes_and_detects_tampering(tmp_path: Path) -> None:
    script = REPO_ROOT / "scripts/pre-rentree/pedagogy/validate_cps.py"
    passing = subprocess.run(
        [sys.executable, str(script), "--repo-root", str(REPO_ROOT)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert passing.returncode == 0, passing.stderr
    assert '"items": 408' in passing.stdout

    tampered_root = tmp_path / "repo"
    (tampered_root / "content/pre-rentree-2026").mkdir(parents=True)
    (tampered_root / "scripts/pre-rentree/pedagogy").mkdir(parents=True)
    for relative in (
        "content/pre-rentree-2026/modules.json",
        "content/pre-rentree-2026/pedagogy",
        "scripts/pre-rentree/pedagogy/schemas",
    ):
        source = REPO_ROOT / relative
        target = tampered_root / relative
        if source.is_dir():
            import shutil

            shutil.copytree(source, target, dirs_exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())
    target_cps = (
        tampered_root
        / "content/pre-rentree-2026/pedagogy/positioning/cps/maths-entree-quatrieme.yaml"
    )
    target_cps.write_text(
        target_cps.read_text(encoding="utf-8").replace(
            "statutValidation: HUMAN_VALIDATION_REQUIRED",
            "statutValidation: CLASSROOM_READY",
            1,
        ),
        encoding="utf-8",
    )
    failing = subprocess.run(
        [sys.executable, str(script), "--repo-root", str(tampered_root)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert failing.returncode != 0
    assert "HUMAN_VALIDATION_REQUIRED" in failing.stderr

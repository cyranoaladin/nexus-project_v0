#!/usr/bin/env python3
"""Finalize deterministic deduplication decisions for the pedagogy import."""

from __future__ import annotations

import argparse
import ast
import copy
import csv
import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

import yaml

from classification import FINAL_CLASSIFICATIONS
from cps_diff import PROVEN_V2_MODULES, compute_v3_diffs
from import_pedagogy_corpus import (
    _assert_output_outside_import,
    build_inventory,
    validate_complete_import_root,
    validate_complete_inventory,
)
from sandbox_runner import run_copied_python_tool as _run_copied_python_tool


FINAL_CSV_NAME = "INVENTAIRE-IMPORT-FINAL.csv"
FINAL_JSON_NAME = "INVENTAIRE-IMPORT-FINAL.json"
MACHINE_DECISIONS_NAME = "DECISIONS-DEDUPLICATION.json"

SESSION_UNIT_ROLES = frozenset(
    {
        "SESSION_STUDENT_BANK",
        "SESSION_ANSWER_KEY",
        "SESSION_STUDENT_CHECK",
        "SESSION_CHECK_ANSWER_KEY",
    }
)
POSITIONING_PACKAGE_V3 = "Nexus-PreRentree-2026-positionnement-17-modules-v3"
SESSION_PACKAGE = "Nexus-PreRentree-2026-85-seances"
POSITIONING_PACKAGE_V2 = "Nexus-positionnement-2026-maths-francais-v2"
POSITIONING_PACKAGE_V1 = "Nexus-positionnement"
USEFUL_GENERATORS = frozenset(
    {"generate_operational_resources.py", "generate_session_kits.py"}
)
USEFUL_VALIDATORS = frozenset({"validate_cps.py", "validate_session_kits.py"})
HISTORICAL_MIGRATIONS = frozenset(
    {"balance_answer_positions.py", "generate_missing_cps.py", "repair_math_cps.py"}
)


def _canonical_json(value: Any) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
        + "\n"
    ).encode("utf-8")


def _normalized_text(raw: str) -> str:
    text = unicodedata.normalize("NFC", raw.replace("\r\n", "\n").replace("\r", "\n"))
    lines = [line.rstrip() for line in text.split("\n")]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines) + "\n"


def normalized_content(path: Path, *, csv_order_semantic: bool = False) -> bytes:
    """Return a comparison representation without changing the source file."""

    suffix = path.suffix.casefold()
    if suffix in {".yaml", ".yml"}:
        return _canonical_json(yaml.safe_load(path.read_text(encoding="utf-8")))
    if suffix == ".json":
        return _canonical_json(json.loads(path.read_text(encoding="utf-8")))
    if suffix == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames is None:
                return b"[]\n"
            header_map = {
                original: original.strip()
                for original in reader.fieldnames
            }
            if len(set(header_map.values())) != len(header_map):
                raise ValueError(
                    f"duplicate normalized CSV headers in {path.name}"
                )
            headers = sorted(header_map.values())
            rows = []
            for row in reader:
                normalized_row = {
                    normalized: (row.get(original) or "").strip()
                    for original, normalized in header_map.items()
                }
                rows.append(normalized_row)
        if not csv_order_semantic:
            rows.sort(key=lambda row: _canonical_json(row))
        return _canonical_json({"headers": headers, "rows": rows})
    if suffix in {".md", ".txt", ".py"}:
        return _normalized_text(path.read_text(encoding="utf-8")).encode("utf-8")
    return path.read_bytes()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_exact_duplicate_groups(files: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group byte-identical inventory rows from their computed SHA-256."""

    by_hash: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in files:
        by_hash[row["sha256"]].append(row)
    groups = []
    duplicate_sets = [
        sorted(rows, key=lambda row: row["relative_path"])
        for rows in by_hash.values()
        if len(rows) > 1
    ]
    duplicate_sets.sort(key=lambda rows: rows[0]["relative_path"])
    for index, rows in enumerate(duplicate_sets, 1):
        members = [row["relative_path"] for row in rows]
        groups.append(
            {
                "group_id": f"sha256-{index:03d}",
                "sha256": rows[0]["sha256"],
                "member_count": len(rows),
                "excess_copy_count": len(rows) - 1,
                "members": members,
            }
        )
    return groups


def compare_candidate_group(
    paths: Iterable[Path],
    *,
    preferred_path: Path | None = None,
    evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compare candidates and fail closed on an unexplained divergence."""

    candidates = sorted((Path(path) for path in paths), key=lambda path: path.as_posix())
    if not candidates:
        raise ValueError("at least one candidate is required")
    hashes = {_sha256_file(path) for path in candidates}
    normalized = {normalized_content(path) for path in candidates}
    if len(hashes) == 1:
        comparison = "IDENTICAL_SHA256"
    elif len(normalized) == 1:
        comparison = "IDENTICAL_NORMALIZED"
    else:
        comparison = "DIVERGENT"

    selected: Path | None = None
    classification = "DUPLICATE_IDENTICAL"
    if len(candidates) == 1:
        selected = candidates[0]
        classification = "CANONICAL_SOURCE"
        comparison = "UNIQUE"
    elif comparison.startswith("IDENTICAL"):
        selected = preferred_path or candidates[0]
    elif preferred_path is not None and _selection_evidence_complete(evidence):
        selected = preferred_path
        classification = "CANONICAL_SOURCE"
        comparison = "DIVERGENT_WITH_SELECTION_EVIDENCE"
    else:
        classification = "CONFLICT_REVIEW_REQUIRED"

    if selected is not None and selected not in candidates:
        raise ValueError("preferred_path must belong to the candidate group")
    return {
        "candidates": [path.as_posix() for path in candidates],
        "selected": selected.as_posix() if selected else None,
        "classification": classification,
        "comparison": comparison,
        "evidence": evidence or {},
    }


def _selection_evidence_complete(evidence: dict[str, Any] | None) -> bool:
    if not isinstance(evidence, dict):
        return False
    qa_report = evidence.get("qa_report")
    computed_diff = evidence.get("computed_diff")
    return (
        evidence.get("structural_validation_passed") is True
        and isinstance(qa_report, dict)
        and qa_report.get("inventory_present") is True
        and qa_report.get("sha256_matches") is True
        and qa_report.get("assertions_verified") is True
        and isinstance(computed_diff, dict)
        and computed_diff.get("computed") is True
        and computed_diff.get("unexpected_change_count") == 0
    )


def _diff_evidence_for_module(
    diffs_by_module: dict[str, dict[str, Any]],
    module: str,
) -> dict[str, Any]:
    return diffs_by_module.get(
        module,
        {
            "computed": False,
            "unexpected_change_count": 1,
            "unexpected_paths": [f"{module}:diff-evidence-missing"],
            "allowed_change_counts": {},
        },
    )


def _candidate_rank(relative_path: str) -> tuple[int, int, str]:
    path = PurePosixPath(relative_path)
    package = path.parts[0]
    package_rank = {
        POSITIONING_PACKAGE_V3: 0,
        SESSION_PACKAGE: 1,
        POSITIONING_PACKAGE_V2: 2,
        POSITIONING_PACKAGE_V1: 3,
    }.get(package, 9)
    return package_rank, len(path.parts), relative_path


def _logical_identity(row: dict[str, Any]) -> str:
    relative = PurePosixPath(row["relative_path"])
    role = row["logical_role"]
    parts = relative.parts
    if role == "POSITIONING_SOURCE":
        return f"positioning/{relative.name}"
    if role in SESSION_UNIT_ROLES or role == "SESSION_MANIFEST":
        try:
            corpus_index = parts.index("corpus")
            return PurePosixPath(*parts[corpus_index:]).as_posix()
        except ValueError:
            return relative.name
    if (
        role == "DOCUMENTATION"
        and "modules" in parts
        and relative.name.casefold() == "readme.md"
    ):
        module_index = parts.index("modules")
        return PurePosixPath(*parts[module_index:]).as_posix()
    if role in {"DOCUMENTATION", "SOURCE_DOCUMENTATION"}:
        return f"documentation/{relative.name}"
    if role in {"GENERATOR", "VALIDATOR"}:
        return f"script/{relative.name}"
    return relative.as_posix()


def _base_classification(row: dict[str, Any]) -> tuple[str, str]:
    relative = PurePosixPath(row["relative_path"])
    parts = relative.parts
    package = parts[0]
    name = relative.name
    role = row["logical_role"]

    if role == "ARCHIVE_PACKAGE":
        return "ARCHIVE_PACKAGE", "ZIP de livraison historique, non source"
    if role == "GENERATED_RESOURCE":
        return "GENERATED_OUTPUT", "sortie dérivée à régénérer depuis les sources"
    if role in SESSION_UNIT_ROLES:
        return "CANONICAL_SOURCE", "fichier unitaire d'une séance du corpus 17 × 5"
    if role == "SESSION_MANIFEST":
        return "CANONICAL_SOURCE", "manifeste des 85 séances"
    if role == "CHECKSUM_MANIFEST":
        return "HISTORICAL_VERSION", "manifeste de contrôle du paquet historique"
    if role == "STRUCTURED_DATA" and name == "source-modules.json":
        return "DUPLICATE_IDENTICAL", "copie normalisée du catalogue déjà versionné"
    if name in USEFUL_GENERATORS:
        return "GENERATOR", "générateur utile à porter vers le pipeline canonique"
    if name in USEFUL_VALIDATORS:
        return "VALIDATOR", "validateur utile à porter vers le pipeline canonique"
    if name in HISTORICAL_MIGRATIONS:
        return "HISTORICAL_VERSION", "migration ponctuelle, non générateur runtime canonique"
    if role in {"GENERATOR", "VALIDATOR"}:
        return "HISTORICAL_VERSION", "script historique sans contrat runtime retenu"
    if role == "POSITIONING_SOURCE":
        if package == POSITIONING_PACKAGE_V3:
            return "CANONICAL_SOURCE", "candidat v3 soumis à validation structurelle"
        if (
            package == SESSION_PACKAGE
            and relative.as_posix().endswith("/sources/curriculum-anchors.yaml")
        ):
            return "CANONICAL_SOURCE", "ancres curriculaires du corpus de séances"
        return "HISTORICAL_VERSION", "version de positionnement antérieure ou copie embarquée"
    if role == "DOCUMENTATION":
        if (
            package == SESSION_PACKAGE
            and "modules" in parts
            and name.casefold() == "readme.md"
        ):
            return "CANONICAL_SOURCE", "index source d'un module de cinq séances"
        if (
            package == POSITIONING_PACKAGE_V3
            and name == "SPEC-tests-positionnement-pre-stage-2026.md"
        ):
            return "CANONICAL_SOURCE", "spécification candidate du positionnement v3"
        return "HISTORICAL_VERSION", "documentation de preuve ou de contexte historique"
    return "UNCLASSIFIED", "aucune règle finale prouvée"


def _validate_cps(path: Path) -> tuple[bool, dict[str, int], list[str]]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    required = {
        "id",
        "niveauEntree",
        "matiere",
        "edition",
        "dureeCibleMinutes",
        "statutValidation",
        "noeuds",
    }
    missing = sorted(required - set(data or {}))
    if missing:
        errors.append(f"champs racine absents: {', '.join(missing)}")
    if data.get("statutValidation") != "HUMAN_VALIDATION_REQUIRED":
        errors.append("statutValidation invalide")
    nodes = data.get("noeuds") or []
    evaluated = [node for node in nodes if node.get("evalueParTest")]
    if len(evaluated) != 8:
        errors.append(f"{len(evaluated)} nœuds évalués")
    item_count = 0
    manual_count = 0
    for node in nodes:
        items = node.get("items") or []
        if node.get("evalueParTest") and sorted(item.get("palier") for item in items) != [
            "A",
            "B",
            "C",
        ]:
            errors.append(f"{node.get('id')}: paliers différents de A/B/C")
        item_count += len(items)
        for item in items:
            if item.get("type") == "qcm_unique":
                propositions = item.get("propositions") or []
                if len(propositions) != 4 or sum(
                    bool(proposition.get("correcte")) for proposition in propositions
                ) != 1:
                    errors.append(f"{item.get('id')}: contrat QCM invalide")
                for proposition in propositions:
                    if not proposition.get("correcte"):
                        target = proposition.get("obstacleVise")
                        if not isinstance(target, int) or not 0 <= target < len(
                            node.get("obstacles") or []
                        ):
                            errors.append(f"{item.get('id')}: obstacleVise invalide")
            elif item.get("type") == "reponse_courte":
                manual_count += 1
                if (
                    item.get("correctionManuelle") is not True
                    or item.get("excluScoringAutomatique") is not True
                ):
                    errors.append(f"{item.get('id')}: réponse manuelle mal qualifiée")
            else:
                errors.append(f"{item.get('id')}: type inconnu")
    if item_count != 24:
        errors.append(f"{item_count} items")
    return (
        not errors,
        {
            "node_count": len(nodes),
            "evaluated_node_count": len(evaluated),
            "item_count": item_count,
            "manual_item_count": manual_count,
        },
        errors,
    )


def _iter_items(data: dict[str, Any]) -> Iterable[tuple[str, dict[str, Any], dict[str, Any]]]:
    for node in data.get("noeuds") or []:
        for item in node.get("items") or []:
            yield item.get("id", ""), node, item


def _qa_report_evidence(
    source_root: Path,
    rows_by_path: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    relative_path = (
        f"{POSITIONING_PACKAGE_V3}/RAPPORT-QA-COMPLET-17-MODULES-2026.md"
    )
    row = rows_by_path.get(relative_path)
    report_path = source_root / relative_path
    inventory_present = row is not None and report_path.is_file()
    actual_sha = _sha256_file(report_path) if report_path.is_file() else None
    inventory_sha = row.get("sha256") if row else None
    text = report_path.read_text(encoding="utf-8") if report_path.is_file() else ""
    assertions = {
        "cps_count_17": "| CPS | 17 |" in text,
        "node_count_141": "| Nœuds décrits | 141 |" in text,
        "evaluated_node_count_136": "| Nœuds évalués | 136 |" in text,
        "item_count_408": "| Items | 408 |" in text,
        "manual_response_count_33": (
            "| Réponses courtes à correction manuelle | 33 |" in text
        ),
        "obstacle_vise_corrections_100": (
            "100 distracteurs auparavant dépourvus de `obstacleVise`" in text
        ),
        "palier_bbc_to_abc": "`B/B/C` à `A/B/C`" in text,
        "answer_positions_balanced": (
            "position des réponses correctes a été équilibrée entre A, B, C et D"
            in text
        ),
        "human_validation_required": "`HUMAN_VALIDATION_REQUIRED`" in text,
    }
    return {
        "relative_path": relative_path,
        "inventory_present": inventory_present,
        "sha256": actual_sha,
        "inventory_sha256": inventory_sha,
        "sha256_matches": (
            inventory_present
            and actual_sha is not None
            and actual_sha == inventory_sha
        ),
        "assertions": assertions,
        "assertions_verified": all(assertions.values()),
    }


def _math_correction_evidence(import_root: Path) -> dict[str, Any]:
    names = [
        "maths-entree-premiere.yaml",
        "maths-entree-quatrieme.yaml",
        "maths-entree-seconde.yaml",
        "maths-entree-terminale.yaml",
        "maths-entree-troisieme.yaml",
    ]
    before_missing = 0
    after_missing = 0
    before_positions: Counter[str] = Counter()
    after_positions: Counter[str] = Counter()
    before_status: Counter[str] = Counter()
    after_status: Counter[str] = Counter()
    palier_corrections: list[dict[str, str]] = []
    pairs_identical = True

    for name in names:
        v1_path = import_root / POSITIONING_PACKAGE_V1 / name
        v2_path = import_root / POSITIONING_PACKAGE_V2 / name
        v3_path = import_root / POSITIONING_PACKAGE_V3 / name
        pairs_identical = pairs_identical and _sha256_file(v1_path) == _sha256_file(v2_path)
        old = yaml.safe_load(v2_path.read_text(encoding="utf-8"))
        new = yaml.safe_load(v3_path.read_text(encoding="utf-8"))
        before_status[old.get("statutValidation", "ABSENT")] += 1
        after_status[new.get("statutValidation", "ABSENT")] += 1
        old_items = {item_id: (node, item) for item_id, node, item in _iter_items(old)}
        new_items = {item_id: (node, item) for item_id, node, item in _iter_items(new)}
        for item_id in sorted(old_items.keys() & new_items.keys()):
            _, old_item = old_items[item_id]
            _, new_item = new_items[item_id]
            if old_item.get("palier") != new_item.get("palier"):
                palier_corrections.append(
                    {
                        "module": name.removesuffix(".yaml"),
                        "item": item_id,
                        "before": old_item.get("palier"),
                        "after": new_item.get("palier"),
                    }
                )
        for _, node, item in _iter_items(old):
            if item.get("type") != "qcm_unique":
                continue
            propositions = item.get("propositions") or []
            before_positions["ABCD"[next(
                index for index, proposition in enumerate(propositions)
                if proposition.get("correcte")
            )]] += 1
            before_missing += sum(
                1
                for proposition in propositions
                if not proposition.get("correcte") and "obstacleVise" not in proposition
            )
        for _, node, item in _iter_items(new):
            if item.get("type") != "qcm_unique":
                continue
            propositions = item.get("propositions") or []
            after_positions["ABCD"[next(
                index for index, proposition in enumerate(propositions)
                if proposition.get("correcte")
            )]] += 1
            after_missing += sum(
                1
                for proposition in propositions
                if not proposition.get("correcte") and "obstacleVise" not in proposition
            )
    return {
        "historical_pair_count": len(names),
        "historical_pairs_byte_identical": pairs_identical,
        "missing_obstacle_targets_before": before_missing,
        "missing_obstacle_targets_after": after_missing,
        "palier_corrections": palier_corrections,
        "correct_answer_positions_before": dict(sorted(before_positions.items())),
        "correct_answer_positions_after": dict(sorted(after_positions.items())),
        "status_before": dict(sorted(before_status.items())),
        "status_after": dict(sorted(after_status.items())),
        "selection": "V3_CANDIDATE_CANONICAL",
        "human_validation_required": True,
    }


def _script_dependencies(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=path.name)
    dependencies = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            dependencies.update(alias.name.split(".", 1)[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            dependencies.add(node.module.split(".", 1)[0])
    return sorted(dependencies)


def _script_assessment(
    relative_path: str,
    path: Path,
    classification: str,
    toolchain_evaluations: dict[str, Any],
) -> dict[str, Any]:
    name = path.name
    contracts = {
        "generate_operational_resources.py": {
            "inputs": ["17 CPS YAML", "REFERENTIEL-CANONIQUE-2026.yaml"],
            "outputs": ["69 ressources sous ressources-generees/"],
            "side_effects": ["supprime puis recrée son répertoire de sortie"],
            "reproducibility": "déterministe pour des sources identiques, sortie à isoler sous .artifacts",
            "test_coverage": "couvert indirectement par validate_cps.py et manifeste généré ; portage à tester",
        },
        "generate_session_kits.py": {
            "inputs": [
                "source-modules.json",
                "curriculum-anchors.yaml",
                "17 CPS YAML",
                "4 banques spécifiques déclarées",
            ],
            "outputs": ["85 kits unitaires, 17 index, 34 compilations et un manifeste CSV"],
            "side_effects": ["écrit un corpus complet et remplace sa destination historique"],
            "reproducibility": "déterministe pour des sources identiques, SOURCE_SHA figé à porter",
            "test_coverage": "couvert par validate_session_kits.py ; portage à tester",
        },
        "validate_cps.py": {
            "inputs": ["17 CPS YAML", "REFERENTIEL-CANONIQUE-2026.yaml"],
            "outputs": ["diagnostic texte et code de sortie"],
            "side_effects": ["aucun"],
            "reproducibility": "déterministe et en lecture seule",
            "test_coverage": "validateur historique utile, à couvrir par tests contractuels canoniques",
        },
        "validate_session_kits.py": {
            "inputs": ["source-modules.json", "MANIFESTE-SEANCES.csv", "corpus de 85 séances"],
            "outputs": ["diagnostic texte, compteurs et code de sortie"],
            "side_effects": ["aucun"],
            "reproducibility": "déterministe et en lecture seule",
            "test_coverage": "validateur historique utile, à couvrir par tests contractuels canoniques",
        },
        "repair_math_cps.py": {
            "inputs": ["5 CPS mathématiques", "table de 100 décisions obstacleVise"],
            "outputs": ["CPS mathématiques réécrites"],
            "side_effects": ["mutation en place des YAML historiques"],
            "reproducibility": "migration non idempotente après application complète",
            "test_coverage": "preuve historique via validate_cps.py, aucun test runtime canonique",
        },
        "balance_answer_positions.py": {
            "inputs": ["17 CPS YAML", "REFERENTIEL-CANONIQUE-2026.yaml"],
            "outputs": ["CPS réordonnées"],
            "side_effects": ["mutation en place des YAML historiques"],
            "reproducibility": "migration déterministe mais non nécessaire au runtime",
            "test_coverage": "preuve historique via validate_cps.py, aucun test runtime canonique",
        },
        "generate_missing_cps.py": {
            "inputs": ["contenu pédagogique encodé dans le script"],
            "outputs": ["8 CPS YAML historiques"],
            "side_effects": ["écriture de sources pédagogiques dans le paquet historique"],
            "reproducibility": "migration déterministe, contenu à ne pas régénérer au runtime",
            "test_coverage": "preuve historique via validate_cps.py, aucun test runtime canonique",
        },
    }
    contract = contracts[name]
    assessment = {
        "relative_path": relative_path,
        "final_classification": classification,
        "dependencies": _script_dependencies(path),
        **contract,
    }
    if name in {"generate_session_kits.py", "validate_session_kits.py"}:
        session_evidence = toolchain_evaluations["session_kits"]
        assessment.update(
            {
                "portability_status": session_evidence["portability_status"],
                "delivered_package_status": session_evidence["delivered_package"][
                    "status"
                ],
                "isolated_execution_status": session_evidence["isolated_execution"][
                    "status"
                ],
                "functional_evidence": "toolchain_evaluations.session_kits",
            }
        )
    elif name in {"generate_operational_resources.py", "validate_cps.py"}:
        positioning_evidence = toolchain_evaluations["positioning_resources"]
        assessment.update(
            {
                "portability_status": positioning_evidence["portability_status"],
                "delivered_package_status": positioning_evidence[
                    "delivered_package"
                ]["status"],
                "isolated_execution_status": positioning_evidence[
                    "isolated_execution"
                ]["status"],
                "functional_evidence": (
                    "toolchain_evaluations.positioning_resources"
                ),
            }
        )
    else:
        assessment.update(
            {
                "portability_status": "HISTORICAL_MIGRATION_NOT_PORTABLE",
                "delivered_package_status": "NOT_EXECUTED",
                "isolated_execution_status": "NOT_EXECUTED",
                "functional_evidence": "classification based on migration side effects",
            }
        )
    return assessment


def _source_manifest_digest(rows: list[dict[str, Any]]) -> str:
    manifest = "".join(
        f'{row["sha256"]}  ./{row["relative_path"]}\n'
        for row in sorted(rows, key=lambda item: item["relative_path"])
    )
    return hashlib.sha256(manifest.encode("utf-8")).hexdigest()


def _actual_source_manifest_digest(
    source_root: Path,
    rows: list[dict[str, Any]],
) -> str:
    manifest = "".join(
        f"{_sha256_file(source_root / row['relative_path'])}  "
        f"./{row['relative_path']}\n"
        for row in sorted(rows, key=lambda item: item["relative_path"])
    )
    return hashlib.sha256(manifest.encode("utf-8")).hexdigest()


def _complete_tree_digest(
    root: Path,
    *,
    excluded_regular_files: Iterable[str | PurePosixPath] = (),
) -> dict[str, Any]:
    resolved_root = root.resolve(strict=True)
    excluded_paths = {
        PurePosixPath(path).as_posix()
        for path in excluded_regular_files
    }
    entries: list[tuple[str, str, str]] = [(".", "directory", "")]

    def visit(directory: Path, relative_directory: PurePosixPath) -> None:
        with os.scandir(directory) as scanned:
            children = sorted(scanned, key=lambda entry: unicodedata.normalize(
                "NFC", entry.name
            ))
        for entry in children:
            relative = (
                PurePosixPath(entry.name)
                if relative_directory == PurePosixPath(".")
                else relative_directory / entry.name
            )
            path = Path(entry.path)
            if relative.as_posix() in excluded_paths:
                continue
            if entry.is_symlink():
                entries.append((relative.as_posix(), "symlink", os.readlink(path)))
            elif entry.is_dir(follow_symlinks=False):
                entries.append((relative.as_posix(), "directory", ""))
                visit(path, relative)
            elif entry.is_file(follow_symlinks=False):
                entries.append((relative.as_posix(), "file", _sha256_file(path)))
            else:
                entries.append((relative.as_posix(), "other", ""))

    visit(resolved_root, PurePosixPath("."))
    entries.sort(key=lambda entry: entry[0])
    digest = hashlib.sha256()
    for relative_path, entry_type, payload in entries:
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(entry_type.encode("ascii"))
        digest.update(b"\0")
        digest.update(payload.encode("utf-8"))
        digest.update(b"\0")
    counts = Counter(entry_type for _, entry_type, _ in entries)
    return {
        "sha256": digest.hexdigest(),
        "entry_count": len(entries),
        "directory_count": counts["directory"],
        "file_count": counts["file"],
        "symlink_count": counts["symlink"],
        "other_count": counts["other"],
    }


def _compare_file_trees(generated_root: Path, imported_root: Path) -> dict[str, Any]:
    generated = {
        path.relative_to(generated_root).as_posix(): _sha256_file(path)
        for path in generated_root.rglob("*")
        if path.is_file() and not path.is_symlink()
    }
    imported = {
        path.relative_to(imported_root).as_posix(): _sha256_file(path)
        for path in imported_root.rglob("*")
        if path.is_file() and not path.is_symlink()
    }
    generated_paths = set(generated)
    imported_paths = set(imported)
    shared = generated_paths & imported_paths
    mismatch_count = sum(generated[path] != imported[path] for path in shared)
    missing_count = len(imported_paths - generated_paths)
    extra_count = len(generated_paths - imported_paths)
    identical_count = sum(generated[path] == imported[path] for path in shared)
    identical = not (missing_count or extra_count or mismatch_count)
    return {
        "status": "IDENTICAL_SHA256" if identical else "DIFFERENT",
        "generated_file_count": len(generated),
        "imported_file_count": len(imported),
        "identical_file_count": identical_count,
        "missing_file_count": missing_count,
        "extra_file_count": extra_count,
        "content_mismatch_count": mismatch_count,
    }


def _not_generated_comparison(imported_root: Path) -> dict[str, Any]:
    return {
        "status": "NOT_GENERATED",
        "generated_file_count": 0,
        "imported_file_count": sum(
            path.is_file() for path in imported_root.rglob("*")
        ),
        "identical_file_count": 0,
        "missing_file_count": 0,
        "extra_file_count": 0,
        "content_mismatch_count": 0,
    }


def _prepare_session_workspace(
    source_root: Path,
    imported_package: Path,
    run_root: Path,
) -> tuple[Path, Path]:
    tools = run_root / "outils"
    positioning = run_root / "positionnement"
    tools.mkdir(parents=True)
    positioning.mkdir()
    for name in ("generate_session_kits.py", "validate_session_kits.py"):
        shutil.copy2(imported_package / "outils" / name, tools / name)
    for name in ("source-modules.json", "curriculum-anchors.yaml"):
        shutil.copy2(imported_package / "sources" / name, tools / name)
    for source in sorted((source_root / POSITIONING_PACKAGE_V3).glob("*.yaml")):
        shutil.copy2(source, positioning / source.name)
    return tools, tools / "corpus-85-seances"


def _evaluate_session_tools(source_root: Path, temporary_root: Path) -> dict[str, Any]:
    imported_package = source_root / SESSION_PACKAGE
    delivered_package = temporary_root / "delivered" / SESSION_PACKAGE
    shutil.copytree(imported_package, delivered_package)
    delivered_generator = _run_copied_python_tool(
        delivered_package / "outils/generate_session_kits.py",
        workspace=delivered_package,
        forbidden_root=source_root,
    )
    delivered_validator = _run_copied_python_tool(
        delivered_package / "outils/validate_session_kits.py",
        workspace=delivered_package,
        forbidden_root=source_root,
    )

    expected_paths = [
        delivered_package / "outils/corpus-85-seances",
        delivered_package / "outils/curriculum-anchors.yaml",
        delivered_package / "outils/source-modules.json",
        delivered_package / "positionnement",
    ]
    missing_expected_paths = [
        f"{SESSION_PACKAGE}/{path.relative_to(delivered_package).as_posix()}"
        for path in expected_paths
        if not path.exists()
    ]
    delivered_status = (
        "FAIL_PATH_LAYOUT"
        if (
            delivered_generator["exception_type"] == "FileNotFoundError"
            and delivered_validator["exception_type"] == "FileNotFoundError"
            and missing_expected_paths
        )
        else "UNEXPECTED_DELIVERED_RESULT"
    )

    runs: list[dict[str, Any]] = []
    generated_corpora: list[Path] = []
    historical_comparisons: list[dict[str, Any]] = []
    for run_number in (1, 2):
        isolated_root = temporary_root / f"isolated-session-{run_number}"
        isolated_tools, generated_corpus = _prepare_session_workspace(
            source_root,
            imported_package,
            isolated_root,
        )
        isolated_generator = _run_copied_python_tool(
            isolated_tools / "generate_session_kits.py",
            workspace=isolated_root,
            forbidden_root=source_root,
        )
        if isolated_generator["status"] == "PASS":
            isolated_validator = _run_copied_python_tool(
                isolated_tools / "validate_session_kits.py",
                workspace=isolated_root,
                forbidden_root=source_root,
            )
        else:
            isolated_validator = {
                "status": "NOT_RUN",
                "returncode": None,
                "exception_type": None,
                "sandbox_status": isolated_generator["sandbox_status"],
            }
        comparison = (
            _compare_file_trees(generated_corpus, imported_package / "corpus")
            if generated_corpus.is_dir()
            else _not_generated_comparison(imported_package / "corpus")
        )
        generated_corpora.append(generated_corpus)
        historical_comparisons.append(comparison)
        runs.append(
            {
                "run": run_number,
                "generator_returncode": isolated_generator["returncode"],
                "generator_sandbox_status": isolated_generator["sandbox_status"],
                "validator_returncode": isolated_validator["returncode"],
                "validator_sandbox_status": isolated_validator["sandbox_status"],
            }
        )
    reproducibility_comparison = (
        _compare_file_trees(generated_corpora[0], generated_corpora[1])
        if all(path.is_dir() for path in generated_corpora)
        else _not_generated_comparison(imported_package / "corpus")
    )
    isolated_status = (
        "PASS"
        if (
            all(
                run["generator_returncode"] == 0
                and run["validator_returncode"] == 0
                and run["generator_sandbox_status"] == "PASS"
                and run["validator_sandbox_status"] == "PASS"
                for run in runs
            )
            and all(
                comparison["status"] == "IDENTICAL_SHA256"
                for comparison in historical_comparisons
            )
            and reproducibility_comparison["status"] == "IDENTICAL_SHA256"
        )
        else "FAIL"
    )
    return {
        "portability_status": "REQUIRES_PATH_ADAPTATION",
        "delivered_package": {
            "status": delivered_status,
            "generator": delivered_generator,
            "validator": delivered_validator,
            "missing_expected_paths": sorted(missing_expected_paths),
            "execution_context": "TEMPORARY_COPY_OF_DELIVERED_LAYOUT",
        },
        "isolated_execution": {
            "status": isolated_status,
            "run_count": len(runs),
            "runs": runs,
            "comparison_to_import": historical_comparisons[0],
            "reproducibility_comparison": reproducibility_comparison,
            "execution_context": "TWO_BWRAP_TEMPORARY_RECONSTRUCTED_LAYOUTS",
        },
    }


def _prepare_positioning_workspace(
    imported_package: Path,
    run_root: Path,
) -> Path:
    run_root.mkdir()
    for source in sorted(imported_package.glob("*.yaml")):
        shutil.copy2(source, run_root / source.name)
    for name in ("generate_operational_resources.py", "validate_cps.py"):
        shutil.copy2(imported_package / name, run_root / name)
    return run_root / "ressources-generees"


def _evaluate_positioning_tools(
    source_root: Path,
    temporary_root: Path,
) -> dict[str, Any]:
    imported_package = source_root / POSITIONING_PACKAGE_V3
    runs: list[dict[str, Any]] = []
    generated_roots: list[Path] = []
    historical_comparisons: list[dict[str, Any]] = []
    for run_number in (1, 2):
        isolated_root = temporary_root / f"isolated-positioning-{run_number}"
        generated_resources = _prepare_positioning_workspace(
            imported_package,
            isolated_root,
        )
        isolated_validator = _run_copied_python_tool(
            isolated_root / "validate_cps.py",
            workspace=isolated_root,
            forbidden_root=source_root,
        )
        isolated_generator = _run_copied_python_tool(
            isolated_root / "generate_operational_resources.py",
            workspace=isolated_root,
            forbidden_root=source_root,
        )
        comparison = (
            _compare_file_trees(
                generated_resources,
                imported_package / "ressources-generees",
            )
            if generated_resources.is_dir()
            else _not_generated_comparison(
                imported_package / "ressources-generees"
            )
        )
        generated_roots.append(generated_resources)
        historical_comparisons.append(comparison)
        runs.append(
            {
                "run": run_number,
                "generator_returncode": isolated_generator["returncode"],
                "generator_sandbox_status": isolated_generator["sandbox_status"],
                "validator_returncode": isolated_validator["returncode"],
                "validator_sandbox_status": isolated_validator["sandbox_status"],
            }
        )
    reproducibility_comparison = (
        _compare_file_trees(generated_roots[0], generated_roots[1])
        if all(path.is_dir() for path in generated_roots)
        else _not_generated_comparison(imported_package / "ressources-generees")
    )
    isolated_status = (
        "PASS"
        if (
            all(
                run["generator_returncode"] == 0
                and run["validator_returncode"] == 0
                and run["generator_sandbox_status"] == "PASS"
                and run["validator_sandbox_status"] == "PASS"
                for run in runs
            )
            and all(
                comparison["status"] == "IDENTICAL_SHA256"
                for comparison in historical_comparisons
            )
            and reproducibility_comparison["status"] == "IDENTICAL_SHA256"
        )
        else "FAIL"
    )
    return {
        "portability_status": "LAYOUT_COMPATIBLE",
        "delivered_package": {
            "status": "LAYOUT_COMPATIBLE_NOT_EXECUTED_IN_SOURCE",
            "execution_context": "STATIC_PATH_CHECK_ONLY",
        },
        "isolated_execution": {
            "status": isolated_status,
            "run_count": len(runs),
            "runs": runs,
            "comparison_to_import": historical_comparisons[0],
            "reproducibility_comparison": reproducibility_comparison,
            "execution_context": "TWO_BWRAP_TEMPORARY_COPIES",
        },
    }


def _evaluate_imported_tools(
    source_root: Path,
    rows: list[dict[str, Any]],
    *,
    excluded_regular_files: Iterable[str | PurePosixPath] = (),
) -> dict[str, Any]:
    manifest_before = _actual_source_manifest_digest(source_root, rows)
    complete_tree_before = _complete_tree_digest(
        source_root,
        excluded_regular_files=excluded_regular_files,
    )
    if complete_tree_before["symlink_count"]:
        raise ValueError("symlinks are forbidden in the historical import")
    with tempfile.TemporaryDirectory(prefix="nexus-pedagogy-tool-evaluation-") as name:
        temporary_root = Path(name)
        session_tools = _evaluate_session_tools(source_root, temporary_root)
        positioning_tools = _evaluate_positioning_tools(source_root, temporary_root)
    manifest_after = _actual_source_manifest_digest(source_root, rows)
    complete_tree_after = _complete_tree_digest(
        source_root,
        excluded_regular_files=excluded_regular_files,
    )
    unchanged = (
        manifest_before == manifest_after
        and complete_tree_before == complete_tree_after
    )
    if not unchanged:
        raise ValueError("historical import mutated during isolated tool evaluation")
    return {
        "session_kits": session_tools,
        "positioning_resources": positioning_tools,
        "source_integrity": {
            "manifest_before_sha256": manifest_before,
            "manifest_after_sha256": manifest_after,
            "complete_tree_before": complete_tree_before,
            "complete_tree_after": complete_tree_after,
            "unchanged": unchanged,
            "execution_policy": (
                "GENERATORS_EXECUTED_ONLY_IN_BWRAP_TEMPORARY_WORKSPACES"
            ),
        },
    }


def _verify_inventory_files(inventory: dict[str, Any], import_root: Path) -> None:
    root = import_root.resolve(strict=True)
    for row in inventory["files"]:
        relative = PurePosixPath(row["relative_path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError(f"unsafe inventory path: {row['relative_path']}")
        path = root.joinpath(*relative.parts)
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"inventory source is not a regular file: {row['relative_path']}")
        if _sha256_file(path) != row["sha256"]:
            raise ValueError(f"inventory hash mismatch: {row['relative_path']}")


def _inventory_path_types(inventory: dict[str, Any]) -> dict[str, str]:
    typed_paths: dict[str, str] = {}
    for collection, entry_type in (
        ("directories", "directory"),
        ("files", "file"),
        ("symlinks", "symlink"),
    ):
        for item in inventory.get(collection, []):
            relative_path = item["relative_path"]
            if relative_path in typed_paths:
                raise ValueError(
                    f"inventory/tree mismatch: duplicate path {relative_path}"
                )
            typed_paths[relative_path] = entry_type
    return typed_paths


def _verify_inventory_tree(
    inventory: dict[str, Any],
    import_root: Path,
    *,
    excluded_regular_files: Iterable[str | PurePosixPath] = (),
) -> None:
    if inventory.get("symlinks"):
        raise ValueError("symlinks are forbidden in the historical inventory")
    current_inventory = build_inventory(
        import_root,
        excluded_regular_files=excluded_regular_files,
    )
    if current_inventory.get("symlinks"):
        raise ValueError("symlinks are forbidden in the historical import")
    expected = _inventory_path_types(inventory)
    current = _inventory_path_types(current_inventory)
    missing = sorted(set(expected) - set(current))
    added = sorted(set(current) - set(expected))
    changed = sorted(
        path
        for path in set(expected) & set(current)
        if expected[path] != current[path]
    )
    if missing or added or changed:
        details = []
        if missing:
            details.append(f"missing={','.join(missing)}")
        if added:
            details.append(f"added={','.join(added)}")
        if changed:
            details.append(
                "type_changed="
                + ",".join(
                    f"{path}:{expected[path]}->{current[path]}"
                    for path in changed
                )
            )
        raise ValueError(f"inventory/tree mismatch: {'; '.join(details)}")


def build_pedagogy_manifest(
    *,
    inventory: dict[str, Any],
    import_root: Path,
    repo_root: Path,
    excluded_regular_files: Iterable[str | PurePosixPath] = (),
) -> dict[str, Any]:
    """Finalize every inventory row and return reports without copying content."""

    source_root = import_root.resolve(strict=True)
    repository = repo_root.resolve(strict=True)
    final_inventory = copy.deepcopy(inventory)
    rows = final_inventory["files"]
    _verify_inventory_tree(
        final_inventory,
        source_root,
        excluded_regular_files=excluded_regular_files,
    )
    _verify_inventory_files(final_inventory, source_root)

    by_path = {row["relative_path"]: row for row in rows}
    for row in rows:
        classification, reason = _base_classification(row)
        row.pop("provisional_classification", None)
        row["final_classification"] = classification
        row["logical_group"] = _logical_identity(row)
        row["decision_reason"] = reason

    exact_groups = find_exact_duplicate_groups(rows)
    for group in exact_groups:
        retained = min(group["members"], key=_candidate_rank)
        group["retained_member"] = retained
        group["decision"] = "RETAIN_ROLE_PRIMARY_AND_MARK_EXCESS_DUPLICATE"
        group["comparison"] = "IDENTICAL_SHA256"
        for member in group["members"]:
            if member == retained:
                continue
            row = by_path[member]
            row["final_classification"] = "DUPLICATE_IDENTICAL"
            row["decision_reason"] = f"copie byte-identique de {retained}"

    catalogue_source_rel = f"{SESSION_PACKAGE}/sources/source-modules.json"
    catalogue_source = source_root / catalogue_source_rel
    repository_catalogue = repository / "content/pre-rentree-2026/modules.json"
    catalogue_identical = (
        normalized_content(catalogue_source) == normalized_content(repository_catalogue)
    )
    if not catalogue_identical:
        by_path[catalogue_source_rel]["final_classification"] = "CONFLICT_REVIEW_REQUIRED"
        by_path[catalogue_source_rel][
            "decision_reason"
        ] = "le catalogue embarqué diverge du catalogue versionné"

    v3_validation: dict[str, dict[str, Any]] = {}
    for row in rows:
        relative = PurePosixPath(row["relative_path"])
        if (
            relative.parts[0] == POSITIONING_PACKAGE_V3
            and row["logical_role"] == "POSITIONING_SOURCE"
            and relative.name != "REFERENTIEL-CANONIQUE-2026.yaml"
        ):
            valid, stats, errors = _validate_cps(source_root / row["relative_path"])
            v3_validation[relative.name] = {
                "structural_validation": "PASS" if valid else "FAIL",
                "statistics": stats,
                "errors": errors,
            }
            if not valid:
                row["final_classification"] = "CONFLICT_REVIEW_REQUIRED"
                row["decision_reason"] = "candidat v3 invalide structurellement"

    qa_report_evidence = _qa_report_evidence(source_root, by_path)
    computed_v3_diffs = compute_v3_diffs(
        source_root,
        v2_package=POSITIONING_PACKAGE_V2,
        v3_package=POSITIONING_PACKAGE_V3,
        expected_modules=PROVEN_V2_MODULES,
    )
    diffs_by_module = {
        item["module"]: item
        for item in computed_v3_diffs["modules"]
    }

    logical_rows: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        logical_rows[(row["logical_role"], row["logical_group"])].append(row)
    logical_group_decisions: list[dict[str, Any]] = []
    for index, ((role, identity), candidates) in enumerate(
        sorted(logical_rows.items()), 1
    ):
        if len(candidates) < 2:
            continue
        paths = [source_root / row["relative_path"] for row in candidates]
        preferred_row = min(candidates, key=lambda row: _candidate_rank(row["relative_path"]))
        evidence: dict[str, Any] | None = None
        if (
            role == "POSITIONING_SOURCE"
            and PurePosixPath(preferred_row["relative_path"]).parts[0]
            == POSITIONING_PACKAGE_V3
            and PurePosixPath(preferred_row["relative_path"]).name in v3_validation
        ):
            candidate_name = PurePosixPath(preferred_row["relative_path"]).name
            validation = v3_validation[candidate_name]
            computed_diff = _diff_evidence_for_module(
                diffs_by_module,
                candidate_name.removesuffix(".yaml"),
            )
            evidence = {
                "structural_validation_passed": (
                    validation["structural_validation"] == "PASS"
                ),
                "qa_report": {
                    "inventory_present": qa_report_evidence[
                        "inventory_present"
                    ],
                    "sha256_matches": qa_report_evidence["sha256_matches"],
                    "assertions_verified": qa_report_evidence[
                        "assertions_verified"
                    ],
                },
                "computed_diff": {
                    "computed": computed_diff["computed"],
                    "allowed_change_counts": computed_diff[
                        "allowed_change_counts"
                    ],
                    "unexpected_change_count": computed_diff[
                        "unexpected_change_count"
                    ],
                    "unexpected_paths": computed_diff["unexpected_paths"],
                },
            }
        comparison = compare_candidate_group(
            paths,
            preferred_path=source_root / preferred_row["relative_path"],
            evidence=evidence,
        )
        if comparison["classification"] == "CONFLICT_REVIEW_REQUIRED":
            for row in candidates:
                row["final_classification"] = "CONFLICT_REVIEW_REQUIRED"
                row["decision_reason"] = "divergence sans preuve de sélection suffisante"
        logical_group_decisions.append(
            {
                "group_id": f"logical-{index:03d}",
                "logical_role": role,
                "logical_identity": identity,
                "candidates": sorted(row["relative_path"] for row in candidates),
                "selected": preferred_row["relative_path"]
                if comparison["selected"] is not None
                else None,
                "comparison": comparison["comparison"],
                "selection_evidence": evidence or {},
            }
        )

    if (
        not qa_report_evidence["inventory_present"]
        or not qa_report_evidence["sha256_matches"]
        or not qa_report_evidence["assertions_verified"]
        or not computed_v3_diffs["computed"]
        or computed_v3_diffs["unexpected_change_count"]
    ):
        for row in rows:
            relative = PurePosixPath(row["relative_path"])
            if (
                row["logical_role"] == "POSITIONING_SOURCE"
                and relative.name != "REFERENTIEL-CANONIQUE-2026.yaml"
                and (
                    relative.parts[0] == POSITIONING_PACKAGE_V3
                    or (
                        relative.parts[0] == SESSION_PACKAGE
                        and "cps" in relative.parts
                    )
                )
            ):
                row["final_classification"] = "CONFLICT_REVIEW_REQUIRED"
                row["decision_reason"] = (
                    "preuve QA ou diff v2→v3 incomplète ou inattendue"
                )

    toolchain_evaluations = _evaluate_imported_tools(
        source_root,
        rows,
        excluded_regular_files=excluded_regular_files,
    )
    if toolchain_evaluations["session_kits"]["isolated_execution"]["status"] != "PASS":
        for row in rows:
            if PurePosixPath(row["relative_path"]).name in {
                "generate_session_kits.py",
                "validate_session_kits.py",
            }:
                row["final_classification"] = "CONFLICT_REVIEW_REQUIRED"
                row["decision_reason"] = (
                    "chaîne séances non reproductible dans le layout temporaire"
                )
    if (
        toolchain_evaluations["positioning_resources"]["isolated_execution"]["status"]
        != "PASS"
    ):
        for row in rows:
            if PurePosixPath(row["relative_path"]).name in {
                "generate_operational_resources.py",
                "validate_cps.py",
            }:
                row["final_classification"] = "CONFLICT_REVIEW_REQUIRED"
                row["decision_reason"] = (
                    "chaîne positionnement non reproductible dans le layout temporaire"
                )
    _verify_inventory_tree(
        final_inventory,
        source_root,
        excluded_regular_files=excluded_regular_files,
    )
    _verify_inventory_files(final_inventory, source_root)

    script_assessments = []
    for row in rows:
        name = PurePosixPath(row["relative_path"]).name
        if name in USEFUL_GENERATORS | USEFUL_VALIDATORS | HISTORICAL_MIGRATIONS:
            script_assessments.append(
                _script_assessment(
                    row["relative_path"],
                    source_root / row["relative_path"],
                    row["final_classification"],
                    toolchain_evaluations,
                )
            )
    script_assessments.sort(key=lambda item: item["relative_path"])

    class_matrix = {
        classification: 0
        for classification in (
            "CANONICAL_SOURCE",
            "GENERATOR",
            "VALIDATOR",
            "GENERATED_OUTPUT",
            "HISTORICAL_VERSION",
            "ARCHIVE_PACKAGE",
            "DUPLICATE_IDENTICAL",
            "CONFLICT_REVIEW_REQUIRED",
            "UNCLASSIFIED",
        )
    }
    for row in rows:
        classification = row["final_classification"]
        if classification not in FINAL_CLASSIFICATIONS:
            raise ValueError(f"invalid final classification: {classification}")
        class_matrix[classification] += 1
    if class_matrix["UNCLASSIFIED"]:
        unknown = [
            row["relative_path"]
            for row in rows
            if row["final_classification"] == "UNCLASSIFIED"
        ]
        raise ValueError(f"unclassified files: {', '.join(unknown)}")

    final_inventory["schema_version"] = 2
    final_inventory["summary"]["classification_matrix"] = class_matrix
    final_inventory["summary"]["pending_deduplication_count"] = 0
    final_inventory["summary"]["unclassified_count"] = class_matrix["UNCLASSIFIED"]
    final_inventory["summary"]["conflict_count"] = class_matrix[
        "CONFLICT_REVIEW_REQUIRED"
    ]

    session_units = sum(row["logical_role"] in SESSION_UNIT_ROLES for row in rows)
    module_readmes = sum(
        row["final_classification"] == "CANONICAL_SOURCE"
        and row["logical_role"] == "DOCUMENTATION"
        and "/corpus/modules/" in row["relative_path"]
        and row["relative_path"].endswith("/README.md")
        for row in rows
    )
    compiled_outputs = sum(
        row["logical_role"] == "GENERATED_RESOURCE"
        and PurePosixPath(row["relative_path"]).name
        in {"CAHIER-ELEVE.md", "GUIDE-ENSEIGNANT.md"}
        for row in rows
    )
    decisions = {
        "schema_version": 1,
        "summary": {
            "file_count": len(rows),
            "class_matrix": class_matrix,
            "exact_duplicate_group_count": len(exact_groups),
            "exact_duplicate_excess_count": sum(
                group["excess_copy_count"] for group in exact_groups
            ),
            "logical_comparison_group_count": len(logical_group_decisions),
            "unresolved_conflict_count": class_matrix["CONFLICT_REVIEW_REQUIRED"],
            "source_manifest_sha256": _source_manifest_digest(rows),
        },
        "method": {
            "comparison_order": [
                "SHA-256 byte identity",
                "YAML/JSON parsed normalization",
                "CSV header/key/row normalization when row order is non-semantic",
                "Markdown/text Unicode, line-ending and trailing-space normalization",
            ],
            "grouping": "logical role plus stable logical identity",
            "copy_policy": "classification only; no content copied or canonicalized",
        },
        "exact_duplicate_groups": exact_groups,
        "logical_group_decisions": logical_group_decisions,
        "catalogue_comparison": {
            "source": catalogue_source_rel,
            "repository_target": "content/pre-rentree-2026/modules.json",
            "normalized_identical": catalogue_identical,
            "classification": (
                "DUPLICATE_IDENTICAL"
                if catalogue_identical
                else "CONFLICT_REVIEW_REQUIRED"
            ),
        },
        "v3_candidate_validation": v3_validation,
        "v3_selection_evidence": {
            "qa_report": qa_report_evidence,
            "computed_diffs": computed_v3_diffs,
        },
        "v3_math_corrections": _math_correction_evidence(source_root),
        "session_sources": {
            "unit_file_count": session_units,
            "module_readme_count": module_readmes,
            "manifest_count": sum(
                row["logical_role"] == "SESSION_MANIFEST"
                and row["final_classification"] == "CANONICAL_SOURCE"
                for row in rows
            ),
            "compiled_output_count": compiled_outputs,
            "selection_status": "CANDIDATE_CANONICAL",
        },
        "script_assessments": script_assessments,
        "toolchain_evaluations": toolchain_evaluations,
        "human_validation": {
            "required": True,
            "publication_approved": False,
            "reason": "la validation structurelle ne remplace pas la relecture pédagogique nominative",
        },
        "missing_modules": [
            {
                "module": "seconde-physique-chimie",
                "status": "INTENTIONALLY_BLOCKED",
                "reason": "absent du catalogue 17 modules et du corpus ; aucune création implicite",
            }
        ],
    }
    return {"inventory": final_inventory, "decisions": decisions}


def _atomic_write_text(destination: Path, content: str) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        dir=destination.parent,
        prefix=f".{destination.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            descriptor = -1
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, destination)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary_path.unlink(missing_ok=True)


def write_manifest_outputs(result: dict[str, Any], output_root: Path) -> None:
    """Write only the final inventory and machine-readable decisions."""

    output = output_root.resolve()
    output.mkdir(parents=True, exist_ok=True)
    inventory = result["inventory"]
    decisions = result["decisions"]
    rows = inventory["files"]
    fields = list(rows[0].keys()) if rows else []
    csv_buffer = io.StringIO(newline="")
    writer = csv.DictWriter(csv_buffer, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    _atomic_write_text(output / FINAL_CSV_NAME, csv_buffer.getvalue())
    _atomic_write_text(
        output / FINAL_JSON_NAME,
        json.dumps(inventory, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )
    _atomic_write_text(
        output / MACHINE_DECISIONS_NAME,
        json.dumps(decisions, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import-root", required=True, type=Path)
    parser.add_argument("--repo-root", default=Path.cwd(), type=Path)
    parser.add_argument("--output-root", required=True, type=Path)
    parser.add_argument("--inventory", type=Path)
    args = parser.parse_args()
    try:
        _assert_output_outside_import(args.import_root, args.output_root)
        excluded_regular_files = validate_complete_import_root(args.import_root)
        inventory_path = args.inventory or args.output_root / "INVENTAIRE-IMPORT.json"
        if inventory_path.is_file():
            inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
        else:
            inventory = build_inventory(
                args.import_root,
                excluded_regular_files=excluded_regular_files,
            )
        validate_complete_inventory(inventory)
        result = build_pedagogy_manifest(
            inventory=inventory,
            import_root=args.import_root,
            repo_root=args.repo_root,
            excluded_regular_files=excluded_regular_files,
        )
        write_manifest_outputs(result, args.output_root)
    except (FileNotFoundError, NotADirectoryError, OSError, ValueError, yaml.YAMLError) as error:
        parser.error(str(error))

    summary = result["decisions"]["summary"]
    print(f'FILE_COUNT={summary["file_count"]}')
    print(f'EXACT_DUPLICATE_GROUP_COUNT={summary["exact_duplicate_group_count"]}')
    print(f'EXACT_DUPLICATE_EXCESS_COUNT={summary["exact_duplicate_excess_count"]}')
    for classification, count in summary["class_matrix"].items():
        print(f"CLASS_{classification}={count}")
    print(f'SOURCE_MANIFEST_SHA256={summary["source_manifest_sha256"]}')
    return 0


if __name__ == "__main__":
    sys.exit(main())

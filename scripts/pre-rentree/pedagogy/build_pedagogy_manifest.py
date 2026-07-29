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
import sys
import tempfile
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

import yaml

from classification import FINAL_CLASSIFICATIONS
from import_pedagogy_corpus import (
    build_inventory,
    validate_complete_import_root,
    validate_complete_inventory,
)


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
    return bool(
        evidence
        and evidence.get("structural_validation") == "PASS"
        and evidence.get("qa_reference")
        and evidence.get("diff_summary")
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


def _script_assessment(relative_path: str, path: Path, classification: str) -> dict[str, Any]:
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
    return {
        "relative_path": relative_path,
        "final_classification": classification,
        "dependencies": _script_dependencies(path),
        **contract,
    }


def _source_manifest_digest(rows: list[dict[str, Any]]) -> str:
    manifest = "".join(
        f'{row["sha256"]}  ./{row["relative_path"]}\n'
        for row in sorted(rows, key=lambda item: item["relative_path"])
    )
    return hashlib.sha256(manifest.encode("utf-8")).hexdigest()


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


def build_pedagogy_manifest(
    *,
    inventory: dict[str, Any],
    import_root: Path,
    repo_root: Path,
) -> dict[str, Any]:
    """Finalize every inventory row and return reports without copying content."""

    source_root = import_root.resolve(strict=True)
    repository = repo_root.resolve(strict=True)
    final_inventory = copy.deepcopy(inventory)
    rows = final_inventory["files"]
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
            validation = v3_validation[PurePosixPath(preferred_row["relative_path"]).name]
            evidence = {
                "structural_validation": validation["structural_validation"],
                "qa_reference": (
                    f"{POSITIONING_PACKAGE_V3}/"
                    "RAPPORT-QA-COMPLET-17-MODULES-2026.md"
                ),
                "diff_summary": {
                    "candidate_generation": "v3",
                    "historical_generations": ["v1", "v2"],
                    "human_validation_required": True,
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

    script_assessments = []
    for row in rows:
        name = PurePosixPath(row["relative_path"]).name
        if name in USEFUL_GENERATORS | USEFUL_VALIDATORS | HISTORICAL_MIGRATIONS:
            script_assessments.append(
                _script_assessment(
                    row["relative_path"],
                    source_root / row["relative_path"],
                    row["final_classification"],
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
        validate_complete_import_root(args.import_root)
        inventory_path = args.inventory or args.output_root / "INVENTAIRE-IMPORT.json"
        if inventory_path.is_file():
            inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
        else:
            inventory = build_inventory(args.import_root)
        validate_complete_inventory(inventory)
        result = build_pedagogy_manifest(
            inventory=inventory,
            import_root=args.import_root,
            repo_root=args.repo_root,
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

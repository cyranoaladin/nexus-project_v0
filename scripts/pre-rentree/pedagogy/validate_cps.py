#!/usr/bin/env python3
"""Validate the canonical Pré-rentrée 2026 positioning sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator


STATUS = "HUMAN_VALIDATION_REQUIRED"


def _load_yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _schema_errors(document: Any, schema_path: Path) -> list[str]:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    return [
        f"{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
        for error in sorted(
            Draft202012Validator(schema).iter_errors(document),
            key=lambda error: tuple(str(part) for part in error.absolute_path),
        )
    ]


def validate(repo_root: Path) -> tuple[list[str], dict[str, int]]:
    """Return validation errors and deterministic corpus counts."""

    errors: list[str] = []
    content_root = repo_root / "content/pre-rentree-2026"
    pedagogy_root = content_root / "pedagogy"
    positioning_root = pedagogy_root / "positioning"
    schema_root = repo_root / "scripts/pre-rentree/pedagogy/schemas"

    required = {
        "module catalog": content_root / "modules.json",
        "reference": positioning_root / "REFERENTIEL-CANONIQUE-2026.yaml",
        "manifest": pedagogy_root / "manifest.yaml",
        "CPS schema": schema_root / "cps.schema.json",
        "manifest schema": schema_root / "pedagogy-manifest.schema.json",
    }
    for label, path in required.items():
        if not path.is_file():
            errors.append(f"{label} manquant : {path.relative_to(repo_root)}")
    if errors:
        return errors, {}

    catalog = json.loads(required["module catalog"].read_text(encoding="utf-8"))
    modules = catalog.get("modules", [])
    module_by_id = {module.get("id"): module for module in modules}
    if len(modules) != 17 or len(module_by_id) != 17:
        errors.append(f"modules.json doit contenir 17 identifiants uniques ({len(modules)} trouvés)")
    if "seconde-physique-chimie" in module_by_id:
        errors.append("module interdit créé artificiellement : seconde-physique-chimie")

    reference = _load_yaml(required["reference"])
    reference_modules = reference.get("modules", [])
    reference_ids = [entry.get("moduleId") for entry in reference_modules]
    if len(reference_ids) != 17 or set(reference_ids) != set(module_by_id):
        errors.append("le référentiel ne couvre pas exactement les 17 modules de modules.json")

    manifest = _load_yaml(required["manifest"])
    for message in _schema_errors(manifest, required["manifest schema"]):
        errors.append(f"manifest.yaml: {message}")
    manifest_modules = {entry.get("id"): entry for entry in manifest.get("modules", [])}
    if set(manifest_modules) != set(module_by_id):
        errors.append("manifest.yaml ne couvre pas exactement les modules de modules.json")
    global_validation = manifest.get("humanValidation", {})
    if global_validation.get("status") != STATUS:
        errors.append(f"statut global doit rester {STATUS}")
    if global_validation.get("reviewer") is not None or global_validation.get("validatedAt") is not None:
        errors.append("validation humaine globale simulée : reviewer/validatedAt doivent rester null")

    counts = {"modules": len(modules), "cps": 0, "nodes": 0, "evaluatedNodes": 0, "items": 0, "manualResponses": 0}
    correct_positions: set[int] = set()
    expected_cps_files: set[str] = set()
    for entry in reference_modules:
        module_id = entry.get("moduleId")
        filename = entry.get("cps")
        if not isinstance(filename, str):
            errors.append(f"{module_id}: nom de CPS absent")
            continue
        expected_cps_files.add(filename)
        path = positioning_root / "cps" / filename
        if not path.is_file():
            errors.append(f"CPS manquante : {path.relative_to(repo_root)}")
            continue
        counts["cps"] += 1
        cps = _load_yaml(path)
        for message in _schema_errors(cps, required["CPS schema"]):
            errors.append(f"{filename}: {message}")

        module = module_by_id.get(module_id, {})
        if cps.get("id") != Path(filename).stem:
            errors.append(f"{filename}: id CPS différent du nom de fichier")
        if cps.get("niveauEntree") != module.get("level") or cps.get("niveauEntree") != entry.get("niveau"):
            errors.append(f"{filename}: niveau incohérent avec modules.json/référentiel")
        if cps.get("matiere") != module.get("subjectId") or cps.get("matiere") != entry.get("matiere"):
            errors.append(f"{filename}: matière incohérente avec modules.json/référentiel")
        if cps.get("statutValidation") != STATUS:
            errors.append(f"{filename}: statutValidation doit rester {STATUS}")

        nodes = cps.get("noeuds") or []
        evaluated = [node for node in nodes if node.get("evalueParTest") is True]
        counts["nodes"] += len(nodes)
        counts["evaluatedNodes"] += len(evaluated)
        if len(evaluated) != 8:
            errors.append(f"{filename}: 8 nœuds évalués attendus, {len(evaluated)} trouvés")
        node_ids: set[str] = set()
        item_ids: set[str] = set()
        for node in nodes:
            node_id = node.get("id")
            if node_id in node_ids:
                errors.append(f"{filename}: nodeId dupliqué {node_id}")
            node_ids.add(node_id)
            items = node.get("items") or []
            if node.get("evalueParTest") is True:
                if not isinstance(node.get("seanceRattachement"), int) or not 1 <= node["seanceRattachement"] <= 5:
                    errors.append(f"{filename}/{node_id}: seanceRattachement hors 1..5")
                if [item.get("palier") for item in items] != ["A", "B", "C"]:
                    errors.append(f"{filename}/{node_id}: paliers attendus dans l'ordre A/B/C")
            elif items or not node.get("motifNonEvalue"):
                errors.append(f"{filename}/{node_id}: nœud non évalué mal justifié")

            for item in items:
                item_id = item.get("id")
                counts["items"] += 1
                if item_id in item_ids:
                    errors.append(f"{filename}: itemId dupliqué {item_id}")
                item_ids.add(item_id)
                if item.get("type") == "reponse_courte":
                    counts["manualResponses"] += 1
                    if item.get("correctionManuelle") is not True or item.get("excluScoringAutomatique") is not True:
                        errors.append(f"{filename}/{item_id}: réponse manuelle incluse dans le scoring automatique")
                    if "propositions" in item:
                        errors.append(f"{filename}/{item_id}: réponse manuelle avec propositions")
                    continue
                propositions = item.get("propositions") or []
                correct = [index for index, proposition in enumerate(propositions) if proposition.get("correcte") is True]
                if len(correct) != 1:
                    errors.append(f"{filename}/{item_id}: exactement une réponse correcte requise")
                else:
                    correct_positions.add(correct[0])
                for proposition in propositions:
                    if proposition.get("correcte") is not True:
                        obstacle = proposition.get("obstacleVise")
                        if not isinstance(obstacle, int) or not 0 <= obstacle < len(node.get("obstacles") or []):
                            errors.append(f"{filename}/{item_id}: obstacleVise invalide")

        manifest_entry = manifest_modules.get(module_id, {})
        if manifest_entry.get("editorialStatus") != STATUS:
            errors.append(f"manifest.yaml/{module_id}: statut éditorial doit rester {STATUS}")
        human = manifest_entry.get("humanValidation", {})
        if human.get("reviewer") is not None or human.get("validatedAt") is not None:
            errors.append(f"manifest.yaml/{module_id}: validation humaine simulée")
        manifest_cps = manifest_entry.get("cps", {})
        if manifest_cps.get("path") != path.relative_to(repo_root).as_posix():
            errors.append(f"manifest.yaml/{module_id}: chemin CPS incohérent")
        if manifest_cps.get("sha256") != _sha256(path):
            errors.append(f"manifest.yaml/{module_id}: hash CPS divergent")

    actual_cps_files = {path.name for path in (positioning_root / "cps").glob("*.yaml")}
    if actual_cps_files != expected_cps_files:
        errors.append("le dossier CPS contient des fichiers absents du référentiel ou en omet")
    if correct_positions != {0, 1, 2, 3}:
        errors.append("distribution des bonnes réponses insuffisante : les positions A/B/C/D doivent être utilisées")

    expected_counts = {
        "modules": 17,
        "cps": 17,
        "nodes": 141,
        "evaluatedNodes": 136,
        "items": 408,
        "manualResponses": 33,
    }
    for key, expected in expected_counts.items():
        if counts[key] != expected:
            errors.append(f"{key}: {expected} attendu, {counts[key]} trouvé")
    for key, expected in expected_counts.items():
        if manifest.get("counts", {}).get(key) != expected:
            errors.append(f"manifest.yaml/counts/{key}: {expected} attendu")

    for source in manifest.get("sharedSources", []):
        path = repo_root / source.get("path", "")
        if not path.is_file() or source.get("sha256") != _sha256(path):
            errors.append(f"source partagée absente ou hash divergent : {source.get('path')}")
    return errors, counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    repo_root = args.repo_root.resolve()
    errors, counts = validate(repo_root)
    print(json.dumps(counts, ensure_ascii=False, indent=2, sort_keys=True))
    if errors:
        print("VALIDATION CPS: ECHEC", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        raise SystemExit(1)
    print("VALIDATION CPS: OK")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Validate the canonical Pré-rentrée 2026 session-kit sources."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator


STATUS = "HUMAN_VALIDATION_REQUIRED"
UNIT_FILENAMES = {
    "banques-eleve.md",
    "corrige-commente.md",
    "verification-eleve.md",
    "verification-correction.md",
}
STUDENT_LEAK_MARKERS = re.compile(
    r"^\s*(?:(?:#{1,6}\s+)(?:solution|réponse attendue|corrigé|barème enseignant|"
    r"diagnostic attendu|éléments de correction|décision pédagogique)\b|"
    r"(?:\*\*)?(?:solution|réponse attendue|corrigé|barème enseignant|"
    r"diagnostic attendu|éléments de correction|décision pédagogique)\s*:\s*(?:\*\*)?)",
    flags=re.IGNORECASE | re.MULTILINE,
)
EXPLICIT_ANSWER_LEAK = re.compile(
    r"^[ \t]*\*\*réponse[ \t]*:[ \t]*\*\*[ \t]*\S.*$",
    flags=re.IGNORECASE | re.MULTILINE,
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _file_text(path: Path, errors: list[str], repo_root: Path) -> str:
    if not path.is_file():
        errors.append(f"fichier manquant : {path.relative_to(repo_root)}")
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeError as error:
        errors.append(f"UTF-8 invalide : {path.relative_to(repo_root)} ({error})")
        return ""


def validate(repo_root: Path) -> tuple[list[str], dict[str, int]]:
    """Return validation errors and deterministic session corpus counts."""

    errors: list[str] = []
    content_root = repo_root / "content/pre-rentree-2026"
    pedagogy_root = content_root / "pedagogy"
    session_root = pedagogy_root / "session-kits"
    manifest_path = session_root / "MANIFESTE-SEANCES.csv"
    required = [
        content_root / "modules.json",
        pedagogy_root / "manifest.yaml",
        pedagogy_root / "positioning/REFERENTIEL-CANONIQUE-2026.yaml",
        repo_root / "scripts/pre-rentree/pedagogy/schemas/session-kit.schema.json",
        repo_root / "scripts/pre-rentree/pedagogy/schemas/pedagogy-manifest.schema.json",
    ]
    for path in required + [manifest_path]:
        if not path.is_file():
            errors.append(f"fichier manquant : {path.relative_to(repo_root)}")
    if errors:
        return errors, {}

    catalog = json.loads(required[0].read_text(encoding="utf-8"))
    modules = catalog.get("modules", [])
    module_by_id = {module.get("id"): module for module in modules}
    if len(modules) != 17 or len(module_by_id) != 17:
        errors.append(f"17 modules uniques attendus, {len(modules)} trouvés")
    if "seconde-physique-chimie" in module_by_id:
        errors.append("module interdit créé artificiellement : seconde-physique-chimie")

    manifest = yaml.safe_load(required[1].read_text(encoding="utf-8"))
    manifest_schema = json.loads(required[4].read_text(encoding="utf-8"))
    for schema_error in Draft202012Validator(manifest_schema).iter_errors(manifest):
        path = "/".join(map(str, schema_error.absolute_path)) or "<root>"
        errors.append(f"manifest.yaml/{path}: {schema_error.message}")
    manifest_modules = {entry.get("id"): entry for entry in manifest.get("modules", [])}
    reference = yaml.safe_load(required[2].read_text(encoding="utf-8"))
    cps_by_module: dict[str, dict[str, Any]] = {}
    for entry in reference.get("modules", []):
        path = pedagogy_root / "positioning/cps" / entry["cps"]
        if path.is_file():
            cps_by_module[entry["moduleId"]] = yaml.safe_load(path.read_text(encoding="utf-8"))

    schema = json.loads(required[3].read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    with manifest_path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None or len(reader.fieldnames) != len(set(reader.fieldnames)):
            errors.append("en-têtes CSV absents ou dupliqués")
        rows = list(reader)
    typed_rows: list[dict[str, Any]] = []
    for line, row in enumerate(rows, start=2):
        try:
            typed = {
                **row,
                "seance": int(row["seance"]),
                "banques": int(row["banques"]),
                "exercices": int(row["exercices"]),
                "questionsVerification": int(row["questionsVerification"]),
            }
        except (KeyError, TypeError, ValueError) as error:
            errors.append(f"MANIFESTE-SEANCES.csv ligne {line}: valeur invalide ({error})")
            continue
        typed_rows.append(typed)
        for schema_error in validator.iter_errors(typed):
            path = "/".join(map(str, schema_error.absolute_path)) or "<root>"
            errors.append(f"MANIFESTE-SEANCES.csv ligne {line}/{path}: {schema_error.message}")

    keys = [(row["moduleId"], row["seance"]) for row in typed_rows]
    if len(keys) != len(set(keys)):
        errors.append("MANIFESTE-SEANCES.csv contient des couples module/séance dupliqués")
    expected_keys = {
        (module["id"], session["number"])
        for module in modules
        for session in module.get("sessions", [])
    }
    if set(keys) != expected_keys:
        errors.append("MANIFESTE-SEANCES.csv ne couvre pas exactement les 85 séances de modules.json")
    for row in typed_rows:
        module = module_by_id.get(row["moduleId"])
        if module is None:
            continue
        session = next(
            (
                candidate
                for candidate in module.get("sessions", [])
                if candidate.get("number") == row["seance"]
            ),
            None,
        )
        if row["niveau"] != module.get("level"):
            errors.append(
                f"{row['moduleId']}/{row['seance']}: niveau incohérent avec modules.json"
            )
        if row["matiere"] != module.get("subjectId"):
            errors.append(
                f"{row['moduleId']}/{row['seance']}: matière incohérente avec modules.json"
            )
        if session is not None and row["intitule"] != session.get("title"):
            errors.append(
                f"{row['moduleId']}/{row['seance']}: intitulé incohérent avec modules.json"
            )

    counts = {
        "modules": len(modules),
        "sessions": 0,
        "banks": 0,
        "exercises": 0,
        "corrections": 0,
        "exitTickets": 0,
        "exitQuestions": 0,
        "sessionUnitFiles": 0,
        "specificResources": 0,
        "exactPromptDuplicates": 0,
    }
    all_prompts: list[str] = []
    row_by_key = {(row["moduleId"], row["seance"]): row for row in typed_rows}
    for module in modules:
        module_id = module["id"]
        module_dir = session_root / "modules" / module_id
        readme_path = module_dir / "README.md"
        readme = _file_text(readme_path, errors, repo_root)
        if module["title"] not in readme or STATUS not in readme:
            errors.append(f"index module incohérent : {readme_path.relative_to(repo_root)}")
        forbidden_compilations = [module_dir / name for name in ("CAHIER-ELEVE.md", "GUIDE-ENSEIGNANT.md")]
        for path in forbidden_compilations:
            if path.exists():
                errors.append(f"sortie générée copiée parmi les sources : {path.relative_to(repo_root)}")

        manifest_module = manifest_modules.get(module_id, {})
        readme_source = manifest_module.get("readme", {})
        if readme_source.get("path") != readme_path.relative_to(repo_root).as_posix():
            errors.append(f"manifest.yaml/{module_id}: chemin README incohérent")
        if readme_path.is_file() and readme_source.get("sha256") != _sha256(readme_path):
            errors.append(f"manifest.yaml/{module_id}: hash README divergent")
        manifest_sessions = {
            entry.get("number"): entry for entry in manifest_module.get("sessions", [])
        }

        for session in module.get("sessions", []):
            counts["sessions"] += 1
            key = (module_id, session["number"])
            row = row_by_key.get(key)
            if row is None:
                continue
            session_dir = session_root / row["dossier"]
            if session_dir.parent != module_dir:
                errors.append(f"{key}: dossier hors du module attendu")
            actual_files = {path.name for path in session_dir.iterdir()} if session_dir.is_dir() else set()
            if actual_files != UNIT_FILENAMES:
                errors.append(
                    f"{key}: fichiers unitaires attendus {sorted(UNIT_FILENAMES)}, trouvés {sorted(actual_files)}"
                )
            texts = {
                filename: _file_text(session_dir / filename, errors, repo_root)
                for filename in sorted(UNIT_FILENAMES)
            }
            counts["sessionUnitFiles"] += sum(
                (session_dir / filename).is_file() for filename in UNIT_FILENAMES
            )
            student = texts["banques-eleve.md"]
            correction = texts["corrige-commente.md"]
            exit_student = texts["verification-eleve.md"]
            exit_correction = texts["verification-correction.md"]
            for filename, text in texts.items():
                if STATUS not in text or session["title"] not in text:
                    errors.append(f"{key}: statut ou intitulé absent de {filename}")
                for token in ("TODO", "TBD", "{{", "}}", "À compléter", "PLACEHOLDER"):
                    if token in text:
                        errors.append(f"{key}: jeton interdit {token!r} dans {filename}")
            if "correcte: true" in student or re.search(
                r"^### Correction\b", student, flags=re.MULTILINE
            ):
                errors.append(f"{key}: solution exposée dans banques-eleve.md")
            for student_name, student_text in (
                ("banques-eleve.md", student),
                ("verification-eleve.md", exit_student),
            ):
                marker = STUDENT_LEAK_MARKERS.search(
                    student_text
                ) or EXPLICIT_ANSWER_LEAK.search(student_text)
                if marker:
                    errors.append(
                        f"{key}: fuite élève dans {student_name} ({marker.group(0).strip()})"
                    )
            if re.search(r"^### Correction\b", exit_student, flags=re.MULTILINE) or (
                "correcte: true" in exit_student
            ):
                errors.append(f"{key}: fuite élève dans verification-eleve.md")
            if "Décision pédagogique" not in exit_correction:
                errors.append(f"{key}: décision pédagogique absente du corrigé de vérification")

            exercises = re.findall(r"^### Exercice [ABC][1-3]$", student, flags=re.MULTILINE)
            corrections = re.findall(r"^### Correction [ABC][1-3]$", correction, flags=re.MULTILINE)
            exit_questions = re.findall(r"^### Question [1-3]$", exit_student, flags=re.MULTILINE)
            exit_corrections = re.findall(
                r"^### Correction question [1-3]$", exit_correction, flags=re.MULTILINE
            )
            if len(exercises) != 9 or len(corrections) != 9:
                errors.append(f"{key}: 9 exercices et 9 corrections requis")
            if len(exit_questions) != 3 or len(exit_corrections) != 3:
                errors.append(f"{key}: exit ticket incomplet")
            for tier in "ABC":
                if f"## Banque {tier}" not in student or f"## Banque {tier}" not in correction:
                    errors.append(f"{key}: banque {tier} absente")

            cps = cps_by_module.get(module_id, {})
            expected_nodes = [
                node["id"]
                for node in cps.get("noeuds", [])
                if node.get("evalueParTest") is True
                and node.get("seanceRattachement") == session["number"]
            ]
            actual_nodes = row["noeudsCPS"].split("|") if row["noeudsCPS"] else []
            if actual_nodes != expected_nodes:
                errors.append(f"{key}: rattachement CPS divergent ({actual_nodes} != {expected_nodes})")
            is_specific = row["ressourceSpecifique"] == "OUI"
            counts["specificResources"] += int(is_specific)
            if is_specific != (not expected_nodes):
                errors.append(f"{key}: justification ressourceSpecifique incohérente")

            all_prompts.extend(
                part.split("**Réponse et justification**", 1)[0].strip()
                for part in re.split(
                    r"^### Exercice [ABC][1-3]\n$", student, flags=re.MULTILINE
                )[1:]
            )
            counts["banks"] += 3
            counts["exercises"] += len(exercises)
            counts["corrections"] += len(corrections)
            counts["exitTickets"] += 1
            counts["exitQuestions"] += len(exit_questions)

            manifest_session = manifest_sessions.get(session["number"], {})
            if manifest_session.get("path") != session_dir.relative_to(repo_root).as_posix():
                errors.append(f"manifest.yaml/{key}: chemin de séance incohérent")
            hashed_files = {
                entry.get("path"): entry.get("sha256")
                for entry in manifest_session.get("files", [])
            }
            for filename in UNIT_FILENAMES:
                path = session_dir / filename
                relative = path.relative_to(repo_root).as_posix()
                if path.is_file() and hashed_files.get(relative) != _sha256(path):
                    errors.append(f"manifest.yaml/{key}: hash divergent pour {filename}")

    counts["exactPromptDuplicates"] = len(all_prompts) - len(set(all_prompts))
    expected_counts = {
        "modules": 17,
        "sessions": 85,
        "banks": 255,
        "exercises": 765,
        "corrections": 765,
        "exitTickets": 85,
        "exitQuestions": 255,
        "sessionUnitFiles": 340,
        "specificResources": 4,
        "exactPromptDuplicates": 0,
    }
    for key, expected in expected_counts.items():
        if counts[key] != expected:
            errors.append(f"{key}: {expected} attendu, {counts[key]} trouvé")
    if manifest.get("counts", {}).get("sessions") != 85:
        errors.append("manifest.yaml/counts/sessions doit valoir 85")
    if manifest.get("counts", {}).get("sessionUnitFiles") != 340:
        errors.append("manifest.yaml/counts/sessionUnitFiles doit valoir 340")
    return errors, counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    repo_root = args.repo_root.resolve()
    errors, counts = validate(repo_root)
    print(json.dumps(counts, ensure_ascii=False, indent=2, sort_keys=True))
    if errors:
        print("VALIDATION KITS DE SEANCE: ECHEC", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        raise SystemExit(1)
    print("VALIDATION KITS DE SEANCE: OK")


if __name__ == "__main__":
    main()

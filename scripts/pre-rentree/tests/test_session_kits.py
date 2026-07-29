from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import jsonschema
import pytest
import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
PEDAGOGY_ROOT = REPO_ROOT / "content/pre-rentree-2026/pedagogy"
SESSION_ROOT = PEDAGOGY_ROOT / "session-kits"
SCHEMA_ROOT = REPO_ROOT / "scripts/pre-rentree/pedagogy/schemas"


def modules() -> list[dict]:
    return json.loads(
        (REPO_ROOT / "content/pre-rentree-2026/modules.json").read_text(encoding="utf-8")
    )["modules"]


def manifest_rows() -> list[dict[str, str]]:
    with (SESSION_ROOT / "MANIFESTE-SEANCES.csv").open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def _update_manifest_hash(repo_root: Path, relative_path: Path) -> None:
    manifest_path = repo_root / "content/pre-rentree-2026/pedagogy/manifest.yaml"
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    relative = relative_path.as_posix()
    digest = hashlib.sha256((repo_root / relative_path).read_bytes()).hexdigest()
    for source in manifest["sharedSources"]:
        if source["path"] == relative:
            source["sha256"] = digest
    for module in manifest["modules"]:
        if module["readme"]["path"] == relative:
            module["readme"]["sha256"] = digest
        for session in module["sessions"]:
            for source in session["files"]:
                if source["path"] == relative:
                    source["sha256"] = digest
    manifest_path.write_text(
        yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def test_session_manifest_is_strict_and_covers_17_modules_85_sessions() -> None:
    schema = json.loads((SCHEMA_ROOT / "session-kit.schema.json").read_text(encoding="utf-8"))
    rows = manifest_rows()
    assert len(rows) == 85
    assert len({row["moduleId"] for row in rows}) == 17
    assert "seconde-physique-chimie" not in {row["moduleId"] for row in rows}
    for row in rows:
        typed = {
            **row,
            "seance": int(row["seance"]),
            "banques": int(row["banques"]),
            "exercices": int(row["exercices"]),
            "questionsVerification": int(row["questionsVerification"]),
        }
        jsonschema.Draft202012Validator(schema).validate(typed)
        assert row["statut"] == "HUMAN_VALIDATION_REQUIRED"

    unknown_row = {
        **rows[0],
        "seance": int(rows[0]["seance"]),
        "banques": int(rows[0]["banques"]),
        "exercices": int(rows[0]["exercices"]),
        "questionsVerification": int(rows[0]["questionsVerification"]),
        "publicationApproved": True,
    }
    assert list(jsonschema.Draft202012Validator(schema).iter_errors(unknown_row))

    expected = {
        (module["id"], session["number"])
        for module in modules()
        for session in module["sessions"]
    }
    assert {(row["moduleId"], int(row["seance"])) for row in rows} == expected


def test_four_sessions_without_cps_node_are_explicit_specific_resources() -> None:
    specific = {
        (row["moduleId"], int(row["seance"]))
        for row in manifest_rows()
        if row["ressourceSpecifique"] == "OUI"
    }
    assert specific == {
        ("quatrieme-francais", 4),
        ("troisieme-francais", 5),
        ("premiere-nsi", 4),
        ("premiere-nsi", 5),
    }
    for row in manifest_rows():
        if (row["moduleId"], int(row["seance"])) in specific:
            assert row["noeudsCPS"] == ""
        else:
            assert row["noeudsCPS"]


def test_canonical_session_sources_have_exact_contractual_counts_and_no_leaks() -> None:
    module_dirs = sorted((SESSION_ROOT / "modules").iterdir())
    assert len(module_dirs) == 17
    assert len(list((SESSION_ROOT / "modules").glob("*/README.md"))) == 17

    unit_files = sorted((SESSION_ROOT / "modules").glob("*/s??-*/*.md"))
    assert len(unit_files) == 340
    assert not list((SESSION_ROOT / "modules").glob("*/CAHIER-ELEVE.md"))
    assert not list((SESSION_ROOT / "modules").glob("*/GUIDE-ENSEIGNANT.md"))

    counts = {
        "sessions": 0,
        "banks": 0,
        "exercises": 0,
        "corrections": 0,
        "exitTickets": 0,
        "exitQuestions": 0,
    }
    all_prompts: list[str] = []
    for row in manifest_rows():
        session_dir = SESSION_ROOT / row["dossier"]
        expected_files = {
            "banques-eleve.md",
            "corrige-commente.md",
            "verification-eleve.md",
            "verification-correction.md",
        }
        assert {path.name for path in session_dir.iterdir()} == expected_files
        student = (session_dir / "banques-eleve.md").read_text(encoding="utf-8")
        correction = (session_dir / "corrige-commente.md").read_text(encoding="utf-8")
        exit_student = (session_dir / "verification-eleve.md").read_text(encoding="utf-8")
        exit_correction = (session_dir / "verification-correction.md").read_text(encoding="utf-8")
        assert "correcte: true" not in student
        assert "Réponse :" not in student
        assert "### Correction" not in student
        assert "Décision pédagogique" in exit_correction

        exercises = re.findall(r"^### Exercice [ABC][1-3]$", student, flags=re.MULTILINE)
        corrections = re.findall(r"^### Correction [ABC][1-3]$", correction, flags=re.MULTILINE)
        questions = re.findall(r"^### Question [1-3]$", exit_student, flags=re.MULTILINE)
        assert len(exercises) == 9
        assert len(corrections) == 9
        assert len(questions) == 3
        for tier in "ABC":
            assert f"## Banque {tier}" in student
            assert f"## Banque {tier}" in correction
        all_prompts.extend(
            part.split("**Réponse et justification**", 1)[0].strip()
            for part in re.split(r"^### Exercice [ABC][1-3]\n$", student, flags=re.MULTILINE)[1:]
        )

        counts["sessions"] += 1
        counts["banks"] += 3
        counts["exercises"] += len(exercises)
        counts["corrections"] += len(corrections)
        counts["exitTickets"] += 1
        counts["exitQuestions"] += len(questions)

    assert counts == {
        "sessions": 85,
        "banks": 255,
        "exercises": 765,
        "corrections": 765,
        "exitTickets": 85,
        "exitQuestions": 255,
    }
    assert len(all_prompts) == len(set(all_prompts))


def test_session_validator_cli_passes_and_detects_missing_source(tmp_path: Path) -> None:
    script = REPO_ROOT / "scripts/pre-rentree/pedagogy/validate_session_kits.py"
    passing = subprocess.run(
        [sys.executable, str(script), "--repo-root", str(REPO_ROOT)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert passing.returncode == 0, passing.stderr
    assert '"sessionUnitFiles": 340' in passing.stdout

    import shutil

    tampered_root = tmp_path / "repo"
    shutil.copytree(REPO_ROOT / "content/pre-rentree-2026", tampered_root / "content/pre-rentree-2026")
    schema_source = REPO_ROOT / "scripts/pre-rentree/pedagogy/schemas"
    shutil.copytree(schema_source, tampered_root / "scripts/pre-rentree/pedagogy/schemas")
    missing = next(
        (tampered_root / "content/pre-rentree-2026/pedagogy/session-kits/modules").glob(
            "*/s01-*/banques-eleve.md"
        )
    )
    missing.unlink()
    failing = subprocess.run(
        [sys.executable, str(script), "--repo-root", str(tampered_root)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert failing.returncode != 0
    assert missing.relative_to(tampered_root).as_posix() in failing.stderr


def test_session_validator_rejects_promoted_status_without_human_proof(
    tmp_path: Path,
) -> None:
    import shutil

    script = REPO_ROOT / "scripts/pre-rentree/pedagogy/validate_session_kits.py"
    tampered_root = tmp_path / "repo"
    shutil.copytree(REPO_ROOT / "content/pre-rentree-2026", tampered_root / "content/pre-rentree-2026")
    schema_source = REPO_ROOT / "scripts/pre-rentree/pedagogy/schemas"
    shutil.copytree(schema_source, tampered_root / "scripts/pre-rentree/pedagogy/schemas")
    manifest_path = tampered_root / "content/pre-rentree-2026/pedagogy/manifest.yaml"
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    manifest["modules"][0]["editorialStatus"] = "CLASSROOM_READY"
    manifest_path.write_text(
        yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False),
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


def test_session_validator_cross_checks_csv_metadata_against_module_catalog(
    tmp_path: Path,
) -> None:
    import shutil

    script = REPO_ROOT / "scripts/pre-rentree/pedagogy/validate_session_kits.py"
    tampered_root = tmp_path / "repo"
    shutil.copytree(REPO_ROOT / "content/pre-rentree-2026", tampered_root / "content/pre-rentree-2026")
    shutil.copytree(
        REPO_ROOT / "scripts/pre-rentree/pedagogy/schemas",
        tampered_root / "scripts/pre-rentree/pedagogy/schemas",
    )
    relative = Path("content/pre-rentree-2026/pedagogy/session-kits/MANIFESTE-SEANCES.csv")
    csv_path = tampered_root / relative
    text = csv_path.read_text(encoding="utf-8")
    csv_path.write_text(text.replace("QUATRIEME,MATHEMATIQUES,1", "TROISIEME,MATHEMATIQUES,1", 1), encoding="utf-8")
    _update_manifest_hash(tampered_root, relative)

    failing = subprocess.run(
        [sys.executable, str(script), "--repo-root", str(tampered_root)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert failing.returncode != 0
    assert "niveau incohérent" in failing.stderr


@pytest.mark.parametrize(
    ("student_filename", "leak"),
    [
        ("banques-eleve.md", "\n**Solution :** 42\n"),
        ("banques-eleve.md", "\n**Réponse :** 42\n"),
        ("verification-eleve.md", "\n**Réponse :** maîtrise fragile\n"),
        ("verification-eleve.md", "\n**Barème enseignant :** 2 points pour la méthode\n"),
        ("verification-eleve.md", "\n**Diagnostic attendu :** maîtrise fragile\n"),
    ],
)
def test_session_validator_detects_semantic_student_leaks_after_hash_refresh(
    tmp_path: Path,
    student_filename: str,
    leak: str,
) -> None:
    import shutil

    script = REPO_ROOT / "scripts/pre-rentree/pedagogy/validate_session_kits.py"
    tampered_root = tmp_path / "repo"
    shutil.copytree(REPO_ROOT / "content/pre-rentree-2026", tampered_root / "content/pre-rentree-2026")
    shutil.copytree(
        REPO_ROOT / "scripts/pre-rentree/pedagogy/schemas",
        tampered_root / "scripts/pre-rentree/pedagogy/schemas",
    )
    student = next(
        (tampered_root / "content/pre-rentree-2026/pedagogy/session-kits/modules").glob(
            f"*/s01-*/{student_filename}"
        )
    )
    student.write_text(student.read_text(encoding="utf-8") + leak, encoding="utf-8")
    _update_manifest_hash(tampered_root, student.relative_to(tampered_root))

    failing = subprocess.run(
        [sys.executable, str(script), "--repo-root", str(tampered_root)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert failing.returncode != 0
    assert "fuite élève" in failing.stderr


def test_session_validator_allows_legitimate_student_response_instruction(
    tmp_path: Path,
) -> None:
    import shutil

    script = REPO_ROOT / "scripts/pre-rentree/pedagogy/validate_session_kits.py"
    tampered_root = tmp_path / "repo"
    shutil.copytree(REPO_ROOT / "content/pre-rentree-2026", tampered_root / "content/pre-rentree-2026")
    shutil.copytree(
        REPO_ROOT / "scripts/pre-rentree/pedagogy/schemas",
        tampered_root / "scripts/pre-rentree/pedagogy/schemas",
    )
    student = next(
        (tampered_root / "content/pre-rentree-2026/pedagogy/session-kits/modules").glob(
            "*/s01-*/banques-eleve.md"
        )
    )
    student.write_text(
        student.read_text(encoding="utf-8")
        + "\nNote : utilisez le libellé « Réponse : » dans votre brouillon.\n",
        encoding="utf-8",
    )
    _update_manifest_hash(tampered_root, student.relative_to(tampered_root))

    passing = subprocess.run(
        [sys.executable, str(script), "--repo-root", str(tampered_root)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert passing.returncode == 0, passing.stderr

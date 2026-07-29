#!/usr/bin/env python3
"""Compile reproducible session documents from canonical editable unit sources."""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

import yaml

from validate_cps import validate as validate_cps
from validate_session_kits import validate as validate_session_kits
from output_contract import assert_exact_output_tree


STATUS = "HUMAN_VALIDATION_REQUIRED"
CANONICAL_RELATIVE = Path("content/pre-rentree-2026/pedagogy")
DEFAULT_OUTPUT_RELATIVE = Path(
    ".artifacts/pre-rentree-2026/pedagogy/generated/session-kits"
)


def _reject_symlink_components(path: Path) -> None:
    current = Path(path.anchor)
    for part in path.parts[1:]:
        current /= part
        if current.is_symlink():
            raise ValueError(f"lien symbolique interdit dans la sortie : {current}")


def _resolve_output(repo_root: Path, output_root: Path | None) -> Path:
    raw = output_root or DEFAULT_OUTPUT_RELATIVE
    if ".." in raw.parts:
        raise ValueError("traversée '..' interdite dans la racine de sortie")
    candidate = raw if raw.is_absolute() else repo_root / raw
    candidate = candidate.absolute()
    _reject_symlink_components(candidate)
    resolved = candidate.resolve(strict=False)
    if resolved == repo_root or resolved.is_relative_to(repo_root):
        allowed = (repo_root / DEFAULT_OUTPUT_RELATIVE).resolve(strict=False)
        if resolved != allowed:
            raise ValueError(
                "dans le dépôt, la sortie doit être "
                f"{DEFAULT_OUTPUT_RELATIVE.as_posix()}"
            )
    return candidate


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _reject_symlink_components(path)
    if path.exists() and not path.is_file():
        raise ValueError(f"sortie non régulière interdite : {path}")
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
            if content and not content.endswith("\n"):
                stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _section(title: str, source: Path) -> list[str]:
    return [f"## {title}", "", source.read_text(encoding="utf-8").rstrip(), ""]


def _compile_student(module: dict[str, Any], repo_root: Path) -> str:
    lines = [
        f"# Cahier élève — {module['id']}",
        "",
        f"**Statut :** `{STATUS}`",
        "",
        "Compilation interne des ressources élèves canoniques.",
        "",
    ]
    for session in module["sessions"]:
        session_root = repo_root / session["path"]
        lines.extend((f"# Séance {session['number']}", ""))
        lines.extend(_section("Entraînement différencié", session_root / "banques-eleve.md"))
        lines.extend(_section("Vérification de fin de séance", session_root / "verification-eleve.md"))
    return "\n".join(lines).rstrip()


def _compile_teacher(module: dict[str, Any], repo_root: Path) -> str:
    lines = [
        f"# Guide enseignant — {module['id']}",
        "",
        f"**Statut :** `{STATUS}`",
        "",
        "Compilation interne des quatre sources unitaires de chaque séance.",
        "",
    ]
    for session in module["sessions"]:
        session_root = repo_root / session["path"]
        lines.extend((f"# Séance {session['number']}", ""))
        lines.extend(_section("Document élève", session_root / "banques-eleve.md"))
        lines.extend(_section("Correction commentée", session_root / "corrige-commente.md"))
        lines.extend(_section("Vérification élève", session_root / "verification-eleve.md"))
        lines.extend(
            _section(
                "Correction de la vérification",
                session_root / "verification-correction.md",
            )
        )
    return "\n".join(lines).rstrip()


def generate(repo_root: Path, output_root: Path | None = None) -> dict[str, int]:
    repo_root = repo_root.resolve(strict=True)
    validation_errors: list[str] = []
    cps_errors, _ = validate_cps(repo_root)
    session_errors, counts = validate_session_kits(repo_root)
    validation_errors.extend(cps_errors)
    validation_errors.extend(session_errors)
    if validation_errors:
        raise ValueError(
            "sources canoniques invalides :\n- " + "\n- ".join(validation_errors)
        )

    canonical_root = repo_root / CANONICAL_RELATIVE
    manifest = yaml.safe_load((canonical_root / "manifest.yaml").read_text(encoding="utf-8"))
    destination = _resolve_output(repo_root, output_root)
    generated = 0
    expected_files: set[str] = set()
    for module in manifest["modules"]:
        if module["editorialStatus"] != STATUS:
            raise ValueError(f"statut ou conflit interdit pour {module['id']}")
        expected_contract = {
            (
                DEFAULT_OUTPUT_RELATIVE
                / "modules"
                / module["id"]
                / "CAHIER-ELEVE.md"
            ).as_posix(),
            (
                DEFAULT_OUTPUT_RELATIVE
                / "modules"
                / module["id"]
                / "GUIDE-ENSEIGNANT.md"
            ).as_posix(),
        }
        if not expected_contract.issubset(set(module["expectedOutputs"])):
            raise ValueError(
                f"sorties attendues incohérentes pour {module['id']}"
            )
        module_output = destination / "modules" / module["id"]
        student_output = module_output / "CAHIER-ELEVE.md"
        teacher_output = module_output / "GUIDE-ENSEIGNANT.md"
        _write_text(
            student_output,
            _compile_student(module, repo_root),
        )
        _write_text(
            teacher_output,
            _compile_teacher(module, repo_root),
        )
        expected_files.update(
            path.relative_to(destination).as_posix()
            for path in (student_output, teacher_output)
        )
        generated += 2
    assert_exact_output_tree(destination, expected_files)
    return {
        **counts,
        "cahiers": len(manifest["modules"]),
        "guides": len(manifest["modules"]),
        "generatedFiles": generated,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output-root", type=Path)
    args = parser.parse_args()
    try:
        counts = generate(args.repo_root, args.output_root)
    except (OSError, ValueError, yaml.YAMLError) as error:
        print(f"GENERATION KITS DE SEANCE: ECHEC\n- {error}", file=sys.stderr)
        raise SystemExit(1) from error
    print(yaml.safe_dump(counts, allow_unicode=True, sort_keys=True).strip())
    print("GENERATION KITS DE SEANCE: OK")


if __name__ == "__main__":
    main()

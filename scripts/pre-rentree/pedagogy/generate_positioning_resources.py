#!/usr/bin/env python3
"""Generate reproducible positioning resources from the canonical pedagogy corpus."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

import yaml

from validate_cps import validate as validate_cps
from output_contract import assert_exact_output_tree


STATUS = "HUMAN_VALIDATION_REQUIRED"
CANONICAL_RELATIVE = Path("content/pre-rentree-2026/pedagogy")
DEFAULT_OUTPUT_RELATIVE = Path(
    ".artifacts/pre-rentree-2026/pedagogy/generated/positioning"
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


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


def _student_test(cps: dict[str, Any], module: dict[str, Any]) -> str:
    lines = [
        f"# {cps['intitulePublic']} — test de positionnement",
        "",
        f"**Document élève · durée cible : {cps['dureeCibleMinutes']} minutes**",
        "",
        "Ce test prépare les séances et permet d'adapter les exercices du groupe.",
        "Après chaque item, indiquer le degré de confiance : sûr, hésitant ou pas su.",
        "",
        f"Référence : `{module['id']}` · édition 2026.",
        "",
    ]
    number = 0
    for node in cps["noeuds"]:
        if node.get("evalueParTest") is not True:
            continue
        lines.extend((f"## Domaine {node['ordre']}", ""))
        for item in node["items"]:
            number += 1
            lines.extend((f"### {number}. {item['enonce']}", ""))
            if item["type"] == "qcm_unique":
                for label, proposition in zip("ABCD", item["propositions"], strict=True):
                    lines.append(f"- [ ] {label}. {proposition['texte']}")
            else:
                lines.extend(
                    (
                        "Votre production :",
                        "",
                        "................................................................................",
                    )
                )
            lines.extend(("", "Confiance : [ ] sûr  [ ] hésitant  [ ] pas su", ""))
    lines.extend(
        (
            "---",
            "Ce document ne produit ni note ni classement automatique.",
        )
    )
    return "\n".join(lines)


def _teacher_correction(cps: dict[str, Any], module: dict[str, Any]) -> str:
    lines = [
        f"# {cps['intitulePublic']} — correction enseignant",
        "",
        f"Référence : `{module['id']}` · statut : **{STATUS}**.",
        "",
        "Une production courte reste `PENDING_REVIEW` jusqu'à sa correction humaine.",
        "",
    ]
    number = 0
    for node in cps["noeuds"]:
        if node.get("evalueParTest") is not True:
            continue
        lines.extend(
            (
                f"## {node['id']} — {node['acquisN1']}",
                "",
                f"- Critère : {node['critereMaitrise']}",
                f"- Séance : {node['seanceRattachement']}",
                "",
            )
        )
        for item in node["items"]:
            number += 1
            lines.extend((f"### Item {number} · palier {item['palier']}", "", item["enonce"], ""))
            if item["type"] == "qcm_unique":
                expected = next(
                    proposition["texte"]
                    for proposition in item["propositions"]
                    if proposition["correcte"] is True
                )
                lines.extend(
                    (
                        f"**Réponse attendue :** {expected}",
                        "",
                        f"**Justification :** {item['justification']}",
                        "",
                        "**Lecture des distracteurs :**",
                    )
                )
                for proposition in item["propositions"]:
                    if proposition["correcte"] is not True:
                        obstacle = node["obstacles"][proposition["obstacleVise"]]
                        lines.append(f"- {proposition['texte']} → {obstacle}")
                lines.append("")
            else:
                lines.extend(("**Critères de correction :**", ""))
                lines.extend(f"- {criterion}" for criterion in item["criteresCorrection"])
                lines.extend(
                    (
                        "",
                        f"**Exemple admissible :** {item['exempleReponseAdmissible']}",
                        "",
                    )
                )
    return "\n".join(lines)


def _teacher_guide(cps: dict[str, Any], module: dict[str, Any]) -> str:
    lines = [
        f"# Pilotage enseignant — {cps['intitulePublic']}",
        "",
        f"Module : `{module['id']}` · statut : **{STATUS}**.",
        "",
        "Les productions `PENDING_REVIEW` restent hors du calibrage automatique.",
        "",
    ]
    for session in range(1, 6):
        nodes = [
            node
            for node in cps["noeuds"]
            if node.get("seanceRattachement") == session
        ]
        lines.extend((f"## Séance {session}", ""))
        if not nodes:
            lines.extend(("Aucun nœud CPS rattaché ; utiliser la ressource spécifique canonique.", ""))
        for node in nodes:
            lines.extend(
                (
                    f"- **{node['id']} — {node['acquisN1']}**",
                    f"  - critère : {node['critereMaitrise']}",
                    f"  - obstacles : {' ; '.join(node['obstacles'])}",
                )
            )
        lines.append("")
    return "\n".join(lines)


def _group_card(cps: dict[str, Any]) -> str:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(
        [
            "nodeId",
            "acquisN1",
            "seance",
            "ACQUIS",
            "FRAGILE",
            "NON_ACQUIS",
            "ERREUR_CONFIANTE",
            "PENDING_REVIEW",
            "decision",
            "notes_enseignant",
        ]
    )
    for node in cps["noeuds"]:
        writer.writerow(
            [
                node["id"],
                node["acquisN1"],
                node.get("seanceRattachement", "PERSONNALISATION"),
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ]
        )
    return stream.getvalue()


def generate(repo_root: Path, output_root: Path | None = None) -> dict[str, int]:
    repo_root = repo_root.resolve(strict=True)
    errors, counts = validate_cps(repo_root)
    if errors:
        raise ValueError("sources canoniques invalides :\n- " + "\n- ".join(errors))

    canonical_root = repo_root / CANONICAL_RELATIVE
    manifest = yaml.safe_load((canonical_root / "manifest.yaml").read_text(encoding="utf-8"))
    reference = yaml.safe_load(
        (canonical_root / "positioning/REFERENTIEL-CANONIQUE-2026.yaml").read_text(
            encoding="utf-8"
        )
    )
    module_by_id = {module["id"]: module for module in manifest["modules"]}
    destination = _resolve_output(repo_root, output_root)
    rows: list[dict[str, str | int]] = []
    expected_files: set[str] = set()

    for reference_module in reference["modules"]:
        module = module_by_id[reference_module["moduleId"]]
        if module["editorialStatus"] != STATUS:
            raise ValueError(f"statut ou conflit interdit pour {module['id']}")
        cps_path = repo_root / module["cps"]["path"]
        cps = yaml.safe_load(cps_path.read_text(encoding="utf-8"))
        stem = cps_path.stem
        expected_contract = {
            (
                DEFAULT_OUTPUT_RELATIVE
                / "tests-eleves"
                / f"{stem}-test.md"
            ).as_posix(),
            (
                DEFAULT_OUTPUT_RELATIVE
                / "corrections"
                / f"{stem}-correction.md"
            ).as_posix(),
            (
                DEFAULT_OUTPUT_RELATIVE
                / "pilotage-enseignant"
                / f"{stem}-pilotage.md"
            ).as_posix(),
            (
                DEFAULT_OUTPUT_RELATIVE
                / "cartes-groupe"
                / f"{stem}-groupe.csv"
            ).as_posix(),
        }
        if not expected_contract.issubset(set(module["expectedOutputs"])):
            raise ValueError(
                f"sorties attendues incohérentes pour {module['id']}"
            )
        paths = {
            "test": destination / "tests-eleves" / f"{stem}-test.md",
            "correction": destination / "corrections" / f"{stem}-correction.md",
            "pilotage": destination / "pilotage-enseignant" / f"{stem}-pilotage.md",
            "carte": destination / "cartes-groupe" / f"{stem}-groupe.csv",
        }
        _write_text(paths["test"], _student_test(cps, module))
        _write_text(paths["correction"], _teacher_correction(cps, module))
        _write_text(paths["pilotage"], _teacher_guide(cps, module))
        _write_text(paths["carte"], _group_card(cps))
        expected_files.update(
            path.relative_to(destination).as_posix() for path in paths.values()
        )
        rows.append(
            {
                "moduleId": module["id"],
                "niveau": module["level"],
                "matiere": module["subject"],
                "cps": cps_path.name,
                "noeuds": len(cps["noeuds"]),
                "noeudsEvalues": sum(
                    node.get("evalueParTest") is True for node in cps["noeuds"]
                ),
                "items": sum(len(node.get("items", [])) for node in cps["noeuds"]),
                "itemsManuels": sum(
                    item.get("type") == "reponse_courte"
                    for node in cps["noeuds"]
                    for item in node.get("items", [])
                ),
                "cpsSha256": _sha256(cps_path),
                "testSha256": _sha256(paths["test"]),
                "correctionSha256": _sha256(paths["correction"]),
                "pilotageSha256": _sha256(paths["pilotage"]),
                "carteSha256": _sha256(paths["carte"]),
                "statut": STATUS,
            }
        )

    fieldnames = list(rows[0])
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        stream.seek(0)
        _write_text(destination / "MANIFESTE.csv", stream.read())
    expected_files.add("MANIFESTE.csv")
    assert_exact_output_tree(destination, expected_files)
    return {
        **counts,
        "tests": len(rows),
        "corrections": len(rows),
        "pilotages": len(rows),
        "cartes": len(rows),
        "generatedFiles": len(rows) * 4 + 1,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output-root", type=Path)
    args = parser.parse_args()
    try:
        counts = generate(args.repo_root, args.output_root)
    except (OSError, ValueError, yaml.YAMLError) as error:
        print(f"GENERATION POSITIONNEMENT: ECHEC\n- {error}", file=sys.stderr)
        raise SystemExit(1) from error
    print(yaml.safe_dump(counts, allow_unicode=True, sort_keys=True).strip())
    print("GENERATION POSITIONNEMENT: OK")


if __name__ == "__main__":
    main()

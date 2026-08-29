#!/usr/bin/env python3
"""Generate unsigned, hash-bound human review packets from canonical sources."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import yaml

from output_contract import assert_exact_output_tree, write_output_text


DEFAULT_OUTPUT = Path(".artifacts/pre-rentree-2026/pedagogy/review")
MANIFEST = Path("content/pre-rentree-2026/pedagogy/manifest.yaml")
MODULES = Path("content/pre-rentree-2026/modules.json")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe_output(repo_root: Path, raw_output: Path | None) -> Path:
    candidate = raw_output or DEFAULT_OUTPUT
    if ".." in candidate.parts:
        raise ValueError("traversée de répertoire interdite")
    candidate = candidate if candidate.is_absolute() else repo_root / candidate
    candidate = candidate.absolute()
    resolved = candidate.resolve(strict=False)
    if resolved == repo_root or resolved.is_relative_to(repo_root):
        expected = (repo_root / DEFAULT_OUTPUT).resolve(strict=False)
        if resolved != expected:
            raise ValueError(
                "dans le dépôt, les paquets de revue doivent rester sous "
                f"{DEFAULT_OUTPUT.as_posix()}"
            )
    return candidate


def _load_sources(repo_root: Path) -> tuple[dict[str, Any], dict[str, Any], bytes]:
    manifest_bytes = (repo_root / MANIFEST).read_bytes()
    manifest = yaml.safe_load(manifest_bytes)
    modules = json.loads((repo_root / MODULES).read_text("utf-8"))
    return manifest, modules, manifest_bytes


def _packet(
    repo_root: Path,
    module: dict[str, Any],
    manifest_module: dict[str, Any],
) -> dict[str, Any]:
    cps_path = repo_root / manifest_module["cps"]["path"]
    cps_bytes = cps_path.read_bytes()
    if _sha256(cps_bytes) != manifest_module["cps"]["sha256"]:
        raise ValueError(f"hash CPS incohérent : {module['id']}")
    cps = yaml.safe_load(cps_bytes)
    items = [
        item
        for node in cps["noeuds"]
        for item in node.get("items", [])
    ]
    manual = [item for item in items if item["type"] == "reponse_courte"]

    return {
        "moduleId": module["id"],
        "assessmentId": cps["id"],
        "title": module["title"],
        "level": module["level"],
        "subject": module["subjectId"],
        "sessions": len(module["sessions"]),
        "nodes": len(cps["noeuds"]),
        "items": len(items),
        "manualResponses": len(manual),
        "officialSourcesCited": [],
        "pedagogicalOwner": None,
        "subjectTeacher": None,
        "reviewedAt": None,
        "decision": None,
        "reservations": [],
        "definitionSha256": f"sha256:{manifest_module['cps']['sha256']}",
        "validatedHash": None,
        "status": "HUMAN_VALIDATION_REQUIRED",
        "requiredTransitions": [
            "SUBJECT_REVIEW_APPROVED",
            "PEDAGOGICAL_OWNER_APPROVED",
            "PUBLICATION_APPROVED",
        ],
        "blockers": ["OFFICIAL_SOURCES_NOT_CITED"],
    }


def _markdown(packet: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"# Revue humaine — {packet['title']}",
            "",
            f"- Module : `{packet['moduleId']}`",
            f"- Définition : `{packet['assessmentId']}`",
            f"- Niveau : `{packet['level']}`",
            f"- Discipline : `{packet['subject']}`",
            f"- Séances : {packet['sessions']}",
            f"- Nœuds : {packet['nodes']}",
            f"- Items : {packet['items']}",
            f"- Réponses à correction manuelle : {packet['manualResponses']}",
            f"- Hash à valider : `{packet['definitionSha256']}`",
            f"- Statut : `{packet['status']}`",
            "",
            "## Sources officielles citées",
            "",
            "Aucune source officielle structurée n'est citée dans la CPS actuelle.",
            "La décision reste bloquée par `OFFICIAL_SOURCES_NOT_CITED`.",
            "",
            "## Revue disciplinaire",
            "",
            "- Enseignant disciplinaire : non renseigné",
            "- Identité vérifiable : non renseignée",
            "- Date : non renseignée",
            "- Décision : non renseignée",
            "- Réserves : non renseignées",
            "",
            "## Revue du responsable pédagogique",
            "",
            "- Responsable : non renseigné",
            "- Identité vérifiable : non renseignée",
            "- Date : non renseignée",
            "- Décision : non renseignée",
            "- Réserves : non renseignées",
            "",
            "## Approbation de publication",
            "",
            "- Responsable de publication : non renseigné",
            "- Identité vérifiable : non renseignée",
            "- Date : non renseignée",
            "- Hash signé : non renseigné",
            "",
            "Ce document est généré. Il ne constitue ni une approbation ni une source éditoriale.",
            "",
        ]
    )


def generate(repo_root: Path, output_root: Path) -> dict[str, Any]:
    manifest, module_catalog, manifest_bytes = _load_sources(repo_root)
    manifest_by_id = {
        module["id"]: module for module in manifest["modules"]
    }
    packets = []
    for module in module_catalog["modules"]:
        manifest_module = manifest_by_id.get(module["id"])
        if manifest_module is None:
            raise ValueError(f"module absent du manifeste : {module['id']}")
        if (
            module["level"] == "SECONDE"
            and module["subjectId"] == "PHYSIQUE_CHIMIE"
        ):
            raise ValueError("Physique-Chimie Seconde est interdite")
        packets.append(_packet(repo_root, module, manifest_module))

    index = {
        "schemaVersion": "1.0.0",
        "campaignId": manifest["campaignId"],
        "manifestVersion": manifest["version"],
        "manifestSha256": f"sha256:{_sha256(manifest_bytes)}",
        "moduleCount": len(packets),
        "status": "HUMAN_VALIDATION_REQUIRED",
        "modules": packets,
    }
    expected = {"human-validation-index.json"}
    for packet in packets:
        filename = f"{packet['moduleId']}.review.md"
        expected.add(filename)
        write_output_text(output_root, filename, _markdown(packet))
    write_output_text(
        output_root,
        "human-validation-index.json",
        json.dumps(index, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )
    assert_exact_output_tree(output_root, expected)
    return index


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output-root", type=Path)
    arguments = parser.parse_args()

    repo_root = arguments.repo_root.resolve(strict=True)
    output_root = _safe_output(repo_root, arguments.output_root)
    result = generate(repo_root, output_root)
    print(
        json.dumps(
            {
                "moduleCount": result["moduleCount"],
                "status": result["status"],
                "outputFiles": result["moduleCount"] + 1,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

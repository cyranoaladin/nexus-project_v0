#!/usr/bin/env python3
"""Remplace les exemples terminaux des prompts Markdown à partir du catalogue.

Le fichier EXEMPLES-PROMPTS-TOUS-NIVEAUX.md est l'unique source de vérité.
Seuls les packs et fichiers explicitement décrits dans ce catalogue sont
traités. Sans option, le script effectue une simulation. Utiliser --apply pour
écrire les modifications.
"""

from __future__ import annotations

import argparse
import os
import re
import stat
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import NoReturn


SOURCE_DEFAULT = "EXEMPLES-PROMPTS-TOUS-NIVEAUX.md"
TARGET_HEADING = "## Exemples à compléter par le responsable pédagogique"
EXPECTED_PROMPTS = (
    "pre-analysis.md",
    "eleve.md",
    "parents.md",
    "nexus.md",
    "verifier.md",
)

PACK_RE = re.compile(
    r"^PACK\s+(?P<number>\d+)\s+[—-]\s+"
    r"(?P<pack>[A-Za-z0-9][A-Za-z0-9._-]*)\s*$"
)
PROMPT_RE = re.compile(
    r"^\d+\.\d+\s+[·•]\s+"
    r"(?P<filename>pre-analysis|eleve|parents|nexus|verifier)\.md\s*$"
)
SEPARATOR_RE = re.compile(r"^[─═]{10,}$")
H2_RE = re.compile(r"(?m)^##\s+")


class ValidationError(Exception):
    """Erreur de structure détectée avant toute écriture."""


@dataclass(frozen=True)
class TextDocument:
    """Texte normalisé et informations nécessaires à sa restitution fidèle."""

    text: str
    newline: str
    has_bom: bool


@dataclass(frozen=True)
class PlannedChange:
    path: Path
    original: bytes
    updated: bytes
    changed: bool


def fail(message: str) -> NoReturn:
    raise ValidationError(message)


def decode_document(path: Path) -> TextDocument:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        fail(f"lecture impossible de {path}: {exc}")

    has_bom = raw.startswith(b"\xef\xbb\xbf")
    payload = raw[3:] if has_bom else raw
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        fail(f"{path} n'est pas un fichier UTF-8 valide: {exc}")

    crlf_count = text.count("\r\n")
    without_crlf = text.replace("\r\n", "")
    lf_count = without_crlf.count("\n")
    cr_count = without_crlf.count("\r")
    styles = sum(count > 0 for count in (crlf_count, lf_count, cr_count))
    if styles > 1:
        fail(f"fins de ligne mixtes dans {path}; correction manuelle requise")

    newline = "\r\n" if crlf_count else ("\r" if cr_count else "\n")
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return TextDocument(normalized, newline, has_bom)


def encode_document(document: TextDocument, normalized_text: str) -> bytes:
    text = normalized_text.replace("\n", document.newline)
    payload = text.encode("utf-8")
    return (b"\xef\xbb\xbf" + payload) if document.has_bom else payload


def trim_catalogue_tail(lines: list[str]) -> list[str]:
    """Retire uniquement les séparateurs placés entre deux entrées du catalogue."""

    end = len(lines)
    while end > 0 and (not lines[end - 1].strip() or SEPARATOR_RE.fullmatch(lines[end - 1])):
        end -= 1
    return lines[:end]


def parse_catalogue(source: Path) -> dict[tuple[str, str], str]:
    document = decode_document(source)
    lines = document.text.splitlines()
    pack_positions = [index for index, line in enumerate(lines) if PACK_RE.fullmatch(line)]
    if not pack_positions:
        fail(f"aucun en-tête PACK reconnu dans {source}")

    mappings: dict[tuple[str, str], str] = {}
    seen_packs: set[str] = set()

    for pack_order, pack_start in enumerate(pack_positions):
        pack_match = PACK_RE.fullmatch(lines[pack_start])
        assert pack_match is not None
        pack_name = pack_match.group("pack")
        if pack_name in seen_packs:
            fail(f"pack dupliqué dans le catalogue: {pack_name}")
        seen_packs.add(pack_name)

        pack_end = (
            pack_positions[pack_order + 1]
            if pack_order + 1 < len(pack_positions)
            else len(lines)
        )
        prompt_positions = [
            index
            for index in range(pack_start + 1, pack_end)
            if PROMPT_RE.fullmatch(lines[index])
        ]
        prompt_names = []

        for prompt_order, prompt_start in enumerate(prompt_positions):
            prompt_match = PROMPT_RE.fullmatch(lines[prompt_start])
            assert prompt_match is not None
            filename = prompt_match.group("filename") + ".md"
            prompt_names.append(filename)

            prompt_end = (
                prompt_positions[prompt_order + 1]
                if prompt_order + 1 < len(prompt_positions)
                else pack_end
            )
            section = trim_catalogue_tail(lines[prompt_start + 1 : prompt_end])

            good_positions = [
                index for index, line in enumerate(section)
                if line == "### Bonne formulation"
            ]
            bad_positions = [
                index for index, line in enumerate(section)
                if line == "### Mauvaise formulation"
            ]
            if len(good_positions) != 1 or len(bad_positions) != 1:
                fail(
                    f"{pack_name}/{filename}: exactement un titre Bonne et un titre "
                    "Mauvaise sont requis"
                )
            if good_positions[0] >= bad_positions[0]:
                fail(f"{pack_name}/{filename}: ordre Bonne/Mauvaise invalide")

            block_lines = section[good_positions[0] :]
            block = "\n".join(block_lines).strip("\n")
            good_body = section[good_positions[0] + 1 : bad_positions[0]]
            bad_body = section[bad_positions[0] + 1 :]
            if not any(line.strip() for line in good_body):
                fail(f"{pack_name}/{filename}: exemple Bonne vide")
            if not any(line.strip() for line in bad_body):
                fail(f"{pack_name}/{filename}: exemple Mauvaise vide")

            key = (pack_name, filename)
            if key in mappings:
                fail(f"entrée dupliquée dans le catalogue: {pack_name}/{filename}")
            mappings[key] = block

        if tuple(prompt_names) != EXPECTED_PROMPTS:
            fail(
                f"{pack_name}: fichiers attendus dans cet ordre: "
                f"{', '.join(EXPECTED_PROMPTS)}; trouvés: "
                f"{', '.join(prompt_names) or 'aucun'}"
            )

    expected_count = len(seen_packs) * len(EXPECTED_PROMPTS)
    if len(mappings) != expected_count:
        fail(
            f"catalogue incohérent: {len(mappings)} blocs trouvés, "
            f"{expected_count} attendus"
        )
    return mappings


def replace_terminal_section(path: Path, block: str) -> PlannedChange:
    document = decode_document(path)
    heading_pattern = re.compile(
        rf"(?m)^{re.escape(TARGET_HEADING)}[ \t]*\n"
    )
    matches = list(heading_pattern.finditer(document.text))
    if len(matches) != 1:
        fail(
            f"{path}: exactement une section « {TARGET_HEADING} » est requise "
            f"({len(matches)} trouvée(s))"
        )

    match = matches[0]
    current_suffix = document.text[match.end() :]
    if H2_RE.search(current_suffix):
        fail(f"{path}: la section d'exemples n'est pas la dernière section de niveau 2")

    if current_suffix.count("### Bonne formulation") != 1:
        fail(f"{path}: titre « Bonne formulation » absent ou dupliqué")
    if current_suffix.count("### Mauvaise formulation") != 1:
        fail(f"{path}: titre « Mauvaise formulation » absent ou dupliqué")

    updated_text = document.text[: match.end()] + "\n" + block.rstrip() + "\n"
    original_bytes = path.read_bytes()
    updated_bytes = encode_document(document, updated_text)
    return PlannedChange(path, original_bytes, updated_bytes, original_bytes != updated_bytes)


def validate_target_path(root: Path, pack_name: str, filename: str) -> Path:
    target = root / pack_name / filename
    if not target.exists():
        fail(f"fichier cible manquant: {target}")
    if not target.is_file():
        fail(f"la cible n'est pas un fichier ordinaire: {target}")
    try:
        target.resolve(strict=True).relative_to(root.resolve(strict=True))
    except ValueError:
        fail(f"la cible sort du dossier racine via un lien symbolique: {target}")
    return target


def find_uncovered_pack_directories(root: Path, covered: set[str]) -> list[str]:
    uncovered = []
    try:
        children = sorted(root.iterdir(), key=lambda path: path.name)
    except OSError as exc:
        fail(f"lecture impossible du dossier {root}: {exc}")

    for child in children:
        if not child.is_dir() or child.name in covered:
            continue
        if all((child / filename).is_file() for filename in EXPECTED_PROMPTS):
            uncovered.append(child.name)
    return uncovered


def atomic_write(path: Path, content: bytes) -> None:
    mode = stat.S_IMODE(path.stat().st_mode)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    except Exception:
        try:
            temporary.unlink(missing_ok=True)
        finally:
            raise


def apply_with_rollback(changes: list[PlannedChange]) -> None:
    written: list[PlannedChange] = []
    try:
        for change in changes:
            atomic_write(change.path, change.updated)
            written.append(change)
    except Exception as exc:
        rollback_errors = []
        for change in reversed(written):
            try:
                atomic_write(change.path, change.original)
            except Exception as rollback_exc:  # situation exceptionnelle à signaler
                rollback_errors.append(f"{change.path}: {rollback_exc}")
        detail = f"écriture interrompue; retour arrière effectué: {exc}"
        if rollback_errors:
            detail += "; échec partiel du retour arrière: " + " | ".join(rollback_errors)
        fail(detail)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Injecte dans les prompts Markdown les exemples définis dans "
            f"{SOURCE_DEFAULT}."
        )
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="dossier prompts (défaut: dossier courant)",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(SOURCE_DEFAULT),
        help=(
            "catalogue source; un chemin relatif est résolu depuis --root "
            f"(défaut: {SOURCE_DEFAULT})"
        ),
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="écrit réellement les fichiers (sinon: simulation)",
    )
    mode.add_argument(
        "--check",
        action="store_true",
        help="n'écrit rien et renvoie le code 1 si des fichiers diffèrent",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="affiche le chemin de chaque fichier qui serait ou a été modifié",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.expanduser().resolve()
    source_argument = args.source.expanduser()
    source = source_argument if source_argument.is_absolute() else root / source_argument

    if not root.is_dir():
        fail(f"dossier racine introuvable: {root}")
    if not source.is_file():
        fail(f"catalogue source introuvable: {source}")

    mappings = parse_catalogue(source)
    covered_packs = {pack for pack, _ in mappings}
    uncovered = find_uncovered_pack_directories(root, covered_packs)

    plan = []
    for (pack_name, filename), block in mappings.items():
        target = validate_target_path(root, pack_name, filename)
        plan.append(replace_terminal_section(target, block))

    changed = [change for change in plan if change.changed]

    print(
        f"Catalogue validé : {len(covered_packs)} pack(s), "
        f"{len(mappings)} bloc(s) d'exemples."
    )
    print(f"Fichiers déjà conformes : {len(plan) - len(changed)}.")
    print(f"Fichiers à modifier : {len(changed)}.")
    if uncovered:
        print(
            "Répertoires de prompts non couverts par le catalogue et ignorés : "
            + ", ".join(uncovered)
            + "."
        )

    if args.list:
        for change in changed:
            print(f"  - {change.path.relative_to(root)}")

    if args.check:
        if changed:
            print("Contrôle négatif : certains fichiers ne correspondent pas au catalogue.")
            return 1
        print("Contrôle positif : tous les fichiers couverts sont conformes.")
        return 0

    if not args.apply:
        print("Simulation uniquement. Relancez avec --apply pour écrire les changements.")
        return 0

    apply_with_rollback(changed)
    print(f"Mise à jour terminée : {len(changed)} fichier(s) modifié(s).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as exc:
        print(f"ERREUR : {exc}", file=sys.stderr)
        raise SystemExit(2)

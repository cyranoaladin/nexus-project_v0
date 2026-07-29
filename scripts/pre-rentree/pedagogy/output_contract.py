"""Fail-closed checks for generated pedagogy output trees."""

from __future__ import annotations

import os
from pathlib import Path, PurePosixPath


def _expected_entries(expected_files: set[str]) -> dict[str, str]:
    expected: dict[str, str] = {}
    for raw in expected_files:
        path = PurePosixPath(raw)
        if (
            path.is_absolute()
            or not path.parts
            or "." in path.parts
            or ".." in path.parts
            or "\\" in raw
        ):
            raise ValueError(f"chemin de sortie attendu invalide : {raw}")
        expected[path.as_posix()] = "file"
        for parent in path.parents:
            if parent == PurePosixPath("."):
                break
            expected[parent.as_posix()] = "directory"
    return expected


def _actual_entries(root: Path) -> dict[str, str]:
    if root.is_symlink():
        raise ValueError(f"racine de sortie symbolique interdite : {root}")
    if not root.is_dir():
        raise ValueError(f"racine de sortie manquante ou non régulière : {root}")
    actual: dict[str, str] = {}

    def visit(directory: Path, relative_directory: PurePosixPath) -> None:
        with os.scandir(directory) as scanned:
            entries = sorted(scanned, key=lambda entry: entry.name)
        for entry in entries:
            relative = (
                PurePosixPath(entry.name)
                if relative_directory == PurePosixPath(".")
                else relative_directory / entry.name
            )
            key = relative.as_posix()
            if entry.is_symlink():
                actual[key] = "symlink"
            elif entry.is_dir(follow_symlinks=False):
                actual[key] = "directory"
                visit(Path(entry.path), relative)
            elif entry.is_file(follow_symlinks=False):
                actual[key] = "file"
            else:
                actual[key] = "other"

    visit(root, PurePosixPath("."))
    return actual


def assert_exact_output_tree(root: Path, expected_files: set[str]) -> None:
    """Reject missing, stale, symbolic or special entries without removing them."""

    expected = _expected_entries(expected_files)
    actual = _actual_entries(root)
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    wrong_types = sorted(
        path
        for path in set(expected) & set(actual)
        if expected[path] != actual[path]
    )
    errors: list[str] = []
    if missing:
        errors.append("entrée attendue manquante : " + ", ".join(missing[:20]))
    if unexpected:
        errors.append("entrée inattendue : " + ", ".join(unexpected[:20]))
    if wrong_types:
        errors.append(
            "type d'entrée inattendu : "
            + ", ".join(
                f"{path} ({actual[path]} au lieu de {expected[path]})"
                for path in wrong_types[:20]
            )
        )
    if errors:
        raise ValueError("contrat de sortie divergent :\n- " + "\n- ".join(errors))

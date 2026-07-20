#!/usr/bin/env python3
"""Fail when generated document outputs or exact source copies are tracked."""

from __future__ import annotations

import argparse
import hashlib
import subprocess
from pathlib import Path


FORBIDDEN_TRACKED_PREFIXES = (
    ".artifacts/",
    "artifacts/pre-rentree-2026/",
    "outputs-v5-canonical/",
)
CANONICAL_SOURCE_ROOT = Path("scripts/pre-rentree")
SOURCE_SUFFIXES = {".py", ".ts", ".css"}


def _tracked_paths(repo_root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=repo_root,
        capture_output=True,
        check=True,
    )
    return [Path(value.decode("utf-8")) for value in result.stdout.split(b"\0") if value]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify(repo_root: Path) -> tuple[list[str], list[str]]:
    root = repo_root.resolve()
    tracked = _tracked_paths(root)
    generated = [
        path.as_posix()
        for path in tracked
        if any(path.as_posix().startswith(prefix) for prefix in FORBIDDEN_TRACKED_PREFIXES)
    ]

    canonical = [
        path
        for path in tracked
        if path.is_relative_to(CANONICAL_SOURCE_ROOT)
        and path.suffix in SOURCE_SUFFIXES
        and "tests" not in path.parts
        and (root / path).is_file()
    ]
    candidates_by_hash: dict[str, list[str]] = {}
    for path in tracked:
        if path.is_relative_to(CANONICAL_SOURCE_ROOT) or not (root / path).is_file():
            continue
        if path.suffix not in SOURCE_SUFFIXES:
            continue
        candidates_by_hash.setdefault(_sha256(root / path), []).append(path.as_posix())

    duplicates: list[str] = []
    for source in canonical:
        for duplicate in candidates_by_hash.get(_sha256(root / source), []):
            duplicates.append(f"{source.as_posix()} == {duplicate}")
    return sorted(generated), sorted(duplicates)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True, type=Path)
    args = parser.parse_args()
    generated, duplicates = verify(args.repo_root)
    print(f"TRACKED_GENERATED_ARTIFACT_COUNT={len(generated)}")
    print(f"DUPLICATE_DOCUMENT_SOURCE_COUNT={len(duplicates)}")
    for finding in (*generated, *duplicates):
        print(f"ERROR={finding}")
    raise SystemExit(1 if generated or duplicates else 0)


if __name__ == "__main__":
    main()

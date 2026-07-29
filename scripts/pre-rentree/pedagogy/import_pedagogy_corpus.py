#!/usr/bin/env python3
"""Inventory a historical pedagogy corpus without mutating it."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterator

from classification import classify, has_ambiguous_name, is_hidden_path, normalized_name


CSV_FIELDS = (
    "relative_path",
    "size_bytes",
    "extension",
    "mime_type",
    "sha256",
    "top_level_package",
    "logical_role",
    "proposed_destination",
    "provisional_classification",
    "is_empty",
    "is_hidden",
    "is_symlink",
    "is_ambiguous_name",
    "is_archive",
    "archive_integrity",
)
MIME_TYPES = {
    ".csv": "text/csv",
    ".json": "application/json",
    ".md": "text/markdown",
    ".py": "text/x-python",
    ".txt": "text/plain",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
    ".zip": "application/zip",
}


def _iter_tree(root: Path) -> Iterator[tuple[Path, PurePosixPath, str]]:
    def visit(directory: Path, relative_directory: PurePosixPath) -> Iterator[tuple[Path, PurePosixPath, str]]:
        with os.scandir(directory) as entries:
            ordered = sorted(entries, key=lambda entry: normalized_name(entry.name))
        for entry in ordered:
            relative = (
                PurePosixPath(entry.name)
                if relative_directory == PurePosixPath(".")
                else relative_directory / entry.name
            )
            path = Path(entry.path)
            if entry.is_symlink():
                yield path, relative, "symlink"
            elif entry.is_dir(follow_symlinks=False):
                yield path, relative, "directory"
                yield from visit(path, relative)
            elif entry.is_file(follow_symlinks=False):
                yield path, relative, "file"
            else:
                yield path, relative, "other"

    yield from visit(root, PurePosixPath("."))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _archive_integrity(path: Path) -> str:
    if path.suffix.casefold() != ".zip":
        return "NOT_ARCHIVE"
    try:
        with zipfile.ZipFile(path) as archive:
            return "VALID" if archive.testzip() is None else "INVALID"
    except (OSError, RuntimeError, zipfile.BadZipFile, zipfile.LargeZipFile):
        return "INVALID"


def _ambiguous_paths(entries: list[tuple[Path, PurePosixPath, str]]) -> set[str]:
    ambiguous: set[str] = set()
    siblings: dict[str, dict[str, list[str]]] = {}
    for _, relative, _ in entries:
        relative_string = relative.as_posix()
        if has_ambiguous_name(relative.name):
            ambiguous.add(relative_string)
        parent = relative.parent.as_posix()
        siblings.setdefault(parent, {}).setdefault(normalized_name(relative.name), []).append(relative_string)
    for names in siblings.values():
        for collisions in names.values():
            if len(collisions) > 1:
                ambiguous.update(collisions)
    return ambiguous


def build_inventory(import_root: Path) -> dict:
    """Return deterministic metadata for regular files, directories and symlinks."""

    root = import_root.resolve(strict=True)
    if not root.is_dir():
        raise NotADirectoryError(import_root)

    tree_entries = list(_iter_tree(root))
    ambiguous_paths = _ambiguous_paths(tree_entries)
    directories = [
        {
            "relative_path": ".",
            "is_hidden": False,
            "is_ambiguous_name": False,
        }
    ]
    files: list[dict] = []
    symlinks: list[dict] = []

    for path, relative, kind in tree_entries:
        relative_string = relative.as_posix()
        hidden = is_hidden_path(relative)
        ambiguous = relative_string in ambiguous_paths
        if kind == "directory":
            directories.append(
                {
                    "relative_path": relative_string,
                    "is_hidden": hidden,
                    "is_ambiguous_name": ambiguous,
                }
            )
        elif kind == "symlink":
            target = os.readlink(path)
            target_is_absolute = Path(target).is_absolute()
            symlinks.append(
                {
                    "relative_path": relative_string,
                    "target": "<ABSOLUTE_TARGET_REDACTED>" if target_is_absolute else target,
                    "target_is_absolute": target_is_absolute,
                    "is_hidden": hidden,
                    "is_ambiguous_name": ambiguous,
                }
            )
        elif kind == "file":
            extension = path.suffix.casefold()
            decision = classify(relative)
            size = path.stat().st_size
            archive_integrity = _archive_integrity(path)
            files.append(
                {
                    "relative_path": relative_string,
                    "size_bytes": size,
                    "extension": extension,
                    "mime_type": MIME_TYPES.get(extension, "application/octet-stream"),
                    "sha256": _sha256(path),
                    "top_level_package": relative.parts[0] if len(relative.parts) > 1 else "",
                    "logical_role": decision.logical_role,
                    "proposed_destination": decision.proposed_destination,
                    "provisional_classification": decision.provisional_classification,
                    "is_empty": size == 0,
                    "is_hidden": hidden,
                    "is_symlink": False,
                    "is_ambiguous_name": ambiguous,
                    "is_archive": extension == ".zip",
                    "archive_integrity": archive_integrity,
                }
            )

    directories.sort(key=lambda item: item["relative_path"])
    files.sort(key=lambda item: item["relative_path"])
    symlinks.sort(key=lambda item: item["relative_path"])
    hidden_count = sum(item["is_hidden"] for item in directories + files + symlinks)
    ambiguous_count = sum(item["is_ambiguous_name"] for item in directories + files + symlinks)
    valid_archives = sum(item["archive_integrity"] == "VALID" for item in files)
    invalid_archives = sum(item["archive_integrity"] == "INVALID" for item in files)
    return {
        "schema_version": 1,
        "summary": {
            "directory_count": len(directories),
            "file_count": len(files),
            "hash_count": sum(bool(item["sha256"]) for item in files),
            "total_bytes": sum(item["size_bytes"] for item in files),
            "empty_file_count": sum(item["is_empty"] for item in files),
            "hidden_entry_count": hidden_count,
            "symlink_count": len(symlinks),
            "ambiguous_name_count": ambiguous_count,
            "archive_count": valid_archives + invalid_archives,
            "valid_archive_count": valid_archives,
            "invalid_archive_count": invalid_archives,
        },
        "directories": directories,
        "files": files,
        "symlinks": symlinks,
    }


def _assert_output_outside_import(import_root: Path, output_root: Path) -> tuple[Path, Path]:
    root = import_root.resolve(strict=True)
    output = output_root.resolve()
    if output == root or output.is_relative_to(root):
        raise ValueError("--output-root must be outside --import-root")
    return root, output


def write_inventory(inventory: dict, import_root: Path, output_root: Path) -> None:
    """Write the three deterministic inventory representations."""

    _, output = _assert_output_outside_import(import_root, output_root)
    if inventory["summary"]["invalid_archive_count"]:
        raise ValueError("inventory contains an invalid ZIP archive")
    output.mkdir(parents=True, exist_ok=True)

    csv_path = output / "INVENTAIRE-IMPORT.csv"
    csv_temp = output / ".INVENTAIRE-IMPORT.csv.tmp"
    with csv_temp.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(inventory["files"])
    csv_temp.replace(csv_path)

    json_path = output / "INVENTAIRE-IMPORT.json"
    json_temp = output / ".INVENTAIRE-IMPORT.json.tmp"
    json_temp.write_text(
        json.dumps(inventory, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    json_temp.replace(json_path)

    manifest_path = output / "MANIFEST-SHA256.txt"
    manifest_temp = output / ".MANIFEST-SHA256.txt.tmp"
    manifest_temp.write_text(
        "".join(
            f'{item["sha256"]}  {item["relative_path"]}\n'
            for item in inventory["files"]
        ),
        encoding="utf-8",
        newline="\n",
    )
    manifest_temp.replace(manifest_path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import-root", required=True, type=Path)
    parser.add_argument("--output-root", required=True, type=Path)
    args = parser.parse_args()
    try:
        inventory = build_inventory(args.import_root)
        write_inventory(inventory, args.import_root, args.output_root)
    except (FileNotFoundError, NotADirectoryError, OSError, ValueError) as error:
        parser.error(str(error))

    summary = inventory["summary"]
    print(f'DIRECTORY_COUNT={summary["directory_count"]}')
    print(f'FILE_COUNT={summary["file_count"]}')
    print(f'HASH_COUNT={summary["hash_count"]}')
    print(f'EMPTY_FILE_COUNT={summary["empty_file_count"]}')
    print(f'HIDDEN_ENTRY_COUNT={summary["hidden_entry_count"]}')
    print(f'SYMLINK_COUNT={summary["symlink_count"]}')
    print(f'AMBIGUOUS_NAME_COUNT={summary["ambiguous_name_count"]}')
    print(f'ZIP_COUNT={summary["archive_count"]}')
    print(f'ZIP_VALID_COUNT={summary["valid_archive_count"]}')
    print(f'ZIP_INVALID_COUNT={summary["invalid_archive_count"]}')
    return 0


if __name__ == "__main__":
    sys.exit(main())

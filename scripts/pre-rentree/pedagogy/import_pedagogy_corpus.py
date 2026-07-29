#!/usr/bin/env python3
"""Inventory a historical pedagogy corpus without mutating it."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable, Iterator

from classification import (
    HISTORICAL_PACKAGES,
    classify,
    has_ambiguous_name,
    has_control_characters,
    is_hidden_path,
    normalized_name,
)


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
IMPORT_REDIRECT_METADATA = PurePosixPath("README.md")


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


def _excluded_regular_file_paths(
    root: Path,
    relative_paths: Iterable[str | PurePosixPath],
) -> set[str]:
    excluded: set[str] = set()
    for value in relative_paths:
        relative = PurePosixPath(value)
        if (
            relative.is_absolute()
            or relative == PurePosixPath(".")
            or ".." in relative.parts
        ):
            raise ValueError(f"unsafe excluded inventory path: {_safe_name(str(value))}")
        path = root.joinpath(*relative.parts)
        if path.is_symlink() or not path.is_file():
            raise ValueError(
                "excluded inventory path must be a regular non-symlink file: "
                f"{_safe_name(relative.as_posix())}"
            )
        excluded.add(relative.as_posix())
    return excluded


def build_inventory(
    import_root: Path,
    *,
    excluded_regular_files: Iterable[str | PurePosixPath] = (),
) -> dict:
    """Return deterministic metadata for regular files, directories and symlinks."""

    root = import_root.resolve(strict=True)
    if not root.is_dir():
        raise NotADirectoryError(import_root)

    excluded_paths = _excluded_regular_file_paths(root, excluded_regular_files)
    tree_entries = [
        entry
        for entry in _iter_tree(root)
        if entry[1].as_posix() not in excluded_paths
    ]
    ambiguous_paths = _ambiguous_paths(tree_entries)
    non_empty_directories = {
        relative.parent.as_posix()
        for _, relative, _ in tree_entries
    }
    directories = [
        {
            "relative_path": ".",
            "is_empty": "." not in non_empty_directories,
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
                    "is_empty": relative_string not in non_empty_directories,
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
            "empty_directory_count": sum(item["is_empty"] for item in directories),
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


def validate_complete_import_root(
    import_root: Path,
) -> tuple[PurePosixPath, ...]:
    """Fail closed unless the CLI receives the complete historical package set."""

    root = import_root.resolve(strict=True)
    if not root.is_dir():
        raise NotADirectoryError(import_root)
    with os.scandir(root) as entries:
        top_level_entries = {entry.name: entry for entry in entries}

    expected = set(HISTORICAL_PACKAGES)
    actual = set(top_level_entries)
    redirect_entry = top_level_entries.get(IMPORT_REDIRECT_METADATA.as_posix())
    if redirect_entry is not None and (
        redirect_entry.is_symlink()
        or not redirect_entry.is_file(follow_symlinks=False)
    ):
        raise ValueError(
            "import redirect metadata must be a regular non-symlink file: "
            f"{IMPORT_REDIRECT_METADATA.as_posix()}"
        )
    missing = [name for name in HISTORICAL_PACKAGES if name not in actual]
    allowed_metadata = (
        {IMPORT_REDIRECT_METADATA.as_posix()}
        if redirect_entry is not None
        else set()
    )
    unexpected = sorted(actual - expected - allowed_metadata)
    if missing:
        raise ValueError(f"missing top-level packages: {', '.join(missing)}")
    if unexpected:
        raise ValueError(
            "unexpected top-level entries: "
            f"{', '.join(_safe_name(name) for name in unexpected)}"
        )

    wrong_type = [
        name
        for name in HISTORICAL_PACKAGES
        if not top_level_entries[name].is_dir(follow_symlinks=False)
    ]
    if wrong_type:
        raise ValueError(
            "top-level packages must be real directories: "
            f"{', '.join(wrong_type)}"
        )

    unsafe_paths = [
        relative.as_posix()
        for _, relative, _ in _iter_tree(root)
        if has_control_characters(relative.name)
    ]
    if unsafe_paths:
        raise ValueError(
            "control characters in entry names: "
            f"{', '.join(_safe_name(path) for path in sorted(unsafe_paths))}"
        )
    return (IMPORT_REDIRECT_METADATA,) if redirect_entry is not None else ()


def validate_complete_inventory(inventory: dict) -> None:
    packages_with_files = {
        item["top_level_package"]
        for item in inventory["files"]
    }
    empty_packages = [
        name
        for name in HISTORICAL_PACKAGES
        if name not in packages_with_files
    ]
    if empty_packages:
        raise ValueError(
            "top-level packages without regular files: "
            f"{', '.join(empty_packages)}"
        )


def _safe_name(name: str) -> str:
    return name.encode("unicode_escape").decode("ascii")


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
    csv_buffer = io.StringIO(newline="")
    writer = csv.DictWriter(csv_buffer, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(inventory["files"])
    _atomic_write_text(csv_path, csv_buffer.getvalue())

    json_path = output / "INVENTAIRE-IMPORT.json"
    _atomic_write_text(
        json_path,
        json.dumps(inventory, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )

    manifest_path = output / "MANIFEST-SHA256.txt"
    _atomic_write_text(
        manifest_path,
        "".join(
            f'{item["sha256"]}  {item["relative_path"]}\n'
            for item in inventory["files"]
        ),
    )


def _atomic_write_text(destination: Path, content: str) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        dir=destination.parent,
        prefix=f".{destination.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            descriptor = -1
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, destination)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import-root", required=True, type=Path)
    parser.add_argument("--output-root", required=True, type=Path)
    args = parser.parse_args()
    try:
        excluded_regular_files = validate_complete_import_root(args.import_root)
        inventory = build_inventory(
            args.import_root,
            excluded_regular_files=excluded_regular_files,
        )
        validate_complete_inventory(inventory)
        write_inventory(inventory, args.import_root, args.output_root)
    except (FileNotFoundError, NotADirectoryError, OSError, ValueError) as error:
        parser.error(str(error))

    summary = inventory["summary"]
    print(f'DIRECTORY_COUNT={summary["directory_count"]}')
    print(f'EMPTY_DIRECTORY_COUNT={summary["empty_directory_count"]}')
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

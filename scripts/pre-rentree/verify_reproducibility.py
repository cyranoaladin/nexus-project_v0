#!/usr/bin/env python3
"""Rebuild and compare the complete family-facing artifact tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from generate_documents import build_package


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _inventory(root: Path) -> dict[str, dict[str, int | str]]:
    public = Path(root).resolve() / "PUBLIC"
    if not public.is_dir():
        raise FileNotFoundError(f"Missing public artifact tree: {public}")
    return {
        path.relative_to(public).as_posix(): {
            "sha256": _sha256(path),
            "fileSize": path.stat().st_size,
        }
        for path in sorted(public.rglob("*"))
        if path.is_file()
    }


def compare_public_builds(first: Path, second: Path) -> dict[str, Any]:
    first_inventory = _inventory(first)
    second_inventory = _inventory(second)
    names = sorted(set(first_inventory) | set(second_inventory))
    mismatches = [
        {
            "path": name,
            "first": first_inventory.get(name),
            "second": second_inventory.get(name),
        }
        for name in names
        if first_inventory.get(name) != second_inventory.get(name)
    ]
    report = {
        "SCOPE": "PUBLIC_FAMILY_ARTIFACTS",
        "REPRODUCIBLE_PUBLIC_BUILD": not mismatches,
        "COMPARED_FILE_COUNT": len(names),
        "MISMATCH_COUNT": len(mismatches),
        "MISMATCHES": mismatches,
        "FILES": [
            {"path": name, **first_inventory[name]}
            for name in sorted(first_inventory)
        ],
    }
    if mismatches:
        raise ValueError(f"Public document build is not reproducible ({len(mismatches)} mismatches)")
    return report


def verify_reproducibility(
    snapshot: Path,
    reference: Path,
    output_report: Path,
) -> dict[str, Any]:
    reference = Path(reference).resolve()
    work_parent = reference.parent
    candidate = Path(tempfile.mkdtemp(prefix=".reproducibility-build-", dir=work_parent))
    try:
        build_package(snapshot, candidate, include_visual=False)
        report = compare_public_builds(reference, candidate)
        report["OBSERVED_AT"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        destination = Path(output_report).resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return report
    finally:
        shutil.rmtree(candidate, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output-report", required=True, type=Path)
    args = parser.parse_args()
    result = verify_reproducibility(args.snapshot, args.reference, args.output_report)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()


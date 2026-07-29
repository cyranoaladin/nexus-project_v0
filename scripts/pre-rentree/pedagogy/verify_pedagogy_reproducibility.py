#!/usr/bin/env python3
"""Verify byte-for-byte reproducibility of the canonical pedagogy generators."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
from pathlib import Path

from generate_positioning_resources import generate as generate_positioning
from generate_session_kits import generate as generate_sessions


EXPECTED_FILE_COUNT = 103


def _hash_tree(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file() and not path.is_symlink()
    }


def verify(repo_root: Path) -> dict[str, object]:
    repo_root = repo_root.resolve(strict=True)
    with tempfile.TemporaryDirectory(prefix="nexus-pedagogy-repro-a-") as first_raw:
        with tempfile.TemporaryDirectory(prefix="nexus-pedagogy-repro-b-") as second_raw:
            roots = [Path(first_raw), Path(second_raw)]
            trees: list[dict[str, str]] = []
            for root in roots:
                generate_positioning(
                    repo_root, root / "generated/positioning"
                )
                generate_sessions(repo_root, root / "generated/session-kits")
                trees.append(_hash_tree(root))
    reproducible = trees[0] == trees[1]
    result: dict[str, object] = {
        "reproducible": reproducible,
        "fileCount": len(trees[0]),
        "treeSha256": hashlib.sha256(
            json.dumps(
                trees[0],
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest(),
    }
    if len(trees[0]) != EXPECTED_FILE_COUNT:
        raise ValueError(
            f"{EXPECTED_FILE_COUNT} sorties attendues, {len(trees[0])} trouvées"
        )
    if not reproducible:
        differing = sorted(
            path
            for path in set(trees[0]) | set(trees[1])
            if trees[0].get(path) != trees[1].get(path)
        )
        raise ValueError(
            "générations non reproductibles : " + ", ".join(differing[:20])
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    try:
        result = verify(args.repo_root)
    except (OSError, ValueError) as error:
        print(f"REPRODUCTIBILITE PEDAGOGIQUE: ECHEC\n- {error}", file=sys.stderr)
        raise SystemExit(1) from error
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    print("REPRODUCTIBILITE PEDAGOGIQUE: OK")


if __name__ == "__main__":
    main()

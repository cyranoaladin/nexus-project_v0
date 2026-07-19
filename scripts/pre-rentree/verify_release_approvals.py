#!/usr/bin/env python3
"""Build and verify the hash-bound Pré-rentrée owner review bundle."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from release_governance import write_governance_bundle


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
APPROVAL_SCHEMA = SCRIPT_DIR / "owner-approval.schema.json"


def _resolve_from_repo(path: Path) -> Path:
    return path.resolve() if path.is_absolute() else (REPO_ROOT / path).resolve()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--require-owner-approval", action="store_true")
    args = parser.parse_args()

    decision = write_governance_bundle(_resolve_from_repo(args.package), APPROVAL_SCHEMA)
    owner_decision = decision["OWNER_REVIEW_DECISION"]
    print(f"OWNER_REVIEW_DECISION={owner_decision}")
    print(f"PUBLIC_STATUS={decision['PUBLIC_STATUS']}")
    print(f"PRIVATE_STATUS={decision['PRIVATE_STATUS']}")
    if args.require_owner_approval and owner_decision != "APPROVED":
        sys.exit(3)


if __name__ == "__main__":
    main()

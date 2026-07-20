#!/usr/bin/env python3
"""Build deterministic parent and owner-review archives from audited artifacts."""

from __future__ import annotations

import argparse
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    raise SystemExit(
        f"Packaging is not available until the audited build exists: {args.artifact_root} -> {args.output}"
    )


if __name__ == "__main__":
    main()

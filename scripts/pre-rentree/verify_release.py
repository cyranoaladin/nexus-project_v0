#!/usr/bin/env python3
"""Verify a complete Pré-rentrée 2026 review artifact tree."""

from __future__ import annotations

import argparse
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--repo-root", required=True, type=Path)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    raise SystemExit(f"Verification is not available until the audited build exists: {args.artifact_root}")


if __name__ == "__main__":
    main()

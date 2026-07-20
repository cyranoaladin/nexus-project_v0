#!/usr/bin/env python3
"""Remove only the local Pré-rentrée artifact directory."""

from pathlib import Path
import shutil


REPO_ROOT = Path(__file__).resolve().parents[2]
TARGET = REPO_ROOT / ".artifacts/pre-rentree-2026"


def main() -> None:
    if TARGET.exists():
        shutil.rmtree(TARGET)
    print(TARGET.relative_to(REPO_ROOT))


if __name__ == "__main__":
    main()

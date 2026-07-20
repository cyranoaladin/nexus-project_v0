from __future__ import annotations

import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
VERIFY_SCRIPT = REPO_ROOT / "scripts/pre-rentree/verify_repository_hygiene.py"


def test_repository_hygiene_verifier_accepts_the_tracked_tree() -> None:
    result = subprocess.run(
        [sys.executable, str(VERIFY_SCRIPT), "--repo-root", str(REPO_ROOT)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "TRACKED_GENERATED_ARTIFACT_COUNT=0" in result.stdout
    assert "DUPLICATE_DOCUMENT_SOURCE_COUNT=0" in result.stdout


def test_gitignore_declares_document_artifacts_and_csv_exceptions() -> None:
    lines = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()

    assert ".artifacts/" in lines
    assert "# Incident / forensic dumps with real DB data" in lines
    assert not any(line.startswith("n# Incident") for line in lines)
    assert "!audit/**/*.csv" in lines
    assert "!content/**/*.csv" in lines

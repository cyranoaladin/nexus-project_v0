"""Hermetic prerequisites for the pre-rentree Python test collection."""

from pathlib import Path
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT_PATH = REPO_ROOT / ".artifacts/pre-rentree-2026/publication.snapshot.json"


def pytest_sessionstart(session):  # noqa: ARG001
    """Build the canonical snapshot before test modules import it."""
    subprocess.run(
        ["npm", "run", "pre-rentree:snapshot", "--silent"],
        cwd=REPO_ROOT,
        check=True,
    )

    if not SNAPSHOT_PATH.is_file():
        raise RuntimeError("pre-rentree snapshot generation completed without an output file")

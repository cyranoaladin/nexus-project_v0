from __future__ import annotations

import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_ROOT = REPO_ROOT / "scripts/pre-rentree/pedagogy"


def test_generators_encode_only_canonical_sources_and_artifact_defaults():
    for name in ("generate_positioning_resources.py", "generate_session_kits.py"):
        text = (SCRIPT_ROOT / name).read_text(encoding="utf-8")
        assert "content/pre-rentree-2026/pedagogy" in text
        assert ".artifacts/pre-rentree-2026/pedagogy/generated" in text
        assert "docs/bilans/dossiers_tests_prerentree" not in text
        assert "/home/" not in text
        assert "public/" not in text
        assert "assets/" not in text
        assert "rmtree" not in text
        assert "datetime" not in text


def test_default_build_creates_only_generated_review_and_packages(tmp_path: Path):
    artifact_root = tmp_path / ".artifacts/pre-rentree-2026/pedagogy"
    commands = (
        (
            SCRIPT_ROOT / "generate_positioning_resources.py",
            artifact_root / "generated/positioning",
        ),
        (
            SCRIPT_ROOT / "generate_session_kits.py",
            artifact_root / "generated/session-kits",
        ),
    )
    for script, output in commands:
        result = subprocess.run(
            [
                sys.executable,
                str(script),
                "--repo-root",
                str(REPO_ROOT),
                "--output-root",
                str(output),
            ],
            text=True,
            capture_output=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
    (artifact_root / "review").mkdir()
    (artifact_root / "packages").mkdir()
    assert {path.name for path in artifact_root.iterdir()} == {
        "generated",
        "review",
        "packages",
    }

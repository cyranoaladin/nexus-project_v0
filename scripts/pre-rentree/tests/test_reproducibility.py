import json
import sys
from pathlib import Path

import pytest


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from verify_reproducibility import compare_public_builds  # noqa: E402


def _public_file(root: Path, name: str, content: bytes) -> None:
    path = root / "PUBLIC" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_reproducibility_report_records_identical_public_trees(tmp_path: Path):
    first, second = tmp_path / "first", tmp_path / "second"
    _public_file(first, "guide.pdf", b"same")
    _public_file(second, "guide.pdf", b"same")

    report = compare_public_builds(first, second)

    assert report["REPRODUCIBLE_PUBLIC_BUILD"] is True
    assert report["COMPARED_FILE_COUNT"] == 1
    assert report["MISMATCH_COUNT"] == 0
    assert report["MISMATCHES"] == []


def test_reproducibility_comparison_fails_on_content_drift(tmp_path: Path):
    first, second = tmp_path / "first", tmp_path / "second"
    _public_file(first, "guide.pdf", b"first")
    _public_file(second, "guide.pdf", b"second")

    with pytest.raises(ValueError, match="not reproducible"):
        compare_public_builds(first, second)


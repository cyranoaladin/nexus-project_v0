from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from record_assistant_visual_review import record_assistant_visual_review  # noqa: E402


def _write(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


def _review_tree(root: Path, *, defect_count: int = 0) -> Path:
    visual = {
        "AUTOMATED_VISUAL_CHECK": "PASS" if defect_count == 0 else "FAIL",
        "VISUAL_DEFECT_COUNT": defect_count,
        "ASSISTANT_VISUAL_REVIEW": "PENDING",
        "OWNER_VISUAL_REVIEW": "PENDING",
    }
    _write(root / "REVIEW/AUDIT/visual-qa-report.json", visual)
    _write(root / "REVIEW/VISUAL/visual-qa-report.json", visual)
    _write(root / "REVIEW/VISUAL/browser-accessibility-report.json", {
        "AUTOMATED_BROWSER_ACCESSIBILITY_CHECK": "PASS",
        "AXE_VIOLATION_COUNT": 0,
        "REMOTE_DEPENDENCY_COUNT": 0,
        "MOBILE_HORIZONTAL_OVERFLOW_PX": 0,
    })
    _write(root / "REVIEW/AUDIT/document-build-manifest.json", {
        "ASSISTANT_VISUAL_REVIEW_AT": None,
        "OWNER_REVIEWED_AT": None,
    })
    return root


def test_records_only_the_assistant_review_after_automated_checks_pass(tmp_path: Path):
    root = _review_tree(tmp_path)
    reviewed_at = "2026-07-20T20:00:00+01:00"

    report = record_assistant_visual_review(
        root,
        reviewed_at=reviewed_at,
        evidence=("planche de contact", "couverture", "capture mobile"),
    )

    assert report["ASSISTANT_VISUAL_REVIEW"] == "PASS"
    assert report["ASSISTANT_VISUAL_REVIEW_AT"] == reviewed_at
    assert report["ASSISTANT_VISUAL_REVIEW_EVIDENCE"] == [
        "planche de contact", "couverture", "capture mobile",
    ]
    for relative in (
        "REVIEW/AUDIT/visual-qa-report.json",
        "REVIEW/VISUAL/visual-qa-report.json",
    ):
        persisted = json.loads((root / relative).read_text(encoding="utf-8"))
        assert persisted["ASSISTANT_VISUAL_REVIEW"] == "PASS"
        assert persisted["OWNER_VISUAL_REVIEW"] == "PENDING"
    manifest = json.loads(
        (root / "REVIEW/AUDIT/document-build-manifest.json").read_text(encoding="utf-8")
    )
    assert manifest["ASSISTANT_VISUAL_REVIEW_AT"] == reviewed_at
    assert manifest["OWNER_REVIEWED_AT"] is None


def test_refuses_to_record_review_when_an_automated_visual_finding_is_open(tmp_path: Path):
    root = _review_tree(tmp_path, defect_count=1)

    with pytest.raises(ValueError, match="automated visual checks"):
        record_assistant_visual_review(
            root,
            reviewed_at="2026-07-20T20:00:00+01:00",
            evidence=("planche de contact",),
        )

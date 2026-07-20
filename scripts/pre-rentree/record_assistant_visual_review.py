#!/usr/bin/env python3
"""Record an actual assistant visual review without impersonating the owner."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


VISUAL_REPORTS = (
    Path("REVIEW/AUDIT/visual-qa-report.json"),
    Path("REVIEW/VISUAL/visual-qa-report.json"),
)
BROWSER_REPORT = Path("REVIEW/VISUAL/browser-accessibility-report.json")
BUILD_MANIFEST = Path("REVIEW/AUDIT/document-build-manifest.json")


def _read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def _write_object_atomic(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        temporary.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _automated_checks_pass(visual: dict[str, Any], browser: dict[str, Any]) -> bool:
    return (
        visual.get("AUTOMATED_VISUAL_CHECK") == "PASS"
        and visual.get("VISUAL_DEFECT_COUNT") == 0
        and browser.get("AUTOMATED_BROWSER_ACCESSIBILITY_CHECK") == "PASS"
        and browser.get("AXE_VIOLATION_COUNT") == 0
        and browser.get("REMOTE_DEPENDENCY_COUNT") == 0
        and browser.get("MOBILE_HORIZONTAL_OVERFLOW_PX") == 0
    )


def record_assistant_visual_review(
    artifact_root: Path,
    *,
    reviewed_at: str,
    evidence: Iterable[str],
) -> dict[str, Any]:
    root = Path(artifact_root).resolve()
    evidence_items = [item.strip() for item in evidence if item.strip()]
    if not evidence_items:
        raise ValueError("At least one reviewed visual evidence item is required")
    datetime.fromisoformat(reviewed_at)

    visual_reports = [_read_object(root / relative) for relative in VISUAL_REPORTS]
    browser = _read_object(root / BROWSER_REPORT)
    if not all(_automated_checks_pass(report, browser) for report in visual_reports):
        raise ValueError("Cannot record assistant review before automated visual checks pass")

    for relative, report in zip(VISUAL_REPORTS, visual_reports, strict=True):
        if report.get("OWNER_VISUAL_REVIEW") != "PENDING":
            raise ValueError("Owner visual review state must remain independently managed")
        report.update({
            "ASSISTANT_VISUAL_REVIEW": "PASS",
            "ASSISTANT_VISUAL_REVIEW_AT": reviewed_at,
            "ASSISTANT_VISUAL_REVIEW_EVIDENCE": evidence_items,
        })
        _write_object_atomic(root / relative, report)

    manifest = _read_object(root / BUILD_MANIFEST)
    manifest["ASSISTANT_VISUAL_REVIEW_AT"] = reviewed_at
    _write_object_atomic(root / BUILD_MANIFEST, manifest)
    return visual_reports[0]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-root", type=Path, required=True)
    parser.add_argument(
        "--reviewed-at",
        default=datetime.now().astimezone().isoformat(timespec="seconds"),
    )
    parser.add_argument("--evidence", action="append", required=True)
    args = parser.parse_args()
    report = record_assistant_visual_review(
        args.artifact_root,
        reviewed_at=args.reviewed_at,
        evidence=args.evidence,
    )
    print(json.dumps({
        "ASSISTANT_VISUAL_REVIEW": report["ASSISTANT_VISUAL_REVIEW"],
        "ASSISTANT_VISUAL_REVIEW_AT": report["ASSISTANT_VISUAL_REVIEW_AT"],
        "OWNER_VISUAL_REVIEW": report["OWNER_VISUAL_REVIEW"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Build the deterministic cross-lot Pré-rentrée deliverable inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


PUBLIC_EXCLUDED_PARTS = {"sources", "internal", "visual-review", "rendered"}
PUBLIC_EXCLUDED_NAMES = {"qa-report.json", "qa-report.md", "frames.concat.txt"}

LOT_SUBJECTS = [
    (1, "fix(pre-rentree): establish canonical commercial publication contract"),
    (2, "feat(pre-rentree): deliver complete week-one campaign kit"),
    (3, "feat(pre-rentree): complete WhatsApp conversion journey"),
    (4, "feat(pre-rentree): deliver parent conversion documentation"),
    (5, "feat(pre-rentree): complete full multichannel campaign"),
    (6, "feat(pre-rentree): add classroom-ready priority resources"),
    (7, "fix(pre-rentree): align public journey with canonical offer claims"),
]


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def commit_for_subject(root: Path, subject: str) -> str:
    output = subprocess.check_output(
        ["git", "log", "--all", "--format=%H%x00%s"], cwd=root, text=True
    )
    for line in output.splitlines():
        sha, _, candidate = line.partition("\x00")
        if candidate == subject:
            return sha
    raise RuntimeError(f"Missing lot commit: {subject}")


def files_for(
    root: Path,
    targets: list[str],
    *,
    public_candidate: bool,
) -> list[dict]:
    found: set[Path] = set()
    for target in targets:
        path = root / target
        if path.is_file():
            found.add(path)
        elif path.is_dir():
            found.update(item for item in path.rglob("*") if item.is_file())
        else:
            raise FileNotFoundError(target)
    if public_candidate:
        found = {
            path for path in found
            if not PUBLIC_EXCLUDED_PARTS.intersection(path.relative_to(root).parts)
            and path.name not in PUBLIC_EXCLUDED_NAMES
        }
    return [
        {"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": digest(path)}
        for path in sorted(found)
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("assets/campaigns/pre-rentree-2026/release-inventory.json"))
    parser.add_argument("--branch", required=True)
    parser.add_argument("--pull-request", type=int, required=True)
    parser.add_argument("--repository-commit-sha", required=True)
    args = parser.parse_args()
    root = args.repo_root.resolve()
    output = args.output if args.output.is_absolute() else root / args.output
    subprocess.run(
        ["git", "cat-file", "-e", f"{args.repository_commit_sha}^{{commit}}"],
        cwd=root,
        check=True,
    )
    groups_spec = [
        ("commercial-contract", ["content/pre-rentree-2026/commercial-contract.fr.json", "content/pre-rentree-2026/proofs.registry.json"], "INTERNAL_SOURCE"),
        ("week-one", ["assets/campaigns/pre-rentree-2026/week-one"], "PUBLIC_CANDIDATE"),
        ("whatsapp", ["content/pre-rentree-2026/whatsapp-conversion.fr.json", "content/pre-rentree-2026/whatsapp.fr.json"], "INTERNAL_SOURCE"),
        ("parent-documents", ["assets/campaigns/pre-rentree-2026/parent-documents"], "PUBLIC_CANDIDATE"),
        ("documents-final", ["assets/campaigns/pre-rentree-2026/documents-final"], "PUBLIC_CANDIDATE"),
        ("full-campaign", ["assets/campaigns/pre-rentree-2026/full-campaign"], "PUBLIC_CANDIDATE"),
        ("priority-resources", ["assets/pedagogy/pre-rentree-2026/priority-resources"], "INTERNAL_REVIEW"),
        ("public-journey-qa", ["assets/qa/pre-rentree-2026/public-journey"], "INTERNAL_REVIEW"),
        ("economic-simulation", ["assets/operations/pre-rentree-2026/economic-simulation"], "INTERNAL_REVIEW"),
        ("release-governance", ["content/pre-rentree-2026/residual-debt.fr.json", "content/pre-rentree-2026/release-gates.json"], "INTERNAL_SOURCE"),
    ]
    groups = [
        {
            "id": identifier,
            "visibility": visibility,
            "files": files_for(
                root,
                targets,
                public_candidate=visibility == "PUBLIC_CANDIDATE",
            ),
        }
        for identifier, targets, visibility in groups_spec
    ]
    public_files = sorted(
        (
            item
            for group in groups
            if group["visibility"] == "PUBLIC_CANDIDATE"
            for item in group["files"]
        ),
        key=lambda item: item["path"],
    )
    review_files = sorted(
        (
            item
            for group in groups
            if group["visibility"] != "PUBLIC_CANDIDATE"
            for item in group["files"]
        ),
        key=lambda item: item["path"],
    )
    aggregate = hashlib.sha256()
    for item in public_files:
        aggregate.update(f'{item["path"]}\0{item["sha256"]}\0'.encode())
    lots = [
        {"lot": lot, "commitSha": commit_for_subject(root, subject), "subject": subject}
        for lot, subject in LOT_SUBJECTS
    ]
    proof_registry = json.loads((root / "content/pre-rentree-2026/proofs.registry.json").read_text(encoding="utf-8"))
    remaining = [decision for decision in proof_registry["decisions"] if decision["status"] == "PENDING"]
    release_gates = json.loads((root / "content/pre-rentree-2026/release-gates.json").read_text(encoding="utf-8"))
    open_release_gates = [gate for gate in release_gates["gates"] if not gate["value"]]
    inventory = {
        "schemaVersion": "1.0.0",
        "campaignId": "pre-rentree-2026",
        "branch": args.branch,
        "pullRequest": args.pull_request,
        "repositoryCommitSha": args.repository_commit_sha,
        "releaseStatus": release_gates["releaseStatus"],
        "verdict": "BLOCKED" if open_release_gates else "READY_FOR_OWNER_GO",
        "lots": lots,
        "summary": {
            "fileCount": len(public_files),
            "totalBytes": sum(item["bytes"] for item in public_files),
            "aggregateSha256": aggregate.hexdigest(),
        },
        "reviewOnlySummary": {
            "fileCount": len(review_files),
            "totalBytes": sum(item["bytes"] for item in review_files),
        },
        "publicKitPolicy": {
            "excludedPathParts": sorted(PUBLIC_EXCLUDED_PARTS),
            "excludedFileNames": sorted(PUBLIC_EXCLUDED_NAMES),
            "rule": "Only groups marked PUBLIC_CANDIDATE may enter a future public package after every release gate is validated.",
        },
        "openReleaseGates": open_release_gates,
        "remainingDecisions": remaining,
        "groups": groups,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Release inventory: {len(public_files)} public-candidate files, verdict {inventory['verdict']}")


if __name__ == "__main__":
    main()

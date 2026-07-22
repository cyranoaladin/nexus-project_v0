#!/usr/bin/env python3
"""Build the deterministic cross-lot Pré-rentrée deliverable inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


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


def files_for(root: Path, targets: list[str]) -> list[dict]:
    found: set[Path] = set()
    for target in targets:
        path = root / target
        if path.is_file():
            found.add(path)
        elif path.is_dir():
            found.update(item for item in path.rglob("*") if item.is_file())
        else:
            raise FileNotFoundError(target)
    return [
        {"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": digest(path)}
        for path in sorted(found)
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("assets/campaigns/pre-rentree-2026/release-inventory.json"))
    args = parser.parse_args()
    root = args.repo_root.resolve()
    output = args.output if args.output.is_absolute() else root / args.output
    groups_spec = [
        ("commercial-contract", ["content/pre-rentree-2026/commercial-contract.fr.json", "content/pre-rentree-2026/proofs.registry.json"]),
        ("week-one", ["assets/campaigns/pre-rentree-2026/week-one"]),
        ("whatsapp", ["content/pre-rentree-2026/whatsapp-conversion.fr.json", "content/pre-rentree-2026/whatsapp.fr.json"]),
        ("parent-documents", ["assets/campaigns/pre-rentree-2026/parent-documents"]),
        ("full-campaign", ["assets/campaigns/pre-rentree-2026/full-campaign"]),
        ("priority-resources", ["assets/pedagogy/pre-rentree-2026/priority-resources"]),
        ("public-journey-qa", ["assets/qa/pre-rentree-2026/public-journey"]),
        ("economic-simulation", ["assets/operations/pre-rentree-2026/economic-simulation"]),
        ("release-governance", ["content/pre-rentree-2026/residual-debt.fr.json"]),
    ]
    groups = [{"id": identifier, "files": files_for(root, targets)} for identifier, targets in groups_spec]
    all_files = sorted((item for group in groups for item in group["files"]), key=lambda item: item["path"])
    aggregate = hashlib.sha256()
    for item in all_files:
        aggregate.update(f'{item["path"]}\0{item["sha256"]}\0'.encode())
    lots = [
        {"lot": lot, "commitSha": commit_for_subject(root, subject), "subject": subject}
        for lot, subject in LOT_SUBJECTS
    ]
    proof_registry = json.loads((root / "content/pre-rentree-2026/proofs.registry.json").read_text(encoding="utf-8"))
    remaining = [decision for decision in proof_registry["decisions"] if decision["status"] == "PENDING"]
    inventory = {
        "schemaVersion": "1.0.0",
        "campaignId": "pre-rentree-2026",
        "branch": "integration/canonical-fusion-20260720",
        "pullRequest": 71,
        "verdict": "BLOCKED" if remaining else "PUBLIC_READY",
        "lots": lots,
        "summary": {
            "fileCount": len(all_files),
            "totalBytes": sum(item["bytes"] for item in all_files),
            "aggregateSha256": aggregate.hexdigest(),
        },
        "remainingDecisions": remaining,
        "groups": groups,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Release inventory: {len(all_files)} files, verdict {inventory['verdict']}")


if __name__ == "__main__":
    main()

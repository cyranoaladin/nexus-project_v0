#!/usr/bin/env python3
"""Build the deterministic cross-lot Pré-rentrée deliverable inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path


PUBLIC_EXCLUDED_PARTS = {"sources", "internal", "visual-review", "rendered"}
PUBLIC_EXCLUDED_NAMES = {"qa-report.json", "qa-report.md", "frames.concat.txt"}

def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def release_commits(root: Path, baseline_sha: str, head_sha: str) -> list[dict]:
    subprocess.run(
        ["git", "merge-base", "--is-ancestor", baseline_sha, head_sha],
        cwd=root,
        check=True,
    )
    output = subprocess.check_output(
        [
            "git",
            "log",
            "--first-parent",
            "--reverse",
            "--format=%H%x00%s",
            f"{baseline_sha}..{head_sha}",
        ],
        cwd=root,
        text=True,
    )
    commits = []
    for index, line in enumerate(output.splitlines(), start=1):
        sha, separator, subject = line.partition("\x00")
        if not separator:
            raise RuntimeError(f"Invalid git log line: {line}")
        commits.append({"order": index, "commitSha": sha, "subject": subject})
    if not commits:
        raise RuntimeError("Release inventory cannot contain an empty commit range")
    return commits


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


def public_document_targets(root: Path) -> list[str]:
    document_root = root / "assets/campaigns/pre-rentree-2026/documents-final"
    manifest = json.loads((document_root / "manifest.json").read_text(encoding="utf-8"))
    targets = []
    forbidden_markers = ("DRAFT", "PROPOSAL", "PROPOSITION", "REVIEW")
    for document in manifest["documents"]:
        if not document["publicDownloadCandidate"]:
            continue
        if document["publicationStatus"] != "PUBLIC_FINAL":
            raise RuntimeError(
                f'Public download is not PUBLIC_FINAL: {document["fileName"]}'
            )
        if any(marker in document["fileName"].upper() for marker in forbidden_markers):
            raise RuntimeError(f'Forbidden public document marker: {document["fileName"]}')
        targets.append((document_root / document["fileName"]).relative_to(root).as_posix())
    if not targets:
        raise RuntimeError("The public PDF allowlist is empty")
    return targets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("assets/campaigns/pre-rentree-2026/release-inventory.json"))
    parser.add_argument("--branch", required=True)
    parser.add_argument("--pull-request", type=int)
    parser.add_argument("--baseline-sha")
    parser.add_argument("--repository-commit-sha", required=True)
    args = parser.parse_args()
    pull_request = args.pull_request
    if pull_request is None:
        raw_pull_request = os.environ.get("PRE_RENTREE_PULL_REQUEST")
        if raw_pull_request is None:
            parser.error(
                "--pull-request or PRE_RENTREE_PULL_REQUEST is required; "
                "release provenance cannot be inferred safely"
            )
        try:
            pull_request = int(raw_pull_request)
        except ValueError:
            parser.error("PRE_RENTREE_PULL_REQUEST must be a positive integer")
    if pull_request < 1:
        parser.error("pull request number must be a positive integer")
    baseline_sha = args.baseline_sha or os.environ.get("PRE_RENTREE_BASELINE_SHA")
    if not baseline_sha:
        parser.error(
            "--baseline-sha or PRE_RENTREE_BASELINE_SHA is required; "
            "release ancestry cannot be inferred safely"
        )
    root = args.repo_root.resolve()
    output = args.output if args.output.is_absolute() else root / args.output
    subprocess.run(
        ["git", "cat-file", "-e", f"{args.repository_commit_sha}^{{commit}}"],
        cwd=root,
        check=True,
    )
    subprocess.run(
        ["git", "cat-file", "-e", f"{baseline_sha}^{{commit}}"],
        cwd=root,
        check=True,
    )
    groups_spec = [
        ("commercial-contract", ["content/pre-rentree-2026/commercial-contract.fr.json", "content/pre-rentree-2026/proofs.registry.json"], "INTERNAL_SOURCE"),
        ("week-one", ["assets/campaigns/pre-rentree-2026/week-one"], "INTERNAL_REVIEW"),
        ("whatsapp", ["content/pre-rentree-2026/whatsapp-conversion.fr.json", "content/pre-rentree-2026/whatsapp.fr.json"], "INTERNAL_SOURCE"),
        ("parent-documents", ["assets/campaigns/pre-rentree-2026/parent-documents"], "INTERNAL_REVIEW"),
        ("documents-final", public_document_targets(root), "PUBLIC_CANDIDATE"),
        ("full-campaign", ["assets/campaigns/pre-rentree-2026/full-campaign"], "INTERNAL_REVIEW"),
        (
            "public-social",
            [
                "assets/campaigns/pre-rentree-2026/social/PUBLIC",
                "assets/campaigns/pre-rentree-2026/social/manifest-public.json",
            ],
            "PUBLIC_CANDIDATE",
        ),
        (
            "social-review",
            [
                "assets/campaigns/pre-rentree-2026/social/REVIEW",
                "assets/campaigns/pre-rentree-2026/social/manifest-review.json",
            ],
            "INTERNAL_REVIEW",
        ),
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
    commits = release_commits(root, baseline_sha, args.repository_commit_sha)
    proof_registry = json.loads((root / "content/pre-rentree-2026/proofs.registry.json").read_text(encoding="utf-8"))
    remaining = [decision for decision in proof_registry["decisions"] if decision["status"] == "PENDING"]
    release_gates = json.loads((root / "content/pre-rentree-2026/release-gates.json").read_text(encoding="utf-8"))
    open_release_gates = [gate for gate in release_gates["gates"] if not gate["value"]]
    open_gate_ids = {gate["id"] for gate in open_release_gates}
    if not open_release_gates and release_gates["releaseStatus"] == "PUBLIC_READY":
        verdict = "PUBLIC_READY"
    elif (
        open_gate_ids == {"publication_authorization"}
        and release_gates["releaseStatus"] == "READY_FOR_OWNER_GO"
    ):
        verdict = "READY_FOR_OWNER_GO"
    else:
        verdict = "BLOCKED"
    campaign = json.loads(
        (root / "data/campaigns/pre-rentree-2026.json").read_text(encoding="utf-8")
    )
    public_document_manifest = json.loads(
        (
            root
            / "assets"
            / "campaigns"
            / "pre-rentree-2026"
            / "documents-final"
            / "manifest.json"
        ).read_text(encoding="utf-8")
    )
    public_documents = [
        {
            "fileName": document["fileName"],
            "sha256": document["sha256"],
            "bytes": document["bytes"],
        }
        for document in public_document_manifest["documents"]
        if document["publicDownloadCandidate"]
    ]
    social_manifest = json.loads(
        (
            root
            / "assets"
            / "campaigns"
            / "pre-rentree-2026"
            / "social"
            / "manifest-public.json"
        ).read_text(encoding="utf-8")
    )
    inventory = {
        "schemaVersion": "1.0.0",
        "campaignId": "pre-rentree-2026",
        "campaignVersion": campaign["version"],
        "launchDate": social_manifest["launchDate"],
        "branch": args.branch,
        "pullRequest": pull_request,
        "baselineSha": baseline_sha,
        "repositoryCommitSha": args.repository_commit_sha,
        "provenance": {
            "repositoryCommitShaRole": "BUILD_INPUT_NOT_FINAL_RELEASE_BINDING",
            "finalReleaseBinding": "ANNOTATED_GO_TAG_AND_GITHUB_PR_COMMENT",
        },
        "releaseStatus": release_gates["releaseStatus"],
        "verdict": verdict,
        "releaseMetrics": {
            "pedagogicalModuleCount": 14,
            "pedagogicalSessionTemplateCount": 70,
            "operationalCohortCount": 17,
            "scheduledSessionOccurrenceCount": 85,
            "studentSessionsPerSubject": 5,
            "studentHoursPerSubject": 10,
        },
        "commits": commits,
        "publicDocuments": public_documents,
        "publicSocialAssets": social_manifest["assets"],
        "githubChecks": {
            "statusAtBuild": "PENDING_REMOTE_VALIDATION",
            "authoritativeBinding": "FINAL_PR_STATUS_CHECK_ROLLUP_AND_GO_COMMENT",
        },
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

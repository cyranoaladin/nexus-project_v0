import json
import os
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts/pre-rentree/build_release_inventory.py"


def test_release_inventory_covers_all_seven_lots_and_final_assets(tmp_path: Path):
    output = tmp_path / "release-inventory.json"
    head = subprocess.check_output(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()
    baseline = subprocess.check_output(
        ["git", "rev-parse", "HEAD^"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()
    subprocess.run([
        sys.executable,
        str(SCRIPT),
        "--repo-root",
        str(REPO_ROOT),
        "--output",
        str(output),
        "--branch",
        "release/pre-rentree-2026-public-ready",
        "--pull-request",
        "999",
        "--baseline-sha",
        baseline,
        "--repository-commit-sha",
        head,
    ], check=True)
    inventory = json.loads(output.read_text(encoding="utf-8"))
    release_gates = json.loads(
        (REPO_ROOT / "content/pre-rentree-2026/release-gates.json")
        .read_text(encoding="utf-8")
    )

    assert inventory["campaignId"] == "pre-rentree-2026"
    assert inventory["campaignVersion"] == "2.1.0"
    assert inventory["launchDate"] == "2026-07-26"
    assert inventory["verdict"] == release_gates["releaseStatus"]
    assert inventory["branch"] == "release/pre-rentree-2026-public-ready"
    assert inventory["pullRequest"] == 999
    assert inventory["baselineSha"] == baseline
    assert inventory["repositoryCommitSha"] == head
    assert inventory["provenance"] == {
        "repositoryCommitShaRole": "BUILD_INPUT_NOT_FINAL_RELEASE_BINDING",
        "finalReleaseBinding": "ANNOTATED_GO_TAG_AND_GITHUB_PR_COMMENT",
    }
    assert inventory["commits"]
    assert all(len(commit["commitSha"]) == 40 for commit in inventory["commits"])
    assert inventory["releaseMetrics"] == {
        "pedagogicalModuleCount": 17,
        "pedagogicalSessionTemplateCount": 85,
        "operationalCohortCount": 20,
        "scheduledSessionOccurrenceCount": 100,
        "studentSessionsPerSubject": 5,
        "studentHoursPerSubject": 10,
    }
    assert inventory["summary"]["fileCount"] > 20
    assert inventory["summary"]["totalBytes"] > 1_000_000
    assert inventory["summary"]["aggregateSha256"]
    public_groups = [
        group for group in inventory["groups"]
        if group["visibility"] == "PUBLIC_CANDIDATE"
    ]
    groups = {group["id"] for group in public_groups}
    assert groups == {"documents-final", "public-social"}
    forbidden_parts = {"sources", "internal", "visual-review", "rendered"}
    for group in public_groups:
        for item in group["files"]:
            assert (REPO_ROOT / item["path"]).is_file()
            assert not forbidden_parts.intersection(Path(item["path"]).parts)
            assert not Path(item["path"]).name.startswith("qa-report")
    document_group = next(group for group in public_groups if group["id"] == "documents-final")
    manifest = json.loads(
        (REPO_ROOT / "assets/campaigns/pre-rentree-2026/documents-final/manifest.json")
        .read_text(encoding="utf-8")
    )
    expected_public_pdfs = {
        item["fileName"]
        for item in manifest["documents"]
        if item["publicDownloadCandidate"] and item["publicationStatus"] == "PUBLIC_FINAL"
    }
    assert {Path(item["path"]).name for item in document_group["files"]} == expected_public_pdfs
    assert len(inventory["publicDocuments"]) == 8
    assert inventory["publicSocialAssets"]
    assert inventory["githubChecks"]["statusAtBuild"] == "PENDING_REMOTE_VALIDATION"
    assert all(
        not any(marker in Path(item["path"]).name.upper() for marker in ("DRAFT", "PROPOSAL", "PROPOSITION", "REVIEW"))
        for item in document_group["files"]
    )


def test_release_inventory_derives_pull_request_from_explicit_environment(tmp_path: Path):
    output = tmp_path / "release-inventory.json"
    head = subprocess.check_output(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()
    baseline = subprocess.check_output(
        ["git", "rev-parse", "HEAD^"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()
    env = os.environ.copy()
    env["PRE_RENTREE_PULL_REQUEST"] = "999"
    env["PRE_RENTREE_BASELINE_SHA"] = baseline

    subprocess.run([
        sys.executable,
        str(SCRIPT),
        "--repo-root",
        str(REPO_ROOT),
        "--output",
        str(output),
        "--branch",
        "release/pre-rentree-2026-public-ready",
        "--repository-commit-sha",
        head,
    ], check=True, env=env)

    inventory = json.loads(output.read_text(encoding="utf-8"))
    assert inventory["pullRequest"] == 999
    assert inventory["baselineSha"] == baseline


def test_release_inventory_fails_closed_without_pull_request(tmp_path: Path):
    env = os.environ.copy()
    env.pop("PRE_RENTREE_PULL_REQUEST", None)
    env["PRE_RENTREE_BASELINE_SHA"] = subprocess.check_output(
        ["git", "rev-parse", "HEAD^"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()
    result = subprocess.run([
        sys.executable,
        str(SCRIPT),
        "--repo-root",
        str(REPO_ROOT),
        "--output",
        str(tmp_path / "release-inventory.json"),
        "--branch",
        "feat/pre-rentree-planning-scheduler",
        "--repository-commit-sha",
        subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            text=True,
        ).strip(),
    ], capture_output=True, text=True, env=env)

    assert result.returncode != 0
    assert "PRE_RENTREE_PULL_REQUEST" in result.stderr


def test_release_inventory_fails_closed_without_baseline(tmp_path: Path):
    env = os.environ.copy()
    env["PRE_RENTREE_PULL_REQUEST"] = "999"
    env.pop("PRE_RENTREE_BASELINE_SHA", None)
    result = subprocess.run([
        sys.executable,
        str(SCRIPT),
        "--repo-root",
        str(REPO_ROOT),
        "--output",
        str(tmp_path / "release-inventory.json"),
        "--branch",
        "release/pre-rentree-2026-public-ready",
        "--repository-commit-sha",
        subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            text=True,
        ).strip(),
    ], capture_output=True, text=True, env=env)

    assert result.returncode != 0
    assert "PRE_RENTREE_BASELINE_SHA" in result.stderr


def test_active_package_script_has_no_hardcoded_pull_request():
    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    command = package["scripts"]["pre-rentree:release-inventory"]

    assert "--pull-request 74" not in command
    assert "--pull-request 75" not in command
    assert "PRE_RENTREE_PULL_REQUEST" in command
    assert "PRE_RENTREE_BRANCH" in command
    assert "PRE_RENTREE_BASELINE_SHA" in command

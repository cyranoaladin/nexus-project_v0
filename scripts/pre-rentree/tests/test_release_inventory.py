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
    subprocess.run([
        sys.executable,
        str(SCRIPT),
        "--repo-root",
        str(REPO_ROOT),
        "--output",
        str(output),
        "--branch",
        "feat/pre-rentree-planning-scheduler",
        "--pull-request",
        "75",
        "--repository-commit-sha",
        head,
    ], check=True)
    inventory = json.loads(output.read_text(encoding="utf-8"))

    assert inventory["campaignId"] == "pre-rentree-2026"
    assert inventory["verdict"] == "BLOCKED"
    assert inventory["branch"] == "feat/pre-rentree-planning-scheduler"
    assert inventory["pullRequest"] == 75
    assert inventory["repositoryCommitSha"] == head
    assert inventory["provenance"] == {
        "repositoryCommitShaRole": "BUILD_INPUT_NOT_FINAL_RELEASE_BINDING",
        "finalReleaseBinding": "ANNOTATED_GO_TAG_AND_GITHUB_PR_COMMENT",
    }
    assert [lot["lot"] for lot in inventory["lots"]] == list(range(1, 8))
    assert all(len(lot["commitSha"]) == 40 for lot in inventory["lots"])
    assert inventory["summary"]["fileCount"] > 300
    assert inventory["summary"]["totalBytes"] > 1_000_000
    assert inventory["summary"]["aggregateSha256"]
    public_groups = [
        group for group in inventory["groups"]
        if group["visibility"] == "PUBLIC_CANDIDATE"
    ]
    groups = {group["id"] for group in public_groups}
    assert {
        "week-one",
        "parent-documents",
        "full-campaign",
        "documents-final",
    }.issubset(groups)
    forbidden_parts = {"sources", "internal", "visual-review", "rendered"}
    for group in public_groups:
        for item in group["files"]:
            assert (REPO_ROOT / item["path"]).is_file()
            assert not forbidden_parts.intersection(Path(item["path"]).parts)
            assert not Path(item["path"]).name.startswith("qa-report")


def test_release_inventory_derives_pull_request_from_explicit_environment(tmp_path: Path):
    output = tmp_path / "release-inventory.json"
    head = subprocess.check_output(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()
    env = os.environ.copy()
    env["PRE_RENTREE_PULL_REQUEST"] = "75"

    subprocess.run([
        sys.executable,
        str(SCRIPT),
        "--repo-root",
        str(REPO_ROOT),
        "--output",
        str(output),
        "--branch",
        "feat/pre-rentree-planning-scheduler",
        "--repository-commit-sha",
        head,
    ], check=True, env=env)

    inventory = json.loads(output.read_text(encoding="utf-8"))
    assert inventory["pullRequest"] == 75


def test_release_inventory_fails_closed_without_pull_request(tmp_path: Path):
    env = os.environ.copy()
    env.pop("PRE_RENTREE_PULL_REQUEST", None)
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


def test_active_package_script_has_no_hardcoded_pull_request():
    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    command = package["scripts"]["pre-rentree:release-inventory"]

    assert "--pull-request 74" not in command
    assert "--pull-request 75" not in command
    assert "PRE_RENTREE_PULL_REQUEST" in command
    assert "PRE_RENTREE_BRANCH" in command

import json
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
        "feat/svt-integration-clean",
        "--pull-request",
        "74",
        "--repository-commit-sha",
        head,
    ], check=True)
    inventory = json.loads(output.read_text(encoding="utf-8"))

    assert inventory["campaignId"] == "pre-rentree-2026"
    assert inventory["verdict"] == "BLOCKED"
    assert inventory["branch"] == "feat/svt-integration-clean"
    assert inventory["pullRequest"] == 74
    assert inventory["repositoryCommitSha"] == head
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

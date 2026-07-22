import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts/pre-rentree/build_release_inventory.py"


def test_release_inventory_covers_all_seven_lots_and_final_assets(tmp_path: Path):
    output = tmp_path / "release-inventory.json"
    subprocess.run([sys.executable, str(SCRIPT), "--repo-root", str(REPO_ROOT), "--output", str(output)], check=True)
    inventory = json.loads(output.read_text(encoding="utf-8"))

    assert inventory["campaignId"] == "pre-rentree-2026"
    assert inventory["verdict"] == "BLOCKED"
    assert [lot["lot"] for lot in inventory["lots"]] == list(range(1, 8))
    assert all(len(lot["commitSha"]) == 40 for lot in inventory["lots"])
    assert inventory["summary"]["fileCount"] > 600
    assert inventory["summary"]["totalBytes"] > 1_000_000
    assert inventory["summary"]["aggregateSha256"]
    groups = {group["id"] for group in inventory["groups"]}
    assert {
        "week-one",
        "whatsapp",
        "parent-documents",
        "full-campaign",
        "priority-resources",
        "public-journey-qa",
        "economic-simulation",
    }.issubset(groups)
    assert all((REPO_ROOT / item["path"]).is_file() for group in inventory["groups"] for item in group["files"])

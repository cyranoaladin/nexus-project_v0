import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
KIT = ROOT / "assets" / "campaigns" / "pre-rentree-2026" / "full-campaign"


def load_manifest():
    return json.loads((KIT / "manifest.json").read_text(encoding="utf-8"))


def test_full_campaign_manifest_files_exist_and_match_sha256():
    manifest = load_manifest()
    assert manifest["campaignId"] == "pre-rentree-2026"
    assert manifest["version"] == "2026-full-campaign-v1"
    assert manifest["status"] == "READY_FOR_OWNER_REVIEW"
    assert len(manifest["assets"]) >= 300
    for asset in manifest["assets"]:
        path = KIT / asset["path"]
        assert path.is_file(), asset["path"]
        assert path.stat().st_size == asset["bytes"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"]


def test_full_campaign_inventory_is_complete():
    manifest = load_manifest()
    ids = {asset["assetId"] for asset in manifest["assets"]}

    assert len([asset_id for asset_id in ids if asset_id.startswith("full-post-") and asset_id.endswith("-png")]) == 13
    assert len([asset_id for asset_id in ids if asset_id.startswith("full-carousel-") and asset_id.endswith("-pdf")]) == 8
    assert len([asset_id for asset_id in ids if asset_id.startswith("full-carousel-") and "-slide-" in asset_id and asset_id.endswith("-png")]) >= 40
    assert len([asset_id for asset_id in ids if asset_id.startswith("full-story-") and asset_id.endswith("-png")]) == 36
    assert len([asset_id for asset_id in ids if asset_id.startswith("full-reel-") and asset_id.endswith("-video")]) == 3
    assert len([asset_id for asset_id in ids if asset_id.startswith("full-reel-") and asset_id.endswith("-srt")]) == 3
    assert len([asset_id for asset_id in ids if asset_id.startswith("full-reel-") and asset_id.endswith("-storyboard")]) == 3


def test_full_campaign_raster_dimensions_and_formats_are_exact():
    for asset in load_manifest()["assets"]:
        if asset["format"] not in {"PNG", "WEBP"}:
            continue
        with Image.open(KIT / asset["path"]) as image:
            assert image.size == (asset["width"], asset["height"]), asset["path"]
            assert image.format == asset["format"], asset["path"]


def test_full_campaign_public_exports_have_no_forbidden_terms():
    forbidden = (
        "gate",
        "review",
        "blocked",
        "placeholder",
        "snt",
        "manuel offert",
        "remise annuelle",
        "places très limitées",
    )
    for path in [
        KIT / "copy" / "campaign-copy.json",
        KIT / "copy" / "whatsapp-variants.md",
        KIT / "calendar" / "full-campaign-calendar.json",
        KIT / "calendar" / "full-campaign-calendar.csv",
    ]:
        public_text = path.read_text(encoding="utf-8").lower()
        assert all(term not in public_text for term in forbidden), path


def test_full_campaign_quality_report_has_no_p0():
    report = json.loads((KIT / "qa-report.json").read_text(encoding="utf-8"))
    assert report["missingAssetCount"] == 0
    assert report["wrongDimensionCount"] == 0
    assert report["overflowCount"] == 0
    assert report["contrastFailures"] == 0
    assert report["brokenReferenceCount"] == 0
    assert report["minimumContrastRatio"] >= 4.5

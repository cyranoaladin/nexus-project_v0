import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
KIT = ROOT / "assets" / "campaigns" / "pre-rentree-2026" / "week-one"


def test_manifest_files_exist_and_match_sha256():
    manifest = json.loads((KIT / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["campaignId"] == "pre-rentree-2026"
    assert manifest["version"] == "2026-week-one-v1"
    assert manifest["launchDate"] == "2026-07-26"
    assert manifest["launchDateStatus"] == "SCHEDULED"
    assert len(manifest["assets"]) >= 50
    for asset in manifest["assets"]:
        path = KIT / asset["path"]
        assert path.is_file(), asset["path"]
        assert path.stat().st_size == asset["bytes"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"]


def test_raster_dimensions_and_formats_are_exact():
    manifest = json.loads((KIT / "manifest.json").read_text(encoding="utf-8"))
    raster_assets = [item for item in manifest["assets"] if item["format"] in {"PNG", "WEBP"}]
    assert raster_assets
    for asset in raster_assets:
        with Image.open(KIT / asset["path"]) as image:
            assert image.size == (asset["width"], asset["height"])
            assert image.format == asset["format"]


def test_expected_visual_inventory_is_complete():
    manifest = json.loads((KIT / "manifest.json").read_text(encoding="utf-8"))
    ids = {item["assetId"] for item in manifest["assets"]}
    for asset_id in {
        "week1-main-portrait-png",
        "week1-main-portrait-webp",
        "week1-main-square-png",
        "week1-main-landscape-png",
        "week1-main-story-png",
        "week1-main-thumbnail-webp",
        "week1-carousel-pdf",
        "week1-reel-video",
        "week1-reel-srt",
        "week1-reel-storyboard",
        "week1-calendar-json",
        "week1-calendar-csv",
        "week1-calendar-pdf",
    }:
        assert asset_id in ids
    assert len([item for item in ids if item.startswith("week1-carousel-slide-") and item.endswith("-png")]) == 8
    assert len([item for item in ids if item.startswith("week1-story-") and item.endswith("-png")]) == 9


def test_main_story_uses_the_central_safe_zone_instead_of_leaving_a_large_void():
    with Image.open(KIT / "main/main-story.png") as image:
        story = image.convert("RGB")

    assert story.size == (1080, 1920)
    central_rows_with_content = 0
    for y in range(700, 1450):
        dark_pixels = sum(
            1
            for x in range(story.width)
            if sum(story.getpixel((x, y))) < 520
        )
        if dark_pixels >= 50:
            central_rows_with_content += 1

    assert central_rows_with_content >= 300


def test_public_text_exports_do_not_leak_internal_or_hidden_claims():
    # "snt" retiré : matière Seconde légitime depuis R2 (décision direction 2026-07-23).
    forbidden = ("gate", "review", "blocked", "owner", "placeholder", "manuel offert", "remise annuelle")
    for relative in [
        "copy/publication-copy.json",
        "calendar/week-one-calendar.json",
        "calendar/week-one-calendar.csv",
        "reel/reel-fr.srt",
    ]:
        text = (KIT / relative).read_text(encoding="utf-8").lower()
        assert all(term not in text for term in forbidden), relative


def test_calendar_uses_the_owner_authorized_launch_date():
    calendar = json.loads((KIT / "calendar/week-one-calendar.json").read_text(encoding="utf-8"))
    assert [day["day"] for day in calendar["days"]] == [f"J{index}" for index in range(1, 8)]
    assert [day["date"] for day in calendar["days"]] == [
        "2026-07-26",
        "2026-07-27",
        "2026-07-28",
        "2026-07-29",
        "2026-07-30",
        "2026-07-31",
        "2026-08-01",
    ]


def test_calendar_csv_uses_repository_safe_line_endings():
    calendar_csv = (KIT / "calendar/week-one-calendar.csv").read_bytes()
    assert b"\r\n" not in calendar_csv

import json
import sys
from pathlib import Path

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from document_assets import (  # noqa: E402
    decode_qr,
    generate_qr,
    generate_social_visuals,
    prepare_assets,
)
from document_audit import audit_social_visuals  # noqa: E402
from document_model import load_snapshot  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = load_snapshot(
    REPO_ROOT / ".artifacts/pre-rentree-2026/publication.snapshot.json",
    REPO_ROOT / "scripts/pre-rentree/schemas/publication-snapshot.schema.json",
)


def test_copies_only_snapshot_assets_and_verifies_their_hashes(tmp_path: Path):
    copied = prepare_assets(SNAPSHOT, REPO_ROOT, tmp_path)

    assert {item["id"] for item in copied} == {
        *{item["id"] for item in SNAPSHOT["assets"]["logos"]},
        *{item["id"] for item in SNAPSHOT["assets"]["fonts"]},
    }
    assert all((tmp_path / item["filename"]).is_file() for item in copied)
    assert all(len(item["sha256"]) == 64 for item in copied)


def test_generates_and_decodes_the_canonical_qr_target(tmp_path: Path):
    qr_path = generate_qr(SNAPSHOT, tmp_path)
    assert qr_path.is_file()
    assert decode_qr(qr_path) == SNAPSHOT["document"]["qrTarget"]


def test_generates_feed_story_monochrome_and_alt_text_from_snapshot(tmp_path: Path):
    assets_dir = tmp_path / "assets"
    public_dir = tmp_path / "public"
    prepare_assets(SNAPSHOT, REPO_ROOT, assets_dir)
    generated = generate_social_visuals(SNAPSHOT, assets_dir, public_dir)

    social_names = SNAPSHOT["document"]["outputs"]["social"]
    assert Image.open(public_dir / social_names["feed"]).size == (1080, 1350)
    assert Image.open(public_dir / social_names["story"]).size == (1080, 1920)
    monochrome = Image.open(public_dir / social_names["monochrome"])
    assert monochrome.size == (1080, 1350)
    assert monochrome.mode in {"1", "L", "RGB"}
    alt = json.loads((public_dir / social_names["altText"]).read_text(encoding="utf-8"))
    assert set(alt) == {"feed", "story", "monochrome"}
    assert all(value.strip() for value in alt.values())
    assert set(generated) == {"feed", "story", "monochrome", "altText"}

    for key in ("feed", "story", "monochrome"):
        image = Image.open(generated[key]).convert("L")
        content = image.crop((0, 50, image.width, image.height))
        dark_ink = content.point(lambda pixel: 255 if pixel < 100 else 0)
        ink_box = dark_ink.getbbox()
        assert ink_box is not None
        assert ink_box[0] >= 24, (key, ink_box)
        assert ink_box[2] <= image.width - 24, (key, ink_box)

    report = audit_social_visuals(SNAPSHOT, public_dir)
    assert report["SOCIAL_VISUAL_DEFECT_COUNT"] == 0
    assert len(report["IMAGE_EVIDENCE"]) == 3
    assert all(len(item["SHA256"]) == 64 for item in report["IMAGE_EVIDENCE"])

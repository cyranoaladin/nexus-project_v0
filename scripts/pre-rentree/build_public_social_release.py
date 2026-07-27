#!/usr/bin/env python3
"""Build deterministic PUBLIC and watermarked REVIEW social release families."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, ByteStringObject


LAUNCH_DATE = "2026-07-26"
CAMPAIGN_DATES = "17–28 août 2026"
PUBLICATION_STATUS = "PUBLIC_RELEASE_CANDIDATE"
WATERMARK = "DOCUMENT DE REVUE — DIFFUSION INTERDITE"
FIXED_PDF_DATE = "D:20000101000000Z"
FORBIDDEN_PUBLIC_COPY = re.compile(
    r"document de revue|diffusion interdite|programme et inscription|"
    r"pré[- ]?inscri(?:re|ption)|\bréserver\b|\bpayer\b",
    re.IGNORECASE,
)
SECONDE_PHYSICS = re.compile(
    r"seconde[^.]{0,180}physique[- ]?chimie|physique[- ]?chimie[^.]{0,180}seconde",
    re.IGNORECASE,
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def watermark(source: Path, target: Path, font_path: Path) -> None:
    with Image.open(source).convert("RGBA") as image:
        overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        font = ImageFont.truetype(font_path, size=max(24, image.width // 28))
        text_box = draw.textbbox((0, 0), WATERMARK, font=font)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]
        padding = max(20, image.width // 40)
        x = max(padding, (image.width - text_width) // 2)
        y = min(
            image.height - text_height - padding,
            int(image.height * 0.72),
        )
        draw.rounded_rectangle(
            (
                x - padding,
                y - padding,
                x + text_width + padding,
                y + text_height + padding,
            ),
            radius=max(12, padding // 2),
            fill=(11, 31, 58, 180),
        )
        draw.text((x, y), WATERMARK, font=font, fill=(255, 255, 255, 255))
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.alpha_composite(image, overlay).convert("RGB").save(
            target,
            format="PNG",
            optimize=True,
        )


def contact_sheet(paths: list[Path], output: Path, columns: int, thumb_width: int) -> None:
    thumbs: list[Image.Image] = []
    for path in paths:
        with Image.open(path).convert("RGB") as image:
            thumb = image.copy()
            thumb.thumbnail((thumb_width, int(thumb_width * 1.8)), Image.Resampling.LANCZOS)
            thumbs.append(thumb)
    rows = (len(thumbs) + columns - 1) // columns
    cell_height = max(item.height for item in thumbs) + 40
    sheet = Image.new("RGB", (columns * (thumb_width + 30) + 30, rows * cell_height + 30), "white")
    for index, thumb in enumerate(thumbs):
        x = 30 + (index % columns) * (thumb_width + 30)
        y = 30 + (index // columns) * cell_height
        sheet.paste(thumb, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", optimize=True)


def normalize_pdf(path: Path, identifier: str, title: str) -> None:
    writer = PdfWriter(clone_from=path)
    writer.add_metadata(
        {
            "/Title": title,
            "/Author": "Nexus Réussite",
            "/Creator": "Nexus deterministic public social release builder",
            "/Producer": "Nexus Réussite",
            "/CreationDate": FIXED_PDF_DATE,
            "/ModDate": FIXED_PDF_DATE,
        }
    )
    digest = hashlib.sha256(identifier.encode("utf-8")).digest()[:16]
    writer._ID = ArrayObject([ByteStringObject(digest), ByteStringObject(digest)])
    normalized = path.with_suffix(".normalized.pdf")
    with normalized.open("wb") as handle:
        writer.write(handle)
    normalized.replace(path)


def asset_record(path: Path, root: Path, role: str, source: str) -> dict[str, Any]:
    width = height = None
    if path.suffix.lower() == ".png":
        with Image.open(path) as image:
            width, height = image.size
    return {
        "path": path.relative_to(root).as_posix(),
        "role": role,
        "source": source,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "width": width,
        "height": height,
    }


def validate_textual_public_assets(public_root: Path) -> None:
    text = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in public_root.rglob("*")
        if path.suffix.lower() in {".json", ".csv", ".md", ".srt", ".svg", ".txt"}
    )
    forbidden = FORBIDDEN_PUBLIC_COPY.search(text)
    if forbidden:
        raise ValueError(f"Forbidden public campaign copy: {forbidden.group(0)}")
    stale = SECONDE_PHYSICS.search(text)
    if stale:
        raise ValueError(f"Stale Seconde campaign claim: {stale.group(0)}")
    if "99 192 829" not in text:
        raise ValueError("Public campaign copy must expose WhatsApp 99 192 829")


def validate_calendar(path: Path) -> None:
    items = json.loads(path.read_text(encoding="utf-8"))
    if not items:
        raise ValueError("Public social calendar is empty")
    required = {
        "publicationDate",
        "publicationTime",
        "channel",
        "audience",
        "assetId",
        "body",
        "cta",
        "utm",
        "whatsappPrefill",
    }
    for item in items:
        missing = required - set(item)
        if missing or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", item["publicationDate"]):
            raise ValueError(f"Incomplete calendar item {item.get('id')}: {sorted(missing)}")


def build(repo_root: Path, output: Path) -> None:
    week = repo_root / "assets" / "campaigns" / "pre-rentree-2026" / "week-one"
    full = repo_root / "assets" / "campaigns" / "pre-rentree-2026" / "full-campaign"
    if output.exists():
        shutil.rmtree(output)
    public = output / "PUBLIC"
    review = output / "REVIEW"
    watermark_font = (
        repo_root
        / "assets"
        / "campaigns"
        / "pre-rentree-2026"
        / "parent-documents"
        / "sources"
        / "fonts"
        / "DMSans.ttf"
    )

    public_images: list[tuple[Path, Path, str]] = [
        (week / "main" / "main-portrait.png", public / "feed" / "principal.png", "feed-main"),
        (full / "publications" / "02-entree-3e.png", public / "feed" / "entree-3e.png", "feed-level"),
        (full / "publications" / "03-entree-seconde.png", public / "feed" / "entree-seconde.png", "feed-level"),
        (full / "publications" / "04-entree-premiere.png", public / "feed" / "entree-premiere.png", "feed-level"),
        (full / "publications" / "05-entree-terminale.png", public / "feed" / "entree-terminale.png", "feed-level"),
        (week / "main" / "main-story.png", public / "story" / "principale.png", "story-main"),
        (full / "stories" / "02-entree-3e" / "frame-01.png", public / "story" / "entree-3e.png", "story-level"),
        (full / "stories" / "03-entree-seconde" / "frame-01.png", public / "story" / "entree-seconde.png", "story-level"),
        (full / "stories" / "04-premiere" / "frame-01.png", public / "story" / "entree-premiere.png", "story-level"),
        (full / "stories" / "05-terminale" / "frame-01.png", public / "story" / "entree-terminale.png", "story-level"),
    ]
    for source, target, _ in public_images:
        copy(source, target)
        watermark(target, review / target.relative_to(public), watermark_font)

    for source in sorted((week / "carousel").glob("slide-*.png")):
        copy(source, public / "carrousel" / source.name)
    copy(week / "carousel" / "carousel-week-one.pdf", public / "carrousel" / "carousel-pre-rentree-2026.pdf")
    copy(week / "reel" / "reel-cover.png", public / "reel" / "couverture.png")
    copy(week / "reel" / "reel-motion-design.mp4", public / "reel" / "pre-rentree-2026.mp4")
    copy(week / "reel" / "reel-fr.srt", public / "reel" / "sous-titres-fr.srt")
    copy(full / "calendar" / "full-campaign-calendar.json", public / "calendrier" / "calendrier.json")
    copy(full / "calendar" / "full-campaign-calendar.csv", public / "calendrier" / "calendrier.csv")
    copy(full / "calendar" / "full-campaign-calendar.pdf", public / "calendrier" / "calendrier.pdf")
    copy(full / "copy" / "campaign-copy.json", public / "textes" / "campagne.json")
    copy(full / "copy" / "whatsapp-variants.md", public / "textes" / "whatsapp.md")

    feed_review = sorted((review / "feed").glob("*.png"))
    story_review = sorted((review / "story").glob("*.png"))
    contact_sheet(feed_review, review / "contact-sheets" / "feed.png", 3, 300)
    contact_sheet(story_review, review / "contact-sheets" / "story.png", 3, 220)
    combined = [
        review / "contact-sheets" / "feed.png",
        review / "contact-sheets" / "story.png",
    ]
    pdf_pages = [Image.open(path).convert("RGB") for path in combined]
    pdf_pages[0].save(
        review / "contact-sheets" / "campagne-sociale.pdf",
        "PDF",
        save_all=True,
        append_images=pdf_pages[1:],
        resolution=120,
    )
    normalize_pdf(
        review / "contact-sheets" / "campagne-sociale.pdf",
        "pre-rentree-2026-social-review-contact-sheets",
        "Nexus Réussite — Revue visuelle campagne Pré-rentrée 2026",
    )
    for page in pdf_pages:
        page.close()

    expected_dimensions = {
        "feed": (1080, 1350),
        "story": (1080, 1920),
    }
    for family, dimensions in expected_dimensions.items():
        for path in (public / family).glob("*.png"):
            with Image.open(path) as image:
                if image.size != dimensions:
                    raise ValueError(f"Unexpected {family} dimensions for {path}: {image.size}")

    validate_calendar(public / "calendrier" / "calendrier.json")
    validate_textual_public_assets(public)

    public_records = [
        asset_record(path, output, role, source.relative_to(repo_root).as_posix())
        for source, path, role in public_images
    ]
    for path in sorted(public.rglob("*")):
        if path.is_file() and not any(record["path"] == path.relative_to(output).as_posix() for record in public_records):
            public_records.append(asset_record(path, output, "public-campaign-support", "generated-campaign-output"))
    review_records = [
        asset_record(path, output, "internal-review", "PUBLIC/" + path.relative_to(review).as_posix())
        for path in sorted(review.rglob("*"))
        if path.is_file()
    ]
    manifest = {
        "schemaVersion": "1.0.0",
        "campaignId": "pre-rentree-2026",
        "campaignVersion": "2.1.0",
        "launchDate": LAUNCH_DATE,
        "campaignDates": CAMPAIGN_DATES,
        "purpose": "PUBLIC_RELEASE_CANDIDATE",
        "publicationStatus": PUBLICATION_STATUS,
        "whatsapp": "99 192 829",
        "venue": "Mutuelleville",
        "assets": public_records,
    }
    (output / "manifest-public.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output / "manifest-review.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0.0",
                "campaignId": "pre-rentree-2026",
                "campaignVersion": "2.1.0",
                "purpose": "INTERNAL_REVIEW",
                "watermark": WATERMARK,
                "assets": review_records,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/campaigns/pre-rentree-2026/social"),
    )
    args = parser.parse_args()
    build(args.repo_root.resolve(), args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

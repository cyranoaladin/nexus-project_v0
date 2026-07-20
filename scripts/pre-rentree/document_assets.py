"""Deterministic project assets, QR verification, and social visuals."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from datetime import date
from pathlib import Path
from typing import Any

import cv2
import qrcode
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont


OUTPUT_NAME_BY_ASSET_ID = {
    "logo-slogan": "logo-slogan.png",
    "logo-compact": "logo-compact.png",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _atomic_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    shutil.copyfile(source, temporary)
    os.replace(temporary, destination)


def prepare_assets(snapshot: dict[str, Any], repo_root: Path, output_dir: Path) -> list[dict[str, Any]]:
    repo_root = Path(repo_root).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for item in (*snapshot["assets"]["logos"], *snapshot["assets"]["fonts"]):
        source = (repo_root / item["path"]).resolve()
        if not source.is_relative_to(repo_root) or not source.is_file():
            raise ValueError(f"Invalid project asset path: {item['path']}")
        actual_hash = _sha256(source)
        if actual_hash != item["sha256"]:
            raise ValueError(f"Asset hash mismatch: {item['id']}")
        filename = OUTPUT_NAME_BY_ASSET_ID.get(item["id"], source.name)
        destination = output_dir / filename
        _atomic_copy(source, destination)
        records.append({"id": item["id"], "filename": filename, "sha256": actual_hash})
    return records


def generate_qr(snapshot: dict[str, Any], output_dir: Path) -> Path:
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / "qr-canonical.png"
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    code = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    code.add_data(snapshot["document"]["qrTarget"])
    code.make(fit=True)
    code.make_image(fill_color="black", back_color="white").save(temporary)
    os.replace(temporary, destination)
    decoded = decode_qr(destination)
    if decoded != snapshot["document"]["qrTarget"]:
        destination.unlink(missing_ok=True)
        raise ValueError("Generated QR target mismatch")
    return destination


def decode_qr(path: Path) -> str:
    image = cv2.imread(str(path))
    if image is None:
        raise ValueError(f"Unreadable QR image: {path}")
    value, _, _ = cv2.QRCodeDetector().detectAndDecode(image)
    if not value:
        raise ValueError("QR code could not be decoded")
    return value


def _convert_font(source: Path, destination: Path) -> Path:
    font = TTFont(str(source))
    font.flavor = None
    font.save(str(destination))
    return destination


def _wrapped_lines(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        box = draw.textbbox((0, 0), candidate, font=font)
        if current and box[2] - box[0] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def _draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    center_x: int,
    top: int,
    fill: str,
    max_width: int,
    spacing: int,
) -> int:
    lines = _wrapped_lines(draw, text, font, max_width)
    current_top = top
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font)
        width = box[2] - box[0]
        height = box[3] - box[1]
        draw.text((center_x - width / 2, current_top), line, font=font, fill=fill)
        current_top += height + spacing
    return current_top


def _social_date_range(snapshot: dict[str, Any]) -> str:
    months = (
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    )
    start = date.fromisoformat(snapshot["campaign"]["startDate"])
    end = date.fromisoformat(snapshot["campaign"]["endDate"])
    if start.year == end.year and start.month == end.month:
        return f"Du {start.day} au {end.day} {months[end.month - 1]} {end.year}"
    return (
        f"Du {start.day} {months[start.month - 1]} {start.year} "
        f"au {end.day} {months[end.month - 1]} {end.year}"
    )


def _social_image(
    snapshot: dict[str, Any],
    assets_dir: Path,
    output_path: Path,
    size: tuple[int, int],
    monochrome: bool,
) -> None:
    width, height = size
    background = "white" if monochrome else "#FBF7EE"
    ink = "black" if monochrome else "#071A3A"
    accent = "black" if monochrome else "#B38B20"
    image = Image.new("RGB", size, background)
    draw = ImageDraw.Draw(image)

    with tempfile.TemporaryDirectory(prefix="nexus-font-") as temporary_dir:
        temporary = Path(temporary_dir)
        sans_path = _convert_font(assets_dir / "DMSans-Variable.woff2", temporary / "sans.ttf")
        serif_path = _convert_font(assets_dir / "Fraunces-Variable.woff2", temporary / "serif.ttf")
        title_font = ImageFont.truetype(str(serif_path), max(54, width // 13))
        body_font = ImageFont.truetype(str(sans_path), max(30, width // 27))
        small_font = ImageFont.truetype(str(sans_path), max(24, width // 34))

        draw.rectangle((0, 0, width, max(18, height // 70)), fill=accent)
        logo = Image.open(assets_dir / "logo-slogan.png").convert("RGBA")
        logo.thumbnail((width * 0.34, height * 0.12), Image.Resampling.LANCZOS)
        if monochrome:
            alpha = logo.getchannel("A")
            gray = Image.new("RGBA", logo.size, "black")
            gray.putalpha(alpha)
            logo = gray
        image.paste(logo, (int((width - logo.width) / 2), int(height * 0.055)), logo)
        if snapshot["campaign"]["publicationMode"] == "REVIEW":
            _draw_centered(
                draw,
                "Document de revue — diffusion interdite",
                small_font,
                width // 2,
                int(height * 0.17),
                ink,
                int(width * 0.84),
                6,
            )

        current = int(height * 0.22)
        current = _draw_centered(
            draw,
            snapshot["content"]["hero"]["h1"],
            title_font,
            width // 2,
            current,
            ink,
            int(width * 0.84),
            max(10, height // 150),
        )
        current += int(height * 0.035)
        date_text = _social_date_range(snapshot)
        current = _draw_centered(draw, date_text, body_font, width // 2, current, ink, int(width * 0.82), 8)
        current += int(height * 0.03)
        levels = " · ".join(level["label"] for level in snapshot["levels"])
        current = _draw_centered(draw, levels, body_font, width // 2, current, ink, int(width * 0.82), 8)
        current += int(height * 0.025)
        subjects = " · ".join(subject["label"] for subject in snapshot["subjects"])
        current = _draw_centered(draw, subjects, small_font, width // 2, current, ink, int(width * 0.86), 7)

        capacities = snapshot["campaign"]["capacityByOffer"]
        group_text = (
            f'Fondations : {capacities["FONDATIONS"]["min"]} à {capacities["FONDATIONS"]["max"]} élèves · '
            f'Premium : {capacities["PREMIUM"]["min"]} à {capacities["PREMIUM"]["max"]} élèves'
        )
        box_top = int(height * 0.70)
        box_bottom = int(height * 0.82)
        draw.rounded_rectangle(
            (int(width * 0.09), box_top, int(width * 0.91), box_bottom),
            radius=max(16, width // 50),
            outline=accent,
            width=max(3, width // 300),
        )
        _draw_centered(draw, group_text, body_font, width // 2, box_top + int(height * 0.025), ink, int(width * 0.72), 8)
        _draw_centered(
            draw,
            snapshot["cta"]["primary"],
            body_font,
            width // 2,
            int(height * 0.86),
            ink,
            int(width * 0.84),
            8,
        )
        _draw_centered(
            draw,
            snapshot["contact"]["domain"],
            small_font,
            width // 2,
            int(height * 0.94),
            ink,
            int(width * 0.80),
            6,
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG", optimize=False, compress_level=9)


def generate_social_visuals(
    snapshot: dict[str, Any], assets_dir: Path, output_dir: Path,
) -> dict[str, Path]:
    assets_dir = Path(assets_dir).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    social = snapshot["document"]["outputs"]["social"]
    outputs = {
        "feed": output_dir / social["feed"],
        "story": output_dir / social["story"],
        "monochrome": output_dir / social["monochrome"],
        "altText": output_dir / social["altText"],
    }
    _social_image(snapshot, assets_dir, outputs["feed"], (1080, 1350), monochrome=False)
    _social_image(snapshot, assets_dir, outputs["story"], (1080, 1920), monochrome=False)
    _social_image(snapshot, assets_dir, outputs["monochrome"], (1080, 1350), monochrome=True)
    alt_base = (
        f'{snapshot["content"]["hero"]["h1"]} '
        f'{snapshot["content"]["hero"]["subtitle"]} '
        f'{snapshot["cta"]["primary"]}.'
    )
    if snapshot["campaign"]["publicationMode"] == "REVIEW":
        alt_base = f"Document de revue, diffusion interdite. {alt_base}"
    alt = {
        "feed": alt_base,
        "story": alt_base,
        "monochrome": f"Version noir et blanc. {alt_base}",
    }
    outputs["altText"].write_text(json.dumps(alt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return outputs

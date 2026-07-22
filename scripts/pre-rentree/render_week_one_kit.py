#!/usr/bin/env python3
"""Render the versioned Pré-rentrée 2026 week-one campaign kit."""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import html
import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont


BLUE = "#0B1F3A"
RED = "#C9252D"
IVORY = "#F7F2E8"
PAPER = "#FFFDF8"
INK = "#172033"
MUTED = "#536072"
WHITE = "#FFFFFF"
VERSION = "2026-week-one-v1"
FIXED_PDF_DATE = "D:20260720000000+01'00'"


@dataclass
class Asset:
    path: Path
    asset_id: str
    role: str
    alt_text: str
    width: int | None = None
    height: int | None = None


class KitRenderer:
    def __init__(self, repo_root: Path, content_path: Path, commercial_path: Path, output: Path):
        self.repo_root = repo_root
        self.content = json.loads(content_path.read_text(encoding="utf-8"))
        self.commercial = json.loads(commercial_path.read_text(encoding="utf-8"))
        self.output = output
        self.assets: list[Asset] = []
        if self.output.name != "week-one":
            raise ValueError("The renderer output directory must be named 'week-one'.")
        if self.output.exists():
            shutil.rmtree(self.output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.logo_path = repo_root / "public" / "images" / "logo_nexus_reussite.png"
        self.logo = Image.open(self.logo_path).convert("RGBA")
        self._font_tmp = tempfile.TemporaryDirectory(prefix="nexus-week-one-fonts-")
        self.font_dir = Path(self._font_tmp.name)
        self._prepare_fonts()
        self.pricing = self._pricing_summary()

    def _prepare_fonts(self) -> None:
        for source_name, output_name in [
            ("DMSans-Variable.woff2", "DMSans.ttf"),
            ("Fraunces-Variable.woff2", "Fraunces.ttf"),
        ]:
            font = TTFont(self.repo_root / "app" / "fonts" / source_name)
            font.flavor = None
            font.save(self.font_dir / output_name)

    def font(self, size: int, serif: bool = False) -> ImageFont.FreeTypeFont:
        return ImageFont.truetype(
            self.font_dir / ("Fraunces.ttf" if serif else "DMSans.ttf"),
            size=size,
        )

    def _pricing_summary(self) -> dict[str, str]:
        offers = self.commercial["offers"]
        third = next(item for item in offers if item["offerId"] == "pre2026-3e-mathematiques")
        seconde = next(item for item in offers if item["offerId"] == "pre2026-seconde-mathematiques")
        premium = sorted(
            [item for item in offers if item["level"] == "PREMIERE"],
            key=lambda item: item["subjectCount"],
        )
        pack_prices = " · ".join(f'{item["price"]:,}'.replace(",", " ") for item in premium)
        return {
            "TROISIEME": f'{third["price"]} TND / matière · acompte {third["deposit"]} TND',
            "SECONDE": f'{seconde["price"]} TND / matière · acompte {seconde["deposit"]} TND',
            "PREMIUM": f'Packs 1 à 4 matières · {pack_prices} TND',
            "SECONDE_AND_PREMIUM": f'Seconde : {seconde["price"]} TND / matière · Premium : {pack_prices} TND',
        }

    def pricing_text(self, key: str | None) -> str:
        return self.pricing.get(key or "", "")

    def register(self, path: Path, asset_id: str, role: str, alt_text: str, width: int | None = None, height: int | None = None) -> None:
        self.assets.append(Asset(path=path, asset_id=asset_id, role=role, alt_text=alt_text, width=width, height=height))

    @staticmethod
    def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
        lines: list[str] = []
        for paragraph in text.split("\n"):
            words = paragraph.split()
            current = ""
            for word in words:
                candidate = f"{current} {word}".strip()
                if draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
                    current = candidate
                else:
                    if current:
                        lines.append(current)
                    current = word
            if current:
                lines.append(current)
        return lines

    def fit_font(self, draw: ImageDraw.ImageDraw, text: str, max_width: int, max_lines: int, start: int, minimum: int, serif: bool = False) -> tuple[ImageFont.FreeTypeFont, list[str]]:
        for size in range(start, minimum - 1, -2):
            font = self.font(size, serif=serif)
            lines = self.wrap(draw, text, font, max_width)
            if len(lines) <= max_lines:
                return font, lines
        font = self.font(minimum, serif=serif)
        return font, self.wrap(draw, text, font, max_width)[:max_lines]

    @staticmethod
    def line_height(font: ImageFont.FreeTypeFont, spacing: int = 12) -> int:
        box = font.getbbox("Ag")
        return box[3] - box[1] + spacing

    def draw_lines(self, draw: ImageDraw.ImageDraw, lines: list[str], xy: tuple[int, int], font: ImageFont.FreeTypeFont, fill: str, spacing: int = 12) -> int:
        x, y = xy
        step = self.line_height(font, spacing)
        for line in lines:
            draw.text((x, y), line, font=font, fill=fill)
            y += step
        return y

    def base_canvas(self, width: int, height: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
        image = Image.new("RGB", (width, height), PAPER)
        draw = ImageDraw.Draw(image)
        draw.ellipse((width * 0.62, -height * 0.12, width * 1.14, height * 0.3), fill=IVORY)
        draw.ellipse((-width * 0.18, height * 0.74, width * 0.35, height * 1.1), fill="#EEF2F7")
        draw.rectangle((0, 0, max(12, width // 90), height), fill=RED)
        return image, draw

    def place_logo(self, image: Image.Image, x: int, y: int, size: int) -> None:
        logo = self.logo.copy()
        logo.thumbnail((size, size), Image.Resampling.LANCZOS)
        image.paste(logo, (x, y), logo)

    def render_card(self, width: int, height: int, eyebrow: str, title: str, body: str, meta: str, cta: str, alt_text: str) -> Image.Image:
        image, draw = self.base_canvas(width, height)
        margin = max(56, int(width * 0.075))
        if height / width < 0.75 or height <= 700:
            self.place_logo(image, margin, 30, 88)
            badge_x = margin + 118
            badge_font, _ = self.fit_font(draw, eyebrow.upper(), width - badge_x - margin - 44, 1, 22, 12)
            draw.rounded_rectangle((badge_x, 42, min(width - margin, badge_x + 500), 102), radius=18, fill=BLUE)
            draw.text((badge_x + 22, 57), eyebrow.upper(), font=badge_font, fill=WHITE)
            title_font, title_lines = self.fit_font(draw, title, width - 2 * margin, 2, 58, 42, serif=True)
            y = self.draw_lines(draw, title_lines, (margin, 150), title_font, BLUE, spacing=10)
            y += 16
            body_font, body_lines = self.fit_font(draw, body, width - 2 * margin, 3, 28, 22)
            self.draw_lines(draw, body_lines, (margin, y), body_font, INK, spacing=8)
            footer_y = height - 112
            draw.rectangle((0, footer_y, width, height), fill=BLUE)
            meta_font, meta_lines = self.fit_font(draw, meta, int(width * 0.58), 2, 22, 18)
            self.draw_lines(draw, meta_lines, (margin, footer_y + 26), meta_font, WHITE, spacing=5)
            cta_font, cta_lines = self.fit_font(draw, cta, int(width * 0.3), 2, 24, 18)
            self.draw_lines(draw, cta_lines, (int(width * 0.68), footer_y + 26), cta_font, "#FFD9D9", spacing=5)
            return image
        self.place_logo(image, margin, margin, max(86, int(width * 0.115)))
        badge_font = self.font(max(22, int(width * 0.025)))
        badge_y = margin + max(105, int(width * 0.12))
        draw.rounded_rectangle((margin, badge_y, margin + min(width - 2 * margin, int(width * 0.55)), badge_y + int(width * 0.07)), radius=20, fill=BLUE)
        draw.text((margin + 24, badge_y + 13), eyebrow.upper(), font=badge_font, fill=WHITE)

        title_y = badge_y + int(width * 0.115)
        title_font, title_lines = self.fit_font(draw, title, width - 2 * margin, 5, max(54, int(width * 0.073)), 38, serif=True)
        y = self.draw_lines(draw, title_lines, (margin, title_y), title_font, BLUE, spacing=16)
        y += max(24, int(height * 0.025))
        body_font, body_lines = self.fit_font(draw, body, width - 2 * margin, 8, max(28, int(width * 0.034)), 22)
        y = self.draw_lines(draw, body_lines, (margin, y), body_font, INK, spacing=12)

        footer_h = max(150, int(height * 0.145))
        footer_y = height - footer_h
        if y > footer_y - 32:
            raise ValueError(f"Text overflow for '{title}' at {width}x{height}")
        draw.rectangle((0, footer_y, width, height), fill=BLUE)
        meta_font, meta_lines = self.fit_font(draw, meta, width - 2 * margin, 2, max(24, int(width * 0.027)), 20)
        self.draw_lines(draw, meta_lines, (margin, footer_y + 24), meta_font, WHITE, spacing=8)
        cta_font, cta_lines = self.fit_font(draw, cta, width - 2 * margin, 2, max(24, int(width * 0.029)), 20)
        self.draw_lines(draw, cta_lines, (margin, footer_y + footer_h // 2), cta_font, "#FFD9D9", spacing=8)
        return image

    def svg_source(self, path: Path, width: int, height: int, eyebrow: str, title: str, body: str, meta: str, cta: str, asset_id: str, alt_text: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        logo_data = base64.b64encode(self.logo_path.read_bytes()).decode("ascii")
        title_lines = self._simple_svg_lines(title, 27)
        body_lines = self._simple_svg_lines(body, 48)
        title_tspans = "".join(f'<tspan x="84" dy="1.12em">{html.escape(line)}</tspan>' for line in title_lines)
        body_tspans = "".join(f'<tspan x="84" dy="1.35em">{html.escape(line)}</tspan>' for line in body_lines)
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{html.escape(alt_text)}">
  <rect width="{width}" height="{height}" fill="{PAPER}"/><rect width="14" height="{height}" fill="{RED}"/>
  <circle cx="{int(width * .88)}" cy="{int(height * .08)}" r="{int(width * .24)}" fill="{IVORY}"/>
  <image href="data:image/png;base64,{logo_data}" x="84" y="72" width="124" height="124" preserveAspectRatio="xMidYMid meet"/>
  <rect x="84" y="230" width="520" height="72" rx="24" fill="{BLUE}"/><text x="112" y="278" fill="white" font-family="DM Sans, sans-serif" font-size="28" font-weight="700">{html.escape(eyebrow.upper())}</text>
  <text x="84" y="360" fill="{BLUE}" font-family="Fraunces, serif" font-size="72" font-weight="650">{title_tspans}</text>
  <text x="84" y="{420 + len(title_lines) * 78}" fill="{INK}" font-family="DM Sans, sans-serif" font-size="34">{body_tspans}</text>
  <rect x="0" y="{height - 190}" width="{width}" height="190" fill="{BLUE}"/>
  <text x="84" y="{height - 120}" fill="white" font-family="DM Sans, sans-serif" font-size="28">{html.escape(meta)}</text>
  <text x="84" y="{height - 62}" fill="#FFD9D9" font-family="DM Sans, sans-serif" font-size="30" font-weight="700">{html.escape(cta)}</text>
</svg>\n'''
        path.write_text(svg, encoding="utf-8")
        self.register(path, asset_id, "editable-source", alt_text, width, height)

    @staticmethod
    def _simple_svg_lines(text: str, limit: int) -> list[str]:
        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if len(candidate) <= limit:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    def save_raster_pair(self, image: Image.Image, base: Path, asset_prefix: str, role: str, alt_text: str) -> tuple[Path, Path]:
        base.parent.mkdir(parents=True, exist_ok=True)
        png = base.with_suffix(".png")
        webp = base.with_suffix(".webp")
        image.save(png, format="PNG", optimize=True)
        image.save(webp, format="WEBP", quality=88, method=6)
        self.register(png, f"{asset_prefix}-png", role, alt_text, *image.size)
        self.register(webp, f"{asset_prefix}-webp", role, alt_text, *image.size)
        return png, webp

    def render_main_visuals(self) -> list[Image.Image]:
        creative = self.content["creativeDirection"]
        alt = self.content["mainPublication"]["altText"]
        variants = [
            ("portrait", 1080, 1350, creative["headline"], f'{creative["promise"]}\n5 séances × 2 h par matière · Effectifs limités'),
            ("square", 1080, 1080, creative["headline"], "Fondamentaux, méthode et confiance avant la rentrée.\n5 séances × 2 h par matière"),
            ("landscape", 1200, 628, "Pré-rentrée 2026", "Cinq séances structurées par matière, dès le 17 août."),
            ("story", 1080, 1920, creative["headline"], f'{creative["promise"]}\n5 séances × 2 h · Effectifs limités selon le parcours'),
            ("thumbnail", 600, 600, "Pré-rentrée 2026", "Dès le 17 août · Mutuelleville"),
        ]
        images: list[Image.Image] = []
        for name, width, height, title, body in variants:
            meta = f'{self.content["contact"]["startLabel"]} · {self.content["contact"]["venue"]}'
            cta = f'WhatsApp {self.content["contact"]["whatsappDisplay"]}'
            image = self.render_card(width, height, creative["levels"], title, body, meta, cta, alt)
            source = self.output / "sources" / "main" / f"main-{name}.svg"
            self.svg_source(source, width, height, creative["levels"], title, body, meta, cta, f"week1-main-{name}-source", alt)
            self.save_raster_pair(image, self.output / "main" / f"main-{name}", f"week1-main-{name}", "main-visual", alt)
            images.append(image)
        return images

    def render_carousel(self) -> list[Image.Image]:
        images: list[Image.Image] = []
        for index, slide in enumerate(self.content["carousel"]["slides"], start=1):
            pricing = self.pricing_text(slide.get("pricingDisclosure"))
            body = f'{slide["body"]}\n{pricing}'.strip()
            meta = "Dès le 17 août · Nexus Réussite, Mutuelleville"
            cta = "WhatsApp 99 192 829" if index == 8 else f"{index} / 8"
            image = self.render_card(1080, 1350, slide["eyebrow"], slide["title"], body, meta, cta, slide["altText"])
            stem = f"slide-{index:02d}"
            self.svg_source(self.output / "sources" / "carousel" / f"{stem}.svg", 1080, 1350, slide["eyebrow"], slide["title"], body, meta, cta, f"week1-carousel-slide-{index:02d}-source", slide["altText"])
            self.save_raster_pair(image, self.output / "carousel" / stem, f"week1-carousel-slide-{index:02d}", "carousel-slide", slide["altText"])
            images.append(image)
        pdf = self.output / "carousel" / "carousel-week-one.pdf"
        images[0].save(
            pdf, "PDF", save_all=True, append_images=images[1:], resolution=150,
            title="Nexus Réussite — Carrousel Pré-rentrée 2026",
            creationDate=FIXED_PDF_DATE, modDate=FIXED_PDF_DATE,
        )
        self.register(pdf, "week1-carousel-pdf", "carousel-document", self.content["carousel"]["caption"])
        return images

    def render_stories(self) -> list[Image.Image]:
        images: list[Image.Image] = []
        for sequence in self.content["stories"]["sequences"]:
            for frame in sequence["frames"]:
                pricing = self.pricing_text(frame.get("pricingDisclosure"))
                body = f'{frame["text"]}\n{pricing}'.strip()
                image = self.render_card(1080, 1920, frame["eyebrow"], sequence["title"], body, frame["interaction"], frame["cta"], frame["altText"])
                stem = frame["id"]
                self.svg_source(self.output / "sources" / "stories" / f"{stem}.svg", 1080, 1920, frame["eyebrow"], sequence["title"], body, frame["interaction"], frame["cta"], f"week1-story-{stem}-source", frame["altText"])
                self.save_raster_pair(image, self.output / "stories" / f"{stem}", f"week1-story-{stem}", "story-frame", frame["altText"])
                images.append(image)
        return images

    def render_reel(self) -> list[Image.Image]:
        reel = self.content["reel"]
        reel_dir = self.output / "reel"
        frames_dir = reel_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        frames: list[Image.Image] = []
        frame_paths: list[Path] = []
        for index, segment in enumerate(reel["timeline"], start=1):
            alt = f'Plan {index} du Reel : {segment["onScreenText"]}'
            image = self.render_card(1080, 1920, f'{segment["start"]:02d}–{segment["end"]:02d} S', reel["title"], segment["onScreenText"], segment["plan"], "Nexus Réussite", alt)
            path = frames_dir / f"frame-{index:02d}.png"
            image.save(path, format="PNG", optimize=True)
            self.register(path, f"week1-reel-frame-{index:02d}-png", "reel-frame", alt, 1080, 1920)
            frames.append(image)
            frame_paths.append(path)

        cover = self.render_card(1080, 1920, "STAGES DE PRÉ-RENTRÉE", reel["cover"]["title"], reel["cover"]["subtitle"], "Nexus Réussite · Mutuelleville", "WhatsApp 99 192 829", reel["cover"]["title"])
        self.save_raster_pair(cover, reel_dir / "reel-cover", "week1-reel-cover", "reel-cover", reel["cover"]["title"])

        script = reel_dir / "reel-script.md"
        script.write_text(self._reel_script_markdown(), encoding="utf-8")
        self.register(script, "week1-reel-script", "editable-reel-script", "Script complet du Reel")
        srt = reel_dir / "reel-fr.srt"
        srt.write_text(self._srt(), encoding="utf-8")
        self.register(srt, "week1-reel-srt", "subtitles", "Sous-titres français du Reel")
        storyboard = reel_dir / "reel-storyboard.pdf"
        frames[0].save(
            storyboard, "PDF", save_all=True, append_images=frames[1:], resolution=120,
            title="Nexus Réussite — Storyboard Reel Pré-rentrée 2026",
            creationDate=FIXED_PDF_DATE, modDate=FIXED_PDF_DATE,
        )
        self.register(storyboard, "week1-reel-storyboard", "storyboard", "Storyboard complet du Reel")

        video = reel_dir / "reel-motion-design.mp4"
        self._encode_reel(video, frame_paths)
        self.register(video, "week1-reel-video", "motion-design-video", "Reel motion design de trente secondes")
        return frames

    def _reel_script_markdown(self) -> str:
        reel = self.content["reel"]
        rows = [
            "# Reel — Dix heures, mais surtout une méthode",
            "",
            f"Durée : {reel['durationSeconds']} secondes · Format : 1080 × 1920 · Version : {VERSION}",
            "",
            "## Voix off",
            "",
            reel["voiceOver"],
            "",
            "## Découpage",
            "",
        ]
        for item in reel["timeline"]:
            rows.extend([
                f"### {item['start']}–{item['end']} s",
                "",
                f"Plan : {item['plan']}",
                f"Voix off : {item['voiceOver']}",
                f"Texte : {item['onScreenText']}",
                f"Transition : {item['transition']}",
                f"Montage : {item['editing']}",
                "",
            ])
        rows.extend(["## Médias nécessaires", "", *[f"- {item}" for item in reel["mediaNeeded"]], "", "## Légende", "", reel["caption"], "", f"CTA : {reel['cta']}", ""])
        return "\n".join(rows)

    @staticmethod
    def timestamp(seconds: int) -> str:
        return f"00:00:{seconds:02d},000"

    def _srt(self) -> str:
        blocks = []
        for index, item in enumerate(self.content["reel"]["timeline"], start=1):
            blocks.append(f'{index}\n{self.timestamp(item["start"])} --> {self.timestamp(item["end"])}\n{item["voiceOver"]}\n')
        return "\n".join(blocks)

    def _encode_reel(self, output: Path, frame_paths: list[Path]) -> None:
        reel = self.content["reel"]
        concat = output.parent / "frames.concat.txt"
        lines: list[str] = []
        for path, segment in zip(frame_paths, reel["timeline"], strict=True):
            lines.extend([f"file '{path.as_posix()}'", f'duration {segment["end"] - segment["start"]}'])
        lines.append(f"file '{frame_paths[-1].as_posix()}'")
        concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self.register(concat, "week1-reel-concat-source", "editable-video-source", "Liste de montage déterministe du Reel")

        with tempfile.TemporaryDirectory(prefix="nexus-week-one-audio-") as temporary:
            audio = Path(temporary) / "voice.wav"
            speech_engine = shutil.which("espeak-ng") or shutil.which("espeak")
            if speech_engine:
                subprocess.run([speech_engine, "-v", "fr", "-s", "170", "-w", str(audio), reel["voiceOver"]], check=True)
            else:
                subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "30", str(audio)], check=True)
            subprocess.run([
                "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat),
                "-i", str(audio), "-vf", "fps=30,format=yuv420p", "-af", "apad=pad_dur=30,atrim=duration=30",
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k",
                "-t", "30", "-movflags", "+faststart", "-metadata", "creation_time=2026-07-20T00:00:00Z",
                "-map_metadata", "-1", str(output),
            ], check=True)

    def render_copy_and_calendar(self) -> list[Image.Image]:
        copy_dir = self.output / "copy"
        calendar_dir = self.output / "calendar"
        copy_dir.mkdir(parents=True, exist_ok=True)
        calendar_dir.mkdir(parents=True, exist_ok=True)
        publication = json.loads(json.dumps(self.content["mainPublication"]))
        publication["pricingSummary"] = self.pricing
        publication["whatsappUrl"] = self._whatsapp_url(publication["whatsappPrefill"], publication["utm"])
        publication_json = copy_dir / "publication-copy.json"
        publication_json.write_text(json.dumps(publication, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.register(publication_json, "week1-publication-copy-json", "channel-copy", publication["altText"])
        publication_md = copy_dir / "publication-copy.md"
        publication_md.write_text(self._publication_markdown(publication), encoding="utf-8")
        self.register(publication_md, "week1-publication-copy-md", "editable-channel-copy", publication["altText"])

        calendar = json.loads(json.dumps(self.content["calendar"]))
        for day in calendar["days"]:
            day["whatsappUrl"] = self._whatsapp_url(
                next(item["text"] for item in self.content["whatsappScripts"] if item["id"] == day["whatsappScriptId"]),
                self._parse_utm(day["utm"]),
            )
        calendar_json = calendar_dir / "week-one-calendar.json"
        calendar_json.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.register(calendar_json, "week1-calendar-json", "publication-calendar", "Calendrier de publication de la première semaine")
        calendar_csv = calendar_dir / "week-one-calendar.csv"
        with calendar_csv.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["jour", "date", "heure", "canal", "audience", "niveau", "tunnel", "objectif", "assetId", "texte", "CTA", "UTM", "scriptWhatsApp", "KPI"])
            for day in calendar["days"]:
                writer.writerow([day["day"], day["date"], day["time"], " | ".join(day["channel"]), day["audience"], day["level"], day["funnelStage"], day["objective"], day["assetId"], day["body"], day["cta"], day["utm"], day["whatsappScriptId"], " | ".join(day["expectedKpi"])])
        self.register(calendar_csv, "week1-calendar-csv", "publication-calendar", "Calendrier CSV exploitable")

        calendar_pages: list[Image.Image] = []
        for day in calendar["days"]:
            image = self.render_card(1240, 1754, f'{day["day"]} · {day["date"]} · {day["time"]}', day["objective"], day["body"], " · ".join(day["channel"]), day["cta"], f'Calendrier {day["day"]}')
            calendar_pages.append(image)
        calendar_pdf = calendar_dir / "week-one-calendar.pdf"
        calendar_pages[0].save(
            calendar_pdf, "PDF", save_all=True, append_images=calendar_pages[1:], resolution=150,
            title="Nexus Réussite — Calendrier semaine 1 Pré-rentrée 2026",
            creationDate=FIXED_PDF_DATE, modDate=FIXED_PDF_DATE,
        )
        self.register(calendar_pdf, "week1-calendar-pdf", "publication-calendar", "Calendrier PDF de sept jours")

        whatsapp = copy_dir / "whatsapp-week-one.md"
        whatsapp.write_text("# Scripts WhatsApp — semaine 1\n\n" + "\n\n".join(f'## {item["id"]}\n\n{item["text"]}' for item in self.content["whatsappScripts"]) + "\n", encoding="utf-8")
        self.register(whatsapp, "week1-whatsapp-scripts", "whatsapp-copy", "Scripts WhatsApp liés aux CTA")
        return calendar_pages

    @staticmethod
    def _parse_utm(query: str) -> dict[str, str]:
        return dict(part.split("=", 1) for part in query.split("&"))

    def _whatsapp_url(self, message: str, utm: dict[str, str]) -> str:
        from urllib.parse import quote
        tracking = "&".join(f"{key}={value}" for key, value in utm.items())
        return f'https://wa.me/21699192829?text={quote(message + "\n\nRéférence : " + tracking)}'

    def _publication_markdown(self, publication: dict[str, Any]) -> str:
        sections = ["# Publication principale — Pré-rentrée 2026", ""]
        for label, key in [("Facebook", "facebook"), ("Instagram", "instagram"), ("Meta Ads", "metaAds"), ("WhatsApp", "whatsappShare")]:
            sections.extend([f"## {label}", "", publication[key]["body"], ""])
        sections.extend(["## Accroches A/B/C", "", *[f"- {hook}" for hook in publication["hooks"]], "", "## CTA A/B", "", *[f"- {cta}" for cta in publication["ctas"]], "", "## Tarifs dérivés", "", *[f"- {key} : {value}" for key, value in publication["pricingSummary"].items()], "", f'Texte alternatif : {publication["altText"]}', "", f'Lien WhatsApp : {publication["whatsappUrl"]}', ""])
        return "\n".join(sections)

    def render_contact_sheet(self, images: list[Image.Image], name: str, columns: int, thumb_width: int) -> None:
        thumbs: list[Image.Image] = []
        for image in images:
            thumb = image.copy()
            thumb.thumbnail((thumb_width, int(thumb_width * 1.8)), Image.Resampling.LANCZOS)
            thumbs.append(thumb)
        rows = (len(thumbs) + columns - 1) // columns
        cell_h = max(image.height for image in thumbs) + 40
        sheet = Image.new("RGB", (columns * (thumb_width + 30) + 30, rows * cell_h + 30), WHITE)
        for index, thumb in enumerate(thumbs):
            x = 30 + (index % columns) * (thumb_width + 30)
            y = 30 + (index // columns) * cell_h
            sheet.paste(thumb, (x, y))
        path = self.output / "visual-review" / f"{name}-contact-sheet.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path, format="PNG", optimize=True)
        self.register(path, f"week1-review-{name}", "visual-review", f"Planche de contrôle {name}", *sheet.size)

    def write_manifest(self) -> None:
        records = []
        for asset in sorted(self.assets, key=lambda item: item.path.as_posix()):
            relative = asset.path.relative_to(self.output).as_posix()
            suffix = asset.path.suffix.lower()
            format_name = {".png": "PNG", ".webp": "WEBP", ".svg": "SVG", ".pdf": "PDF", ".mp4": "MP4", ".srt": "SRT", ".json": "JSON", ".csv": "CSV", ".md": "MARKDOWN", ".txt": "TEXT"}.get(suffix, suffix.lstrip(".").upper())
            records.append({
                "assetId": asset.asset_id,
                "path": relative,
                "role": asset.role,
                "format": format_name,
                "width": asset.width,
                "height": asset.height,
                "bytes": asset.path.stat().st_size,
                "sha256": hashlib.sha256(asset.path.read_bytes()).hexdigest(),
                "altText": asset.alt_text,
            })
        manifest = {
            "schemaVersion": "1.0.0",
            "version": VERSION,
            "campaignId": "pre-rentree-2026",
            "editionDate": "2026-07-20",
            "sourceContent": "content/pre-rentree-2026/week-one-campaign.fr.json",
            "commercialContract": ".artifacts/pre-rentree-2026/commercial-contract.snapshot.json",
            "publicationStatus": "AWAITING_HUMAN_VALIDATIONS",
            "rights": {
                "photography": "Aucune photographie ni image d'élève utilisée.",
                "logo": "Logo officiel Nexus Réussite présent dans le dépôt.",
                "fonts": "DM Sans et Fraunces, licence OFL-1.1 conservée dans licenses/fonts/OFL-1.1.txt.",
                "icons": "Formes et pictogrammes originaux produits par le renderer."
            },
            "accessibility": {
                "primaryContrast": "Bleu Nexus sur ivoire : WCAG AA pour texte normal.",
                "safeZones": self.content["reel"]["safeZones"],
                "altTextRequired": True
            },
            "assets": records,
        }
        (self.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def render(self) -> None:
        main = self.render_main_visuals()
        carousel = self.render_carousel()
        stories = self.render_stories()
        reel = self.render_reel()
        calendar = self.render_copy_and_calendar()
        self.render_contact_sheet(main, "main", 3, 300)
        self.render_contact_sheet(carousel, "carousel", 4, 240)
        self.render_contact_sheet(stories, "stories", 3, 240)
        self.render_contact_sheet(reel, "reel", 3, 240)
        self.render_contact_sheet(calendar, "calendar", 4, 240)
        self.write_manifest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content", required=True, type=Path)
    parser.add_argument("--commercial", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    renderer = KitRenderer(repo_root, args.content.resolve(), args.commercial.resolve(), args.output.resolve())
    renderer.render()


if __name__ == "__main__":
    main()

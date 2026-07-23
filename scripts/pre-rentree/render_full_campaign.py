#!/usr/bin/env python3
"""Render the complete deterministic Pré-rentrée 2026 multichannel campaign."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fontTools.ttLib import TTFont
from PIL import Image
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, ByteStringObject

from campaign_calendar import resolve_publication_date
from render_week_one_kit import Asset, KitRenderer


VERSION = "2026-full-campaign-v1"
FIXED_PDF_DATE = "D:20000101000000Z"
PUBLIC_STATUS = "READY_FOR_OWNER_REVIEW"
META = "Dès le 17 août · Nexus Réussite, Mutuelleville"


class FullCampaignRenderer(KitRenderer):
    def __init__(
        self,
        repo_root: Path,
        content_path: Path,
        commercial_path: Path,
        output: Path,
        launch_date: str | None = None,
    ):
        self.repo_root = repo_root
        self.content = json.loads(content_path.read_text(encoding="utf-8"))
        configured_launch_date = self.content.get("launchDate")
        if launch_date and configured_launch_date and launch_date != configured_launch_date:
            raise ValueError("CLI launch date conflicts with the content launch date")
        self.launch_date = launch_date or configured_launch_date
        self.launch_date_status = (
            "OWNER_AUTHORIZED"
            if self.launch_date
            else self.content["launchDateStatus"]
        )
        for item in self.all_items:
            item.update(resolve_publication_date(
                self.launch_date,
                item["publicationDayOffset"],
            ))
        self.commercial = json.loads(commercial_path.read_text(encoding="utf-8"))
        self.output = output
        self.assets: list[Asset] = []
        self.overflow_count = 0
        if self.output.name != "full-campaign":
            raise ValueError("The renderer output directory must be named 'full-campaign'.")
        if self.output.exists():
            shutil.rmtree(self.output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.logo_path = repo_root / "public" / "images" / "logo_nexus_reussite.png"
        self.logo = Image.open(self.logo_path).convert("RGBA")
        self._font_tmp = tempfile.TemporaryDirectory(prefix="nexus-full-campaign-fonts-")
        self.font_dir = Path(self._font_tmp.name)
        self._prepare_fonts()
        self.pricing = self._pricing_summary()
        self._validate_source()

    def _prepare_fonts(self) -> None:
        for source_name, output_name in [
            ("DMSans-Variable.woff2", "DMSans.ttf"),
            ("Fraunces-Variable.woff2", "Fraunces.ttf"),
        ]:
            font = TTFont(self.repo_root / "app" / "fonts" / source_name, recalcTimestamp=False)
            if "head" in font:
                font["head"].created = 3848943600
                font["head"].modified = 3848943600
            font.flavor = None
            font.save(self.font_dir / output_name)

    def _validate_source(self) -> None:
        expected = {"publications": 13, "carousels": 8, "stories": 12, "reels": 3}
        for family, count in expected.items():
            if len(self.content[family]) != count:
                raise ValueError(f"{family} must contain {count} items")
        proof_registry = json.loads(
            (self.repo_root / "content" / "pre-rentree-2026" / "proofs.registry.json").read_text(encoding="utf-8")
        )
        approved_proofs = {proof["proofId"] for proof in proof_registry["proofs"] if proof["status"] == "APPROVED"}
        offer_ids = {offer["offerId"] for offer in self.commercial["offers"] if offer["publiclyEligible"]}
        for item in self.all_items:
            missing_proofs = set(item["proofIds"]) - approved_proofs
            missing_offers = set(item.get("offerIds", [])) - offer_ids
            if missing_proofs or missing_offers:
                raise ValueError(f"Unsupported evidence on {item['id']}: {missing_proofs=} {missing_offers=}")
        public_text = json.dumps(
            [self.content[family] for family in expected], ensure_ascii=False
        ).lower()
        for forbidden in ("snt", "manuel offert", "remise annuelle", "places très limitées"):
            if forbidden in public_text:
                raise ValueError(f"Forbidden public term: {forbidden}")

    @property
    def all_items(self) -> list[dict[str, Any]]:
        return [
            *self.content["publications"],
            *self.content["carousels"],
            *self.content["stories"],
            *self.content["reels"],
        ]

    @staticmethod
    def _money(value: int) -> str:
        return f"{value:,}".replace(",", " ")

    def _pricing_summary(self) -> dict[str, str]:
        offers = self.commercial["offers"]
        third = next(offer for offer in offers if offer["offerId"] == "pre2026-3e-mathematiques")
        seconde = next(offer for offer in offers if offer["offerId"] == "pre2026-seconde-mathematiques")
        premium = sorted(
            [offer for offer in offers if offer["level"] == "PREMIERE"],
            key=lambda offer: offer["subjectCount"],
        )
        premium_line = " · ".join(
            f"{offer['subjectCount']} mat. {self._money(offer['price'])} TND"
            for offer in premium
        )
        third_line = f"3e : {third['price']} TND / matière · acompte {third['deposit']} TND"
        seconde_line = f"Seconde : {seconde['price']} TND / matière · acompte {seconde['deposit']} TND"
        return {
            "TROISIEME": third_line,
            "SECONDE": seconde_line,
            "PREMIERE": f"Première : {premium_line}",
            "TERMINALE": f"Terminale : {premium_line}",
            "PREMIUM": f"Packs Premium : {premium_line}",
            "ALL": f"{third_line}\n{seconde_line}\nPremium : {premium_line}",
        }

    def _pricing_text(self, disclosure: str | None) -> str:
        return self.pricing.get(disclosure or "", "")

    @staticmethod
    def _visual_excerpt(text: str, sentence_count: int = 1) -> str:
        sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", text) if item.strip()]
        return " ".join(sentences[:sentence_count])

    @staticmethod
    def _publication_title(item: dict[str, Any]) -> str:
        titles = {
            "01-annonce-generale": "Une rentrée solide commence avant le premier devoir",
            "02-entree-3e": "En 3e, consolider les bases et la méthode",
            "03-entree-seconde": "Préparer l'entrée en Seconde avec méthode",
            "04-entree-premiere": "En Première, construire le bon parcours",
            "05-entree-terminale": "En Terminale, hiérarchiser les priorités",
            "06-methode-nexus": "Dix heures structurées, séance après séance",
            "07-valeur-tarif": "Comparer le contenu réel du stage",
            "08-dix-heures": "Cinq séances pour avancer par étapes",
            "09-effectifs-limites": "Un effectif défini pour chaque parcours",
            "10-reservation-acompte": "Demander le programme et la grille",
            "11-checklist-parent": "Trois informations pour commencer",
            "12-rappel-avant-stage": "Le stage commence le 17 août",
            "13-demarrage": "Les stages commencent aujourd'hui",
        }
        return titles[item["id"]]

    def _render_publication(self, item: dict[str, Any]) -> Image.Image:
        body = f"{self._visual_excerpt(item['body'])}\n{self._pricing_text(item.get('pricingDisclosure'))}".strip()
        return self.render_card(
            1080,
            1350,
            " · ".join(item["level"]) if item["level"] != ["ALL"] else "PRÉ-RENTRÉE 2026",
            self._publication_title(item),
            body,
            META,
            f"{item['cta']} · 99 192 829",
            item["altText"],
        )

    def render_publications(self) -> list[Image.Image]:
        images = []
        for item in self.content["publications"]:
            image = self._render_publication(item)
            base = self.output / "publications" / item["id"]
            source = self.output / "sources" / "publications" / f"{item['id']}.svg"
            body = f"{self._visual_excerpt(item['body'])}\n{self._pricing_text(item.get('pricingDisclosure'))}".strip()
            self.svg_source(source, 1080, 1350, "PRÉ-RENTRÉE 2026", self._publication_title(item), body, META, f"{item['cta']} · 99 192 829", f"{item['assetId']}-source", item["altText"])
            self.save_raster_pair(image, base, item["assetId"], "publication-visual", item["altText"])
            images.append(image)
        return images

    def render_carousels(self) -> list[Image.Image]:
        all_images = []
        for carousel in self.content["carousels"]:
            images = []
            carousel_dir = self.output / "carousels" / carousel["id"]
            for index, slide in enumerate(carousel["slides"], start=1):
                pricing = self._pricing_text(slide.get("pricingDisclosure"))
                body = f"{slide['body']}\n{pricing}".strip()
                cta = "WhatsApp 99 192 829" if index == len(carousel["slides"]) else f"{index} / {len(carousel['slides'])}"
                image = self.render_card(1080, 1350, slide["eyebrow"], slide["title"], body, META, cta, slide["altText"])
                prefix = f"{carousel['assetId']}-slide-{index:02d}"
                self.svg_source(
                    self.output / "sources" / "carousels" / carousel["id"] / f"slide-{index:02d}.svg",
                    1080, 1350, slide["eyebrow"], slide["title"], body, META, cta,
                    f"{prefix}-source", slide["altText"],
                )
                self.save_raster_pair(image, carousel_dir / f"slide-{index:02d}", prefix, "carousel-slide", slide["altText"])
                images.append(image)
                all_images.append(image)
            pdf = carousel_dir / f"{carousel['id']}.pdf"
            images[0].save(pdf, "PDF", save_all=True, append_images=images[1:], resolution=150, title=carousel["hook"], creationDate=FIXED_PDF_DATE, modDate=FIXED_PDF_DATE)
            self._normalize_pdf(pdf, carousel["assetId"], carousel["hook"])
            self.register(pdf, f"{carousel['assetId']}-pdf", "carousel-document", carousel["altText"])
        return all_images

    def render_stories(self) -> list[Image.Image]:
        images = []
        for story in self.content["stories"]:
            for index, frame in enumerate(story["frames"], start=1):
                pricing = self._pricing_text(frame.get("pricingDisclosure"))
                body = f"{frame['text']}\n{pricing}".strip()
                image = self.render_card(1080, 1920, frame["eyebrow"], story["hook"], body, frame["interaction"], frame["cta"], frame["altText"])
                prefix = f"{story['assetId']}-{index:02d}"
                self.svg_source(
                    self.output / "sources" / "stories" / story["id"] / f"frame-{index:02d}.svg",
                    1080, 1920, frame["eyebrow"], story["hook"], body, frame["interaction"], frame["cta"],
                    f"{prefix}-source", frame["altText"],
                )
                self.save_raster_pair(image, self.output / "stories" / story["id"] / f"frame-{index:02d}", prefix, "story-frame", frame["altText"])
                images.append(image)
        return images

    @staticmethod
    def _voice_segments(voice_over: str, count: int) -> list[str]:
        sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", voice_over) if item.strip()]
        buckets = ["" for _ in range(count)]
        for index, sentence in enumerate(sentences):
            target = min(index, count - 1)
            buckets[target] = f"{buckets[target]} {sentence}".strip()
        for index, value in enumerate(buckets):
            if not value:
                buckets[index] = buckets[index - 1] if index else voice_over
        return buckets

    @staticmethod
    def _timestamp(seconds: int) -> str:
        return f"00:00:{seconds:02d},000"

    def _reel_script(self, reel: dict[str, Any]) -> str:
        rows = [
            f"# Reel — {reel['hook']}", "",
            f"Durée : {reel['durationSeconds']} secondes · Format : 1080 × 1920 · Version : {VERSION}", "",
            "## Voix off intégrale", "", reel["voiceOver"], "", "## Découpage seconde par seconde", "",
        ]
        voices = self._voice_segments(reel["voiceOver"], len(reel["timeline"]))
        for segment, voice in zip(reel["timeline"], voices, strict=True):
            rows.extend([
                f"### {segment['start']}–{segment['end']} s", "",
                f"Plan : {segment['visual']}",
                f"Voix off : {voice}",
                f"Texte incrusté : {segment['overlay']}",
                f"Transition : {segment['transition']}",
                "Montage : conserver les textes dans les zones sûres et synchroniser l'apparition sur la voix.", "",
            ])
        rows.extend([
            "## Zones sûres", "",
            f"Haut {reel['safeZones']['top']} px · bas {reel['safeZones']['bottom']} px · gauche/droite {reel['safeZones']['left']} px.", "",
            "## Médias nécessaires", "", *[f"- {item}" for item in reel["mediaNeeded"]], "",
            "## Version sans tournage", "", reel["motionDesignAlternative"], "",
            "## Légende", "", reel["body"], "", f"CTA : {reel['cta']}", "",
        ])
        return "\n".join(rows)

    def _srt(self, reel: dict[str, Any]) -> str:
        voices = self._voice_segments(reel["voiceOver"], len(reel["timeline"]))
        return "\n\n".join(
            f"{index}\n{self._timestamp(segment['start'])} --> {self._timestamp(segment['end'])}\n{voice}"
            for index, (segment, voice) in enumerate(zip(reel["timeline"], voices, strict=True), start=1)
        ) + "\n"

    def _encode_reel(self, reel: dict[str, Any], output: Path, frame_paths: list[Path]) -> Path:
        concat = output.parent / "frames.concat.txt"
        lines = []
        for path, segment in zip(frame_paths, reel["timeline"], strict=True):
            lines.extend([f"file 'frames/{path.name}'", f"duration {segment['end'] - segment['start']}"])
        lines.append(f"file 'frames/{frame_paths[-1].name}'")
        concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
        transition_duration = 0.2
        frame_duration = (reel["durationSeconds"] + transition_duration * (len(frame_paths) - 1)) / len(frame_paths)
        command = ["ffmpeg", "-y", "-v", "error"]
        for path in frame_paths:
            command.extend(["-loop", "1", "-t", f"{frame_duration:.6f}", "-i", f"frames/{path.name}"])
        command.extend(["-f", "lavfi", "-t", str(reel["durationSeconds"]), "-i", "anullsrc=r=48000:cl=stereo"])
        filters = [
            f"[{index}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v{index}]"
            for index in range(len(frame_paths))
        ]
        transitions = ["fade", "slideleft", "smoothup", "dissolve", "fadeblack"]
        previous = "v0"
        for index in range(1, len(frame_paths)):
            output_label = f"x{index}"
            offset = index * (frame_duration - transition_duration)
            filters.append(
                f"[{previous}][v{index}]xfade=transition={transitions[index - 1]}:duration={transition_duration}:offset={offset:.6f}[{output_label}]"
            )
            previous = output_label
        command.extend([
            "-filter_complex", ";".join(filters), "-map", f"[{previous}]", "-map", f"{len(frame_paths)}:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-t", str(reel["durationSeconds"]), "-movflags", "+faststart",
            "-map_metadata", "-1", "-metadata", "creation_time=2000-01-01T00:00:00Z", output.name,
        ])
        subprocess.run(command, check=True, cwd=output.parent)
        return concat

    def render_reels(self) -> list[Image.Image]:
        all_frames = []
        for reel in self.content["reels"]:
            reel_dir = self.output / "reels" / reel["id"]
            frames_dir = reel_dir / "frames"
            frames_dir.mkdir(parents=True, exist_ok=True)
            frames = []
            frame_paths = []
            for index, segment in enumerate(reel["timeline"], start=1):
                alt = f"Plan {index} : {segment['overlay']}"
                image = self.render_card(1080, 1920, f"{segment['start']:02d}–{segment['end']:02d} S", reel["hook"], segment["overlay"], segment["visual"], "Nexus Réussite", alt)
                prefix = f"{reel['assetId']}-frame-{index:02d}"
                self.svg_source(
                    self.output / "sources" / "reels" / reel["id"] / f"frame-{index:02d}.svg",
                    1080, 1920, f"{segment['start']:02d}–{segment['end']:02d} S", reel["hook"], segment["overlay"], segment["visual"], "Nexus Réussite", f"{prefix}-source", alt,
                )
                path = frames_dir / f"frame-{index:02d}.png"
                image.save(path, format="PNG", optimize=True)
                self.register(path, f"{prefix}-png", "reel-frame", alt, 1080, 1920)
                frames.append(image)
                frame_paths.append(path)
                all_frames.append(image)

            cover = reel["cover"]
            cover_image = self.render_card(1080, 1920, cover["eyebrow"], cover["title"], cover["subtitle"], META, "WhatsApp 99 192 829", cover["altText"])
            self.svg_source(self.output / "sources" / "reels" / reel["id"] / "cover.svg", 1080, 1920, cover["eyebrow"], cover["title"], cover["subtitle"], META, "WhatsApp 99 192 829", f"{reel['assetId']}-cover-source", cover["altText"])
            self.save_raster_pair(cover_image, reel_dir / "cover", f"{reel['assetId']}-cover", "reel-cover", cover["altText"])

            script = reel_dir / "script.md"
            script.write_text(self._reel_script(reel), encoding="utf-8")
            self.register(script, f"{reel['assetId']}-script", "editable-reel-script", reel["altText"])
            srt = reel_dir / "subtitles-fr.srt"
            srt.write_text(self._srt(reel), encoding="utf-8")
            self.register(srt, f"{reel['assetId']}-srt", "subtitles", reel["altText"])
            storyboard = reel_dir / "storyboard.pdf"
            frames[0].save(storyboard, "PDF", save_all=True, append_images=frames[1:], resolution=120, title=reel["hook"], creationDate=FIXED_PDF_DATE, modDate=FIXED_PDF_DATE)
            self._normalize_pdf(storyboard, f"{reel['assetId']}-storyboard", reel["hook"])
            self.register(storyboard, f"{reel['assetId']}-storyboard", "storyboard", reel["altText"])
            video = reel_dir / "motion-design.mp4"
            concat = self._encode_reel(reel, video, frame_paths)
            self.register(concat, f"{reel['assetId']}-concat-source", "editable-video-source", reel["altText"])
            self.register(video, f"{reel['assetId']}-video", "motion-design-video", reel["altText"])
        return all_frames

    def _whatsapp_url(self, item: dict[str, Any]) -> str:
        tracking = "&".join(f"utm_{key}={value}" for key, value in item["utm"].items())
        return f"https://wa.me/21699192829?text={quote(item['whatsappPrefill'] + chr(10) + chr(10) + 'Référence : ' + tracking)}"

    def render_copy_and_calendar(self) -> list[Image.Image]:
        copy_dir = self.output / "copy"
        calendar_dir = self.output / "calendar"
        copy_dir.mkdir(parents=True, exist_ok=True)
        calendar_dir.mkdir(parents=True, exist_ok=True)
        compiled = json.loads(json.dumps(self.content, ensure_ascii=False))
        compiled["pricing"] = self.pricing
        registry = []
        for family in ("publications", "carousels", "stories", "reels"):
            for item in compiled[family]:
                registry.append({
                    "family": family,
                    "id": item["id"],
                    "assetId": item["assetId"],
                    "owner": item.pop("owner"),
                    "status": item.pop("status"),
                    "proofIds": item["proofIds"],
                    "publicationDay": item["publicationDay"],
                    "publicationDate": item["publicationDate"],
                })
                item["pricingLine"] = self._pricing_text(item.get("pricingDisclosure"))
                item["whatsappUrl"] = self._whatsapp_url(item)
        copy_json = copy_dir / "campaign-copy.json"
        copy_json.write_text(json.dumps(compiled, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.register(copy_json, "full-campaign-copy-json", "campaign-copy", "Copies éditoriales complètes de la campagne")
        registry_path = self.output / "internal" / "publication-registry.json"
        registry_path.parent.mkdir(parents=True, exist_ok=True)
        registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.register(registry_path, "full-campaign-publication-registry", "internal-publication-registry", "Responsables, statuts et preuves des contenus")
        whatsapp = copy_dir / "whatsapp-variants.md"
        whatsapp.write_text(
            "# Déclinaisons WhatsApp — campagne Pré-rentrée 2026\n\n" +
            "\n\n".join(
                f"## {item['id']}\n\n{item['whatsappPrefill']}\n\nCTA : {item['cta']}\n\nLien : {self._whatsapp_url(item)}"
                for item in self.all_items
            ) + "\n",
            encoding="utf-8",
        )
        self.register(whatsapp, "full-campaign-whatsapp-variants", "whatsapp-copy", "Déclinaisons WhatsApp de chaque contenu")

        calendar_internal = sorted(
            [dict(item, family=family) for family in ("publications", "carousels", "stories", "reels") for item in self.content[family]],
            key=lambda item: (item["publicationDayOffset"], item["family"], item["id"]),
        )
        calendar = []
        for item in calendar_internal:
            public_item = dict(item)
            public_item.pop("owner")
            public_item.pop("status")
            calendar.append(public_item)
        calendar_json = calendar_dir / "full-campaign-calendar.json"
        calendar_json.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.register(calendar_json, "full-campaign-calendar-json", "publication-calendar", "Calendrier complet jusqu'au démarrage")
        calendar_csv = calendar_dir / "full-campaign-calendar.csv"
        with calendar_csv.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            writer.writerow(["jour", "date", "heure", "famille", "id", "canal", "audience", "niveau", "tunnel", "objectif", "assetId", "texte", "CTA", "UTM", "réponseWhatsApp", "KPI"])
            for item in calendar:
                writer.writerow([
                    item["publicationDay"], item["publicationDate"] or "", item.get("publicationTime", "19:00"), item["family"], item["id"], " | ".join(item["channel"]), " | ".join(item["audience"]),
                    " | ".join(item["level"]), item["funnelStage"], item["objective"], item["assetId"], item["body"], item["cta"],
                    "&".join(f"utm_{key}={value}" for key, value in item["utm"].items()), item["whatsappPrefill"], self._expected_kpi(item["funnelStage"]),
                ])
        self.register(calendar_csv, "full-campaign-calendar-csv", "publication-calendar", "Calendrier CSV exploitable")

        pages = []
        for item in calendar:
            date_label = item["publicationDate"] or "DATE À AUTORISER"
            page = self.render_card(1240, 1754, f"{item['publicationDay']} · {date_label} · {item['family'].upper()}", item["hook"], self._visual_excerpt(item["body"], 2), " · ".join(item["channel"]), item["cta"], f"Calendrier {item['id']}")
            pages.append(page)
        pdf = calendar_dir / "full-campaign-calendar.pdf"
        pages[0].save(pdf, "PDF", save_all=True, append_images=pages[1:], resolution=150, title="Calendrier complet Pré-rentrée 2026", creationDate=FIXED_PDF_DATE, modDate=FIXED_PDF_DATE)
        self._normalize_pdf(pdf, "full-campaign-calendar", "Calendrier complet Pré-rentrée 2026")
        self.register(pdf, "full-campaign-calendar-pdf", "publication-calendar", "Calendrier PDF complet jusqu'au démarrage")
        return pages

    @staticmethod
    def _expected_kpi(stage: str) -> str:
        return {
            "DISCOVERY": "Portée utile, lecture vidéo et visites de profil",
            "CONSIDERATION": "Enregistrements, réponses et conversations WhatsApp qualifiées",
            "CONVERSION": "Demandes d'information qualifiées",
        }[stage]

    @staticmethod
    def _normalize_pdf(path: Path, identifier: str, title: str) -> None:
        writer = PdfWriter(clone_from=path)
        writer.add_metadata({
            "/Title": title,
            "/Author": "Nexus Réussite",
            "/Creator": "Nexus deterministic full-campaign renderer",
            "/Producer": "Nexus Réussite",
            "/CreationDate": FIXED_PDF_DATE,
            "/ModDate": FIXED_PDF_DATE,
        })
        digest = hashlib.sha256(identifier.encode("utf-8")).digest()[:16]
        writer._ID = ArrayObject([ByteStringObject(digest), ByteStringObject(digest)])
        normalized = path.with_suffix(".normalized.pdf")
        with normalized.open("wb") as handle:
            writer.write(handle)
        normalized.replace(path)

    def render_contact_sheet(self, images: list[Image.Image], name: str, columns: int, thumb_width: int) -> None:
        thumbs = []
        for image in images:
            thumb = image.copy()
            thumb.thumbnail((thumb_width, int(thumb_width * 1.8)), Image.Resampling.LANCZOS)
            thumbs.append(thumb)
        rows = math.ceil(len(thumbs) / columns)
        cell_height = max(thumb.height for thumb in thumbs) + 32
        sheet = Image.new("RGB", (columns * (thumb_width + 24) + 24, rows * cell_height + 24), "#FFFFFF")
        for index, thumb in enumerate(thumbs):
            x = 24 + (index % columns) * (thumb_width + 24)
            y = 24 + (index // columns) * cell_height
            sheet.paste(thumb, (x, y))
        path = self.output / "visual-review" / f"{name}-contact-sheet.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path, format="PNG", optimize=True)
        self.register(path, f"full-campaign-review-{name}", "visual-review", f"Planche de contrôle {name}", *sheet.size)

    @staticmethod
    def _relative_luminance(hex_color: str) -> float:
        channels = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
        channels = [channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

    def _contrast_ratio(self, foreground: str, background: str) -> float:
        values = sorted([self._relative_luminance(foreground), self._relative_luminance(background)], reverse=True)
        return (values[0] + 0.05) / (values[1] + 0.05)

    def write_qa_and_manifest(self) -> dict[str, Any]:
        referenced = {item["assetId"] for item in self.all_items}
        produced_ids = {asset.asset_id for asset in self.assets}
        broken = [
            asset_id for asset_id in referenced
            if not any(produced.startswith(asset_id) for produced in produced_ids)
        ]
        wrong_dimensions = 0
        for asset in self.assets:
            if asset.path.suffix.lower() not in {".png", ".webp"}:
                continue
            with Image.open(asset.path) as image:
                if image.size != (asset.width, asset.height):
                    wrong_dimensions += 1
        minimum_contrast = min(
            self._contrast_ratio("#0B1F3A", "#FFFDF8"),
            self._contrast_ratio("#FFFFFF", "#0B1F3A"),
            self._contrast_ratio("#FFD9D9", "#0B1F3A"),
        )
        qa = {
            "schemaVersion": "1.0.0",
            "version": VERSION,
            "missingAssetCount": sum(not asset.path.is_file() for asset in self.assets),
            "wrongDimensionCount": wrong_dimensions,
            "overflowCount": self.overflow_count,
            "contrastFailures": int(minimum_contrast < 4.5),
            "brokenReferenceCount": len(broken),
            "brokenReferences": broken,
            "minimumContrastRatio": round(minimum_contrast, 2),
            "safeZones": {"reels": "250 px haut, 360 px bas, 90 px latéraux", "stories": "éléments essentiels contenus entre 250 et 1560 px"},
            "rights": "Aucune photographie ni média tiers ; logo officiel et polices OFL uniquement.",
        }
        qa_path = self.output / "qa-report.json"
        qa_path.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.register(qa_path, "full-campaign-qa-report", "quality-report", "Rapport qualité de la campagne complète")
        if any(qa[key] for key in ("missingAssetCount", "wrongDimensionCount", "overflowCount", "contrastFailures", "brokenReferenceCount")):
            raise RuntimeError(f"Full-campaign quality gate failed: {qa}")

        records = []
        for asset in sorted(self.assets, key=lambda item: item.path.relative_to(self.output).as_posix()):
            suffix = asset.path.suffix.lower()
            records.append({
                "assetId": asset.asset_id,
                "path": asset.path.relative_to(self.output).as_posix(),
                "role": asset.role,
                "format": {".png": "PNG", ".webp": "WEBP", ".svg": "SVG", ".pdf": "PDF", ".mp4": "MP4", ".srt": "SRT", ".json": "JSON", ".csv": "CSV", ".md": "MARKDOWN", ".txt": "TEXT"}.get(suffix, suffix.removeprefix(".").upper()),
                "width": asset.width,
                "height": asset.height,
                "bytes": asset.path.stat().st_size,
                "sha256": hashlib.sha256(asset.path.read_bytes()).hexdigest(),
                "altText": asset.alt_text,
            })
        manifest = {
            "schemaVersion": "1.0.0",
            "version": VERSION,
            "campaignId": self.content["campaignId"],
            "status": PUBLIC_STATUS,
            "launchDate": self.launch_date,
            "launchDateStatus": self.launch_date_status,
            "sourceVersion": self.content["version"],
            "commercialContractVersion": self.commercial["version"],
            "inventory": {"publications": 13, "carousels": 8, "carouselSlides": 40, "storySequences": 12, "storyFrames": 36, "reels": 3},
            "sourceInputs": [
                "content/pre-rentree-2026/full-campaign.fr.json",
                "content/pre-rentree-2026/commercial-contract.fr.json",
                "content/pre-rentree-2026/proofs.registry.json",
                "data/pricing.canonical.json",
                "scripts/pre-rentree/render_full_campaign.py",
            ],
            "assets": records,
        }
        (self.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return manifest

    def render(self) -> dict[str, Any]:
        posts = self.render_publications()
        carousels = self.render_carousels()
        stories = self.render_stories()
        reels = self.render_reels()
        calendar = self.render_copy_and_calendar()
        self.render_contact_sheet(posts, "publications", 4, 220)
        self.render_contact_sheet(carousels, "carousels", 5, 180)
        self.render_contact_sheet(stories, "stories", 6, 150)
        self.render_contact_sheet(reels, "reels", 6, 150)
        self.render_contact_sheet(calendar, "calendar", 6, 150)
        return self.write_qa_and_manifest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content", type=Path, required=True)
    parser.add_argument("--commercial", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--launch-date", default=None)
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    renderer = FullCampaignRenderer(
        repo_root,
        args.content if args.content.is_absolute() else repo_root / args.content,
        args.commercial if args.commercial.is_absolute() else repo_root / args.commercial,
        args.output if args.output.is_absolute() else repo_root / args.output,
        args.launch_date or None,
    )
    manifest = renderer.render()
    print(json.dumps({"status": "READY", "assets": len(manifest["assets"]), **manifest["inventory"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

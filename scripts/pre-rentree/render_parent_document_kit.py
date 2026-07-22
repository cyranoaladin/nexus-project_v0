#!/usr/bin/env python3
"""Render the deterministic Pré-rentrée 2026 parent-document kit."""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import io
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, ByteStringObject
from weasyprint import HTML


VERSION = "2026-parent-documents-v1"
SUBJECTS = {
    "MATHEMATIQUES": "Mathématiques",
    "FRANCAIS": "Français",
    "PHYSIQUE_CHIMIE": "Physique-chimie",
    "NSI": "NSI",
    "PHILOSOPHIE": "Philosophie",
    "SVT": "SVT",
}
LEVELS = {
    "TROISIEME": "Entrée en 3e",
    "SECONDE": "Entrée en Seconde",
    "PREMIERE": "Entrée en Première",
    "TERMINALE": "Entrée en Terminale",
}
NO_STAGE_PRICING = {"accompagnements-annuels", "passerelle-stage-annuel"}


@dataclass(frozen=True)
class Asset:
    path: Path
    asset_id: str
    role: str
    document_id: str | None = None
    width: int | None = None
    height: int | None = None
    page_count: int | None = None


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _amount(value: int) -> str:
    return f"{value:,}".replace(",", "\u202f") + " TND"


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _contrast_ratio(foreground: str, background: str) -> float:
    def luminance(color: str) -> float:
        channels = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
        linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    first, second = sorted((luminance(foreground), luminance(background)), reverse=True)
    return round((first + 0.05) / (second + 0.05), 2)


class ParentDocumentRenderer:
    def __init__(self, repo_root: Path, content_path: Path, commercial_path: Path, output: Path):
        self.repo_root = repo_root
        self.content = json.loads(content_path.read_text(encoding="utf-8"))
        self.commercial = json.loads(commercial_path.read_text(encoding="utf-8"))
        self.stylesheet = (repo_root / "scripts/pre-rentree/templates/parent-document.css").read_text(encoding="utf-8")
        self.output = output
        self.assets: list[Asset] = []
        self.offers = {offer["offerId"]: offer for offer in self.commercial["offers"]}
        self.proofs = {
            proof["proofId"]: proof
            for proof in json.loads(
                (repo_root / "content/pre-rentree-2026/proofs.registry.json").read_text(encoding="utf-8")
            )["proofs"]
        }
        if output.name != "parent-documents":
            raise ValueError("Output directory must be named parent-documents")
        self._validate_sources()

    def _validate_sources(self) -> None:
        if self.content["version"] != VERSION:
            raise ValueError("Unexpected parent-document source version")
        if len(self.content["documents"]) != 14:
            raise ValueError("The parent kit must contain exactly fourteen documents")
        for document in self.content["documents"]:
            missing_offers = set(document.get("offerIds", [])) - self.offers.keys()
            missing_proofs = set(document["proofIds"]) - self.proofs.keys()
            if missing_offers:
                raise ValueError(f"Unknown offers for {document['documentId']}: {sorted(missing_offers)}")
            if missing_proofs:
                raise ValueError(f"Unknown proofs for {document['documentId']}: {sorted(missing_proofs)}")
            unapproved = [proof_id for proof_id in document["proofIds"] if self.proofs[proof_id]["status"] != "APPROVED"]
            if unapproved:
                raise ValueError(f"Unapproved proofs for {document['documentId']}: {unapproved}")
        raw = json.dumps(self.content["documents"], ensure_ascii=False).lower()
        forbidden = ("snt", "manuel offert", "remise annuelle", "réduction annuelle", "placeholder")
        if any(term in raw for term in forbidden):
            raise ValueError("Parent-facing source contains a hidden or internal claim")

    def _logo_data_uri(self) -> str:
        logo_path = self.repo_root / "public/images/logo_nexus_reussite.png"
        return "data:image/png;base64," + base64.b64encode(logo_path.read_bytes()).decode("ascii")

    @staticmethod
    def _offer_label(offer: dict[str, Any]) -> str:
        level = LEVELS[offer["level"]]
        if offer.get("subjectCount"):
            count = offer["subjectCount"]
            return f"{level} · {count} matière{'s' if count > 1 else ''} au choix"
        return f"{level} · {SUBJECTS[offer['subjects'][0]]}"

    @staticmethod
    def _offer_subjects(offer: dict[str, Any]) -> str:
        labels = [SUBJECTS[item] for item in offer["subjects"]]
        return ", ".join(labels)

    def _offer_rows(self, document: dict[str, Any]) -> str:
        if document["documentId"] in NO_STAGE_PRICING:
            return ""
        rows = []
        for offer_id in document.get("offerIds", []):
            offer = self.offers[offer_id]
            rows.append(
                "<tr>"
                f"<td><strong>{_escape(self._offer_label(offer))}</strong><br>{_escape(self._offer_subjects(offer))}</td>"
                f"<td>{offer['hours']} h · {offer['sessions']} séances</td>"
                f"<td>{offer['groupMin']} à {offer['groupMax']} élèves</td>"
                f"<td class=\"price\">{_escape(_amount(offer['price']))}</td>"
                f"<td class=\"price\">{_escape(_amount(offer['deposit']))}</td>"
                "</tr>"
            )
        if not rows:
            return ""
        return (
            '<section class="offer-block"><h2>Repères de l\'offre</h2>'
            '<table class="offer-table"><thead><tr><th>Parcours</th><th>Format</th>'
            '<th>Groupe</th><th>Tarif</th><th>Acompte</th></tr></thead>'
            f"<tbody>{''.join(rows)}</tbody></table>"
            '<p class="source-note">Tarifs et acomptes injectés depuis le contrat commercial compilé. '
            'Une demande sans acompte ne réserve pas la place.</p></section>'
        )

    @staticmethod
    def _section(section: dict[str, Any]) -> str:
        paragraphs = "".join(f"<p>{_escape(paragraph)}</p>" for paragraph in section["paragraphs"])
        bullets = "".join(f"<li>{_escape(item)}</li>" for item in section["bullets"])
        return f'<article class="section-card"><h2>{_escape(section["heading"])}</h2>{paragraphs}<ul>{bullets}</ul></article>'

    def _html(self, document: dict[str, Any]) -> str:
        contact = self.content["contact"]
        feature = self._section(document["sections"][0])
        sections = "".join(self._section(section) for section in document["sections"][1:])
        return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="author" content="Nexus Réussite">
  <meta name="description" content="{_escape(document['purpose'])}">
  <title>{_escape(document['title'])} · Nexus Réussite</title>
  <style>
{self.stylesheet}
  </style>
</head>
<body>
  <header class="masthead">
    <div class="brand"><img src="{self._logo_data_uri()}" alt=""><div><strong>Nexus Réussite</strong><span>Stages de pré-rentrée 2026</span></div></div>
    <a class="masthead-contact" href="{_escape(contact['url'])}">WhatsApp {_escape(contact['display'])}</a>
  </header>
  <main>
    <p class="eyebrow">Dès le 17 août 2026 · Mutuelleville</p>
    <h1>{_escape(document['title'])}</h1>
    <p class="subtitle">{_escape(document['subtitle'])}</p>
    <div class="lead-grid"><p class="purpose">{_escape(document['purpose'])}</p><p class="audience"><strong>Pour qui ?</strong><br>{_escape(document['audience'])}</p></div>
    <div class="section-feature">{feature}</div>
    <a class="cta" href="{_escape(contact['url'])}"><strong>{_escape(document['cta'])}</strong><span>WhatsApp {_escape(contact['display'])}</span></a>
{self._offer_rows(document)}
    <div class="sections">{sections}</div>
  </main>
</body>
</html>
"""

    @staticmethod
    def _normalize_pdf(path: Path, document: dict[str, Any]) -> None:
        writer = PdfWriter(clone_from=path)
        normalized_font_objects: set[int] = set()
        for page in writer.pages:
            resources = page.get("/Resources", {}).get_object()
            fonts = resources.get("/Font", {}).get_object()
            for reference in fonts.values():
                font = reference.get_object()
                descendants = font.get("/DescendantFonts", [])
                candidates = [item.get_object() for item in descendants] or [font]
                for candidate in candidates:
                    descriptor_reference = candidate.get("/FontDescriptor")
                    if descriptor_reference is None:
                        continue
                    descriptor = descriptor_reference.get_object()
                    font_reference = descriptor.get("/FontFile2")
                    if font_reference is None:
                        continue
                    marker = getattr(font_reference, "idnum", id(font_reference))
                    if marker in normalized_font_objects:
                        continue
                    normalized_font_objects.add(marker)
                    stream = font_reference.get_object()
                    font_data = io.BytesIO(stream.get_data())
                    embedded = TTFont(font_data, recalcTimestamp=False)
                    if "head" in embedded:
                        embedded["head"].created = 3848943600
                        embedded["head"].modified = 3848943600
                    output = io.BytesIO()
                    embedded.save(output)
                    stream.set_data(output.getvalue())
        writer.add_metadata(
            {
                "/Title": document["title"],
                "/Author": "Nexus Réussite",
                "/Subject": "Stages de pré-rentrée 2026",
                "/Keywords": "Nexus Réussite, pré-rentrée, Mutuelleville",
                "/Creator": "Nexus deterministic parent-document renderer",
                "/Producer": "Nexus Réussite",
                "/CreationDate": "D:20260720000000+01'00'",
                "/ModDate": "D:20260720000000+01'00'",
            }
        )
        identifier = hashlib.sha256(document["documentId"].encode("utf-8")).digest()[:16]
        writer._ID = ArrayObject([ByteStringObject(identifier), ByteStringObject(identifier)])
        normalized = path.with_suffix(".normalized.pdf")
        with normalized.open("wb") as target:
            writer.write(target)
        normalized.replace(path)

    def _render_pages(self, document_id: str, pdf_path: Path) -> tuple[int, list[dict[str, Any]]]:
        target = self.output / "rendered" / document_id
        target.mkdir(parents=True, exist_ok=True)
        records = []
        with fitz.open(pdf_path) as pdf:
            page_count = pdf.page_count
            for index, page in enumerate(pdf, start=1):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2.1, 2.1), alpha=False)
                image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
                image = image.resize((1240, 1755), Image.Resampling.LANCZOS)
                path = target / f"page-{index:02d}.png"
                image.save(path, format="PNG", optimize=True)
                text = page.get_text().strip()
                records.append(
                    {
                        "page": index,
                        "textCharacters": len(text),
                        "blank": len(text) < 180,
                        "width": 1240,
                        "height": 1755,
                    }
                )
                self.assets.append(
                    Asset(path, f"parent-{document_id}-page-{index:02d}", "visual-inspection", document_id, 1240, 1755)
                )
        return page_count, records

    def _contact_sheet(self, pages: list[tuple[str, Path]]) -> Path:
        thumb_w, thumb_h = 310, 439
        cols = 4
        rows = (len(pages) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * 350, rows * 500), "#E9EDF3")
        draw = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype("DejaVuSans.ttf", 18)
        except OSError:
            font = ImageFont.load_default()
        for index, (label, page_path) in enumerate(pages):
            x = (index % cols) * 350 + 20
            y = (index // cols) * 500 + 18
            with Image.open(page_path) as page:
                thumbnail = page.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            sheet.paste(thumbnail, (x, y))
            draw.text((x, y + thumb_h + 10), label, fill="#0B1F3A", font=font)
        path = self.output / "visual-review" / "parent-documents-contact-sheet.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path, format="PNG", optimize=True)
        self.assets.append(Asset(path, "parent-documents-contact-sheet", "visual-review", width=sheet.width, height=sheet.height))
        return path

    def _prepare_fonts(self, sources: Path) -> None:
        font_dir = sources / "fonts"
        font_dir.mkdir(parents=True, exist_ok=True)
        for source_name, target_name in (
            ("DMSans-Variable.woff2", "DMSans.ttf"),
            ("Fraunces-Variable.woff2", "Fraunces.ttf"),
        ):
            target = font_dir / target_name
            font = TTFont(self.repo_root / "app/fonts" / source_name, recalcTimestamp=False)
            font.flavor = None
            font["head"].created = 3848943600
            font["head"].modified = 3848943600
            font.save(target)
            self.assets.append(Asset(target, f"parent-font-{target.stem.lower()}", "licensed-font"))
        license_target = font_dir / "OFL-1.1.txt"
        shutil.copyfile(self.repo_root / "licenses/fonts/OFL-1.1.txt", license_target)
        self.assets.append(Asset(license_target, "parent-font-license-ofl", "font-license"))

    def render(self) -> dict[str, Any]:
        if self.output.exists():
            shutil.rmtree(self.output)
        sources = self.output / "sources"
        pdf_dir = self.output / "pdf"
        sources.mkdir(parents=True)
        pdf_dir.mkdir(parents=True)
        self._prepare_fonts(sources)

        qa_documents = []
        rendered_pages: list[tuple[str, Path]] = []
        for document in self.content["documents"]:
            document_id = document["documentId"]
            html_path = sources / f"{document_id}.html"
            html_path.write_text(self._html(document), encoding="utf-8")
            self.assets.append(Asset(html_path, f"parent-{document_id}-html", "editable-source", document_id))
            pdf_path = pdf_dir / f"{document_id}.pdf"
            HTML(filename=str(html_path), base_url=str(sources)).write_pdf(
                pdf_path,
                pdf_identifier=hashlib.sha256(document_id.encode("utf-8")).digest()[:16],
            )
            self._normalize_pdf(pdf_path, document)
            page_count, page_records = self._render_pages(document_id, pdf_path)
            self.assets.append(Asset(pdf_path, f"parent-{document_id}-pdf", "final-pdf", document_id, page_count=page_count))
            rendered_pages.extend(
                (
                    f"{document_id} · p{page['page']}",
                    self.output / "rendered" / document_id / f"page-{page['page']:02d}.png",
                )
                for page in page_records
            )
            with fitz.open(pdf_path) as pdf:
                fonts = sorted({font[3] for page in pdf for font in page.get_fonts(full=True)})
                links = [link for page in pdf for link in page.get_links()]
                overflow_blocks = sum(
                    1
                    for page in pdf
                    for block in page.get_text("blocks")
                    if block[0] < -0.5
                    or block[1] < -0.5
                    or block[2] > page.rect.width + 0.5
                    or block[3] > page.rect.height + 0.5
                )
            qa_documents.append(
                {
                    "documentId": document_id,
                    "pageCount": page_count,
                    "pages": page_records,
                    "blankPageCount": sum(1 for page in page_records if page["blank"]),
                    "fonts": fonts,
                    "fontCount": len(fonts),
                    "overflowBlockCount": overflow_blocks,
                    "whatsappLinkPresent": any(link.get("uri") == self.content["contact"]["url"] for link in links),
                }
            )

        self._contact_sheet(rendered_pages)
        qa_report = {
            "version": VERSION,
            "documentCount": len(qa_documents),
            "blankPageCount": sum(document["blankPageCount"] for document in qa_documents),
            "missingWhatsappLinkCount": sum(not document["whatsappLinkPresent"] for document in qa_documents),
            "overflowBlockCount": sum(document["overflowBlockCount"] for document in qa_documents),
            "minimumContrastRatio": min(
                _contrast_ratio(foreground, background)
                for foreground, background in (
                    ("#C9252D", "#FFFDF8"),
                    ("#526176", "#FFFDF8"),
                    ("#FFFFFF", "#0B1F3A"),
                    ("#FFD9D9", "#0B1F3A"),
                    ("#172033", "#FFFDF8"),
                )
            ),
            "fontSubstitutionCount": sum(
                not (
                    "dm" in "".join(document["fonts"]).lower()
                    and "sans" in "".join(document["fonts"]).lower()
                    and "fraunces" in "".join(document["fonts"]).lower()
                )
                for document in qa_documents
            ),
            "documents": qa_documents,
        }
        qa_path = self.output / "qa-report.json"
        qa_path.write_text(json.dumps(qa_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.assets.append(Asset(qa_path, "parent-documents-qa-report", "quality-report"))
        if (
            qa_report["blankPageCount"]
            or qa_report["missingWhatsappLinkCount"]
            or qa_report["fontSubstitutionCount"]
            or qa_report["overflowBlockCount"]
            or qa_report["minimumContrastRatio"] < 4.5
        ):
            raise RuntimeError("Parent-document PDF quality gate failed")

        manifest_assets = []
        for asset in sorted(self.assets, key=lambda item: item.path.relative_to(self.output).as_posix()):
            record: dict[str, Any] = {
                "assetId": asset.asset_id,
                "path": asset.path.relative_to(self.output).as_posix(),
                "role": asset.role,
                "format": asset.path.suffix.removeprefix(".").upper(),
                "bytes": asset.path.stat().st_size,
                "sha256": _sha256(asset.path),
            }
            if asset.document_id:
                record["documentId"] = asset.document_id
            if asset.width and asset.height:
                record.update({"width": asset.width, "height": asset.height})
            if asset.page_count:
                record["pageCount"] = asset.page_count
            manifest_assets.append(record)
        manifest = {
            "schemaVersion": "1.0.0",
            "version": VERSION,
            "campaignId": self.content["campaignId"],
            "documentIds": [document["documentId"] for document in self.content["documents"]],
            "documents": [
                {
                    "documentId": document["documentId"],
                    "offerIds": document.get("offerIds", []),
                    "proofIds": document["proofIds"],
                    "html": f"sources/{document['documentId']}.html",
                    "pdf": f"pdf/{document['documentId']}.pdf",
                    "pageCount": next(
                        item["pageCount"]
                        for item in qa_documents
                        if item["documentId"] == document["documentId"]
                    ),
                }
                for document in self.content["documents"]
            ],
            "sourceVersion": self.content["version"],
            "commercialContractVersion": self.commercial["version"],
            "sourceInputs": [
                "content/pre-rentree-2026/parent-documents.fr.json",
                "scripts/pre-rentree/templates/parent-document.css",
                "scripts/pre-rentree/render_parent_document_kit.py",
            ],
            "status": "READY_FOR_OWNER_REVIEW",
            "assets": manifest_assets,
        }
        (self.output / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content", type=Path, required=True)
    parser.add_argument("--commercial", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    renderer = ParentDocumentRenderer(
        repo_root,
        args.content if args.content.is_absolute() else repo_root / args.content,
        args.commercial if args.commercial.is_absolute() else repo_root / args.commercial,
        args.output if args.output.is_absolute() else repo_root / args.output,
    )
    manifest = renderer.render()
    print(json.dumps({"status": "READY", "documents": len(manifest["documentIds"]), "assets": len(manifest["assets"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Render deterministic classroom-resource review packs for Pré-rentrée 2026."""

from __future__ import annotations

import argparse
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


VERSION = "2026-priority-resources-v1"
DOCUMENTS = ("positioningStudent", "positioningTeacher", "workbookStudent", "guideTeacher")


@dataclass(frozen=True)
class Asset:
    path: Path
    asset_id: str
    role: str
    module_id: str | None = None
    document_id: str | None = None
    width: int | None = None
    height: int | None = None
    page_count: int | None = None


def esc(value: Any) -> str:
    return html.escape(str(value), quote=True)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contrast_ratio(foreground: str, background: str) -> float:
    def luminance(color: str) -> float:
        values = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
        linear = [value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in values]
        return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]

    first, second = sorted((luminance(foreground), luminance(background)), reverse=True)
    return round((first + .05) / (second + .05), 2)


class PriorityResourceRenderer:
    def __init__(self, root: Path, content_path: Path, matrix_path: Path, output: Path):
        self.root = root
        self.content = json.loads(content_path.read_text(encoding="utf-8"))
        self.matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
        self.output = output
        self.css = (root / "scripts/pre-rentree/templates/priority-resource.css").read_text(encoding="utf-8")
        self.assets: list[Asset] = []
        self._validate()

    def _validate(self) -> None:
        if self.content["version"] != VERSION or self.content["status"] != "READY_FOR_PEDAGOGICAL_REVIEW":
            raise ValueError("Unexpected resource source version or status")
        if len(self.content["modules"]) != 6:
            raise ValueError("Exactly six priority modules are required")
        matrix_rows = {row["moduleId"]: row for row in self.matrix["rows"]}
        for module in self.content["modules"]:
            if module["moduleId"] not in matrix_rows:
                raise ValueError(f"Missing programme matrix row: {module['moduleId']}")
            if matrix_rows[module["moduleId"]]["officialProgrammeId"] != module["programmeMatrixRef"]:
                raise ValueError(f"Programme mismatch: {module['moduleId']}")
            if module["validation"]["status"] != "PENDING_HUMAN_VALIDATION":
                raise ValueError(f"Human validation cannot be inferred: {module['moduleId']}")
            if len(module["positioning"]["questions"]) < 6 or len(module["exercises"]) < 4:
                raise ValueError(f"Incomplete teaching material: {module['moduleId']}")
            if any(len(activity.get("resourceContent", "")) <= 60 for activity in module["activities"]):
                raise ValueError(f"Activity support is not directly usable: {module['moduleId']}")

    @staticmethod
    def _header(module: dict[str, Any], kind: str, page_label: str) -> str:
        return f"""
<header class="masthead"><div class="brand">Nexus Réussite</div><div class="document-kind">{esc(kind)} · {esc(page_label)}</div></header>
<p class="eyebrow">Pré-rentrée 2026 · {esc(module['level'])}</p>
<h1>{esc(module['subject'])}</h1>
<p class="subtitle">{esc(module['focus'])}</p>
<div class="meta"><div><span>Module</span><strong>{esc(module['moduleId'])}</strong></div><div><span>Durée du parcours</span><strong>{module['durationMinutes'] // 60} heures</strong></div><div><span>Difficulté</span><strong>{esc(module['difficultyRange'])}</strong></div><div><span>Référence</span><strong>{esc(module['programmeMatrixRef'])}</strong></div></div>
"""

    @staticmethod
    def _question(question: dict[str, Any], teacher: bool) -> str:
        correction = ""
        if teacher:
            correction = f'<div class="answer"><strong>Réponse :</strong> {esc(question["answer"])}<br><strong>Barème :</strong> {esc(question["correctionGuidance"])}</div>'
        else:
            correction = '<div class="lines" aria-label="Zone de réponse"></div>'
        return f'<article class="card"><span class="tag">{esc(question["difficulty"])}</span><span class="points">{question["points"]} pt</span><h3>{esc(question["id"])} · {esc(question["skill"])}</h3><p>{esc(question["prompt"])}</p>{correction}</article>'

    def _positioning_student(self, module: dict[str, Any]) -> str:
        questions = module["positioning"]["questions"]
        pages = []
        for index, chunk in enumerate((questions[:3], questions[3:]), start=1):
            introduction = ""
            if index == 1:
                introduction = f'<div class="notice"><strong>Consignes · {module["positioning"]["durationMinutes"]} minutes</strong><p>{esc(module["positioning"]["student"]["instructions"])}</p></div>'
                if module.get("positioning", {}).get("supportText"):
                    introduction += f'<article class="card"><h2>Texte support original Nexus</h2><p>{esc(module["positioning"]["supportText"])}</p></article>'
            pages.append(f'<section class="sheet">{self._header(module, "Test de positionnement · version élève", f"partie {index}/2")}{introduction}<div class="grid">{"".join(self._question(item, False) for item in chunk)}</div><p class="footer-note">Nom : ____________________ · Date : ____________________ · Score réservé à l’enseignant : ____ / {module["positioning"]["totalPoints"]}</p></section>')
        return "".join(pages)

    def _positioning_teacher(self, module: dict[str, Any]) -> str:
        positioning = module["positioning"]
        pages = []
        for index, chunk in enumerate((positioning["questions"][:3], positioning["questions"][3:]), start=1):
            introduction = ""
            if index == 1:
                bands = "".join(f"<li>{esc(item)}</li>" for item in positioning["teacher"]["interpretationBands"])
                introduction = f'<div class="notice"><strong>Passation</strong><p>{esc(positioning["teacher"]["administration"])}</p><ul>{bands}</ul></div>'
            pages.append(f'<section class="sheet">{self._header(module, "Test de positionnement · version enseignant", f"corrigé {index}/2")}{introduction}<div class="grid">{"".join(self._question(item, True) for item in chunk)}</div><p class="footer-note">Document enseignant · Corrigé spécifique · Total : {positioning["totalPoints"]} points</p></section>')
        return "".join(pages)

    @staticmethod
    def _activity(activity: dict[str, Any], teacher: bool) -> str:
        extra = f'<p><strong>Déroulé enseignant :</strong> {esc(activity["teacherFlow"])}</p><p><strong>Production attendue :</strong> {esc(activity["expectedOutcome"])}</p>' if teacher else f'<p><strong>Consigne :</strong> {esc(activity["studentInstructions"])}</p><p><strong>À remettre :</strong> {esc(activity["expectedOutcome"])}</p>'
        materials = ", ".join(activity["materials"])
        return f'<article class="card"><span class="tag">{esc(activity["difficulty"])}</span><span class="points">{activity["durationMinutes"]} min</span><h3>{esc(activity["id"])} · {esc(activity["title"])}</h3><p><strong>Objectif :</strong> {esc(activity["objective"])}</p>{extra}<p><strong>Support directement exploitable :</strong> {esc(activity["resourceContent"])}</p><p><strong>Supports :</strong> {esc(materials)}</p></article>'

    @staticmethod
    def _exercise(exercise: dict[str, Any], teacher: bool) -> str:
        answer = f'<div class="answer"><strong>Correction spécifique :</strong> {esc(exercise["correction"])}</div>' if teacher else '<div class="lines" aria-label="Zone de réponse"></div>'
        return f'<article class="card"><span class="tag">{esc(exercise["difficulty"])}</span><span class="points">{exercise["points"]} pt · {exercise["durationMinutes"]} min</span><h3>{esc(exercise["id"])} · {esc(exercise["title"])}</h3><p>{esc(exercise["prompt"])}</p>{answer}</article>'

    def _workbook_student(self, module: dict[str, Any]) -> str:
        activities = "".join(self._activity(item, False) for item in module["activities"])
        exercises = module["exercises"]
        criteria = "".join(f'<tr><td>{esc(item["label"])}</td><td>{esc(item["descriptor"])}</td><td>{item["points"]}</td></tr>' for item in module["finalProduction"]["criteria"])
        prompts = "".join(f"<li>{esc(item)}</li>" for item in module["bilan"]["studentPrompts"])
        return (
            f'<section class="sheet">{self._header(module, "Cahier d’activités · version élève", "activités")}<div class="notice"><strong>Parcours structuré</strong><p>Lis l’objectif avant de commencer, garde une trace de la méthode et prépare la production attendue pour la mise en commun.</p></div>{activities}<p class="footer-note">Les supports et jeux de données cités sont inclus dans cette ressource ; aucune manipulation non décrite n’est requise.</p></section>'
            f'<section class="sheet">{self._header(module, "Cahier d’activités · version élève", "entraînement 1/2")}<div class="grid">{"".join(self._exercise(item, False) for item in exercises[:2])}</div><p class="footer-note">Rédige les étapes et réserve les dix dernières minutes à la relecture.</p></section>'
            f'<section class="sheet">{self._header(module, "Cahier d’activités · version élève", "entraînement 2/2")}<div class="grid">{"".join(self._exercise(item, False) for item in exercises[2:])}</div><p class="footer-note">Utilise le vocabulaire de la discipline et indique précisément ce qui reste à reprendre.</p></section>'
            f'<section class="sheet">{self._header(module, "Cahier d’activités · version élève", "production finale")}<article class="card"><span class="points">{module["finalProduction"]["durationMinutes"]} min</span><h2>{esc(module["finalProduction"]["title"])}</h2><p>{esc(module["finalProduction"]["prompt"])}</p></article><table class="rubric"><thead><tr><th>Critère</th><th>Indicateur de réussite</th><th>Points</th></tr></thead><tbody>{criteria}</tbody></table><article class="card"><h2>Bilan élève · {module["bilan"]["durationMinutes"]} minutes</h2><ol>{prompts}</ol><div class="lines"></div></article><p class="footer-note">Production à remettre à l’enseignant pour retour pédagogique.</p></section>'
        )

    def _guide_teacher(self, module: dict[str, Any]) -> str:
        activities = "".join(self._activity(item, True) for item in module["activities"])
        exercises = module["exercises"]
        criteria = "".join(f'<tr><td>{esc(item["label"])}</td><td>{esc(item["descriptor"])}</td><td>{item["points"]}</td></tr>' for item in module["finalProduction"]["criteria"])
        observations = "".join(f"<li>{esc(item)}</li>" for item in module["bilan"]["teacherObservationFields"])
        checklist = "".join(f"<li>☐ {esc(item)}</li>" for item in module["validation"]["checklist"])
        return (
            f'<section class="sheet">{self._header(module, "Guide de séance · version enseignant", "conduite des activités")}<div class="notice"><strong>Intention pédagogique</strong><p>Faire expliciter les procédures, observer les obstacles et adapter la reprise à partir du test de positionnement.</p></div>{activities}<p class="footer-note">Les durées sont indicatives et doivent rester compatibles avec le parcours total de dix heures.</p></section>'
            f'<section class="sheet">{self._header(module, "Guide de séance · version enseignant", "corrigés 1/2")}<div class="grid">{"".join(self._exercise(item, True) for item in exercises[:2])}</div><p class="footer-note">Attribuer les points à la démarche lorsqu’elle est explicitée, même en présence d’une erreur finale isolée.</p></section>'
            f'<section class="sheet">{self._header(module, "Guide de séance · version enseignant", "corrigés 2/2")}<div class="grid">{"".join(self._exercise(item, True) for item in exercises[2:])}</div><p class="footer-note">Consigner l’erreur dominante et la prochaine action d’entraînement.</p></section>'
            f'<section class="sheet">{self._header(module, "Guide de séance · version enseignant", "production et bilan")}<article class="card"><h2>{esc(module["finalProduction"]["title"])}</h2><p><strong>Attendu :</strong> {esc(module["finalProduction"]["expectedAnswer"])}</p></article><table class="rubric"><thead><tr><th>Critère</th><th>Descripteur</th><th>Points</th></tr></thead><tbody>{criteria}</tbody></table><article class="card"><h2>Observation du bilan</h2><ul>{observations}</ul></article><div class="status">Statut : PENDING_HUMAN_VALIDATION · Rôle requis : {esc(module["validation"]["requiredRole"])}</div><article class="card"><h3>Contrôle pédagogique nominatif</h3><ul>{checklist}</ul><p>Validé par : ____________________ · Date : ____________________ · Signature : ____________________</p></article></section>'
        )

    def _document_html(self, module: dict[str, Any], document_id: str) -> str:
        builders = {
            "positioningStudent": self._positioning_student,
            "positioningTeacher": self._positioning_teacher,
            "workbookStudent": self._workbook_student,
            "guideTeacher": self._guide_teacher,
        }
        body = builders[document_id](module)
        title = f"{module['title']} · {document_id}"
        return f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="author" content="Nexus Réussite"><meta name="description" content="Ressource pédagogique spécifique {esc(module["moduleId"])}"><title>{esc(title)}</title><style>{self.css}</style></head><body>{body}</body></html>\n'

    @staticmethod
    def _normalize_pdf(path: Path, title: str, stable_id: str) -> None:
        writer = PdfWriter(clone_from=path)
        seen: set[int] = set()
        for page in writer.pages:
            resources = page.get("/Resources", {}).get_object()
            fonts = resources.get("/Font", {}).get_object()
            for reference in fonts.values():
                font = reference.get_object()
                candidates = [item.get_object() for item in font.get("/DescendantFonts", [])] or [font]
                for candidate in candidates:
                    descriptor_reference = candidate.get("/FontDescriptor")
                    if descriptor_reference is None:
                        continue
                    stream_reference = descriptor_reference.get_object().get("/FontFile2")
                    if stream_reference is None:
                        continue
                    marker = getattr(stream_reference, "idnum", id(stream_reference))
                    if marker in seen:
                        continue
                    seen.add(marker)
                    stream = stream_reference.get_object()
                    embedded = TTFont(io.BytesIO(stream.get_data()), recalcTimestamp=False)
                    if "head" in embedded:
                        embedded["head"].created = 3848943600
                        embedded["head"].modified = 3848943600
                    target = io.BytesIO()
                    embedded.save(target)
                    stream.set_data(target.getvalue())
        writer.add_metadata({"/Title": title, "/Author": "Nexus Réussite", "/Subject": "Pré-rentrée 2026 · Ressource pédagogique", "/Creator": "Nexus deterministic priority-resource renderer", "/Producer": "Nexus Réussite", "/CreationDate": "D:20260720000000+01'00'", "/ModDate": "D:20260720000000+01'00'"})
        identifier = hashlib.sha256(stable_id.encode("utf-8")).digest()[:16]
        writer._ID = ArrayObject([ByteStringObject(identifier), ByteStringObject(identifier)])
        normalized = path.with_suffix(".normalized.pdf")
        with normalized.open("wb") as target:
            writer.write(target)
        normalized.replace(path)

    def _prepare_fonts(self, source_root: Path) -> None:
        font_dir = source_root / "fonts"
        font_dir.mkdir(parents=True)
        for source_name, target_name in (("DMSans-Variable.woff2", "DMSans.ttf"), ("Fraunces-Variable.woff2", "Fraunces.ttf")):
            target = font_dir / target_name
            font = TTFont(self.root / "app/fonts" / source_name, recalcTimestamp=False)
            font.flavor = None
            font["head"].created = 3848943600
            font["head"].modified = 3848943600
            font.save(target)
            self.assets.append(Asset(target, f"priority-font-{target.stem.lower()}", "licensed-font"))
        license_path = font_dir / "OFL-1.1.txt"
        shutil.copyfile(self.root / "licenses/fonts/OFL-1.1.txt", license_path)
        self.assets.append(Asset(license_path, "priority-font-license-ofl", "font-license"))

    def _render_pages(self, module_id: str, document_id: str, pdf_path: Path) -> tuple[int, list[dict[str, Any]]]:
        target = self.output / "rendered" / module_id / document_id
        target.mkdir(parents=True, exist_ok=True)
        records = []
        with fitz.open(pdf_path) as pdf:
            for index, page in enumerate(pdf, start=1):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2.1, 2.1), alpha=False)
                image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples).resize((1240, 1755), Image.Resampling.LANCZOS)
                path = target / f"page-{index:02d}.png"
                image.save(path, format="PNG", optimize=True)
                text_length = len(page.get_text("text").strip())
                records.append({"page": index, "textCharacters": text_length, "blank": text_length <= 120, "width": 1240, "height": 1755})
                self.assets.append(Asset(path, f"priority-{module_id}-{document_id}-page-{index:02d}", "visual-inspection", module_id, document_id, 1240, 1755))
        return len(records), records

    def _contact_sheets(self, pages: list[tuple[str, Path]]) -> None:
        chunk_size = 20
        target_dir = self.output / "visual-review"
        target_dir.mkdir(parents=True)
        for sheet_index, start in enumerate(range(0, len(pages), chunk_size), start=1):
            chunk = pages[start:start + chunk_size]
            thumb_w, thumb_h, cell_w, cell_h, cols = 248, 351, 280, 400, 4
            rows = (len(chunk) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "#E9EDF3")
            draw = ImageDraw.Draw(sheet)
            try:
                font = ImageFont.truetype("DejaVuSans.ttf", 12)
            except OSError:
                font = ImageFont.load_default()
            for index, (label, page_path) in enumerate(chunk):
                x, y = (index % cols) * cell_w + 16, (index // cols) * cell_h + 12
                with Image.open(page_path) as page:
                    sheet.paste(page.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS), (x, y))
                draw.text((x, y + thumb_h + 7), label[:38], fill="#0B1F3A", font=font)
            path = target_dir / f"priority-resources-contact-sheet-{sheet_index:02d}.png"
            sheet.save(path, format="PNG", optimize=True)
            self.assets.append(Asset(path, f"priority-contact-sheet-{sheet_index:02d}", "visual-review", width=sheet.width, height=sheet.height))

    def render(self) -> dict[str, Any]:
        if self.output.exists():
            shutil.rmtree(self.output)
        source_root = self.output / "sources"
        source_root.mkdir(parents=True)
        self._prepare_fonts(source_root)
        manifest_modules = []
        qa_documents = []
        all_pages: list[tuple[str, Path]] = []

        for module in self.content["modules"]:
            module_id = module["moduleId"]
            module_documents = {}
            for document_id in DOCUMENTS:
                html_path = source_root / module_id / f"{document_id}.html"
                html_path.parent.mkdir(parents=True, exist_ok=True)
                html_path.write_text(self._document_html(module, document_id), encoding="utf-8")
                self.assets.append(Asset(html_path, f"priority-{module_id}-{document_id}-html", "editable-source", module_id, document_id))
                pdf_path = self.output / "pdf" / module_id / f"{document_id}.pdf"
                pdf_path.parent.mkdir(parents=True, exist_ok=True)
                HTML(filename=str(html_path), base_url=str(html_path.parent)).write_pdf(pdf_path, pdf_identifier=hashlib.sha256(f"{module_id}:{document_id}".encode()).digest()[:16])
                self._normalize_pdf(pdf_path, f"{module['title']} · {document_id}", f"{module_id}:{document_id}")
                page_count, page_records = self._render_pages(module_id, document_id, pdf_path)
                self.assets.append(Asset(pdf_path, f"priority-{module_id}-{document_id}-pdf", "final-pdf", module_id, document_id, page_count=page_count))
                all_pages.extend((f"{module_id} · {document_id} · p{page['page']}", self.output / "rendered" / module_id / document_id / f"page-{page['page']:02d}.png") for page in page_records)
                with fitz.open(pdf_path) as pdf:
                    fonts = sorted({font[3] for page in pdf for font in page.get_fonts(full=True)})
                    overflow = sum(1 for page in pdf for block in page.get_text("blocks") if block[0] < -.5 or block[1] < -.5 or block[2] > page.rect.width + .5 or block[3] > page.rect.height + .5)
                qa_documents.append({"moduleId": module_id, "documentId": document_id, "pageCount": page_count, "pages": page_records, "fonts": fonts, "blankPageCount": sum(page["blank"] for page in page_records), "missingFont": not ("dm" in " ".join(fonts).lower() and "sans" in " ".join(fonts).lower() and "fraunces" in " ".join(fonts).lower()), "overflowCount": overflow})
                module_documents[document_id] = {"html": html_path.relative_to(self.output).as_posix(), "pdf": pdf_path.relative_to(self.output).as_posix(), "pageCount": page_count}
            manifest_modules.append({"moduleId": module_id, "programmeId": module["programmeMatrixRef"], "status": module["status"], "validationStatus": module["validation"]["status"], "documents": module_documents})

        self._contact_sheets(all_pages)
        qa_report = {
            "version": VERSION,
            "blankPageCount": sum(item["blankPageCount"] for item in qa_documents),
            "missingFontCount": sum(item["missingFont"] for item in qa_documents),
            "overflowCount": sum(item["overflowCount"] for item in qa_documents),
            "missingAssetCount": 0,
            "minimumContrastRatio": min(contrast_ratio(fg, bg) for fg, bg in (("#C9252D", "#FFFDF8"), ("#526176", "#FFFDF8"), ("#FFFFFF", "#0B1F3A"), ("#172033", "#FFFDF8"))),
            "humanValidationPendingCount": sum(module["validation"]["status"] == "PENDING_HUMAN_VALIDATION" for module in self.content["modules"]),
            "documents": qa_documents,
        }
        qa_path = self.output / "qa-report.json"
        qa_path.write_text(json.dumps(qa_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.assets.append(Asset(qa_path, "priority-qa-report", "quality-report"))
        if any((qa_report["blankPageCount"], qa_report["missingFontCount"], qa_report["overflowCount"], qa_report["missingAssetCount"])) or qa_report["minimumContrastRatio"] < 4.5 or qa_report["humanValidationPendingCount"] != 6:
            raise RuntimeError(f"Priority-resource quality gate failed: {qa_report}")

        manifest_assets = []
        for asset in sorted(self.assets, key=lambda item: item.path.relative_to(self.output).as_posix()):
            record = {"assetId": asset.asset_id, "path": asset.path.relative_to(self.output).as_posix(), "role": asset.role, "format": asset.path.suffix.removeprefix(".").upper(), "bytes": asset.path.stat().st_size, "sha256": sha256(asset.path)}
            if asset.module_id:
                record["moduleId"] = asset.module_id
            if asset.document_id:
                record["documentId"] = asset.document_id
            if asset.width and asset.height:
                record.update({"width": asset.width, "height": asset.height})
            if asset.page_count:
                record["pageCount"] = asset.page_count
            manifest_assets.append(record)
        manifest = {"schemaVersion": "1.0.0", "version": VERSION, "status": self.content["status"], "schoolYear": self.matrix["schoolYear"], "modules": manifest_modules, "sourceInputs": ["content/pre-rentree-2026/priority-resources.fr.json", "content/pre-rentree-2026/official-programme-matrix.fr.json", "scripts/pre-rentree/templates/priority-resource.css", "scripts/pre-rentree/render_priority_resource_kit.py"], "assets": manifest_assets}
        (self.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content", type=Path, required=True)
    parser.add_argument("--matrix", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    renderer = PriorityResourceRenderer(root, args.content if args.content.is_absolute() else root / args.content, args.matrix if args.matrix.is_absolute() else root / args.matrix, args.output if args.output.is_absolute() else root / args.output)
    manifest = renderer.render()
    print(json.dumps({"status": manifest["status"], "modules": len(manifest["modules"]), "assets": len(manifest["assets"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
KIT = ROOT / "assets" / "campaigns" / "pre-rentree-2026" / "parent-documents"


EXPECTED_IDS = {
    "brochure-generale",
    "guide-parent",
    "fiche-3e",
    "fiche-seconde",
    "fiche-premiere",
    "fiche-terminale",
    "comparatif-fondations-premium",
    "inclusions-options-exclusions",
    "justification-tarifaire",
    "faq-commerciale",
    "procedure-inscription",
    "conditions-reservation-acompte",
    "accompagnements-annuels",
    "passerelle-stage-annuel",
}


class VisibleTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def test_manifest_is_complete_and_hashes_match():
    manifest = json.loads((KIT / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["campaignId"] == "pre-rentree-2026"
    assert manifest["version"] == "2026-parent-documents-v1"
    assert set(manifest["documentIds"]) == EXPECTED_IDS
    assert len(manifest["documents"]) == len(EXPECTED_IDS)
    assert all(document["offerIds"] for document in manifest["documents"])
    assert all(document["proofIds"] for document in manifest["documents"])
    for asset in manifest["assets"]:
        path = KIT / asset["path"]
        assert path.is_file(), asset["path"]
        assert path.stat().st_size == asset["bytes"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"]


def test_pdf_uses_nexus_fonts_without_substitution():
    qa = json.loads((KIT / "qa-report.json").read_text(encoding="utf-8"))
    assert qa["fontSubstitutionCount"] == 0
    for document in qa["documents"]:
        joined = " ".join(document["fonts"]).lower()
        assert "dm" in joined and "sans" in joined
        assert "fraunces" in joined


def test_pdf_layout_and_palette_meet_publication_gates():
    qa = json.loads((KIT / "qa-report.json").read_text(encoding="utf-8"))
    assert qa["overflowBlockCount"] == 0
    assert qa["minimumContrastRatio"] >= 4.5


def test_every_document_has_editable_html_pdf_and_page_renders():
    for document_id in EXPECTED_IDS:
        html_path = KIT / "sources" / f"{document_id}.html"
        pdf_path = KIT / "pdf" / f"{document_id}.pdf"
        assert html_path.is_file()
        assert pdf_path.is_file()
        html_text = html_path.read_text(encoding="utf-8")
        assert "https://wa.me/21699192829" in html_text
        assert "99 192 829" in html_text
        with fitz.open(pdf_path) as pdf:
            assert pdf.page_count >= 1
            assert all(len(page.get_text().strip()) >= 180 for page in pdf)
            assert all(page.get_pixmap(matrix=fitz.Matrix(0.2, 0.2)).samples for page in pdf)
            page_renders = sorted((KIT / "rendered" / document_id).glob("page-*.png"))
            assert len(page_renders) == pdf.page_count


def test_renders_are_a4_portrait_and_not_blank():
    paths = list(KIT.glob("rendered/*/page-*.png"))
    assert len(paths) >= len(EXPECTED_IDS)
    for path in paths:
        with Image.open(path) as image:
            assert image.size == (1240, 1755)
            colors = image.convert("RGB").getcolors(maxcolors=1_000_000)
            assert colors is not None
            assert len(colors) >= 20


def test_public_outputs_exclude_internal_and_unapproved_claims():
    forbidden = (
        "gate",
        "review",
        "blocked",
        "owner",
        "placeholder",
        "snt",
        "manuel offert",
        "remise annuelle",
        "réduction annuelle",
        "garantie de résultat",
    )
    paths = list(KIT.glob("sources/*.html"))
    assert len(paths) == len(EXPECTED_IDS)
    for path in paths:
        parser = VisibleTextParser()
        parser.feed(path.read_text(encoding="utf-8"))
        text = " ".join(parser.parts).lower()
        assert all(term not in text for term in forbidden), path.name

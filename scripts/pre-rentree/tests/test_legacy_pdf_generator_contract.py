import importlib.util
import json
from pathlib import Path

import fitz


REPO_ROOT = Path(__file__).resolve().parents[3]
GENERATOR_PATH = REPO_ROOT / "tools/pdf-generator/generate_all_pdfs.py"
PRICING_PATH = REPO_ROOT / "data/pricing.canonical.json"
DOCUMENTS_FINAL = REPO_ROOT / "assets/campaigns/pre-rentree-2026/documents-final"
PUBLIC_DOCUMENTS = REPO_ROOT / "public/documents/pre-rentree-2026"


def load_generator():
    spec = importlib.util.spec_from_file_location("legacy_pdf_generator", GENERATOR_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_tariff_pdf_rows_are_derived_from_canonical_pricing():
    generator = load_generator()
    pricing = json.loads(PRICING_PATH.read_text(encoding="utf-8"))
    html = generator.make_tarifs_body()

    for pack in pricing["pre_rentree_packs"]:
        values = (
            pack["price_per_student"],
            pack["payment"]["deposit"],
            pack["payment"]["solde"],
        )
        assert pack["payment"]["deposit"] + pack["payment"]["solde"] == pack["price_per_student"]
        assert all(f"{value:,}".replace(",", "&#8239;") in html for value in values)


def test_legacy_pdf_bodies_exclude_unapproved_public_claims_and_seconde_snt():
    generator = load_generator()
    bodies = [
        generator.make_programme_body("Seconde", generator.PROGRAMMES["Seconde"]),
        generator.make_planning_body(),
        generator.make_tarifs_body(),
        generator.make_dossier_accueil_body(),
    ]
    public_text = "\n".join(bodies).casefold()

    assert "snt" not in public_text
    assert "bilan écrit remis aux parents" not in public_text
    assert "bilan individualisé écrit remis aux parents" not in public_text
    assert "enseignants certifiés" not in public_text
    assert "enseignants agrégés" not in public_text
    assert "bilan écrit" not in public_text


def test_capacity_labels_match_foundations_and_premium_contracts():
    generator = load_generator()
    planning = generator.make_planning_body()

    assert "Fondations (3e et Seconde) : 4 à 6 élèves, maximum 6" in planning
    assert "Premium (Première et Terminale) : 3 à 5 élèves, maximum 5" in planning


def test_math_programmes_are_rendered_from_canonical_review_modules():
    generator = load_generator()
    seconde = generator.make_programme_body("Seconde", generator.PROGRAMMES["Seconde"])
    premiere = generator.make_programme_body("Première", generator.PROGRAMMES["Première"])

    assert "PROPOSITION — MODULE À VALIDER PAR LA DIRECTION PÉDAGOGIQUE" in seconde
    assert "Série continue regroupée en classes" in seconde
    assert "probabilités conditionnelles" in seconde
    assert "PROPOSITION — MODULE À VALIDER PAR LA DIRECTION PÉDAGOGIQUE" in premiere
    assert "épreuve terminale anticipée de mathématiques" in premiere
    assert "fonctions sinus et cosinus" not in premiere.casefold()


def test_final_pdf_exports_match_the_active_generator_contract():
    text_by_name = {}
    for path in DOCUMENTS_FINAL.glob("*.pdf"):
        with fitz.open(path) as document:
            text_by_name[path.name] = "\n".join(page.get_text() for page in document)

    combined = "\n".join(text_by_name.values()).casefold()
    assert "snt" not in combined
    assert "initiation informatique" not in combined
    assert "enseignants certifiés" not in combined
    assert "enseignants agrégés" not in combined
    assert "bilan écrit" not in combined
    assert "fondations : 4 à 6 élèves" in combined
    assert "premium : 3 à 5 élèves" in combined
    assert "proposition — module à valider par la direction pédagogique" in (
        text_by_name["NexusReussite_PreRentree2026_Programme_Seconde.pdf"].casefold()
    )
    assert all(
        "document de revue — non contractuel" in text.casefold()
        or "_draft.pdf" in name.casefold()
        for name, text in text_by_name.items()
    )


def test_every_final_pdf_has_complete_review_renders_and_contact_sheet():
    for path in DOCUMENTS_FINAL.glob("*.pdf"):
        with fitz.open(path) as document:
            expected_pages = document.page_count
        rendered = sorted(
            (DOCUMENTS_FINAL / "rendered" / path.stem).glob("page-*.png")
        )
        assert len(rendered) == expected_pages, path.name
        assert all(item.stat().st_size > 10_000 for item in rendered)

    contact_sheet = (
        DOCUMENTS_FINAL
        / "visual-review"
        / "documents-final-contact-sheet.png"
    )
    assert contact_sheet.stat().st_size > 10_000


def test_tariff_pdf_has_no_orphan_page():
    with fitz.open(DOCUMENTS_FINAL / "NexusReussite_PreRentree2026_Tarifs.pdf") as document:
        assert document.page_count == 1


def test_public_download_copies_and_weight_manifest_match_final_pdfs():
    manifest = json.loads(
        (DOCUMENTS_FINAL / "manifest.json").read_text(encoding="utf-8")
    )
    public_records = [
        item for item in manifest["documents"]
        if item["publicDownloadCandidate"]
    ]
    assert len(public_records) == 6
    for item in public_records:
        final_path = DOCUMENTS_FINAL / item["fileName"]
        public_path = PUBLIC_DOCUMENTS / item["fileName"]
        assert public_path.read_bytes() == final_path.read_bytes()
        assert item["bytes"] == final_path.stat().st_size
        assert item["sizeLabel"] == f'{final_path.stat().st_size // 1024} Ko'

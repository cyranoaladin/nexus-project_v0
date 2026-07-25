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


def test_legacy_pdf_bodies_scope_r2_snt_module_and_r4_teacher_statut():
    """R2 (décision direction 2026-07-23) a restauré le module informatique de Seconde
    (SNT/NSI) — décision SUPERSEDED le 2026-07-24 par la nouvelle grille fenêtres +
    week-end : Seconde n'offre plus que Maths + Français (aucune séance NSI/SNT/PC),
    conformément à la matrice niveaux/matières explicitement redéfinie et au retrait du
    module `seconde-informatique-snt` de modules.json (14 modules, cf. SEPARATION_STAGES_ANNUEL.md).
    R4 (décision direction 2026-07-23) : la mention de STATUT collectif
    (« enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice »)
    est autorisée sur les supports COMMERCIAUX (Tarifs) uniquement ; elle ne nomme
    personne, distincte de l'anonymat nominatif (noms toujours interdits en public).
    Les composantes gated (bilan écrit remis aux parents) restent hors contrat public."""
    generator = load_generator()
    programme = generator.make_programme_body("Seconde", generator.PROGRAMMES["Seconde"])
    planning = generator.make_planning_body()
    tarifs = generator.make_tarifs_body()
    dossier = generator.make_dossier_accueil_body()

    # R2 superseded (2026-07-24) — Seconde n'a plus de module informatique/SNT.
    # (note : pas de recherche de sous-chaîne "nsi" ici, elle matcherait le mot
    # français courant "ainsi" et donnerait un faux positif)
    assert "snt" not in programme.casefold()

    # R4 — la mention de statut est portée par le support commercial (Tarifs) uniquement.
    assert generator.ENSEIGNANT_STATUT_COMMERCIAL in tarifs
    for non_commercial in (programme, planning, dossier):
        assert "enseignants certifiés" not in non_commercial.casefold()
        assert "enseignants agrégés" not in non_commercial.casefold()
    # Le planning (non commercial) garde la formulation prudente publiée.
    assert "enseignants expérimentés" in planning.casefold()

    # Les composantes gated (bilan écrit remis aux parents) restent hors contrat public.
    for body in (programme, planning, tarifs, dossier):
        assert "bilan écrit remis aux parents" not in body.casefold()
        assert "bilan individualisé écrit remis aux parents" not in body.casefold()
        assert "bilan écrit" not in body.casefold()


def test_capacity_labels_match_foundations_and_premium_contracts():
    generator = load_generator()
    planning = generator.make_planning_body()

    assert "Fondations (3e et Seconde) : 3 à 6 élèves, maximum 6" in planning
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


def test_troisieme_programme_pdf_exists_and_is_rendered_from_canonical_modules():
    """Toutes les matières 3e (Mathématiques, Français) doivent avoir un programme
    détaillé exportable au même titre que Seconde/Première/Terminale — un niveau
    entièrement vendu et planifié ne peut pas être privé de son PDF programme."""
    generator = load_generator()
    assert "3e" in generator.PROGRAMMES
    troisieme = generator.make_programme_body("3e", generator.PROGRAMMES["3e"])

    assert "Mathématiques" in troisieme
    assert "Français" in troisieme
    assert "Méthodologie DNB et sujet d'entraînement" in troisieme
    # Les deux modules 3e portent PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION (homogénéisation
    # des statuts, 2026-07-25) : le bandeau de validation doit apparaître.
    assert "PROPOSITION — MODULE À VALIDER PAR LA DIRECTION PÉDAGOGIQUE" in troisieme


def test_final_pdf_exports_match_the_active_generator_contract():
    text_by_name = {}
    for path in DOCUMENTS_FINAL.glob("*.pdf"):
        with fitz.open(path) as document:
            text_by_name[path.name] = "\n".join(page.get_text() for page in document)

    combined = "\n".join(text_by_name.values()).casefold()
    assert "bilan écrit" not in combined

    # R2 superseded (2026-07-24) — Seconde n'offre plus que Maths + Français (nouvelle grille
    # fenêtres + week-end) ; le module informatique/SNT a été retiré de modules.json.
    assert "snt" not in text_by_name["NexusReussite_PreRentree2026_Programme_Seconde.pdf"].casefold()

    # R4 (2026-07-23) — la mention de statut collectif est portée par le support commercial (Tarifs)
    # uniquement ; elle ne doit pas fuiter sur les documents non commerciaux (planning, dossier, programmes).
    tarifs_text = text_by_name["NexusReussite_PreRentree2026_Tarifs.pdf"].casefold()
    assert "enseignants certifiés" in tarifs_text or "enseignants agrégés" in tarifs_text
    for name, text in text_by_name.items():
        if name == "NexusReussite_PreRentree2026_Tarifs.pdf":
            continue
        assert "enseignants certifiés" not in text.casefold()
        assert "enseignants agrégés" not in text.casefold()
    assert "fondations : 3 à 6 élèves" in combined
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
    assert len(public_records) == 7
    for item in public_records:
        final_path = DOCUMENTS_FINAL / item["fileName"]
        public_path = PUBLIC_DOCUMENTS / item["fileName"]
        assert public_path.read_bytes() == final_path.read_bytes()
        assert item["bytes"] == final_path.stat().st_size
        assert item["sizeLabel"] == f'{final_path.stat().st_size // 1024} Ko'

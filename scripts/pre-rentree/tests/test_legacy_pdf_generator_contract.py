import importlib.util
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
GENERATOR_PATH = REPO_ROOT / "tools/pdf-generator/generate_all_pdfs.py"
PRICING_PATH = REPO_ROOT / "data/pricing.canonical.json"


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


def test_capacity_labels_match_foundations_and_premium_contracts():
    generator = load_generator()
    planning = generator.make_planning_body()

    assert "Fondations (3e et Seconde) : 4 à 6 élèves, maximum 6" in planning
    assert "Premium (Première et Terminale) : 3 à 5 élèves, maximum 5" in planning

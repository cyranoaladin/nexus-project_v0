"""Les questions HG de Terminale se lisent sans documents externes manquants."""
import json
import re
import subprocess
import unicodedata
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
HG = ROOT / "instruments/TC-HG"
VARIANTES = {
    "HG-T-DOC-11": "HG-T-DOC-01", "HG-T-DOC-12": "HG-T-DOC-02",
    "HG-T-DOC-13": "HG-T-DOC-03", "HG-T-DOC-14": "HG-T-DOC-04",
    "HG-T-CART-13": "HG-T-CART-03",
}
POSITIONS = {10: "HG-T-DOC-11", 11: "HG-T-DOC-12", 12: "HG-T-DOC-13",
             13: "HG-T-DOC-14", 16: "HG-T-CART-13"}
RENVOI_VISUEL = re.compile(
    r"cette carte|cette affiche|sur un fond de carte|"
    r"à partir de la légende d['’]une carte|analysez une affiche", re.I)
SELECTIONS_HORS_TLE = {
    "1RE": "2-HIST-01 2-GEO-01 2-CART-01 1-HIST-01 1-HIST-02 1-HIST-03 "
           "1-GEO-01 1-GEO-02 1-GEO-03 1-DOC-01 1-DOC-02 1-DOC-03 1-DOC-04 "
           "1-CART-01 1-CART-02 1-CART-03 1-PROB-01 1-PROB-02",
    "ETENDUE": "2-HIST-01 2-GEO-01 2-CART-01 1-HIST-01 1-HIST-02 T-HIST-01 "
               "T-HIST-02 1-GEO-01 1-GEO-02 T-GEO-01 T-GEO-02 1-DOC-01 1-DOC-03 "
               "T-DOC-01 T-DOC-03 T-DOC-04 1-CART-01 1-CART-02 T-CART-01 "
               "T-CART-02 T-CART-03 T-PROB-03 1-PROB-02",
}


def banque():
    return {it["item_id"]: it for it in json.loads((HG / "banque.json").read_text())["items"]}


def selection(version):
    asm = json.loads((HG / "assemblages" / f"{version}.json").read_text())
    return [iid for bloc in asm["blocs"] for iid in bloc["items"]]


def normaliser(texte):
    texte = unicodedata.normalize("NFKC", texte).replace("’", "'").replace("‐", "-")
    texte = re.sub(r"[-\u00ad]\s*\n\s*", "", texte)
    return re.sub(r"\s+", " ", texte.replace("*", "")).strip()


def renvois_sans_document(items):
    # Le fallback retenu est exclusivement textuel : aucune image historique implicite.
    return [it["item_id"] for it in items if RENVOI_VISUEL.search(it["enonce"])]


def test_tle_selectionne_uniquement_les_cinq_variantes_aux_bonnes_positions():
    ids = selection("TLE")
    assert len(ids) == 18
    assert {n: ids[n - 1] for n in POSITIONS} == POSITIONS
    assert not set(ids) & set(VARIANTES.values())


def test_aucun_renvoi_visuel_sans_document_dans_les_questions_tle():
    items = banque()
    assert renvois_sans_document([items[i] for i in selection("TLE")]) == []


@pytest.mark.parametrize("enonce", ["Relevez sur cette carte les ports.",
    "Analysez cette affiche.", "Sur un fond de carte, placez deux ports.",
    "À partir de la légende d'une carte, identifiez l'unité.",
    "Analysez une affiche de propagande soviétique."])
def test_contre_epreuve_detecte_un_support_manquant(enonce):
    assert renvois_sans_document([{"item_id": "ESSAI", "enonce": enonce,
                                   "supports": []}]) == ["ESSAI"]


@pytest.mark.parametrize("nouveau,ancien", VARIANTES.items())
def test_variantes_preservent_competence_et_bareme(nouveau, ancien):
    items = banque()
    assert nouveau in items, f"Variante autonome absente : {nouveau}"
    for champ in ("competence", "palier", "type", "score_max", "duree_min"):
        assert items[nouveau][champ] == items[ancien][champ], champ
    assert items[nouveau]["enonce"] != items[ancien]["enonce"]
    assert items[nouveau]["cle"] != items[ancien]["cle"]
    if "DOC" in nouveau:
        assert "Document pédagogique Nexus" in items[nouveau]["enonce"]


@pytest.mark.parametrize("version", SELECTIONS_HORS_TLE)
def test_premiere_et_cycle_complet_gardent_leur_selection(version):
    assert selection(version) == ["HG-" + i for i in SELECTIONS_HORS_TLE[version].split()]


@pytest.mark.parametrize("collection", ["01_LIVRETS_CANDIDAT", "02_CORRECTIONS_COACH"])
def test_pdf_canonique_contient_les_documents_et_les_dix_huit_questions(collection):
    pdf = ROOT / "release/diagnostics-v2" / collection / "PROFIL_B_DEUXIEME_PARTIE" / \
        "02_EVALUATIONS_PONCTUELLES/HISTOIRE-GEOGRAPHIE.pdf"
    assert pdf.is_file(), f"HG Profil B non construit : {pdf}"
    texte = normaliser(subprocess.run(["pdftotext", "-layout", str(pdf), "-"],
                                     check=True, capture_output=True, text=True).stdout)
    assert {int(n) for n in re.findall(r"Question\s+(\d+)\b", texte)} == set(range(1, 19))
    assert not RENVOI_VISUEL.search(texte)
    items = banque()
    mots_pdf = re.sub(r"\W+", " ", texte)
    for iid in selection("TLE"):
        assert re.sub(r"\W+", " ", normaliser(items[iid]["enonce"])) in mots_pdf, iid
    for iid in VARIANTES:
        assert iid in items, f"Variante autonome absente : {iid}"
        assert iid in texte
        assert normaliser(items[iid]["enonce"])[:120] in texte
    if collection == "02_CORRECTIONS_COACH":
        assert "composition pyramidale" not in texte
        for iid in VARIANTES:
            attendu = normaliser(items[iid]["cle"]["reponse_2pts"])
            assert re.sub(r"\W+", " ", attendu) in mots_pdf, iid

"""La règle de calculatrice d'un livret est une seule règle, dérivée de la banque.

Le cahier (§ 7.6, § 7.7) réserve la calculatrice au bloc C des spécialités scientifiques.
La banque le dit dans l'énoncé du bloc : « La calculatrice est autorisée pour cette
partie. » La couverture et l'encadré « Avant de commencer » dérivent leur consigne de ce
marqueur ; aucun livret ne peut dire « sans calculatrice » puis l'autoriser en Partie 3.
"""
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import livret as LI  # noqa: E402

RELEASE = ROOT / "release" / "diagnostics-v2"
SANS = "ce diagnostic se traite sans calculatrice"
AUTORISEE = "calculatrice est autorisée pour cette partie"
ENCADRE_P2 = "Calculatrice interdite pour les Parties 1, 2 et 4 ; autorisée uniquement pour la Partie 3."


def plat(pdf):
    fitz = pytest.importorskip("fitz")
    with fitz.open(pdf) as d:
        # Une césure de fin de ligne s'extrait « Calcu‐ latrice » : on la referme.
        pages = [re.sub(r"\u2010\s+", "", " ".join(p.get_text().split())) for p in d]
    return " ".join(pages), pages


def test_regle_derivee_des_numeros_de_parties():
    assert LI.regle_calculatrice([3], [1, 2, 3, 4]) == ("Partie 3 uniquement", ENCADRE_P2)
    assert LI.regle_calculatrice([], [1, 2, 3]) is None
    assert LI.regle_calculatrice([2], [1, 2]) == (
        "Partie 2 uniquement", "Calculatrice interdite pour la Partie 1 ; autorisée uniquement pour la Partie 2.")


def test_le_marqueur_de_banque_est_reserve_au_bloc_c():
    import json
    for code in ("EDS-MATH", "EDS-PC"):
        banque = json.loads((ROOT / "instruments" / code / "banque.json").read_text(encoding="utf-8"))
        blocs = {it["bloc"] for it in banque["items"] if LI.CALCULATRICE_AUTORISEE in it.get("enonce", "")}
        assert blocs == {"C"}, code


@pytest.mark.parametrize("matiere,profil,versions,coach,cartouche,phrase", [
    ("MATHEMATIQUES", "P2", [("EDS-MATH", "NT")], False, "Partie 3 uniquement", ENCADRE_P2),
    ("MATHEMATIQUES", "P2", [("EDS-MATH", "NT")], True, "Partie 3 uniquement", None),
    ("SPE-PHYSIQUE-CHIMIE", "P2", [("EDS-PC", "NT")], False, "Partie 3 uniquement", ENCADRE_P2),
    ("MATHEMATIQUES", "P1", [("MATH-EA", "SPECIFIQUES")], False, "Interdite", "Calculatrice interdite à l'épreuve."),
])
def test_source_du_livret_porte_une_seule_regle(monkeypatch, tmp_path, matiere, profil, versions,
                                                coach, cartouche, phrase):
    monkeypatch.setattr(LI, "rendre", lambda doc, *_: doc)
    doc = LI.composer(matiere, profil, versions, tmp_path / "l.pdf", coach=coach)
    assert rf"\cartouche{{Calculatrice}}{{{cartouche}}}" in doc
    if phrase:
        # `tex()` pose une espace insécable devant « ; » : on vérifie chaque moitié.
        for moitie in phrase.split(" ; "):
            assert moitie in doc, moitie
    assert not (SANS in doc and LI.CALCULATRICE_AUTORISEE in doc)
    assert "Selon le sujet" not in doc


def release_pdfs():
    if not (RELEASE / "01_LIVRETS_CANDIDAT").exists():
        return []
    return sorted(p for p in RELEASE.rglob("*.pdf") if "03_IMPRESSION" not in str(p))


@pytest.mark.parametrize("pdf", release_pdfs(), ids=lambda p: str(p.relative_to(RELEASE)))
def test_aucun_livret_de_la_release_ne_porte_les_deux_mentions(pdf):
    texte, _ = plat(pdf)
    assert not (SANS in texte and AUTORISEE in texte), pdf.name
    if AUTORISEE in texte:
        assert "CALCULATRICE Selon le sujet" not in texte, pdf.name
        assert re.search(r"CALCULATRICE Parties? [\d, et]+ uniquement", texte), pdf.name


def test_livret_mathematiques_profil_b_candidat_et_coach():
    cand = RELEASE / "01_LIVRETS_CANDIDAT/PROFIL_B_DEUXIEME_PARTIE/04_SPECIALITES/MATHEMATIQUES_AVEC_SPECIALITE.pdf"
    coach = RELEASE / "02_CORRECTIONS_COACH/PROFIL_B_DEUXIEME_PARTIE/04_SPECIALITES/MATHEMATIQUES_AVEC_SPECIALITE.pdf"
    if not cand.exists():
        pytest.skip("release v2 non construite")
    texte, pages = plat(cand)
    assert "CALCULATRICE Partie 3 uniquement" in pages[0]
    assert "DURÉE DU DIAGNOSTIC 1 h 30" in pages[0]
    # XeLaTeX pose l'espace fine avant « ; » comme un crénage : elle n'est pas extraite.
    attendu = ("Calculatrice : l’autorisation dépend du sujet de l’épreuve. "
               + ENCADRE_P2.replace("'", "’").replace(" ;", ";"))
    assert attendu in pages[1]
    assert SANS not in texte
    # Le bandeau d'une partie s'extrait « N Partie N Titre » ; la couverture, elle, dit
    # « Partie 3 uniquement » et ne doit pas servir de point de coupe.
    partie3 = re.split(r"\b3 Partie 3 ", texte, 1)[1].split(" 4 Partie 4 ", 1)[0]
    assert AUTORISEE in partie3 and texte.count(AUTORISEE) == 1
    texte_coach, pages_coach = plat(coach)
    assert "CALCULATRICE Partie 3 uniquement" in pages_coach[0]
    assert texte_coach.count(AUTORISEE) == 1

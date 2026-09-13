"""Le dossier d'entrée nominatif rappelle la situation connue au lieu de la redemander.

Il est recomposé depuis la source des formulaires, dans exports_candidats/ seulement ;
le PDF canonique de la release reste intact. Les noms employés ici sont fictifs.
"""
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

import pytest

fitz = pytest.importorskip("fitz")
RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import livret as LI  # noqa: E402
import pack_candidat as PC  # noqa: E402

RELEASE = RACINE / "release" / "diagnostics-v2"
EXPORTS = RACINE / "exports_candidats"
CANONIQUE = RELEASE / "01_LIVRETS_CANDIDAT/PROFIL_B_DEUXIEME_PARTIE/00_DOSSIER_ENTREE/DOSSIER_D_ENTREE_NEXUS.pdf"
NAME = "Camille EXEMPLE"
FACTS = dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"],
             spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none",
             candidat_id="TEST-DOSSIER-ENTREE")
CONNUES = ["QP-01", "QP-02", "QP-06", "QP-07", "QP-09", "QP-19", "QP-31"]
EXCLUES = [f"QP-{n}" for n in range(20, 31)]
CONSERVEES = [f"QP-{n:02d}" for n in (3, 4, 5, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18)] + \
    [f"MET-{n:02d}" for n in range(1, 13)]


def formulaires():
    return [(c, json.loads((RACINE / "instruments" / c / "formulaire.json").read_text(encoding="utf-8")))
            for c in ("QP", "MET")]


def situation():
    qp = PC.build_candidate_facts(**FACTS)
    return PC.situation_connue(qp, NAME)


def normaliser(texte):
    """Texte extrait, sans les césures de fin de ligne ni le trait d'union typographique."""
    texte = re.sub(r"[-\u2010\u00ad]\s*\n\s*", "", texte).replace("\u2010", "-")
    return " ".join(texte.split())


def texte(pdf):
    with fitz.open(pdf) as d:
        pages = [normaliser(p.get_text()) for p in d]
        return " ".join(pages), pages


@pytest.fixture(scope="module")
def dossier():
    if not CANONIQUE.exists():
        pytest.skip("release v2 non construite")
    avant = hashlib.sha256(CANONIQUE.read_bytes()).hexdigest()
    EXPORTS.mkdir(exist_ok=True)  # un clone propre n'a pas de zone d'export
    with tempfile.TemporaryDirectory(prefix="test-dossier-entree-", dir=EXPORTS) as t:
        cible = Path(t) / "DOSSIER_D_ENTREE_NEXUS.pdf"
        LI.formulaire_entree("P2", cible, situation=situation())
        yield cible
    assert hashlib.sha256(CANONIQUE.read_bytes()).hexdigest() == avant


def test_plan_pour_un_p2_standard():
    plan = LI.plan_formulaire_entree(formulaires(), situation())
    assert sorted(plan["mentions"]) == CONNUES
    assert plan["exclues"] == EXCLUES
    assert plan["total"] == 43 and plan["posees"] == 25
    assert plan["duree_min"] == 25
    assert dict(plan["encadre"]) == {
        "Profil": "Deuxième partie du baccalauréat", "Session": "2027",
        "Spécialités présentées en Terminale": "Mathématiques, Numérique et sciences informatiques",
        "Spécialité non poursuivie après la Première": "Physique-chimie",
        "Épreuves anticipées de français": "déjà présentées",
        "Mode des évaluations ponctuelles": "annuel"}
    assert plan["mentions"]["QP-09"] == "Physique-chimie."
    assert "Session 2027" in plan["mentions"]["QP-02"]
    assert "ne vous concerne pas" in plan["mentions"]["QP-19"]


def test_bac_en_une_session_garde_la_section_d_eligibilite():
    sit = {**situation(), "profil": "P3", "mode_passation_ea": "meme_session", "eaf": "les_deux"}
    plan = LI.plan_formulaire_entree(formulaires(), sit)
    assert plan["exclues"] == []
    assert plan["posees"] == 43 - len(CONNUES)
    assert "même" in plan["mentions"]["QP-19"].lower()
    assert dict(plan["encadre"])["Épreuves anticipées de français"] == "l'écrit et l'oral"


def test_encadre_situation_et_mentions_dans_le_pdf(dossier):
    plat, pages = texte(dossier)
    assert "Situation déjà enregistrée par Nexus" in pages[1]
    for ligne in ("Profil : Deuxième partie du baccalauréat", "Session : 2027",
                  "Spécialités présentées en Terminale : Mathématiques, Numérique et sciences informatiques",
                  "Spécialité non poursuivie après la Première : Physique-chimie",
                  "Épreuves anticipées de français : déjà présentées",
                  "Mode des évaluations ponctuelles : annuel"):
        assert ligne in pages[1], ligne
    assert plat.count("Information déjà enregistrée") == len(CONNUES)
    for iid in CONNUES:
        assert re.search(rf"{iid} .*?Information déjà enregistrée", plat), iid


def test_questions_sans_objet_absentes_et_utiles_conservees(dossier):
    plat, _ = texte(dossier)
    ids = re.findall(r"Question (\d+) (QP-\d+|MET-\d+)", plat)
    assert [int(n) for n, _ in ids] == list(range(1, 33)), "numérotation continue"
    presents = [i for _, i in ids]
    assert set(presents) == set(CONNUES) | set(CONSERVEES)
    assert not set(presents) & set(EXCLUES)
    assert "Passage de toutes les épreuves à la même session" not in plat
    assert "specialites" not in plat, "la répétition générique est instanciée"
    assert plat.count("Mathématiques Je l’ai suivie en classe") == 1
    assert "Numérique et sciences informatiques : Fragile" in plat


def test_couverture_nominative_et_duree_recalculee(dossier):
    _, pages = texte(dossier)
    cover = pages[0]
    for attendu in (NAME, "SESSION FINALE 2027", "DURÉE DU DIAGNOSTIC 25 min",
                    "NATURE DU DOCUMENT Questionnaire Nexus", "CALCULATRICE Non nécessaire",
                    "MATÉRIEL Aucun", "CANDIDAT :"):
        assert attendu in cover, attendu
    for absent in ("RÉFÉRENCE CANDIDAT", "selon le dossier", "ÉPREUVE OFFICIELLE", "40 min"):
        assert absent not in cover, absent
    assert "Ne recopiez pas vos coordonnées personnelles" in pages[1]
    assert "Aucun nom" not in pages[1]


def test_charte_graphique_identique_au_canonique(dossier):
    def empreinte(pdf):
        with fitz.open(pdf) as d:
            polices = {f[3].split("+")[-1] for p in d for f in p.get_fonts()}
            return d[0].rect, polices, len(d[0].get_images()), d[0].get_text("dict")["blocks"][0]["bbox"]
    assert empreinte(dossier) == empreinte(CANONIQUE)


def test_export_nominatif_utilise_le_dossier_recompose():
    if not CANONIQUE.exists():
        pytest.skip("release v2 non construite")
    EXPORTS.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="test-dossier-entree-", dir=EXPORTS) as t:
        out = PC.create_candidate_pack(**FACTS, candidat_nom=NAME, output_dir=Path(t))
        plat, pages = texte(out / "A_ENVOYER/livrets/DOSSIER_D_ENTREE_NEXUS.pdf")
        assert "Situation déjà enregistrée par Nexus" in plat and NAME in pages[0]
        with fitz.open(out / "OPTION_IMPRESSION/PACK_IMPRESSION_CANDIDAT.pdf") as pack:
            assert sum("Situation déjà enregistrée par Nexus" in p.get_text() for p in pack) == 1
        sans_nom = PC.create_candidate_pack(**FACTS, output_dir=Path(t) / "generique", assemble_pdf=False)
        assert (sans_nom / "A_ENVOYER/livrets/DOSSIER_D_ENTREE_NEXUS.pdf").read_bytes() == CANONIQUE.read_bytes()

"""Les questions d'histoire-géographie se lisent sans document manquant — aux trois versions.

La correction avait été écrite, puis appliquée à une seule version sur trois. La banque
portait cinq variantes autonomes, dont l'énoncé transcrit son document ; l'assemblage TLE
les servait, et ce contrôle en faisait foi. Les assemblages 1RE et ETENDUE continuaient
pendant ce temps à servir les originaux : le livret imprimait la notice d'un discours de
Lamartine, puis trois questions demandant d'y relever un argument, de le critiquer et de
le confronter à une seconde source — sans une ligne du discours sur la page. Six points
sur quarante en version Première, huit en version étendue.

Ce contrôle ne fige plus une sélection : il vérifie la règle, sur les trois versions.
"""
import json
import re
import subprocess
import unicodedata
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
HG = ROOT / "instruments/TC-HG"
#: Les variantes autonomes : leur énoncé porte le document qu'il exploite. Les originaux
#: qu'elles remplacent ont été retirés de la banque — les garder aurait exposé un
#: assemblage futur à reprendre une question insoluble.
VARIANTES = ("HG-T-DOC-11", "HG-T-DOC-12", "HG-T-DOC-13", "HG-T-DOC-14",
             "HG-T-CART-13", "HG-1-DOC-12", "HG-1-DOC-13", "HG-1-DOC-14")

#: Les originaux retirés. Aucun ne doit revenir, ni en banque ni en assemblage.
RETIRES = ("HG-1-DOC-02", "HG-1-DOC-03", "HG-1-DOC-04", "HG-T-DOC-01", "HG-T-DOC-02",
           "HG-T-DOC-03", "HG-T-DOC-04", "HG-T-CART-03")

VERSIONS = ("1RE", "TLE", "ETENDUE")
POSITIONS = {10: "HG-T-DOC-11", 11: "HG-T-DOC-12", 12: "HG-T-DOC-13",
             13: "HG-T-DOC-14", 16: "HG-T-CART-13"}
#: Un renvoi à un document que l'énoncé ne peut pas porter lui-même : une carte, une
#: affiche, un fond de carte. Cherché aussi dans le texte extrait du PDF.
RENVOI_VISUEL = re.compile(
    r"cette carte|cette affiche|sur un fond de carte|"
    r"à partir de la légende d['’]une carte|analysez une affiche|"
    r"relevez dans ce discours", re.I)

#: Un renvoi à un document quelconque. Il est légitime lorsque l'énoncé transcrit le
#: document ; il ne l'est pas lorsqu'il désigne une source que rien n'apporte.
RENVOI_DOCUMENT = re.compile(
    r"ce discours|ce texte|ce document|cette source|confrontez ce |ces deux sources",
    re.I)

#: Ce par quoi un énoncé montre qu'il porte le document dont il parle : une transcription
#: annoncée, une citation d'au moins quatre-vingts caractères, ou une notice en italique.
PORTE_SON_DOCUMENT = re.compile(
    r"Document pédagogique Nexus|Repères fournis|Notice\s*:|«[^»]{80,}»", re.S)



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
    """Les questions dont l'énoncé désigne un document que le candidat n'aura pas.

    Le repli retenu est exclusivement textuel : aucune image historique implicite. Un
    énoncé a le droit de dire « ce texte » — à condition de le transcrire.
    """
    coupables = []
    for it in items:
        enonce = it["enonce"]
        if it.get("supports"):
            continue
        if RENVOI_VISUEL.search(enonce):
            coupables.append(it["item_id"])
        elif RENVOI_DOCUMENT.search(enonce) and not PORTE_SON_DOCUMENT.search(enonce):
            coupables.append(it["item_id"])
    return coupables


def test_tle_selectionne_les_cinq_variantes_aux_bonnes_positions():
    ids = selection("TLE")
    assert len(ids) == 18
    assert {n: ids[n - 1] for n in POSITIONS} == POSITIONS


@pytest.mark.parametrize("version", VERSIONS)
def test_aucun_renvoi_a_un_document_absent_dans_aucune_version(version):
    items = banque()
    coupables = renvois_sans_document([items[i] for i in selection(version)])
    assert coupables == [], (
        f"TC-HG/{version} : {coupables} renvoient à un document que le livret n'imprime "
        f"pas. La question est insoluble sur le document remis au candidat.")


@pytest.mark.parametrize("version", VERSIONS)
def test_aucune_version_ne_reprend_un_original_retire(version):
    repris = sorted(set(selection(version)) & set(RETIRES))
    assert repris == [], f"TC-HG/{version} reprend des questions retirées : {repris}"


def test_les_originaux_ont_bien_quitte_la_banque():
    presents = sorted(set(banque()) & set(RETIRES))
    assert presents == [], (
        f"{presents} sont revenus en banque : un assemblage pourrait les reprendre, et "
        f"le candidat lirait de nouveau « relevez dans ce discours » sans discours.")


@pytest.mark.parametrize("enonce", ["Relevez sur cette carte les ports.",
    "Analysez cette affiche.", "Sur un fond de carte, placez deux ports.",
    "À partir de la légende d'une carte, identifiez l'unité.",
    "Analysez une affiche de propagande soviétique."])
def test_contre_epreuve_detecte_un_support_manquant(enonce):
    assert renvois_sans_document([{"item_id": "ESSAI", "enonce": enonce,
                                   "supports": []}]) == ["ESSAI"]


@pytest.mark.parametrize("iid", VARIANTES)
def test_chaque_variante_porte_le_document_qu_elle_exploite(iid):
    """Une variante autonome se lit seule : son document est dans son énoncé.

    Et ce document se déclare pour ce qu'il est — un texte de travail Nexus — plutôt que
    de reconstituer de mémoire une source d'époque qu'on ne pourrait pas citer.
    """
    it = banque()[iid]
    assert it["supports"] == [], f"{iid} : une variante autonome n'a pas de support séparé"
    assert renvois_sans_document([it]) == [], \
        f"{iid} : l'énoncé renvoie encore à un document qu'il ne porte pas"
    assert PORTE_SON_DOCUMENT.search(it["enonce"]), \
        f"{iid} : aucune transcription de document dans l'énoncé"
    if "DOC" in iid:
        assert "Document pédagogique Nexus" in it["enonce"], \
            f"{iid} : le document n'est pas transcrit ni déclaré comme texte de travail"
    assert it["type"] == "B" and it["score_max"] == 2


@pytest.mark.parametrize("version", VERSIONS)
def test_le_bareme_et_la_duree_de_chaque_version_sont_tenus(version):
    """La substitution n'a rien retiré au candidat : mêmes points, mêmes minutes."""
    attendu = {"1RE": (18, 40, 45.0), "TLE": (18, 40, 45.0), "ETENDUE": (23, 50, 60.0)}
    items = banque()
    ids = selection(version)
    asm = json.loads((HG / "assemblages" / f"{version}.json").read_text())
    duree = (asm.get("bloc_0", {}).get("duree_min", 0)
             + sum(items[i]["duree_min"] for i in ids))
    assert (len(ids), sum(items[i]["score_max"] for i in ids), duree) == attendu[version]


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
    servies = [i for i in VARIANTES if i in selection("TLE")]
    for iid in servies:
        assert iid in items, f"Variante autonome absente : {iid}"
        assert iid in texte
        assert normaliser(items[iid]["enonce"])[:120] in texte
    if collection == "02_CORRECTIONS_COACH":
        assert "composition pyramidale" not in texte
        for iid in servies:
            attendu = normaliser(items[iid]["cle"]["reponse_2pts"])
            assert re.sub(r"\W+", " ", attendu) in mots_pdf, iid

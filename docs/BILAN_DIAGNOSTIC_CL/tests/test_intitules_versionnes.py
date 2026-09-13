"""L'intitulé affiché décrit le périmètre réellement évaluable de la version passée.

Le bilan P3 mesure la spécialité abandonnée en version N1 : l'assemblage n'y contient
aucun item de Terminale. Afficher « Marché, monnaie et financement, défaillances ;
croissance, commerce international et emploi en Terminale » laissait croire au candidat
que son score portait sur des notions qui n'avaient pas été mesurées. Ces tests imposent
la règle sur toutes les spécialités dont le périmètre mélange Première et Terminale.
"""
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
MAQ_P2 = RACINE / "instruments" / "_MAQUETTE_P2"
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import maquette_bilan as M  # noqa: E402
import validate_referentiel as VR  # noqa: E402


@pytest.fixture(scope="module")
def ref():
    return json.loads((RACINE / "referentiels" / "competences.json")
                      .read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def bilan_p3():
    return M.Bilan().calculer()


@pytest.fixture(scope="module")
def bilan_p2():
    return M.Bilan(dossier=MAQ_P2).calculer()


def competences_de(ref, pc):
    return {c["code"]: c for p in ref["perimetres"] if p["code"] == pc
            for c in p["competences"]}


CIBLES = ["EDS-SES", "EDS-MATH", "EDS-PC", "EDS-NSI", "EDS-SVT", "EDS-HGGSP", "EDS-HLP"]


# ─────────────────────────────── la règle, sur toutes les spécialités mixtes

@pytest.mark.parametrize("pc", CIBLES)
@pytest.mark.parametrize("version", ["N1", "NT"])
def test_l_intitule_ne_promet_que_ce_que_la_version_mesure(pc, version, ref):
    comps = competences_de(ref, pc)
    for code, c in comps.items():
        etat = (c.get("etat_par_version") or {}).get(version)
        if etat != "evaluee":
            continue
        niveaux = (c.get("niveaux_items") or {}).get(version) or []
        affiche = (c.get("intitule_par_version") or {}).get(version, c["intitule"])
        if "T" not in niveaux:
            assert "Terminale" not in affiche, \
                f"{pc}/{code} en {version} : l'intitulé annonce du Terminale sans item de ce niveau"
        else:
            assert affiche == c["intitule"], \
                f"{pc}/{code} en {version} : l'intitulé complet doit rester affiché"


def test_le_referentiel_impose_lintitule_versionne(ref, abime):
    """Contre-épreuve : retirer un intitulé versionné doit faire échouer le contrôle."""
    sans = abime(ref, lambda r: [c.pop("intitule_par_version")
                                 for p in r["perimetres"] for c in p["competences"]
                                 if c["code"] == "ECO" and p["code"] == "EDS-SES"])
    err, _ = VR.controler(sans)
    assert any("intitule_par_version" in e for e in err), err


def test_un_intitule_versionne_qui_promet_encore_du_terminale_est_refuse(ref, abime):
    faux = abime(ref, lambda r: [c["intitule_par_version"].__setitem__(
        "N1", "Marché et croissance en Terminale")
        for p in r["perimetres"] for c in p["competences"]
        if c["code"] == "ECO" and p["code"] == "EDS-SES"])
    err, _ = VR.controler(faux)
    assert any("annonce encore" in e for e in err), err


# ─────────────────────────────── ce que le moteur et le rendu en font

def test_le_moteur_choisit_lintitule_de_la_version_passee(bilan_p3, bilan_p2, ref):
    assert bilan_p3.version_passee("EDS-SES") == "N1"
    assert bilan_p2.version_passee("EDS-SES") == "NT"
    court = bilan_p3.intitule("EDS-SES", "ECO")
    complet = bilan_p2.intitule("EDS-SES", "ECO")
    assert "Terminale" not in court and "Terminale" in complet
    assert complet == competences_de(ref, "EDS-SES")["ECO"]["intitule"]
    assert bilan_p3.res[("EDS-SES", "ECO")]["intitule"] == court


@pytest.mark.parametrize("jeu,pc,attendu_terminale", [
    ("bilan_p3", "EDS-SES", False),      # spécialité abandonnée, version N1
    ("bilan_p3", "EDS-MATH", True),      # spécialité poursuivie, version NT
    ("bilan_p2", "EDS-SES", True),       # P2 : les deux spécialités en NT
    ("bilan_p2", "EDS-MATH", True),
])
def test_le_bilan_affiche_lintitule_de_la_version(jeu, pc, attendu_terminale, request):
    b = request.getfixturevalue(jeu)
    texte, _ = B.rendre(b)
    section = texte.split(f"### {B.nom_matiere(b, pc)}", 1)[1].split("\n### ", 1)[0]
    mixtes = [k[1] for k in b.res if k[0] == pc
              and "Terminale" in b.comps[k]["intitule"]]
    assert mixtes, f"{pc} n'a plus de compétence mixte : le test ne prouve rien"
    for comp in mixtes:
        affiche = b.intitule(pc, comp)
        assert affiche in section
        assert ("Terminale" in affiche) is attendu_terminale


def test_aucun_intitule_de_terminale_dans_un_bilan_dont_la_version_est_n1(bilan_p3):
    """EDS-SES est passé en N1 : sa section ne doit annoncer aucune notion de Terminale."""
    texte, _ = B.rendre(bilan_p3)
    section = texte.split(f"### {B.nom_matiere(bilan_p3, 'EDS-SES')}", 1)[1] \
                   .split("\n### ", 1)[0]
    assert "en Terminale" not in section


def test_la_calibration_et_le_plan_emploient_le_meme_intitule(bilan_p3):
    texte, _ = B.rendre(bilan_p3)
    for comp in ("ECO", "SOC", "POL"):
        court = bilan_p3.intitule("EDS-SES", comp)
        complet = bilan_p3.comps[("EDS-SES", comp)]["intitule"]
        assert complet not in texte, \
            f"l'intitulé complet de EDS-SES/{comp} reste affiché quelque part"
        assert court in texte

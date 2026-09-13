"""Q-26 opposable à tout le profil : le gate est unique, en amont, et ferme tout.

Le reproche de la direction était précis : la règle de l'article 3 était vérifiée à
l'intérieur de la sélection de MATH-EA. Un candidat dont le passage en une seule session
n'était pas établi perdait donc l'épreuve anticipée de mathématiques — et conservait
FR-EAF, la philosophie, le Grand oral et ses spécialités, c'est-à-dire l'essentiel d'un
profil qui n'aurait pas dû s'ouvrir.

L'ordre est désormais : faits déclarés → éligibilité de l'article 3 → vérification de la
preuve → ouverture du profil → dérivation de **tous** les instruments. Ces contre-tests
tiennent les quatre cas exigés : non éligible, éligible mais non vérifié, éligible et
vérifié, et la preuve que le gate n'est pas décoratif.
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import eligibilite as EL  # noqa: E402
import maquette_donnees as D  # noqa: E402
import passation as P  # noqa: E402

#: Les instruments qu'un profil « toutes les épreuves à la même session » ouvre, et qui
#: ne doivent jamais apparaître quand l'article 3 ne l'autorise pas.
INSTRUMENTS_DU_PROFIL = {"FR-EAF", "FR-EAF-ORAL", "MATH-EA", "PHI", "GO"}


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def catalogue():
    return charger(RACINE / "referentiels" / "catalogue_instruments.json")


@pytest.fixture()
def qp():
    """Le jeu P3, rendu en production : la porte de simulation est fermée."""
    q = charger(RACINE / "instruments" / "_MAQUETTE" / "qp.json")
    q["mode_rendu"] = "production"
    return q


def sans(qp, *cles):
    q = copy.deepcopy(qp)
    for c in cles:
        q["reponses"].pop(c, None)
    return q


def codes(qp, cat):
    return {c for c, _ in D.liste_effective_des_instruments_a_passer(qp, cat)}


# ─────────────────────────────── A · non éligible : rien n'est dérivé

def test_a_un_candidat_non_eligible_nouvre_aucun_instrument(qp, catalogue):
    q = sans(qp, "age_au_31_decembre_annee_examen", "pieces_justificatives")
    st = D.statut_du_profil(q)
    assert st["statut"] == EL.P3_NON_OUVERT and not st["ouvert"]
    assert codes(q, catalogue) == set(), \
        "un profil fermé dérive encore des instruments"


def test_a_le_refus_ne_vise_pas_les_seules_mathematiques(qp, catalogue):
    """Le contre-test du gate partiel : ce n'est pas MATH-EA seule qui tombe."""
    q = sans(qp, "age_au_31_decembre_annee_examen", "pieces_justificatives")
    assert not (codes(q, catalogue) & INSTRUMENTS_DU_PROFIL)


def test_a_aucun_plan_de_passation_ne_se_construit_sur_un_profil_ferme(qp, catalogue):
    q = sans(qp, "age_au_31_decembre_annee_examen", "pieces_justificatives")
    plan = P.plan(q, catalogue)
    assert plan["nombre_demi_journees"] == 0 and plan["total_au_centre"] == 0
    assert plan["statut_profil"] == EL.P3_NON_OUVERT


# ─────────────────────────────── B · éligible, non vérifié : en attente

def test_b_le_droit_sans_la_preuve_met_le_profil_en_attente(qp, catalogue):
    q = sans(qp, "pieces_justificatives")
    st = D.statut_du_profil(q)
    assert st["statut"] == EL.P3_EN_ATTENTE and not st["ouvert"]
    assert st["critere"] == "AGE-20"
    assert codes(q, catalogue) == set()


def test_b_lattente_se_distingue_du_refus(qp):
    attente = D.statut_du_profil(sans(qp, "pieces_justificatives"))
    refus = D.statut_du_profil(sans(qp, "age_au_31_decembre_annee_examen",
                                    "pieces_justificatives"))
    assert attente["statut"] != refus["statut"], \
        "une pièce manquante et un droit absent produisent le même statut"
    assert "piece_identite" in attente["motif"]


# ─────────────────────────────── C · éligible et vérifié : dérivation normale

def test_c_le_profil_ouvert_derive_tous_ses_instruments(qp, catalogue):
    st = D.statut_du_profil(qp)
    assert st["statut"] == EL.P3_OUVERT and st["ouvert"]
    assert INSTRUMENTS_DU_PROFIL <= codes(qp, catalogue)
    assert P.plan(qp, catalogue)["nombre_demi_journees"] == 3


def test_c_louverture_est_documentee_par_sa_source(qp):
    st = D.statut_du_profil(qp)
    assert st["critere"] == "AGE-20"
    assert st["fondement"] == "art. 3"
    assert st["texte"].startswith("arrêté du 16 juillet 2018")


# ─────────────────────────────── D · le gate n'est pas décoratif

def test_d_retirer_le_gate_de_la_derivation_fait_echouer_le_controle(qp, catalogue,
                                                                    monkeypatch):
    """Si la dérivation cesse de consulter le gate, le cas A redevient ouvert."""
    q = sans(qp, "age_au_31_decembre_annee_examen", "pieces_justificatives")
    monkeypatch.setattr(D, "liste_effective_des_instruments_a_passer",
                        D._instruments_du_profil)
    assert D.liste_effective_des_instruments_a_passer(q, catalogue), \
        "le contre-test ne prouve rien : la dérigation sans gate ne rend rien non plus"
    assert INSTRUMENTS_DU_PROFIL <= {c for c, _ in
                                     D.liste_effective_des_instruments_a_passer(q, catalogue)}


def test_d_le_gate_nest_pas_recopie_dans_la_selection_des_instruments():
    """Une seule porte : la sélection d'instrument ne consulte pas l'éligibilité."""
    src = (RACINE / "scripts" / "maquette_donnees.py").read_text(encoding="utf-8")
    corps = src.split("def _instruments_du_profil", 1)[1].split("\ndef ", 1)[0]
    assert "EL." not in corps and "eligibilite" not in corps, \
        "le gate est de nouveau recopié dans la dérivation par instrument"
    assert src.count("EL.statut_profil") == 1


# ─────────────────────────────── la porte de simulation est déclarée, jamais devinée

def test_une_maquette_simule_le_gate_et_le_dit(qp, catalogue):
    q = sans(qp, "age_au_31_decembre_annee_examen", "pieces_justificatives")
    q["mode_rendu"] = "maquette"
    st = D.statut_du_profil(q)
    assert st["ouvert"] and st["simulation"] is True
    assert st["statut"] == "P3_SIMULE" and st["statut_reel"] == EL.P3_NON_OUVERT
    assert codes(q, catalogue)


def test_la_simulation_ne_sapplique_quau_mode_declare(qp, catalogue):
    q = sans(qp, "age_au_31_decembre_annee_examen", "pieces_justificatives")
    for mode in ("production", None):
        q["mode_rendu"] = mode
        assert not D.statut_du_profil(q)["ouvert"], mode


def test_les_maquettes_du_depot_passent_le_gate_pour_de_bon():
    """Les jeux P2 et P3 portent leur pièce : ils n'usent pas de la porte de simulation."""
    for jeu in ("_MAQUETTE", "_MAQUETTE_P2"):
        q = charger(RACINE / "instruments" / jeu / "qp.json")
        q["mode_rendu"] = "production"
        assert D.statut_du_profil(q)["statut"] == EL.P3_OUVERT, jeu

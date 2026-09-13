"""Le plan de passation suit la liste effective des instruments, jamais une table de profils.

Un plan construit sur « profil × configuration française » ajouterait MATH-EA à tout P2 et
tout P3, alors que l'épreuve peut être dispensée par l'article 17, remplacée par une note
conservée, déjà présentée au titre de la même session, ou simplement pas encore créée pour
l'année de passation du candidat. Ces tests parcourent les six cas et vérifient à chaque
fois deux choses : que l'instrument est là si et seulement s'il est dû, et que le plafond
de 3 h 15 du § 1.1 tient sans qu'aucun instrument soit retiré.
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import maquette_donnees as D  # noqa: E402
import passation as P  # noqa: E402


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def catalogue():
    return charger(RACINE / "referentiels" / "catalogue_instruments.json")


def jeu(nom, **faits):
    qp = copy.deepcopy(charger(RACINE / "instruments" / nom / "qp.json"))
    qp["reponses"].update(faits)
    return qp


#: Les six cas demandés par la direction. « du » dit si MATH-EA doit figurer au plan.
CAS = {
 "P2 — épreuve due":
   (lambda: jeu("_MAQUETTE_P2"), True),
 "P2 — dispense transitoire de l'article 17":
   (lambda: jeu("_MAQUETTE_P2", dispense_transitoire="DISP-ECHEC-2026"), False),
 "P2 — note conservée après échec (D334-13)":
   (lambda: jeu("_MAQUETTE_P2", ea_mathematiques_deja_presentee="oui",
                session_de_presentation_ea_math=2026, note_ea_mathematiques=12,
                conservation_demandee="oui"), False),
 "P3 — épreuve due":
   (lambda: jeu("_MAQUETTE"), True),
 "P3 — épreuve déjà présentée au titre de la même session":
   (lambda: jeu("_MAQUETTE", ea_mathematiques_deja_presentee="oui",
                session_de_presentation_ea_math=2027), False),
 "P1 opérationnel 2026-2027 — épreuve due, sujet SPECIFIQUES":
   (lambda: jeu("_MAQUETTE_P1_2026_2027_SPECIFIQUES"), True),
}


@pytest.mark.parametrize("cas", list(CAS))
def test_math_ea_figure_au_plan_si_et_seulement_si_elle_est_due(cas, catalogue):
    fabrique, du = CAS[cas]
    qp = fabrique()
    codes = {c for c, _ in D.liste_effective_des_instruments_a_passer(qp, catalogue)}
    assert ("MATH-EA" in codes) is du, cas
    plan = P.plan(qp, catalogue)
    au_plan = {x["code"] for dj in plan["demi_journees"] for x in dj}
    assert ("MATH-EA" in au_plan) is du, cas


@pytest.mark.parametrize("cas", list(CAS))
def test_le_plafond_du_paragraphe_1_1_tient_dans_les_six_cas(cas, catalogue):
    qp = CAS[cas][0]()
    plan = P.plan(qp, catalogue)
    assert plan["durees"], cas
    for i, duree in enumerate(plan["durees"], 1):
        assert duree <= plan["plafond"], f"{cas}, J{i} : {duree} min"


@pytest.mark.parametrize("cas", list(CAS))
def test_aucun_instrument_nest_perdu_entre_la_liste_et_le_plan(cas, catalogue):
    qp = CAS[cas][0]()
    plan = P.plan(qp, catalogue)
    attendus = set(D.liste_effective_des_instruments_a_passer(qp, catalogue))
    places = {(x["code"], x["version"]) for dj in plan["demi_journees"] for x in dj}
    places |= {(x["code"], x["version"]) for x in plan["a_distance"]}
    assert places == attendus, cas


def test_une_dispense_retire_une_heure_au_centre(catalogue):
    """La conséquence chiffrée : sans MATH-EA, une heure de moins au centre."""
    du = P.plan(jeu("_MAQUETTE_P2"), catalogue)
    dispense = P.plan(jeu("_MAQUETTE_P2", dispense_transitoire="DISP-ECHEC-2026"),
                      catalogue)
    fiche = {(i["code"], i["version"]): i for i in catalogue["instruments"]}
    duree = fiche[("MATH-EA", "SPE")]["duree_cible_min"]
    assert du["total_au_centre"] - dispense["total_au_centre"] == duree


def test_le_plan_ne_lit_aucune_table_de_profils(catalogue):
    """Contre-test : si le plan lisait le profil, deux P2 aux faits différents seraient égaux."""
    a = P.plan(jeu("_MAQUETTE_P2"), catalogue)
    b = P.plan(jeu("_MAQUETTE_P2", dispense_transitoire="DISP-ECHEC-2026"), catalogue)
    assert a["total_au_centre"] != b["total_au_centre"], \
        "deux P2 de même profil et même configuration reçoivent le même plan"


def test_le_tableau_des_cas_est_reproductible(catalogue):
    """Le tableau remis à la direction se recalcule à l'identique."""
    def resume(qp):
        p = P.plan(qp, catalogue)
        return (p["nombre_demi_journees"], tuple(p["durees"]), p["total_au_centre"])
    for cas, (fabrique, _) in CAS.items():
        assert resume(fabrique()) == resume(fabrique()), cas

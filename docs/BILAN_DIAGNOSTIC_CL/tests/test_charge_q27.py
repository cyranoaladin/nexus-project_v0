"""Q-27 — la charge a deux indicateurs, et un seul commande le séquencement.

EC-18 abaissait le seuil du § 8.2 de 20 h à 15 h, au motif que 20 h était inatteignable :
six matières porteuses d'un rythme, 3 h chacune au maximum, plafonnaient la somme à 18 h.
La création de MATH-EA porte ce plafond à 21 h. La justification enregistrée était donc
devenue fausse — et une règle amendée qui survit à son motif est une règle sans fondement.

Décision de la direction (Q-27) : le seuil du Cahier est rétabli tel qu'il est écrit —
la somme doit **dépasser** 20 h —, et le signal de 15 h devient un indicateur distinct,
« vigilance — charge élevée », qui **atteint** son seuil sans rien imposer.

Ces tests tiennent les quatre bornes demandées : 14,5 · 15 · 20 · 20,5.
"""
import copy
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import maquette_bilan as M  # noqa: E402


@pytest.fixture(scope="module")
def regles():
    return M.charger(RACINE / "referentiels" / "regles_bilan.json")


@pytest.fixture(scope="module")
def p3():
    return M.Bilan().calculer()


# ─────────────────────────────── les quatre bornes

@pytest.mark.parametrize("somme,sequencement,vigilance", [
    (14.5, False, False),   # sous les deux seuils
    (15.0, False, True),    # « atteint » se lit largement : la vigilance se déclenche
    (20.0, False, True),    # « dépasse » se lit strictement : 20 h ne séquence pas
    (20.5, True, True),     # au-delà du seuil du Cahier : le séquencement est proposé
])
def test_les_bornes_des_deux_indicateurs(somme, sequencement, vigilance, regles):
    i = M.indicateurs_de_charge(somme, "P3", regles)
    assert i["sequencement"] is sequencement
    assert i["vigilance"] is vigilance


def test_le_seuil_du_cahier_est_retabli(regles):
    al = regles["alerte_charge"]
    assert al["seuil_heures"] == al["seuil_cahier_initial"] == 20
    assert al["comparaison"] == "depasse"


def test_la_vigilance_est_un_indicateur_distinct_et_inferieur(regles):
    vig = regles["alerte_charge"]["vigilance_charge_elevee"]
    assert vig["seuil_heures"] == 15 and vig["comparaison"] == "atteint"
    assert vig["seuil_heures"] < regles["alerte_charge"]["seuil_heures"]
    assert vig["effet"] == "signal"


def test_la_vigilance_ne_remplace_pas_le_seuil_du_cahier(regles):
    """Entre 15 h et 20 h, il y a un signal et aucun séquencement : c'est tout Q-27."""
    for somme in (15.0, 17.0, 20.0):
        i = M.indicateurs_de_charge(somme, "P3", regles)
        assert i["vigilance"] and not i["sequencement"], somme


def test_un_profil_hors_perimetre_ne_declenche_rien(regles):
    assert not any(M.indicateurs_de_charge(25.0, "P1", regles)[k]
                   for k in ("sequencement", "vigilance"))


# ─────────────────────────────── ce que le bilan écrit de part et d'autre

def bilan_a(p3, somme_cible):
    """Le même bilan, avec les rythmes de groupe ramenés à une somme imposée.

    Les heures déclarées sont portées au large : la règle du plafond est une autre règle,
    et ces tests-ci ne portent que sur les deux seuils de charge.
    """
    b = copy.deepcopy(p3)
    b.qp["reponses"]["heures_disponibles"] = 40
    groupes = list(b.groupes)
    part = somme_cible / len(groupes)
    vrai = b.rythme_groupe
    b.rythme_groupe = lambda g, _v=vrai, _p=part: (_p,) + tuple(_v(g)[1:])
    return b


@pytest.mark.parametrize("somme", [14.5, 15.0, 20.0])
def test_sous_le_seuil_du_cahier_le_bilan_ne_propose_aucun_sequencement(p3, somme):
    b = bilan_a(p3, somme)
    texte = M.document(b)
    assert "**Séquencement**" not in texte and "**Séquencement et plafond**" not in texte
    assert b.regles["alerte_charge"]["proposition"] not in texte


def test_a_vingt_heures_et_demie_le_bilan_propose_le_sequencement(p3):
    b = bilan_a(p3, 20.5)
    texte = M.document(b)
    assert "**Séquencement**" in texte
    assert b.regles["alerte_charge"]["proposition"] in texte


@pytest.mark.parametrize("somme,attendu", [(14.5, False), (15.0, True), (20.0, True)])
def test_la_vigilance_apparait_seule_entre_les_deux_seuils(p3, somme, attendu):
    texte = M.document(bilan_a(p3, somme))
    assert ("**Vigilance — charge élevée**" in texte) is attendu


def test_le_document_dit_les_deux_seuils_et_leur_lecture(p3):
    texte = M.document(p3)
    al = p3.regles["alerte_charge"]
    assert "Seuil de séquencement : **20 h** (dépassement strict)" in texte
    assert "Seuil de vigilance : **15 h** (atteint)" in texte
    assert al["vigilance_charge_elevee"]["n_impose_pas"] in texte


# ─────────────────────────────── EC-18 est transformé, non laissé caduc

def test_ec18_ne_porte_plus_la_justification_caduque(p3):
    e = p3.ecart("EC-18")
    assert "21 h" in e["constat"], "EC-18 ne dit pas pourquoi son motif est tombé"
    assert "rétabli" in e["arbitrage"]
    assert "clos" in e["procedure"]
    assert e["etat"].startswith("transformé")


def test_aucune_regle_active_ne_se_fonde_sur_limpossibilite_du_seuil(regles):
    """Le motif « le seuil de 20 h ne se déclencherait jamais » n'est plus une règle."""
    al = regles["alerte_charge"]
    assert "motif_amendement" not in al, \
        "le motif de l'amendement clos subsiste dans les règles actives"
    assert "ne se serait jamais déclenché" not in str(al)


def test_le_bilan_du_p3_reste_diffusable_apres_q27(p3):
    texte, verifs = B.rendre(p3)
    assert B.diffusable(verifs)
    assert p3.regles["alerte_charge"]["vigilance_charge_elevee"]["n_impose_pas"] in texte

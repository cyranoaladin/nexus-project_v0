"""Le plan de passation tient l'invariant du § 1.1 dans les quatre configurations.

« Aucune demi-journée de passation ne dépasse 3 h 15 d'évaluation effective. » Depuis
Q-19, un P2 peut ajouter à son plan un assemblage de français et l'entretien oral : ces
tests vérifient que le plafond tient, qu'aucun instrument n'est retiré pour le tenir, et
que c'est le nombre de demi-journées qui augmente (EC-29).
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import passation as P  # noqa: E402
import maquette_donnees as D  # noqa: E402

CONFIGS = ["aucune", "ecrit", "oral", "les_deux"]


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def catalogue():
    return charger(RACINE / "referentiels" / "catalogue_instruments.json")


@pytest.fixture()
def qp_p2():
    return charger(RACINE / "instruments" / "_MAQUETTE_P2" / "qp.json")


@pytest.fixture()
def qp_p3():
    return charger(RACINE / "instruments" / "_MAQUETTE" / "qp.json")


def pour(qp, config):
    q = copy.deepcopy(qp)
    q["reponses"]["epreuves_francais_a_presenter"] = config
    return q


# ─────────────────────────────── l'invariant du § 1.1

@pytest.mark.parametrize("config", CONFIGS)
def test_aucune_demi_journee_ne_depasse_le_plafond(config, qp_p2, catalogue):
    p = P.plan(pour(qp_p2, config), catalogue)
    assert p["durees"], "aucune demi-journée calculée"
    for i, duree in enumerate(p["durees"], 1):
        assert duree <= p["plafond"], \
            f"configuration {config}, J{i} : {duree} min pour un plafond de {p['plafond']}"


@pytest.mark.parametrize("config", CONFIGS)
def test_aucun_instrument_nest_retire_pour_tenir_le_plafond(config, qp_p2, catalogue):
    qp = pour(qp_p2, config)
    p = P.plan(qp, catalogue)
    attendus = {(c, v) for c, v in D.instruments_passes(qp, catalogue)}
    places = {(x["code"], x["version"]) for dj in p["demi_journees"] for x in dj}
    places |= {(x["code"], x["version"]) for x in p["a_distance"]}
    assert places == attendus, f"{config} : {attendus - places} disparus du plan"


@pytest.mark.parametrize("config,attendu", [("aucune", 3), ("ecrit", 3),
                                            ("oral", 3), ("les_deux", 3)])
def test_le_nombre_de_demi_journees_dun_p2(config, attendu, qp_p2, catalogue):
    """Q-22 et Q-24 : trois demi-journées dans les quatre configurations.

    Avant MATH-EA, la configuration « aucune » tenait en deux demi-journées. L'épreuve
    anticipée de mathématiques ajoute une heure au centre : le plafond de 3 h 15 impose
    désormais trois demi-journées quelle que soit la configuration française.
    """
    p = P.plan(pour(qp_p2, config), catalogue)
    assert p["nombre_demi_journees"] == attendu


def test_le_p3_tient_en_trois_demi_journees(qp_p3, catalogue):
    p = P.plan(qp_p3, catalogue)
    assert p["nombre_demi_journees"] == 3
    assert all(d <= p["plafond"] for d in p["durees"])


@pytest.mark.parametrize("config", CONFIGS)
def test_seuls_qp_et_met_se_passent_a_distance(config, qp_p2, catalogue):
    """§ 3.2 — la passation à distance n'est admise que pour ces deux formulaires."""
    p = P.plan(pour(qp_p2, config), catalogue)
    assert {x["code"] for x in p["a_distance"]} == {"QP", "MET"}
    for dj in p["demi_journees"]:
        for x in dj:
            assert x["support"] not in \
                catalogue["conventions"]["plan_passation"]["supports_a_distance"]


# ─────────────────────────────── contre-tests : la règle vient du référentiel

@pytest.mark.parametrize("config", CONFIGS)
def test_un_plafond_abaisse_augmente_le_nombre_de_demi_journees(config, qp_p2, catalogue):
    """Le plafond n'est pas écrit dans le script : le déplacer déplace le plan."""
    cat = copy.deepcopy(catalogue)
    avant = P.plan(pour(qp_p2, config), cat)["nombre_demi_journees"]
    cat["conventions"]["plan_passation"]["duree_max_demi_journee_min"] = 100
    apres = P.plan(pour(qp_p2, config), cat)
    assert apres["nombre_demi_journees"] > avant
    assert all(d <= 100 for d in apres["durees"])


def test_un_instrument_plus_long_quune_demi_journee_est_refuse(qp_p2, catalogue):
    cat = copy.deepcopy(catalogue)
    cat["conventions"]["plan_passation"]["duree_max_demi_journee_min"] = 30
    with pytest.raises(SystemExit):
        P.plan(qp_p2, cat)


def test_le_decoupage_du_paragraphe_3_2_depasse_le_plafond(catalogue):
    """EC-29 — le plan proposé au § 3.2 pour un P2 place 3 h 30 dans une demi-journée."""
    duree = {(i["code"], i["version"]): i["duree_cible_min"]
             for i in catalogue["instruments"]}
    j1 = duree[("PHI", "standard")] + duree[("FR-MAI", "standard")] \
        + duree[("EDS-MATH", "NT")]
    plafond = catalogue["conventions"]["plan_passation"]["duree_max_demi_journee_min"]
    assert j1 > plafond, \
        "le découpage du § 3.2 tient désormais dans le plafond : EC-29 est sans objet"


def test_le_plan_est_reproductible(qp_p2, catalogue):
    a = P.plan(qp_p2, catalogue)
    b = P.plan(qp_p2, catalogue)
    assert [[x["code"] for x in dj] for dj in a["demi_journees"]] == \
           [[x["code"] for x in dj] for dj in b["demi_journees"]]


@pytest.mark.parametrize("config", CONFIGS)
def test_le_total_au_centre_est_la_somme_des_demi_journees(config, qp_p2, catalogue):
    p = P.plan(pour(qp_p2, config), catalogue)
    assert sum(p["durees"]) == p["total_au_centre"]

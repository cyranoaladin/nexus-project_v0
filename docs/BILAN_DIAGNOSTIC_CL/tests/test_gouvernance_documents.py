"""Les documents de gouvernance disent tous la même chose, ou la suite échoue.

Sept pièces décrivent l'état du dispositif : le README, la synthèse de mise en service, le
verdict gate par gate, l'acceptation en clone propre, le manifeste de la release et les
inventaires d'audit. Chacune était juste au moment où elle a été écrite, et deux d'entre
elles se sont mises à répondre différemment à la même question — le nombre de tests passés
en clone propre, l'effectif d'instruments — sans que rien ne le voie.

La règle tenue ici : **une famille de faits, une source canonique**. Les autres documents
la citent ; aucun ne la recopie d'ailleurs. Ce contrôle rejoue chaque valeur depuis sa
source et refuse qu'un document en affirme une autre.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import audit_readme as AR  # noqa: E402
import etat_depot as ED  # noqa: E402
import go_live_readiness as GLR  # noqa: E402

AUDIT = RACINE / "audit"


def charger(chemin: str) -> dict:
    return json.loads((RACINE / chemin).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def etat():
    """Les faits, lus chacun à sa source canonique — la même que celle du README."""
    return ED.etat_courant()


@pytest.fixture(scope="module")
def readme():
    return AR.etat_courant((RACINE / "README_ETAT.md").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def readiness():
    return (AUDIT / "GO_LIVE_READINESS.md").read_text(encoding="utf-8")


def test_chaque_famille_de_faits_a_une_source_canonique_et_elle_existe():
    for famille, chemin in ED.SOURCES_CANONIQUES.items():
        assert (RACINE / chemin).exists(), f"{famille} : source canonique absente ({chemin})"


def test_le_verdict_est_le_meme_partout(etat, readme, readiness):
    gate = charger(ED.SOURCES_CANONIQUES["verdict"])
    assert etat["GO_LIVE_READY"] == gate["GO_LIVE_READY"]
    assert f"| `GO_LIVE_READY` | {etat['GO_LIVE_READY']} |" in readme
    assert f"GO_LIVE_READY = {etat['GO_LIVE_READY']}" in readiness, \
        "la synthèse de mise en service annonce un autre verdict que le gate"


def test_le_perimetre_est_le_meme_partout(etat, readme, readiness):
    for libelle, cle in (("Instruments métier", "instruments"),
                         ("Variantes instrument × version", "variantes"),
                         ("Questions en banque", "items_banque"),
                         ("Assemblages", "assemblages")):
        assert f"| {libelle} | {etat[cle]} |" in readme, f"README : {libelle}"
    assert f"**{etat['instruments']}**, en **{etat['variantes']} variantes**" in readiness
    assert f"**{etat['items_banque']}**" in readiness, \
        "la synthèse n'annonce pas le nombre de questions de banque"


def test_les_effectifs_de_release_sont_les_memes_partout(etat, readme, readiness):
    man = charger(ED.SOURCES_CANONIQUES["release"])["effectifs"]
    assert etat["livrets_candidat"] == man["livrets_candidat"]
    assert etat["corrections_coach"] == man["corrections_coach"]
    assert etat["catalogues_operateur"] == man["operator_print_catalogues"]
    assert etat["fichiers_release"] == man["fichiers"]
    for libelle, cle in (("Livrets candidat", "livrets_candidat"),
                         ("Corrections coach", "corrections_coach"),
                         ("Catalogues opérateur d'impression", "catalogues_operateur"),
                         ("Fichiers de release", "fichiers_release")):
        assert f"| {libelle} | {etat[cle]} |" in readme, f"README : {libelle}"
    for n in (etat["livrets_candidat"], etat["corrections_coach"],
              etat["catalogues_operateur"], etat["fichiers_release"]):
        assert f"**{n}**" in readiness, f"la synthèse ne porte pas l'effectif {n}"


def test_le_domaine_candidat_est_le_meme_partout(etat, readme, readiness):
    etats = charger(ED.SOURCES_CANONIQUES["domaine_candidat"])
    assert etat["candidate_states"] == etats["total"] == len(etats["etats"])
    man = charger(ED.SOURCES_CANONIQUES["release"])["effectifs"]
    assert etat["candidate_states"] == man["candidate_states"], (
        "le manifeste de release et l'espace d'états candidats ne comptent pas la même "
        "chose")
    assert etat["selection_classes"] == man["selection_classes"]
    assert f"| États candidats valides | {etat['candidate_states']} |" in readme
    assert GLR.milliers(etat["candidate_states"]) in readiness, \
        "la synthèse n'annonce pas le nombre d'états candidats"


def test_les_resultats_de_test_sont_les_memes_partout(etat, readme, readiness):
    """Le point qui avait divergé : deux documents, deux comptes de tests passés."""
    cc = charger(ED.SOURCES_CANONIQUES["tests"])
    assert cc["pytest"]["failed"] == 0
    assert (cc["pytest"]["collected"]
            == cc["pytest"]["passed"] + cc["pytest"]["failed"] + cc["pytest"]["skipped"]
            + cc["pytest"].get("xfailed", 0) + cc["pytest"].get("xpassed", 0)), \
        "les compteurs de la pièce d'acceptation ne se somment pas"
    assert etat["pytest_passed"] == cc["pytest"]["passed"]
    assert (f"| Suite complète en clone propre | {etat['pytest_passed']} passés, "
            f"{etat['pytest_failed']} échec" in readme)
    n = etat["pytest_passed"]
    assert GLR.milliers(n) in readiness, \
        f"la synthèse n'annonce pas les {n} tests passés en clone propre"
    gate = charger(ED.SOURCES_CANONIQUES["verdict"])
    g2 = next(g for g in gate["gates"] if g["gate"] == "GATE 02")
    assert g2["preuves"]["pytest_echecs"] == 0
    assert g2["preuves"]["pytest_passes"] == cc["pytest"]["passed"], \
        "le gate cite un autre nombre de tests que la pièce d'acceptation"


def test_la_couverture_reglementaire_est_dite_incomplete_partout(etat, readme, readiness):
    couv = charger(ED.SOURCES_CANONIQUES["couverture_reglementaire"])["couverture_nexus"]
    assert "REGULATORY_BAC_COVERAGE_COMPLETE=NO" in couv["consequence"]
    assert "`READY_FOR_FULL_REGULATORY_BAC_COVERAGE` | NO" in readme
    assert "READY_FOR_FULL_REGULATORY_BAC_COVERAGE = NO" in readiness \
        or "FULL_REGULATORY_BAC_COVERAGE" in readiness
    for code in etat["hors_offre"]:
        assert code in readme, f"{code} n'est pas dit hors offre dans le README"
    assert (etat["coefficients_couverts"] + etat["coefficients_non_couverts"]) == 40


def test_aucun_defaut_d_audit_ne_reste_ouvert(etat, readme):
    findings = [json.loads(l) for l
                in (AUDIT / "FINDINGS.jsonl").read_text(encoding="utf-8").splitlines()
                if l.strip()]
    ouverts = [f["finding_id"] for f in findings if f["status"] != "FIXED"]
    assert ouverts == [], ouverts
    assert etat["findings_ouverts"] == 0
    assert "| Défauts d'audit encore ouverts | 0 |" in readme


def test_le_readme_n_affirme_rien_que_le_depot_contredit():
    """Le contrôle d'état du README, rejoué ici pour qu'il compte dans la suite."""
    err = AR.auditer((RACINE / "README_ETAT.md").read_text(encoding="utf-8"))
    assert err == [], err


def test_les_questions_reportees_sont_vides():
    texte = (RACINE / "README_ETAT.md").read_text(encoding="utf-8")
    i = texte.find("## 8. Questions d'arbitrage reportées")
    j = texte.find("## 8 bis.")
    section = texte[i:j]
    assert "Aucune" in section, "le registre des questions reportées n'est pas déclaré vide"
    assert not [l for l in section.splitlines() if l.lstrip().startswith("|")], \
        "une question figure encore au registre des questions reportées"
    tranchees = texte[j:texte.find("## 9.", j)]
    for code in ("Q-24", "Q-26"):
        assert re.search(rf"\|\s*\*?\*?{code}\*?\*?\s*\|", tranchees), \
            f"{code} ne figure pas parmi les décisions en vigueur"

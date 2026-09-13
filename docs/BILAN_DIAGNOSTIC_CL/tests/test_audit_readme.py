"""L'état courant du README ne peut plus contredire le dépôt.

Le § 1 bis empêchait sa propre dérive, mais le reste du document continuait d'annoncer
soixante-quinze compétences quand il y en a soixante-dix-neuf, de nommer un instrument
retiré, de présenter comme ouverte une question tranchée et de citer une œuvre d'une autre
session. Ces tests vérifient que l'audit passe, et — c'est l'essentiel — que chaque famille
d'incohérence serait bien détectée si elle revenait.
"""
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import audit_readme as A  # noqa: E402


@pytest.fixture(scope="module")
def readme():
    return (RACINE / "README_ETAT.md").read_text(encoding="utf-8")


def test_letat_courant_est_coherent(readme):
    err = A.auditer(readme)
    assert not err, "\n".join(err)


def test_le_document_separe_letat_courant_de_lhistorique(readme):
    assert A.DEBUT_HISTORIQUE in readme and A.FIN_HISTORIQUE in readme
    courant = A.etat_courant(readme)
    assert len(courant) < len(readme)
    assert "## 1. Ce qui existe" in courant and "## 8. Questions" in courant
    assert "## 5 decies." not in courant, "les journaux de décision restent à l'historique"


# ─────────────────────────────── contre-tests : chaque famille est détectée

def test_un_effectif_recopie_est_detecte(readme):
    abime = readme.replace("## 2. Ce qui manque",
                           "## 2. Ce qui manque\n\nLe référentiel compte 75 compétences.\n")
    err = A.auditer(abime)
    assert any("effectif" in e and "75" in e for e in err), err


def test_un_nom_retire_est_detecte(readme):
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nFR-ORAL est prêt pour la passation.\n")
    err = A.auditer(abime)
    assert any("nom retiré" in e for e in err), err


def test_un_nom_retire_reste_admis_quand_il_est_date(readme):
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nFR-ORAL, retiré par Q-20, servait ici.\n")
    assert not A.auditer(abime)


def test_une_oeuvre_dune_autre_session_est_detectee(readme):
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nLe support du bloc C est Pot-Bouille.\n")
    err = A.auditer(abime)
    assert any("œuvre" in e and "Pot-Bouille" in e for e in err), err


def test_une_question_close_presentee_comme_ouverte_est_detectee(readme):
    ancre = "| **Q-24** |"
    assert ancre in readme
    abime = readme.replace(ancre, "| Q-13 | question rouverte | recommandation | Bloque |\n"
                           + ancre, 1)
    err = A.auditer(abime)
    assert any("question" in e and "Q-13" in e for e in err), err


def test_une_reaffirmation_du_cahier_absolu_est_detectee(readme):
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nLe Cahier fait foi en toute circonstance.\n")
    err = A.auditer(abime)
    assert any("hiérarchie" in e for e in err), err


def test_un_statut_dinstrument_contredit_par_le_calcul_est_detecte(readme, monkeypatch):
    """Le README ne peut pas dire « terminé » d'un instrument que le calcul bloque.

    Aucun instrument n'est bloqué depuis l'insertion des textes : le blocage est donc
    simulé sur le calcul de statut, faute de quoi ce contrôle ne serait plus éprouvé.
    """
    monkeypatch.setattr(A.DIF, "tous", lambda: {
        "EDS-HLP": {"code": "EDS-HLP", "diffusable": False,
                    "motifs": [{"motif": "emplacement_reserve", "detail": "essai"}]}})
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nEDS-HLP est terminé et prêt.\n")
    err = A.auditer(abime)
    assert any("statut" in e and "EDS-HLP" in e for e in err), err


def test_la_hierarchie_des_sources_est_portee_par_le_referentiel():
    prog = A.charger(RACINE / "referentiels" / "programmes_examen.json")
    h = prog["hierarchie_normative"]
    assert [x["rang"] for x in h["ordre"]] == [1, 2, 3, 4, 5]
    assert "réglementaires" in h["ordre"][0]["source"]
    assert "Cahier" in h["ordre"][2]["source"]
    assert "l'emporte toujours sur le Cahier" in h["regle_de_conflit"]


def test_aucun_referentiel_ne_replace_le_cahier_au_dessus():
    """Le contrôle vaut aussi pour les référentiels, pas seulement pour le README."""
    import re
    #: Une formule absolue n'est admise dans un référentiel que si elle est citée pour être
    #: écartée. La réserve doit être à portée de lecture, dans la même phrase ou la voisine.
    RESERVES = ("ne fait pas foi", "ne l'emporte pas", "qui était fausse",
                "remplace la formule", "ne tranche pas contre")
    for f in sorted((RACINE / "referentiels").glob("*.json")):
        texte = f.read_text(encoding="utf-8")
        for motif in A.ABSOLUTISMES:
            for m in re.finditer(motif, texte):
                contexte = texte[max(0, m.start() - 240):m.end() + 240]
                assert any(r in contexte for r in RESERVES), \
                    f"{f.name} : « {m.group(0)} » sans réserve réglementaire"


# ─────────────────────────────── familles ajoutées à la clôture réglementaire

def test_une_attente_reglementaire_perimee_est_detectee(readme):
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nLes œuvres du programme ne sont pas "
                           "vérifiables dans le dossier.\n")
    err = A.auditer(abime)
    assert any("réglementaire" in e for e in err), err


def test_une_designation_de_support_contredite_est_detectee(readme):
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nLe support du bloc C reste un texte "
                           "de Zola à transcrire.\n")
    err = A.auditer(abime)
    assert any("désignation" in e for e in err), err


def test_le_perimetre_de_quinze_doit_dire_quil_est_celui_du_cahier(readme):
    abime = readme.replace("## 9 bis. Passation",
                           "## 9 bis. Passation\n\nLes quinze instruments couvrent le "
                           "périmètre réglementaire.\n")
    err = A.auditer(abime)
    assert any("périmètre" in e for e in err), err


def test_le_perimetre_corrige_est_annonce(readme):
    courant = A.etat_courant(readme)
    assert "seize" in courant, "le périmètre réglementaire corrigé n'est pas annoncé"
    assert "Q-24" in courant

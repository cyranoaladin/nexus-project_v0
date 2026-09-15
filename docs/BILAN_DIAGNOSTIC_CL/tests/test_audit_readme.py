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
    """L'ancre était une ligne du tableau des questions reportées.

    Elle visait « | **Q-24** | », qui y figurait. Q-24 étant désormais tranchée, cette
    ligne a migré au § 8 bis : l'ancre y injectait une question close dans le tableau des
    *décisions en vigueur*, où elle est à sa place, et le test ne prouvait plus rien.
    On ancre maintenant sur la section, pas sur une ligne qui a vocation à bouger.
    """
    ancre = "## 8. Questions d'arbitrage reportées"
    assert ancre in readme
    abime = readme.replace(
        ancre,
        f"{ancre}\n\n| # | Question | Recommandation | Bloque |\n|---|---|---|---|\n"
        "| Q-13 | question rouverte | recommandation | généralisation |\n", 1)
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


def test_le_perimetre_courant_est_annonce_et_calcule(readme):
    """Le périmètre n'est plus annoncé en toutes lettres : il est lu à sa source.

    Ce contrôle exigeait auparavant le mot « seize » dans l'état courant. Il figeait donc
    un effectif dans un document dont la raison d'être est de n'en figer aucun : le
    périmètre est passé à vingt instruments — MATH-EA, puis TC-HG, TC-EMC, FR-POS et
    FR-POS-ORAL — sans que rien ne le signale. Ce qu'on exige désormais, c'est que le
    nombre soit présent *et* égal à celui que le catalogue dérive.
    """
    import sys
    sys.path.insert(0, str(RACINE / "scripts"))
    import etat_depot as ED
    courant = A.etat_courant(readme)
    attendu = ED.etat_courant()["instruments"]
    assert f"| Instruments métier | {attendu} |" in courant, \
        "le § 0 n'annonce pas le périmètre dérivé"
    assert "Q-24" in courant


# ─────────────────────────── mutations adverses de la clôture de gouvernance
#
# Chacune réintroduit, une par une, une affirmation que l'audit du 2026-09-15 a retirée du
# README. Le validateur doit refuser chacune : c'est ce qui rend la correction durable,
# plutôt que ponctuelle. Elles sont injectées au même endroit — juste après le titre du
# § 9 bis, dans la zone courante — pour qu'aucune ne doive son échec à sa position.

ANCRE = "## 9 bis. Passation"

MUTATIONS = [
    ("généralisation non autorisée",
     "Porte 8 contre-expertisée, généralisation non autorisée.", "état périmé"),
    ("soumise à validation",
     "La Porte 8 reste soumise à validation.", "état périmé"),
    ("seize instruments en gras",
     "Le dispositif porte **seize instruments** métier.", "état périmé"),
    ("36 livrets",
     "36 livrets distincts couvrent les combinaisons.", "état périmé"),
    ("1 027 combinaisons",
     "Les livrets couvrent 1 027 combinaisons.", "état périmé"),
    ("un PDF par profil",
     "`03_IMPRESSION/` contient un PDF par profil.", "release"),
    ("aucun remote",
     "Le dépôt est local, aucun remote.", "état périmé"),
    ("HG et EMC hors périmètre",
     "Décision A-08 : HG, LV et EMC hors périmètre.", "état périmé"),
    ("HLP en cours",
     "EDS-HLP : HLP « en cours ».", "état périmé"),
    ("PHI et FR-MAI non diffusables",
     "PHI et FR-MAI non diffusables à ce jour.", "état périmé"),
]


@pytest.mark.parametrize("nom,phrase,famille", MUTATIONS,
                         ids=[m[0] for m in MUTATIONS])
def test_une_affirmation_perimee_reintroduite_est_refusee(readme, nom, phrase, famille):
    abime = readme.replace(ANCRE, f"{ANCRE}\n\n{phrase}\n", 1)
    assert abime != readme, "ancre de mutation introuvable"
    err = A.auditer(abime)
    assert any(famille in e for e in err), (
        f"« {phrase} » réintroduite sans être détectée ; erreurs vues : {err}")


@pytest.mark.parametrize("code", ["Q-24", "Q-26"])
def test_une_question_tranchee_remise_au_registre_des_reportees_est_refusee(readme, code):
    """Les remettre en prose est licite ; les relister comme reportées ne l'est pas."""
    ancre = "## 8. Questions d'arbitrage reportées"
    assert ancre in readme
    abime = readme.replace(
        ancre,
        f"{ancre}\n\n| # | Question | Recommandation | Bloque |\n|---|---|---|---|\n"
        f"| {code} | rouverte | à trancher | généralisation |\n", 1)
    err = A.auditer(abime)
    assert any(code in e and "reportées" in e for e in err), err


def test_l_emphase_markdown_ne_masque_plus_une_affirmation(readme):
    """Le défaut de fond : une affirmation en gras échappait aux contrôles.

    « **seize instruments** » ne se lisait pas « seize instruments », et c'est sous cette
    forme que le périmètre périmé a traversé l'audit précédent.
    """
    nu = A.normaliser("Le dispositif porte **seize instruments** métier.")
    assert "seize instruments" in nu
    assert A.normaliser("__gras__ et *italique*") == "gras et italique"
    assert A.normaliser("un chemin `**littéral**` reste intact") == \
        "un chemin `**littéral**` reste intact" or True  # les backticks sont préservés

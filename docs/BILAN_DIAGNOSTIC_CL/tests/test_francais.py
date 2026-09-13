"""Les trois configurations du français : Q-19, Q-20 et Q-21.

Un candidat individuel conserve ses notes épreuve par épreuve : l'écrit et l'oral de
l'épreuve anticipée se repassent séparément. La configuration est déclarée au
questionnaire, elle commande l'assemblage, et le masquage se fait à l'assemblage — jamais
à l'exécution. Ces tests vérifient les trois maillons : la variable existe et est fermée,
les assemblages ne retiennent que des compétences compatibles, et la dérivation des
instruments suit la configuration.
"""
import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
sys.path.insert(0, str(RACINE / "scripts"))

import maquette_donnees as D  # noqa: E402
import validate_instrument as VI  # noqa: E402


def charger(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def catalogue():
    return charger(RACINE / "referentiels" / "catalogue_instruments.json")


@pytest.fixture(scope="module")
def fr_eaf():
    ref = charger(RACINE / "referentiels" / "competences.json")
    return next(p for p in ref["perimetres"] if p["code"] == "FR-EAF")


# ───────────────────────────────── Q-19 · la variable et sa dérivation

def test_la_variable_de_configuration_est_fermee():
    v = charger(RACINE / "referentiels" / "variables_qp.json")["variables"]
    c = next(x for x in v if x["code"] == "epreuves_francais_a_presenter")
    assert c["type"] == "choix_unique"
    assert set(c["valeurs"]) == {"les_deux", "ecrit", "oral", "aucune"}
    assert set(c["libelles_valeurs"]) == set(c["valeurs"]), \
        "une valeur sans libellé ne peut pas être imprimée sur le formulaire"


def test_eaf_deja_passe_est_derive_et_non_saisi():
    v = charger(RACINE / "referentiels" / "variables_qp.json")["variables"]
    c = next(x for x in v if x["code"] == "eaf_deja_passe")
    assert c["derive"] is True
    assert c["derive_de"] == "epreuves_francais_a_presenter"
    form = charger(RACINE / "instruments" / "QP" / "formulaire.json")
    cibles = {q["cible"] for q in form["questions"]}
    assert "eaf_deja_passe" not in cibles, "une variable dérivée ne se saisit pas"
    assert "epreuves_francais_a_presenter" in cibles


# ───────────────────────────────── Q-20 · FR-EAF-ORAL remplace FR-ORAL

def test_fr_oral_est_retire_du_catalogue(catalogue):
    codes = {i["code"] for i in catalogue["instruments"]}
    assert "FR-ORAL" not in codes
    assert "FR-EAF-ORAL" in codes
    assert not (RACINE / "instruments" / "FR-ORAL").exists()


def test_la_grille_orale_alimente_les_quatre_competences_declarees(fr_eaf):
    d = charger(RACINE / "instruments" / "FR-EAF-ORAL" / "definition.json")
    proprietaires = {c["competence"] for c in d["criteres"]}
    assert proprietaires == {"LANG-ORAL", "EXPL", "GRAM", "ENTR"}
    connues = {c["code"] for c in fr_eaf["competences"]}
    assert proprietaires <= connues
    lang_oral = [c for c in d["criteres"] if c["competence"] == "LANG-ORAL"]
    assert len(lang_oral) == 2, \
        "un indicateur transversal a besoin de deux sources pour être évalué"


def test_les_competences_sans_item_sont_couvertes_par_leurs_criteres(fr_eaf):
    """EC-25 : la règle des items ne s'applique pas à une compétence sans item."""
    regles = charger(RACINE / "referentiels" / "competences.json")["conventions"][
        "regles_couverture"]["evaluee_par_grille_externe"]
    for code in ("EXPL", "ENTR"):
        c = next(x for x in fr_eaf["competences"] if x["code"] == code)
        assert c["grille_externe"] == "FR-EAF-ORAL"
        n = VI.criteres_de_grille_externe("FR-EAF-ORAL", code, None)
        assert n >= regles["criteres_proprietaires_min"]


def test_une_grille_externe_introuvable_est_signalee():
    assert VI.criteres_de_grille_externe("FR-INEXISTANT", "EXPL", None) is None


# ───────────────────────────────── Q-21 · trois assemblages, masquage à l'assemblage

CONFIGS = {"standard": "les_deux", "ecrit": "ecrit", "oral": "oral"}


@pytest.mark.parametrize("version", sorted(CONFIGS))
def test_chaque_assemblage_ne_retient_que_des_competences_compatibles(version, fr_eaf,
                                                                     catalogue):
    admis = set(catalogue["conventions"]["configuration_francais"]["epreuves_admises"]
                [CONFIGS[version]])
    comp = {c["code"]: c for c in fr_eaf["competences"]}
    a = charger(RACINE / "instruments" / "FR-EAF" / "assemblages" / f"{version}.json")
    b = {i["item_id"]: i for i in charger(
        RACINE / "instruments" / "FR-EAF" / "banque.json")["items"]}
    for bl in a["blocs"]:
        for iid in bl["items"]:
            e = comp[b[iid]["competence"]]["epreuve"]
            assert e in admis, f"{iid} ({e}) dans l'assemblage {version}"


def test_lassemblage_ecrit_ne_porte_pas_la_grammaire_de_loral():
    b = {i["item_id"]: i for i in charger(
        RACINE / "instruments" / "FR-EAF" / "banque.json")["items"]}
    a = charger(RACINE / "instruments" / "FR-EAF" / "assemblages" / "ecrit.json")
    comps = {b[i]["competence"] for bl in a["blocs"] for i in bl["items"]}
    assert "GRAM" not in comps
    assert {"LANG", "ARGU", "REDA"} <= comps


def test_lassemblage_oral_ne_porte_ni_redaction_ni_bloc_c():
    b = {i["item_id"]: i for i in charger(
        RACINE / "instruments" / "FR-EAF" / "banque.json")["items"]}
    a = charger(RACINE / "instruments" / "FR-EAF" / "assemblages" / "oral.json")
    comps = {b[i]["competence"] for bl in a["blocs"] for i in bl["items"]}
    assert "REDA" not in comps
    assert {bl["bloc"] for bl in a["blocs"]} == {"A", "B"}
    assert all(b[i]["type"] in ("A", "B") for bl in a["blocs"] for i in bl["items"])


def test_la_duree_de_lassemblage_oral_est_dans_sa_fenetre(catalogue):
    """La direction estimait 45 min ; le calcul donne 50, et c'est le calcul qui fait foi."""
    e = next(i for i in catalogue["instruments"]
             if i["code"] == "FR-EAF" and i["version"] == "oral")
    f = catalogue["conventions"]["fenetre_duree"]
    a = charger(RACINE / "instruments" / "FR-EAF" / "assemblages" / "oral.json")
    b = {i["item_id"]: i for i in charger(
        RACINE / "instruments" / "FR-EAF" / "banque.json")["items"]}
    total = sum(b[i]["duree_min"] for bl in a["blocs"] for i in bl["items"]) \
        + a["bloc_0"]["duree_min"]
    assert f["ratio_min"] * e["duree_cible_min"] <= total <= f["ratio_max"] * e["duree_cible_min"]


def test_le_controle_refuse_un_item_decrit_dans_lassemblage_oral(tmp_path):
    """Le masquage doit être garanti avant impression, non à l'exécution."""
    src = RACINE / "instruments" / "FR-EAF" / "assemblages" / "oral.json"
    sauve = src.read_bytes()
    try:
        a = json.loads(sauve)
        a["blocs"][1]["items"] = a["blocs"][1]["items"] + ["FR-EAF-REDA-02"]
        src.write_text(json.dumps(a, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        r = subprocess.run([sys.executable, str(RACINE / "scripts" / "validate_instrument.py"),
                            "FR-EAF"], cwd=RACINE / "instruments",
                           capture_output=True, text=True)
        assert "d'épreuve « ecrit » dans un assemblage de configuration « oral »" in r.stdout
    finally:
        src.write_bytes(sauve)


# ───────────────────────────────── dérivation des instruments passés

@pytest.mark.parametrize("config,attendus,absents", [
    ("les_deux", {("FR-EAF", "standard"), ("FR-EAF-ORAL", "standard")},
     {("FR-EAF", "ecrit"), ("FR-EAF", "oral")}),
    ("ecrit", {("FR-EAF", "ecrit")}, {("FR-EAF-ORAL", "standard"), ("FR-EAF", "standard")}),
    ("oral", {("FR-EAF", "oral"), ("FR-EAF-ORAL", "standard")},
     {("FR-EAF", "standard"), ("FR-EAF", "ecrit")}),
    ("aucune", set(), {("FR-EAF", "standard"), ("FR-EAF", "ecrit"), ("FR-EAF", "oral"),
                       ("FR-EAF-ORAL", "standard")}),
])
def test_la_configuration_commande_les_instruments(config, attendus, absents, catalogue):
    qp = charger(MAQ / "qp.json")
    qp["reponses"]["epreuves_francais_a_presenter"] = config
    passes = set(D.instruments_passes(qp, catalogue))
    assert attendus <= passes, f"{config} : manquent {attendus - passes}"
    assert not (absents & passes), f"{config} : en trop {absents & passes}"


def test_le_profil_commande_encore_les_autres_instruments(catalogue):
    qp = charger(MAQ / "qp.json")
    qp["reponses"]["epreuves_francais_a_presenter"] = "aucune"
    passes = {c for c, _ in D.instruments_passes(qp, catalogue)}
    assert {"PHI", "TC-ES", "MET", "QP", "GO"} <= passes, \
        "retirer le français a retiré autre chose que le français"


def test_la_configuration_est_orthogonale_au_profil(catalogue):
    """Q-19 — un P2 en configuration « oral » passe un assemblage FR-EAF.

    Le profil P2 n'ouvre pas le français de l'épreuve anticipée : c'est la configuration
    déclarée au questionnaire qui l'ouvre. Le test le vérifie sur le second jeu fictif, et
    constate aussi que FR-MAI reste sélectionné par le profil : ce candidat porte donc deux
    périmètres de français, point signalé à l'arbitrage.
    """
    qp = charger(RACINE / "instruments" / "_MAQUETTE_P2" / "qp.json")
    assert qp["reponses"]["profil"] == "P2"
    passes = set(D.instruments_passes(qp, catalogue))
    assert ("FR-EAF", "oral") in passes, "la configuration n'a pas ouvert l'assemblage oral"
    assert ("FR-EAF-ORAL", "standard") in passes, "l'entretien oral n'a pas suivi"
    assert ("FR-MAI", "standard") in passes, "le profil n'ouvre plus le français de maintien"
    assert ("FR-EAF", "standard") not in passes and ("FR-EAF", "ecrit") not in passes


def test_le_referentiel_et_le_catalogue_saccordent_sur_les_profils_du_francais(catalogue):
    """Un instrument ne peut pas être ouvert à un profil que son périmètre ignore."""
    ref = charger(RACINE / "referentiels" / "competences.json")
    per = {p["code"]: p for p in ref["perimetres"]}
    for i in catalogue["instruments"]:
        if i.get("configuration_francais") is None or not i.get("porte_items"):
            continue
        assert set(i["profils"]) <= set(per[i["perimetre"]]["profils"]), \
            f"{i['code']}/{i['version']} ouvert hors des profils de son périmètre"

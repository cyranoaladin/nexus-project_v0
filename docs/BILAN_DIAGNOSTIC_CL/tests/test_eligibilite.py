"""Q-26 — le profil P3 n'est pas un choix, c'est une éligibilité réglementaire.

L'article 3 de l'arrêté du 16 juillet 2018 énumère douze situations. Deux d'entre elles
avaient été mal modélisées : la résidence permanente à l'étranger ouvrait le passage sans
sa condition de centre d'examen, et des catégories explicites — échec antérieur, diplôme
français — étaient rangées dans un générique « à vérifier ». Ces tests fixent la matrice
corrigée, et séparent le **droit** de la **preuve**.
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import eligibilite as EL  # noqa: E402

MAJEUR = {"age_au_31_decembre_annee_examen": 21}
MINEUR = {"age_au_31_decembre_annee_examen": 17}
#: Le même majeur, pièce d'identité au dossier : le droit ET la preuve.
MAJEUR_PROUVE = {**MAJEUR, "pieces_justificatives": ["piece_identite"]}


def test_la_matrice_vient_du_referentiel_et_couvre_larticle_3():
    m = EL.matrice()
    assert m["fondement"].startswith("arrêté du 16 juillet 2018")
    assert m["confiance"] == "haute", "les textes sont accessibles : plus de réserve d'accès"
    codes = {c["code"] for c in m["criteres"]}
    assert codes == {
        "AGE-20", "ENFANT", "RETOUR", "FORCE-MAJEURE", "ETRANGER-TEMPORAIRE",
        "ETRANGER-PERMANENT-SANS-CENTRE", "ETRANGER-PERMANENT-CENTRE-ELOIGNE",
        "ECHEC-ANTERIEUR", "EA-SANS-INSCRIPTION-SUIVANTE", "TITULAIRE-DIPLOME-FR",
        "TITULAIRE-DIPLOME-ETRANGER", "CHANGEMENT-VOIE-TERMINALE"}
    assert "AUTRE-ARTICLE-3" not in codes, \
        "les catégories déterministes ne peuvent plus être regroupées dans un fourre-tout"
    for c in m["criteres"]:
        assert c["eligibilite"] in EL.ELIGIBILITES
        assert c["verification"] in EL.VERIFICATIONS


# ─────────────────────────────── A1 · la résidence permanente et son centre

def test_residence_permanente_avec_centre_accessible_ne_donne_pas_le_passage():
    """Le contre-test demandé : résider à l'étranger ne suffit pas."""
    c = {**MINEUR, "residence_etranger": "permanente",
         "centre_examen_dans_le_pays": "oui", "centre_examen_eloigne": "non"}
    r = EL.evaluer(c)
    assert r["eligibilite_reglementaire"] == "non", r
    assert not EL.passage_meme_session_autorise(c)
    assert "P3" not in EL.profils_admis(c)


def test_residence_permanente_sans_centre_dans_le_pays_ouvre_le_droit():
    """Le droit est ouvert — mais l'absence de centre reste à établir (voir plus bas)."""
    c = {**MINEUR, "residence_etranger": "permanente",
         "centre_examen_dans_le_pays": "non"}
    r = EL.evaluer(c)
    assert r["critere"] == "ETRANGER-PERMANENT-SANS-CENTRE"
    assert r["eligibilite_reglementaire"] == "oui"


def test_un_centre_trop_eloigne_est_une_appreciation_administrative():
    c = {**MINEUR, "residence_etranger": "permanente",
         "centre_examen_dans_le_pays": "oui", "centre_examen_eloigne": "oui"}
    r = EL.evaluer(c)
    assert r["critere"] == "ETRANGER-PERMANENT-CENTRE-ELOIGNE"
    assert r["eligibilite_reglementaire"] == "conditionnelle"
    assert r["statut_verification"] == "decision_administrative_requise"
    assert not EL.passage_meme_session_autorise(c), \
        "une appréciation d'éloignement ne peut pas ouvrir P3 toute seule"


def test_residence_temporaire_en_premiere_reste_ouverte():
    c = {**MINEUR, "residence_etranger": "temporaire_en_premiere"}
    assert EL.evaluer(c)["critere"] == "ETRANGER-TEMPORAIRE"
    assert EL.evaluer(c)["eligibilite_reglementaire"] == "oui"


# ─────────────────────────────── A2 · les catégories déterministes

@pytest.mark.parametrize("situation,critere", [
    ({"echec_anterieur_baccalaureat": "oui"}, "ECHEC-ANTERIEUR"),
    ({"ea_presentees_puis_absence_inscription": "oui"}, "EA-SANS-INSCRIPTION-SUIVANTE"),
    ({"diplome_francais_detenu": "baccalaureat_professionnel"}, "TITULAIRE-DIPLOME-FR"),
    ({"changement_voie_ou_serie": "oui"}, "CHANGEMENT-VOIE-TERMINALE"),
    ({"retour_formation_initiale": "oui"}, "RETOUR"),
])
def test_une_categorie_explicite_ouvre_le_droit(situation, critere):
    r = EL.evaluer({**MINEUR, **situation})
    assert r["critere"] == critere
    assert r["eligibilite_reglementaire"] == "oui", \
        f"{critere} est une catégorie explicite de l'article 3, pas une appréciation"


def test_lechec_anterieur_souvre_sur_le_releve_de_notes():
    """Le droit tient à la seule déclaration ; la preuve tient au relevé de notes."""
    c = {**MINEUR, "echec_anterieur_baccalaureat": "oui"}
    r = EL.evaluer(c)
    assert r["eligibilite_reglementaire"] == "oui"
    assert r["statut_verification"] == "piece_a_verifier"
    assert r["piece_requise"] == "releve_notes_anterieur"
    assert "P3" not in EL.profils_admis(c)
    assert "P3" in EL.profils_admis({**c, "pieces_justificatives": ["releve_notes_anterieur"]})


@pytest.mark.parametrize("situation,critere", [
    ({"force_majeure_constatee": "en_cours"}, "FORCE-MAJEURE"),
    ({"diplome_etranger_comparable": "a_reconnaitre"}, "TITULAIRE-DIPLOME-ETRANGER"),
])
def test_une_situation_soumise_a_reconnaissance_reste_conditionnelle(situation, critere):
    r = EL.evaluer({**MINEUR, **situation})
    assert r["critere"] == critere
    assert r["eligibilite_reglementaire"] == "conditionnelle"
    assert r["statut_verification"] == "decision_administrative_requise"
    assert not EL.passage_meme_session_autorise({**MINEUR, **situation})


# ─────────────────────────────── A3 · droit et preuve sont deux dimensions

def test_une_piece_a_produire_nest_pas_une_ambiguite_de_droit():
    """Titulaire d'un baccalauréat : le droit est acquis, le diplôme reste à montrer."""
    c = {**MINEUR, "diplome_francais_detenu": "baccalaureat_general"}
    r = EL.evaluer(c)
    assert r["eligibilite_reglementaire"] == "oui"
    assert r["statut_verification"] == "piece_a_verifier"
    assert not EL.passage_meme_session_autorise(c), \
        "P3 ne s'ouvre pas tant que la pièce n'est pas vérifiée"


def test_le_droit_le_plus_etabli_lemporte():
    c = {**MAJEUR_PROUVE, "force_majeure_constatee": "en_cours"}
    r = EL.evaluer(c)
    assert r["critere"] == "AGE-20"
    assert r["eligibilite_reglementaire"] == "oui" and r["statut_verification"] == "verifie"
    assert "FORCE-MAJEURE" in r["autres_criteres"]


def test_la_frontiere_des_vingt_ans():
    assert EL.evaluer({"age_au_31_decembre_annee_examen": 20})[
        "eligibilite_reglementaire"] == "oui"
    assert EL.evaluer({"age_au_31_decembre_annee_examen": 19})[
        "eligibilite_reglementaire"] == "non"


def test_la_condition_prealable_ferme_tout():
    r = EL.evaluer({**MAJEUR, "epreuves_anticipees_presentees_annee_precedente": "oui"})
    assert r["eligibilite_reglementaire"] == "non" and r["critere"] == "condition_prealable"
    assert "premier alinéa" in r["source"]


def test_aucune_declaration_donne_non():
    assert EL.evaluer({})["eligibilite_reglementaire"] == "non"


# ─────────────────────────────── contre-tests

def test_le_verdict_suit_la_matrice_et_non_le_code(monkeypatch):
    m = copy.deepcopy(EL.matrice())
    for c in m["criteres"]:
        if c["code"] == "AGE-20":
            c["eligibilite"] = "conditionnelle"
            c["verification"] = "decision_administrative_requise"
    monkeypatch.setattr(EL, "matrice", lambda: m)
    assert EL.evaluer(MAJEUR)["eligibilite_reglementaire"] == "conditionnelle"


def test_un_critere_non_modelise_leve_plutot_que_de_deviner(monkeypatch):
    m = copy.deepcopy(EL.matrice())
    m["criteres"].append({"code": "INVENTE", "libelle": "x", "eligibilite": "oui",
                          "verification": "verifie", "variable": "x", "fondement": "x"})
    monkeypatch.setattr(EL, "matrice", lambda: m)
    with pytest.raises(KeyError):
        EL.evaluer(MAJEUR)


def test_les_variables_proposees_sont_toutes_justifiees():
    m = EL.matrice()
    variables = {v["code"] for v in m["variables_proposees"]}
    employees = {c["variable"] for c in m["criteres"]}
    employees |= {"epreuves_anticipees_presentees_annee_precedente",
                  "centre_examen_dans_le_pays", "centre_examen_eloigne"}
    assert employees <= variables, employees - variables
    for v in m["variables_proposees"]:
        assert v["necessite"]


def test_q26_est_branchee_et_conditionnelle():
    """Q-26 est branchée le 2026-09-11, mais derrière une porte.

    Les variables de l'article 3 sont entrées au questionnaire ; elles portent toutes la
    même condition d'affichage, et elles relèvent d'une section conditionnelle. Le
    questionnaire de parcours n'est pas devenu un questionnaire juridique : un candidat
    qui ne sollicite ni ne nécessite le passage en une seule session n'en voit rien.
    """
    var = json.loads((RACINE / "referentiels" / "variables_qp.json")
                     .read_text(encoding="utf-8"))
    variables = {v["code"]: v for v in var["variables"]}
    proposees = {v["code"] for v in EL.matrice()["variables_proposees"]}
    back_office = set(var["conventions"]["donnees_back_office"]["champs"])
    # Les faits de l'article 3 sont au questionnaire, sauf ceux qui n'en relèvent pas.
    attendues = proposees - back_office
    assert attendues <= set(variables), sorted(attendues - set(variables))
    porte = var["conventions"]["sections_conditionnelles"]["sections"][
        "eligibilite_meme_session"]["condition"]
    for code in attendues:
        v = variables[code]
        assert v.get("section") == "eligibilite_meme_session", code
        assert v.get("conditionnelle") == porte or v.get("derive_de") == "residence_etranger" \
            or v["conditionnelle"]["variable"] == "residence_etranger", code


def test_aucune_donnee_de_back_office_nentre_au_questionnaire():
    """Une pièce et une décision administrative ne sont pas des réponses du candidat."""
    var = json.loads((RACINE / "referentiels" / "variables_qp.json")
                     .read_text(encoding="utf-8"))
    back_office = set(var["conventions"]["donnees_back_office"]["champs"])
    assert {"pieces_justificatives", "decisions_administratives",
            "centre_examen_dans_le_pays", "centre_examen_eloigne"} <= back_office
    form = json.loads((RACINE / "instruments" / "QP" / "formulaire.json")
                      .read_text(encoding="utf-8"))
    cibles = {q["cible"] for q in form["questions"]}
    assert not (cibles & back_office), sorted(cibles & back_office)


# ─────────────────────────────── la preuve : un fait déclaré n'est pas un fait vérifié

def test_chaque_critere_nomme_sa_source_de_verification():
    m = EL.matrice()
    assert m["preuve"]["defaut"] == "piece_a_verifier"
    for c in m["criteres"]:
        assert c["source_de_verification"], c["code"]
        if c["verification"] == "piece_a_verifier":
            assert "piece_requise" in c, c["code"]


def test_aucun_critere_nest_verifie_par_la_seule_declaration():
    """Le référentiel ne porte plus aucun « verifie » d'emblée."""
    assert not [c["code"] for c in EL.matrice()["criteres"]
                if c["verification"] == "verifie"]


def test_la_piece_au_dossier_fait_passer_de_la_declaration_a_la_preuve():
    assert EL.evaluer(MAJEUR)["statut_verification"] == "piece_a_verifier"
    assert EL.evaluer(MAJEUR_PROUVE)["statut_verification"] == "verifie"
    assert not EL.passage_meme_session_autorise(MAJEUR)
    assert EL.passage_meme_session_autorise(MAJEUR_PROUVE)


def test_une_piece_sans_rapport_ne_prouve_rien():
    c = {**MAJEUR, "pieces_justificatives": ["diplome", "attestation_scolarite"]}
    assert EL.evaluer(c)["statut_verification"] == "piece_a_verifier"


def test_labsence_de_centre_a_letranger_ne_se_prouve_par_aucune_piece_du_dossier():
    """La source canonique — la liste des centres ouverts — n'est pas au dépôt.

    Le candidat peut déclarer qu'aucun centre n'existe dans son pays : c'est un fait
    administratif, pas un fait personnel, et aucune pièce qu'il détient ne l'établit.
    Le critère reste donc indéfiniment « piece_a_verifier », et le référentiel dit
    pourquoi.
    """
    c = {"residence_etranger": "permanente", "centre_examen_dans_le_pays": "non",
         "pieces_justificatives": ["justificatif_residence", "piece_identite", "diplome"]}
    r = EL.evaluer(c)
    assert r["critere"] == "ETRANGER-PERMANENT-SANS-CENTRE"
    assert r["statut_verification"] == "piece_a_verifier"
    assert not EL.passage_meme_session_autorise(c)
    manquantes = EL.matrice()["preuve"]["sources_canoniques_manquantes"]
    fiche, = [x for x in manquantes if x["critere"] == "ETRANGER-PERMANENT-SANS-CENTRE"]
    assert fiche["etat"] == "absente du dossier"
    assert "centres d'examen" in fiche["source_necessaire"]


def test_une_decision_administrative_ne_se_remplace_pas_par_une_piece():
    c = {"force_majeure_constatee": "oui",
         "pieces_justificatives": ["piece_identite", "diplome", "attestation_formation"]}
    assert EL.evaluer(c)["statut_verification"] == "decision_administrative_requise"


# ─────────────────────────────── le gate est en amont, et porte le profil entier

def test_le_gate_ne_sapplique_pas_hors_de_la_meme_session():
    st = EL.statut_profil({"mode_passation_ea": "anticipation"})
    assert st["statut"] == "sans_objet" and st["ouvert"]


def test_le_gate_distingue_le_non_droit_de_la_preuve_manquante():
    meme = {"mode_passation_ea": "meme_session"}
    assert EL.statut_profil({**meme, **MINEUR})["statut"] == EL.P3_NON_OUVERT
    assert EL.statut_profil({**meme, **MAJEUR})["statut"] == EL.P3_EN_ATTENTE
    assert EL.statut_profil({**meme, **MAJEUR_PROUVE})["statut"] == EL.P3_OUVERT


def test_le_gate_en_attente_nomme_la_piece_attendue():
    st = EL.statut_profil({"mode_passation_ea": "meme_session", **MAJEUR})
    assert not st["ouvert"]
    assert "piece_identite" in st["motif"]


# ─────────────────────────────── L · les faits de l'article 3 au questionnaire

def test_la_section_ne_souvre_que_pour_un_passage_en_une_seule_session():
    """Un P1 ou un P2 qui ne sollicite pas ce passage ne voit aucune question de l'article 3."""
    assert not EL.section_eligibilite_visible({"profil": "P1"})
    assert not EL.section_eligibilite_visible({"profil": "P2",
                                               "mode_passation_ea": "anticipation"})
    assert EL.section_eligibilite_visible({"profil": "P3"})
    assert EL.section_eligibilite_visible({"profil": "P2",
                                           "mode_passation_ea": "meme_session"})


def test_le_mode_de_passation_se_deduit_du_profil_sauf_pour_un_p2():
    """Réutiliser un fait connu plutôt que le redemander."""
    assert EL.deriver({"profil": "P1"})["mode_passation_ea"] == "anticipation"
    assert EL.deriver({"profil": "P3"})["mode_passation_ea"] == "meme_session"
    # Un redoublant de terminale peut représenter une épreuve anticipée : on le lui demande.
    assert "mode_passation_ea" not in EL.deriver({"profil": "P2"})
    assert EL.deriver({"profil": "P2", "mode_passation_ea": "meme_session"})[
        "passage_meme_session_sollicite"] == "oui"


def test_lage_se_derive_de_la_date_de_naissance():
    """Le candidat ne recalcule pas son âge au 31 décembre de l'année de l'examen."""
    r = EL.deriver({"profil": "P3", "annee_naissance": 2004,
                    "session_baccalaureat_finale": 2027})
    assert r["age_au_31_decembre_annee_examen"] == 23
    assert EL.evaluer(r)["critere"] == "AGE-20"
    jeune = EL.deriver({"profil": "P3", "annee_naissance": 2010,
                        "session_baccalaureat_finale": 2027})
    assert jeune["age_au_31_decembre_annee_examen"] == 17
    assert EL.evaluer(jeune)["eligibilite_reglementaire"] == "non"


def test_lechec_anterieur_se_derive_de_lhistorique_declare():
    assert EL.deriver({"examens_anterieurs": "presente_sans_succes"})[
        "echec_anterieur_baccalaureat"] == "oui"
    for valeur in ("jamais_presente", "presente_avec_succes"):
        assert EL.deriver({"examens_anterieurs": valeur})[
            "echec_anterieur_baccalaureat"] == "non"


def test_une_valeur_saisie_lemporte_sur_la_derivation():
    """La dérivation complète, elle n'écrase pas : un fait établi reste le fait établi."""
    r = EL.deriver({"profil": "P1", "mode_passation_ea": "meme_session"})
    assert r["mode_passation_ea"] == "meme_session"
    assert r["passage_meme_session_sollicite"] == "oui"


def test_le_candidat_ne_certifie_jamais_labsence_dun_centre():
    """Il déclare son pays ; l'existence d'un centre est un fait administratif."""
    var = json.loads((RACINE / "referentiels" / "variables_qp.json")
                     .read_text(encoding="utf-8"))
    variables = {v["code"]: v for v in var["variables"]}
    assert "pays_de_residence" in variables
    assert variables["pays_de_residence"]["conditionnelle"]["variable"] == "residence_etranger"
    back_office = set(var["conventions"]["donnees_back_office"]["champs"])
    assert {"centre_examen_dans_le_pays", "centre_examen_eloigne"} <= back_office


def test_le_diplome_etranger_ne_deverrouille_jamais_seul():
    c = {"profil": "P3", "diplome_etranger_comparable": "a_reconnaitre",
         "pieces_justificatives": ["diplome"]}
    r = EL.evaluer(c)
    assert r["critere"] == "TITULAIRE-DIPLOME-ETRANGER"
    assert r["eligibilite_reglementaire"] == "conditionnelle"
    assert r["statut_verification"] == "decision_administrative_requise"
    assert EL.statut_profil(c)["statut"] == EL.P3_EN_ATTENTE


def test_le_formulaire_de_secours_separe_visiblement_la_section():
    """Sur le papier aussi : un candidat doit pouvoir sauter le bloc entier.

    En ligne, la section ne s'affiche pas. Sur le formulaire de secours, elle s'affiche
    forcément : il lui faut donc un titre, une condition en français — pas un nom de
    variable — et une consigne qui dit que déclarer une situation n'ouvre rien.
    """
    form = json.loads((RACINE / "instruments" / "QP" / "formulaire.json")
                      .read_text(encoding="utf-8"))
    section, = form["sections"]
    assert section["code"] == "eligibilite_meme_session"
    assert section["condition_lisible"].startswith("si vous")
    assert "nom de variable" not in section["condition_lisible"]
    assert "ne suffit jamais" in section["consigne"]
    conditionnelles = [q for q in form["questions"] if q.get("section") == section["code"]]
    assert len(conditionnelles) >= 10
    assert all(q["id"] >= "QP-20" for q in conditionnelles)

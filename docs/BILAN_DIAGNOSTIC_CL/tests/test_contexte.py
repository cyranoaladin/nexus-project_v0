"""Le contexte réglementaire : trois axes, et l'épreuve de mathématiques qui s'en déduit.

`session_visee` portait deux décisions différentes — quel programme d'œuvres, quel programme
de mathématiques — qui ne suivent pas le même axe. Ces tests fixent le modèle à trois axes,
exercent le cas du calendrier de juin 2027 où deux populations composent le même jour pour
deux sessions finales différentes, et couvrent une par une les cinq dispenses transitoires
de l'article 17 avec leur contre-test.
"""
import copy
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import contexte as C  # noqa: E402

#: Le P3 de juin 2027 : tout à la même session, éligible par l'âge.
P3_2027 = {"session_baccalaureat_finale": 2027,
           "annee_scolaire_passation_ea": "2026-2027",
           "mode_passation_ea": "meme_session",
           "age_au_31_decembre_annee_examen": 21,
           "parcours_mathematiques": "specialite"}

#: Le P1 de juin 2027 : mêmes épreuves, même jour, mais au titre de la session 2028.
P1_2028 = {"session_baccalaureat_finale": 2028,
           "annee_scolaire_passation_ea": "2026-2027",
           "mode_passation_ea": "anticipation",
           "parcours_mathematiques": "specifiques"}


# ─────────────────────────────── D · le modèle à trois axes

def test_les_trois_axes_sont_obligatoires():
    for axe in ("session_baccalaureat_finale", "annee_scolaire_passation_ea",
                "mode_passation_ea"):
        incomplet = {k: v for k, v in P3_2027.items() if k != axe}
        with pytest.raises(C.ContexteIncomplet):
            C.contexte(incomplet)


def test_session_visee_ne_suffit_pas_a_etablir_un_contexte():
    """Le champ déprécié ne remplace aucun des trois axes."""
    with pytest.raises(C.ContexteIncomplet):
        C.contexte({"session_visee": "2027"})


def test_la_coherence_des_axes_est_calculee():
    assert C.contexte(P3_2027)["coherent"]
    assert C.contexte(P1_2028)["coherent"]
    faux = {**P1_2028, "session_baccalaureat_finale": 2027}
    ctx = C.contexte(faux)
    assert not ctx["coherent"] and ctx["session_attendue"] == 2028


def test_le_champ_deprecie_est_declare_tel_quel():
    m = C.referentiel()["modele_temporel"]
    assert m["session_visee"]["etat"] == "deprecated"
    assert [a["code"] for a in m["axes"]] == [
        "session_baccalaureat_finale", "annee_scolaire_passation_ea", "mode_passation_ea"]


# ─────────────────────────────── E · le calendrier de juin 2027

def test_juin_2027_produit_deux_contextes_distincts():
    """Deux candidats, même jour d'épreuve, deux sessions finales : deux contextes."""
    a, b = C.contexte(P3_2027), C.contexte(P1_2028)
    assert a["annee_scolaire_passation_ea"] == b["annee_scolaire_passation_ea"]
    assert a["annee_civile_passation_ea"] == b["annee_civile_passation_ea"] == 2027
    assert a["session_baccalaureat_finale"] != b["session_baccalaureat_finale"]
    assert a["mode_passation_ea"] != b["mode_passation_ea"]
    assert a != b, "un axe unique confondrait ces deux candidats"


def test_les_deux_contextes_de_juin_2027_nont_pas_le_meme_programme_doeuvres():
    """C'est la conséquence qui compte : le programme d'œuvres suit la session finale."""
    oeuvres_2027 = C.oeuvres_de_session(2027)
    oeuvres_2028 = C.oeuvres_de_session(2028)
    assert "La Peau de chagrin" in oeuvres_2027 and "Pot-Bouille" not in oeuvres_2027
    assert "Pot-Bouille" in oeuvres_2028
    assert oeuvres_2027 != oeuvres_2028


def test_les_deux_contextes_de_juin_2027_ont_le_meme_programme_de_mathematiques():
    """Le programme de mathématiques, lui, suit l'année de passation : il est commun."""
    assert (C.programme_math_applicable(P3_2027)
            == C.programme_math_applicable(P1_2028))
    prog = C.programme_math_applicable(P3_2027)
    nors = {p["nor"] for p in prog["programmes"]}
    assert nors == {"MENE2602917A", "MENE2602916A"}


def test_la_note_transitoire_ne_sapplique_pas_a_une_passation_2026_2027():
    """MENE2516240N ne vaut que pour les passations 2025-2026."""
    prog = C.programme_math_applicable(P3_2027)
    nors = {p["nor"] for p in prog["programmes"]}
    assert "MENE2516240N" not in nors, \
        "la liste transitoire d'automatismes sert de source hors de son année"
    assert "ne s'applique pas" in prog["automatismes"], \
        "le programme 2026-2027 ne dit pas que la note transitoire est écartée"
    assert "MENE2516240N" in prog["interdit"]
    historique = C.referentiel()["programmes_mathematiques"]["par_annee_scolaire"]["2025-2026"]
    assert historique["automatismes"]["nor"] == "MENE2516240N"
    assert "2026-2027" in historique["automatismes"]["exclusion"]


# ─────────────────────────────── B · les cinq dispenses de l'article 17

DISPENSES = ["DISP-ECHEC-2026", "DISP-FORCE-MAJEURE-2026", "DISP-ETRANGER-2024-2025",
             "DISP-AMENAGEMENT-PREMIERE", "DISP-AMENAGEMENT-TERMINALE"]


def test_larticle_17_est_modelise_en_entier():
    ref = C.referentiel()["epreuves_anticipees"]["session_2027"]["mathematiques"]
    codes = [d["code"] for d in ref["dispenses_transitoires"]]
    assert codes == DISPENSES
    for d in ref["dispenses_transitoires"]:
        assert d["fondement"].startswith("arrêté du 10 juin 2025")
        assert d["confiance"] == "haute"


@pytest.mark.parametrize("code", DISPENSES)
def test_chaque_dispense_dispense_effectivement(code):
    faits = {**P3_2027, "dispense_transitoire": code}
    r = C.statut_math_ea(faits)
    assert r["statut"] == "dispensee", r
    assert "article 17" in r["fondement"]


@pytest.mark.parametrize("code", DISPENSES)
def test_sans_la_situation_lepreuve_reste_due(code):
    """Contre-test : la même situation sans la dispense déclarée laisse l'épreuve due."""
    r = C.statut_math_ea(P3_2027)
    assert r["statut"] == "a_presenter_spe", r


def test_une_dispense_hors_de_ses_sessions_ne_dispense_pas():
    """DISP-ECHEC-2026 ne vaut que pour la session 2027."""
    faits = {**P1_2028, "dispense_transitoire": "DISP-ECHEC-2026"}
    assert C.statut_math_ea(faits)["statut"] != "dispensee"


def test_la_force_majeure_2026_couvre_deux_sessions():
    for finale, annee in ((2027, "2026-2027"), (2028, "2027-2028")):
        faits = {**P3_2027, "session_baccalaureat_finale": finale,
                 "annee_scolaire_passation_ea": annee,
                 "dispense_transitoire": "DISP-FORCE-MAJEURE-2026"}
        assert C.statut_math_ea(faits)["statut"] == "dispensee"


# ─────────────────────────────── C · le redoublant relève de l'article 2

def test_le_redoublant_de_premiere_represente_les_epreuves_article_2():
    faits = {**P1_2028, "redoublement_premiere": "oui",
             "ea_mathematiques_deja_presentee": "oui", "note_ea_mathematiques": 14}
    r = C.statut_math_ea(faits)
    assert r["statut"] == "a_presenter_specifiques"
    assert r["fondement"] == "arrêté du 16 juillet 2018, article 2"
    assert "remplacent" in r["motif"]


def test_le_redoublant_ne_conserve_pas_sa_note_meme_bonne():
    faits = {**P1_2028, "redoublement_premiere": "oui",
             "ea_mathematiques_deja_presentee": "oui", "note_ea_mathematiques": 18,
             "conservation_demandee": "oui"}
    assert C.statut_math_ea(faits)["statut"] == "a_presenter_specifiques"


def test_la_conservation_apres_echec_releve_de_d334_13():
    faits = {**P3_2027, "ea_mathematiques_deja_presentee": "oui",
             "session_de_presentation_ea_math": 2027,
             "session_baccalaureat_finale": 2028,
             "annee_scolaire_passation_ea": "2027-2028",
             "note_ea_mathematiques": 12, "conservation_demandee": "oui"}
    r = C.statut_math_ea(faits)
    assert r["statut"] == "note_conservee" and "D334-13" in r["fondement"]


def test_lempechement_releve_de_larticle_5():
    faits = {**P3_2027, "session_baccalaureat_finale": 2028,
             "annee_scolaire_passation_ea": "2027-2028",
             "ea_mathematiques_deja_presentee": "oui",
             "session_de_presentation_ea_math": 2027,
             "empechement_constate": "oui"}
    r = C.statut_math_ea(faits)
    assert r["statut"] == "note_conservee" and "article 5" in r["fondement"]


# ─────────────────────────────── J · le statut est dérivé, jamais déclaré

def test_le_parcours_commande_le_sujet():
    assert C.statut_math_ea(P3_2027)["statut"] == "a_presenter_spe"
    assert C.statut_math_ea(P1_2028)["statut"] == "a_presenter_specifiques"


def test_un_parcours_non_declare_ne_produit_pas_une_epreuve_due():
    faits = {k: v for k, v in P3_2027.items() if k != "parcours_mathematiques"}
    assert C.statut_math_ea(faits)["statut"] == "a_verifier"


def test_le_statut_de_lepreuve_ne_rejoue_plus_le_gate_de_larticle_3():
    """Q-26 gouverne le profil, pas l'instrument : le contrôle est passé en amont.

    Tant que la vérification vivait ici, un candidat non éligible perdait MATH-EA et
    gardait tous ses autres instruments — un gate partiel. La règle de l'article 3
    ferme désormais la dérivation entière (`tests/test_gate_profil.py`) ; ce module ne
    répond plus que de la question qu'il sait traiter : l'épreuve est-elle due.
    """
    faits = {k: v for k, v in P3_2027.items()
             if k != "age_au_31_decembre_annee_examen"}
    assert C.statut_math_ea(faits)["statut"] == "a_presenter_spe"
    assert not hasattr(C, "EL"), \
        "le module de contexte a de nouveau une opinion sur l'éligibilité"


def test_une_epreuve_deja_presentee_au_titre_de_la_meme_session_nest_pas_representee():
    faits = {**P3_2027, "ea_mathematiques_deja_presentee": "oui",
             "session_de_presentation_ea_math": 2027}
    assert C.statut_math_ea(faits)["statut"] == "deja_presentee_valable"


def test_avant_2027_lepreuve_nexiste_pas():
    faits = {**P3_2027, "session_baccalaureat_finale": 2026,
             "annee_scolaire_passation_ea": "2025-2026"}
    assert C.statut_math_ea(faits)["statut"] == "sans_objet"


def test_tous_les_statuts_sont_declares_au_referentiel():
    ref = C.referentiel()["epreuves_anticipees"]["session_2027"]["mathematiques"]
    declares = {s["code"] for s in ref["statut_derive"]["statuts"]}
    assert declares <= set(C.STATUTS_MATH)
    assert "sans_objet" in C.STATUTS_MATH

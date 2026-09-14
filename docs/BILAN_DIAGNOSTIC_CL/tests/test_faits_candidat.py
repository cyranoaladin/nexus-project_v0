"""Le domaine des faits candidats est verrouillé : ce qui en sort est refusé, pas ignoré.

`faits_candidat.build_candidate_facts` est la seule construction des faits ; ces tests
énumèrent les familles de faits invalides que le moteur doit refuser, et prouvent que
`distribution.profil_reel` n'est qu'un adaptateur d'arguments vers cette construction.
"""
import inspect
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import distribution as D  # noqa: E402
import faits_candidat as FC  # noqa: E402
import pack_candidat as PC  # noqa: E402

VALIDE_P2 = dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"],
                 spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none")

FAMILLES_INVALIDES = {
    "premiere_0_specialite": ({**VALIDE_P2, "spes_premiere": []}, "Nombre de spécialités de Première"),
    "premiere_1_specialite": ({**VALIDE_P2, "spes_premiere": ["MATH"], "spes_terminales": None, "spe_non_poursuivie": None}, "Nombre de spécialités de Première"),
    "premiere_2_specialites": ({**VALIDE_P2, "spes_premiere": ["MATH", "NSI"]}, "Nombre de spécialités de Première"),
    "premiere_4_specialites": ({**VALIDE_P2, "spes_premiere": ["MATH", "PC", "NSI", "SVT"]}, "Nombre de spécialités de Première"),
    "premiere_doublon": ({**VALIDE_P2, "spes_premiere": ["MATH", "MATH", "NSI"]}, "en double"),
    "terminale_doublon": ({**VALIDE_P2, "spes_premiere": ["MATH", "PC", "NSI"], "spes_terminales": ["MATH", "MATH"]}, "en double"),
    "specialite_inconnue_premiere": ({**VALIDE_P2, "spes_premiere": ["MATH", "PC", "LATIN"]}, "Spécialité invalide"),
    "specialite_inconnue_terminale": ({**VALIDE_P2, "spes_terminales": ["MATH", "LATIN"], "spe_non_poursuivie": None}, "Spécialité invalide"),
    "terminale_non_incluse_dans_premiere": ({**VALIDE_P2, "spes_terminales": ["MATH", "SVT"], "spe_non_poursuivie": None}, "non incluses"),
    "terminale_1_specialite": ({**VALIDE_P2, "spes_terminales": ["MATH"], "spe_non_poursuivie": None}, "Nombre de spécialités terminales"),
    "terminale_3_specialites": ({**VALIDE_P2, "spes_terminales": ["MATH", "PC", "NSI"], "spe_non_poursuivie": None}, "Nombre de spécialités terminales"),
    "mauvaise_specialite_abandonnee": ({**VALIDE_P2, "spe_non_poursuivie": "MATH"}, "Incohérence des spécialités"),
    "abandon_hors_premiere": ({**VALIDE_P2, "spe_non_poursuivie": "SVT", "spes_terminales": None}, "non présente dans les spécialités de Première"),
    "abandon_inconnue_terminale_connue": ({**VALIDE_P2, "spe_non_poursuivie": "aucune"}, "Incohérence des spécialités"),
    "p2_sans_terminale": ({**VALIDE_P2, "spe_non_poursuivie": None, "spes_terminales": None}, "deux spécialités terminales"),
    "p3_sans_terminale": ({**VALIDE_P2, "profil": "P3", "mode_ep": "fin_cycle", "eaf_due": "les_deux", "spe_non_poursuivie": None, "spes_terminales": None}, "deux spécialités terminales"),
    "p3_mode_annuelle": ({**VALIDE_P2, "profil": "P3", "mode_ep": "annuelle", "eaf_due": "les_deux"}, "fin_cycle"),
    "mode_inconnu": ({**VALIDE_P2, "mode_ep": "trimestriel"}, "Mode d'évaluations ponctuelles inconnu"),
    "profil_inconnu": ({**VALIDE_P2, "profil": "P4"}, "Profil inconnu"),
    "eaf_none_en_p1": ({**VALIDE_P2, "profil": "P1", "eaf_due": "none"}, "inadmissible"),
    "eaf_ecrit_en_p3": ({**VALIDE_P2, "profil": "P3", "mode_ep": "fin_cycle", "eaf_due": "ecrit"}, "inadmissible"),
    "eaf_statut_inconnu": ({**VALIDE_P2, "eaf_due": "les_trois"}, "inadmissible"),
    "fr_mai_en_p1": ({**VALIDE_P2, "profil": "P1", "eaf_due": "les_deux", "fr_mai_requis": True}, "FR-MAI"),
}


@pytest.mark.parametrize("famille", sorted(FAMILLES_INVALIDES), ids=sorted(FAMILLES_INVALIDES))
def test_les_faits_invalides_sont_refuses(famille):
    faits, motif = FAMILLES_INVALIDES[famille]
    with pytest.raises(ValueError, match=motif):
        FC.build_candidate_facts(candidat_id="TEST", **faits)


def test_les_familles_invalides_couvrent_le_cahier_des_charges():
    noms = " ".join(FAMILLES_INVALIDES)
    for attendu in ("premiere_0", "premiere_1", "premiere_2", "premiere_4", "doublon", "inconnue",
                    "non_incluse", "terminale_1", "terminale_3", "mauvaise_specialite_abandonnee",
                    "abandon_inconnue_terminale_connue", "p3_mode"):
        assert attendu in noms, attendu


def test_p1_orientation_inconnue_est_valide():
    r = FC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], candidat_id="T")["reponses"]
    assert r["specialites_terminales"] == [] and r["specialite_non_poursuivie"] == FC.INCONNUE
    assert r["math_ea_due"] is True and r["eaf_due"] == "les_deux"


def test_p1_orientation_connue_deduit_les_deux_specialites():
    r = FC.build_candidate_facts("P1", "fin_cycle", ["MATH", "PC", "NSI"], "PC", candidat_id="T")["reponses"]
    assert r["specialites_terminales"] == ["MATH", "NSI"] and r["specialite_non_poursuivie"] == "PC"


def test_p3_normalise_le_mode_fin_de_cycle():
    r = FC.build_candidate_facts("P3", None, ["MATH", "PC", "NSI"], "NSI", eaf_due="les_deux", candidat_id="T")["reponses"]
    assert r["mode_evaluations_ponctuelles"] == "fin_cycle" and r["mode_passation_ea"] == "meme_session"
    assert r["math_ea_due"] is True


def test_defauts_fr_pos_et_fr_mai_sont_faux_pour_tous_les_profils():
    for profil, faits in (("P1", dict(spes_premiere=["MATH", "PC", "NSI"])),
                          ("P2", dict(spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="PC")),
                          ("P3", dict(spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="PC"))):
        r = FC.build_candidate_facts(profil, None, candidat_id="T", **faits)["reponses"]
        assert r["fr_pos_requis"] is False and r["positionnement_francais"] is False, profil
        assert r["fr_mai_requis"] is False, profil


def test_pack_candidat_expose_la_construction_canonique():
    assert PC.build_candidate_facts is FC.build_candidate_facts
    assert PC.SPECIALITES_VALIDES == FC.SPECIALITES_VALIDES


def test_profil_reel_est_un_adaptateur_sans_regle_metier():
    """Même faits par les deux portes : le banc de distribution et les packs candidats."""
    src = inspect.getsource(D.profil_reel)
    assert "build_candidate_facts" in src
    for regle in ("positionnement_francais", "math_ea_due\"] =", "fr_mai_requis\"] =", "eaf_due\"] ="):
        assert regle not in src, f"profil_reel redéfinit une règle : {regle}"
    a = D.profil_reel("P2", ("MATH", "NSI"), "aucune", abandonnee="PC", mode_ep="annuelle")["reponses"]
    b = FC.build_candidate_facts("P2", "annuelle", ["MATH", "NSI", "PC"], "PC", ["MATH", "NSI"], eaf_due="none",
                                 candidat_id="COMBINAISON")["reponses"]
    assert a == b
    c = D.profil_reel("P1", ("MATH", "PC", "NSI"))["reponses"]
    assert c["positionnement_francais"] is False, "FR-POS n'est plus activé par défaut en P1"
    assert c["specialites_terminales"] == []
    with pytest.raises(ValueError):
        D.profil_reel("P3", ("MATH", "PC", "NSI"), abandonnee="NSI", mode_ep="annuelle")

"""La provenance des nombres du bilan : « enregistré » ne vaut pas « autorisé ».

Le § 8.3 interdit « tout chiffre non issu du moteur de calcul ». Un accumulateur qui se
contente d'enregistrer ce qu'on lui donne ne prouve rien : il légitime tout ce qui le
traverse. Ces tests éprouvent la garantie réelle — aucune méthode d'émission n'accepte une
valeur, chaque émission se retrouve dans sa source, et un nombre étranger n'atteint jamais
le document, qu'il soit ajouté au texte final, glissé dans une ligne composée, ou passé à
une fonction générique.
"""
import copy
import re
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import maquette_bilan as M  # noqa: E402


@pytest.fixture(scope="module")
def bilan():
    return M.Bilan().calculer()


@pytest.fixture()
def prose(bilan):
    return B.Prose(B.Sources(bilan))


# ─────────────────────────────── ce qui est refusé

def test_1_un_chiffre_ajoute_au_document_final_est_refuse(bilan):
    """Cas 1 — « 87 % » ajouté au rendu : V-Texte le voit, il n'a jamais été émis."""
    corps, p = B.composer(bilan)
    resultats = B.controles(bilan, corps + "\n\nProgression attendue : 87 %.\n", p)
    v_texte = next(x for x in resultats if x[0] == "V-Texte")
    assert not v_texte[1], "un chiffre étranger a franchi V-Texte"
    assert "87" in v_texte[2]


def test_2_aucune_fonction_generique_ne_legitime_un_texte_chiffre(prose):
    """Cas 2 — il n'existe aucune porte d'entrée pour du texte libre chiffré.

    Les méthodes qui impriment du texte prennent un chemin de référentiel, jamais une
    chaîne : donner « Progression attendue : 87 % » à l'une d'elles échoue, parce qu'elle
    la traite comme un chemin, qui n'existe pas.
    """
    for methode in ("ref_texte", "qp_texte"):
        with pytest.raises((KeyError, ValueError, IndexError)):
            getattr(prose, methode)("Progression attendue : 87 %")
    assert not hasattr(prose, "texte"), \
        "une méthode d'émission accepte du texte libre : la garantie est perdue"


def test_3_un_nombre_arbitraire_ne_peut_pas_etre_emis(prose):
    """Cas 3 — aucune méthode n'accepte 87 : ni le moteur, ni le référentiel, ni la
    structure, dont la liste est fermée."""
    with pytest.raises(KeyError):
        prose.nb("score.INVENTE.87")
    with pytest.raises(KeyError):
        prose.ref("regles_bilan.chiffre_invente")
    with pytest.raises(B.NombreSansProvenance):
        prose.structure(87)
    with pytest.raises(B.NombreSansProvenance):
        prose.renvoi("87.4")


def test_une_ligne_composee_avec_un_chiffre_non_emis_est_refusee(prose):
    """La composition s'arrête net : le chiffre n'entre pas dans le document."""
    with pytest.raises(B.NombreSansProvenance) as exc:
        prose += ["Le candidat progressera de 87 % d'ici juin."]
    assert "87" in str(exc.value)
    assert not prose.lignes


def test_un_registre_modifie_apres_coup_est_detecte(bilan):
    """V-Provenance rejoue chaque émission dans sa source : truquer le registre ne suffit
    pas."""
    corps, p = B.composer(bilan)
    assert not p.provenances_invalides()
    cle = next(c for t, o, c in p.emissions if o == "moteur")
    p.src.moteur[cle] = 0.87
    mauvaises = p.provenances_invalides()
    assert mauvaises, "une valeur du registre a changé sans que V-Provenance le voie"
    resultats = B.controles(bilan, corps, p)
    assert not next(x for x in resultats if x[0] == "V-Provenance")[1]


def test_une_cle_du_moteur_disparue_fait_echouer_la_provenance(bilan):
    corps, p = B.composer(bilan)
    cle = next(c for t, o, c in p.emissions if o == "moteur")
    del p.src.moteur[cle]
    assert any(cle in m for m in p.provenances_invalides())


# ─────────────────────────────── ce qui est accepté, et vérifié

def test_4_un_nombre_issu_du_moteur_est_accepte(prose, bilan):
    """Cas 4 — la valeur imprimée est celle du registre, au format du document."""
    pc = bilan.perimetres_passes[0]
    texte = prose.pct(f"global.{pc}")
    assert texte == f"{bilan.agr[pc]['global'] * 100:.0f} %"
    assert not prose.provenances_invalides()
    assert prose.emis[texte.split()[0]] == {("moteur", f"global.{pc}")}


def test_5_un_nombre_issu_du_referentiel_est_accepte(prose, bilan):
    """Cas 5 — le seuil de calibration vient du référentiel, pas du script."""
    texte = prose.ref("regles_bilan.indice_calibration.ecart_signal")
    assert texte == str(bilan.regles["indice_calibration"]["ecart_signal"])
    assert not prose.provenances_invalides()


def test_6_une_date_ou_un_identifiant_du_questionnaire_est_accepte(prose, bilan):
    """Cas 6 — la date de passation et la référence candidat sont des données candidat."""
    assert prose.qp_texte("session_date") == bilan.qp["session_date"]
    assert prose.qp_texte("candidate_ref") == bilan.qp["candidate_ref"]
    assert prose.qp("reponses.heures_disponibles") == \
        f"{bilan.qp['reponses']['heures_disponibles']:.0f}"
    assert not prose.provenances_invalides()


def test_toute_emission_du_document_porte_une_origine_declaree(bilan):
    corps, p = B.composer(bilan)
    origines = {o for _, o, _ in p.emissions}
    assert origines <= set(B.ORIGINES)
    assert origines == set(B.ORIGINES), \
        "une des quatre origines n'est pas exercée par le document"
    for morceau in re.findall(B.NOMBRE, corps):
        assert morceau in p.emis, f"{morceau} figure au rendu sans émission"


def test_la_constante_structurelle_se_limite_aux_sections_et_aux_renvois(bilan):
    corps, p = B.composer(bilan)
    valeurs = {t for t, o, _ in p.emissions if o == "structure"}
    assert valeurs <= {str(n) for n in B.STRUCTURE_AUTORISEE} | set(B.RENVOIS_CAHIER)


def test_le_document_change_quand_le_moteur_change(bilan):
    """Contre-épreuve : si le rendu ne suivait pas le moteur, rien de tout ceci ne vaudrait."""
    avant, _ = B.composer(bilan)
    b = copy.deepcopy(bilan)
    pc = b.perimetres_passes[0]
    b.agr[pc]["global"] = 0.11
    apres, _ = B.composer(b)
    assert avant != apres
    assert "11 %" in apres

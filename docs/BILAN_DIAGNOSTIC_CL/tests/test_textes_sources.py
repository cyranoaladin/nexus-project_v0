"""Le registre des textes sources : ce qu'il prouve, et ce qu'il refuse.

Un support littéraire n'est pas une donnée comme une autre. Il vient d'une édition, il a
des bornes, et deux diagnostics ne doivent jamais faire travailler un candidat sur le même
passage — un candidat P3 passe FR-EAF, PHI et EDS-HLP les mêmes journées, et la seconde
mesure serait contaminée par la première.

Ces tests portent sur le mécanisme, éprouvé en réintroduisant la faute sur une copie, et
sur l'état : les sept textes du dépôt sont enregistrés, mesurés et distincts.
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import textes_sources as TS  # noqa: E402
import validate_instrument as VI  # noqa: E402


@pytest.fixture(scope="module")
def registre():
    return TS.registre()


# ─────────────────────────────── l'état : sept textes, tous identifiés

def test_le_registre_est_tenu():
    assert TS.controler() == []


def test_chaque_texte_porte_les_douze_champs_exiges(registre):
    """La règle absolue des sources : un support sans provenance n'est pas un support."""
    obligatoires = ("auteur", "oeuvre", "edition", "editeur", "annee",
                    "chapitre_ou_partie", "pages_du_passage_dans_l_edition",
                    "source", "ancre_debut", "ancre_fin", "nombre_mots",
                    "nombre_lignes_dans_le_pdf_final", "sha256_texte_normalise")
    for cle, t in registre["textes"].items():
        for champ in obligatoires:
            assert t.get(champ), f"{cle} : champ « {champ} » absent ou vide"
        assert t["source"]["url"].startswith("https://"), cle
        assert t["facsimile"]["confrontation"], cle


def test_chaque_texte_est_employe_et_chaque_support_est_enregistre(registre):
    employes = {s["source"] for s in TS.supports_du_depot()}
    assert employes == set(registre["textes"])


def test_les_sept_empreintes_sont_deux_a_deux_distinctes(registre):
    empreintes = [t["sha256_texte_normalise"] for t in registre["textes"].values()]
    assert len(set(empreintes)) == len(empreintes)


def test_aucun_passage_ne_sert_deux_instruments():
    """§ 10 — le même extrait ne peut pas fonder deux diagnostics."""
    par_texte = {}
    for s in TS.supports_du_depot():
        par_texte.setdefault(TS.empreinte(s["texte"]), set()).add(s["instrument"])
    partages = {h: i for h, i in par_texte.items() if len(i) > 1}
    assert not partages, partages


def test_le_meme_passage_peut_servir_deux_versions_dun_meme_instrument():
    """Ce qui est interdit, c'est deux instruments — pas deux versions.

    La Boétie est le support du bloc B dans les six assemblages de FR-EAF : le programme
    de littérature d'idées n'est pas renouvelé entre 2027 et 2028, et un candidat ne passe
    jamais deux assemblages du même instrument.
    """
    par_texte = {}
    for s in TS.supports_du_depot():
        par_texte.setdefault(TS.empreinte(s["texte"]), []).append(
            (s["instrument"], s["assemblage"]))
    laboetie = TS.registre()["textes"]["laboetie"]["sha256_texte_normalise"]
    emplois = par_texte[laboetie]
    assert len(emplois) == 6
    assert {i for i, _ in emplois} == {"FR-EAF"}


# ─────────────────────────────── les contrôles, éprouvés sur la faute

def test_un_texte_modifie_sans_le_registre_est_detecte(monkeypatch):
    """L'appariement : le registre décrit un texte, pas un emplacement."""
    supports = copy.deepcopy(TS.supports_du_depot())
    supports[0]["texte"] += " Une phrase ajoutée après coup."
    monkeypatch.setattr(TS, "supports_du_depot", lambda: supports)
    err = TS.controler()
    assert any("ne correspond plus" in e for e in err), err


def test_une_collision_dempreinte_entre_deux_sources_est_refusee(monkeypatch):
    """§ 10 — collision de hash = échec du build."""
    reg = copy.deepcopy(TS.registre())
    reg["textes"]["descartes"]["sha256_texte_normalise"] = \
        reg["textes"]["montaigne"]["sha256_texte_normalise"]
    monkeypatch.setattr(TS, "registre", lambda: reg)
    err = TS.controler()
    assert any("collision d'empreinte" in e for e in err), err


def test_un_passage_partage_entre_deux_instruments_est_refuse(monkeypatch):
    """Le cas que la conception a écarté : Montaigne servant FR-EAF et EDS-HLP."""
    supports = copy.deepcopy(TS.supports_du_depot())
    montaigne = next(s for s in supports if s["source"] == "montaigne")
    intrus = dict(montaigne, instrument="PHI", fichier="instruments/PHI/essai.json",
                  assemblage="standard")
    monkeypatch.setattr(TS, "supports_du_depot", lambda: supports + [intrus])
    err = TS.controler()
    assert any("contamination" in e for e in err), err


def test_un_texte_employe_hors_de_ses_usages_declares_est_refuse(monkeypatch):
    """La séparation des sessions passe par là : Zola n'a rien à faire en 2027."""
    supports = copy.deepcopy(TS.supports_du_depot())
    zola = next(s for s in supports if s["source"] == "zola")
    zola["assemblage"] = "standard"          # assemblage de session 2027
    monkeypatch.setattr(TS, "supports_du_depot", lambda: supports)
    err = TS.controler()
    assert any("n'est pas déclaré pour" in e for e in err), err


def test_un_champ_calcule_recopie_a_la_main_est_detecte(monkeypatch):
    """Le registre ne recopie rien : mots et empreinte sont recalculés depuis le dépôt."""
    reg = copy.deepcopy(TS.registre())
    reg["textes"]["condorcet"]["nombre_mots"] = 400
    monkeypatch.setattr(TS, "registre", lambda: reg)
    err = TS.controler()
    assert any("nombre_mots" in e for e in err), err


def test_le_controle_entre_dans_la_validation_globale():
    """Une collision doit arrêter le build, pas seulement un script isolé."""
    import inspect
    source = inspect.getsource(VI.main)
    assert "TS.controler()" in source


# ─────────────────────────────── la longueur se mesure dans le PDF

@pytest.mark.parametrize("cle,fenetre", [
    ("laboetie", (20, 25)), ("balzac", (15, 20)), ("montaigne", (15, 20)),
    ("descartes", (15, 20)), ("moliere", (10, 12))])
def test_les_longueurs_mesurees_tiennent_dans_leur_fenetre(registre, cle, fenetre):
    n = registre["textes"][cle]["nombre_lignes_dans_le_pdf_final"]
    assert fenetre[0] <= n <= fenetre[1], f"{cle} : {n} lignes"


def test_la_longueur_de_condorcet_se_compte_en_mots(registre):
    """La spécification de FR-MAI porte sur les mots, non sur les lignes."""
    assert 380 <= registre["textes"]["condorcet"]["nombre_mots"] <= 420


def test_les_lignes_brutes_de_zola_restent_visibles(registre):
    """Vingt-trois lignes brutes : le chiffre n'est pas effacé par la règle qui l'explique."""
    z = registre["textes"]["zola"]
    assert z["nombre_lignes_dans_le_pdf_final"] == 23
    assert z["nombre_paragraphes"] == 6
    assert z["lignes_pleines_equivalentes"] == 18
    prog = json.loads((RACINE / "referentiels" / "programmes_examen.json")
                      .read_text(encoding="utf-8"))
    mesure = prog["designations_oeuvres"]["FR-EAF/bloc_C@2028"]["passage"]["mesure"]
    assert mesure["lignes_brutes"] == 23
    assert mesure["conforme"] is True
    assert "reflow" in mesure["note"], "le reflow essayé doit rester consigné"


# ─────────────────────────────── la longueur : une règle vérifiée, non déclarée

def test_la_fenetre_de_longueur_est_tenue_par_les_sept_passages(registre):
    for cle, t in registre["textes"].items():
        f = t.get("fenetre_lignes")
        if f:
            n = t["lignes_pleines_equivalentes"]
            assert f[0] <= n <= f[1], f"{cle} : {n} lignes pleines, fenêtre {f}"
        else:
            fm = t["fenetre_mots"]
            assert fm[0] <= t["nombre_mots"] <= fm[1], cle


def test_la_grandeur_mesuree_est_definie_et_justifiee(registre):
    """La règle dit ce qu'elle mesure, pourquoi, et qu'elle n'est pas réglementaire."""
    m = registre["mesure_de_longueur"]
    assert "convention interne" in m["statut"]
    assert "aucune exigence réglementaire" in m["statut"]
    assert m["grandeur"] == "lignes_pleines_equivalentes"
    assert "nombre_paragraphes - 1" in m["formule"]
    assert "reflow" in m["reflow_essaye_le_2026_09_11"].lower()


def test_un_passage_trop_long_est_refuse(monkeypatch):
    """Contre-test : la fenêtre n'est pas devenue une formalité."""
    reg = copy.deepcopy(TS.registre())
    reg["textes"]["balzac"]["lignes_pleines_equivalentes"] = 40
    reg["textes"]["balzac"]["nombre_lignes_dans_le_pdf_final"] = 41
    monkeypatch.setattr(TS, "registre", lambda: reg)
    err = TS.controler()
    assert any("hors de la fenêtre" in e for e in err), err


# ─────────────────────────────── la confrontation au fac-similé

def test_la_confrontation_au_facsimile_est_consignee_texte_par_texte(registre):
    conf = registre["confrontation_au_facsimile"]
    couverts = {e["texte"] for e in conf["ecarts_releves"]} | set(conf["sans_ecart"])
    assert couverts == set(registre["textes"])


def test_la_page_non_corrigee_de_montaigne_est_signalee(registre):
    """Un niveau de relecture 1 ne vaut pas vérification : le registre le dit."""
    f = registre["textes"]["montaigne"]["facsimile"]
    assert set(f["niveau_de_relecture"].values()) == {1}
    assert "NON corrigées" in f["confrontation"]
    assert "comparée mot à mot" in f["confrontation"]


def test_lediton_musart_numerote_autrement_que_le_canon(registre):
    """La mise en garde documentaire demandée : titre canonique et édition sont deux choses."""
    ident = registre["textes"]["montaigne"]["identification_dans_l_edition"]
    assert ident["titre_canonique"] == "De la vanité des paroles"
    assert ident["chapitre_imprime"] == "CHAPITRE XX"
    assert "LI" in ident["avertissement"]

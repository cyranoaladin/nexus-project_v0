"""Un bilan ne peut pas se déclarer diffusable si l'un de ses instruments ne l'est pas.

La chaîne du § 6.3 contrôle la saisie et le rendu ; elle ne disait rien de l'instrument qui
a produit cette saisie. Un bilan de maquette terminait donc par huit contrôles réussis
alors que trois de ses instruments imprimaient encore « [EXTRAIT À INSÉRER…] » à la place
de leur texte. Ces tests ferment ce trou : le statut d'un instrument est calculé depuis ses
fichiers, V-Instruments le confronte au bilan, et le mode de rendu est déclaré, jamais
déduit du nom d'un dossier.

Depuis l'insertion des textes sources, le dépôt ne porte plus aucun instrument bloqué. Un
test qui s'appuierait sur cet état ne prouverait plus rien : les contrôles s'éprouvent
donc sur des copies où la faute est réintroduite, jamais sur l'état courant.
"""
import copy
import json
import shutil
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
MAQ_P2 = RACINE / "instruments" / "_MAQUETTE_P2"
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import diffusabilite as DIF  # noqa: E402
import maquette_bilan as M  # noqa: E402


@pytest.fixture(scope="module")
def bilan_p3():
    return M.Bilan().calculer()


@pytest.fixture(scope="module")
def etats():
    return DIF.tous()


# ─────────────────────────────── le statut est calculé, pas déclaré

def test_le_statut_nomme_le_motif_de_chaque_blocage(tmp_path):
    """Un blocage sans motif nommé serait un blocage qu'on ne sait pas lever.

    La faute est réintroduite sur une copie : un emplacement réservé dans le support du
    bloc C, comme le dépôt en portait avant l'insertion des textes.
    """
    copie = tmp_path / "PHI"
    shutil.copytree(RACINE / "instruments" / "PHI", copie,
                    ignore=shutil.ignore_patterns("build"))
    assert DIF.statut_dossier(copie)["diffusable"]
    chemin = copie / "assemblages" / "standard.json"
    asm = json.loads(chemin.read_text(encoding="utf-8"))
    for bloc in asm["blocs"]:
        for sup in bloc.get("supports", []):
            if isinstance(sup, dict) and "texte" in sup:
                sup["texte"] = "[EXTRAIT À INSÉRER — texte philosophique]"
    chemin.write_text(json.dumps(asm, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    s = DIF.statut_dossier(copie)
    assert not s["diffusable"]
    assert s["motifs"], "bloqué sans motif"
    for m in s["motifs"]:
        assert m["motif"] in {"emplacement_reserve", "support_incomplet",
                              "support_a_completer", "validation",
                              "instrument_absent", "correction_en_cours"}
        assert m["detail"]


def test_les_cinq_instruments_a_support_externe_portent_leur_texte(etats):
    """Les cinq instruments qui attendaient un texte l'ont reçu le 2026-09-11.

    C'est l'objet de la passe : aucun d'eux ne peut plus être bloqué pour un support
    manquant, et le registre des sources dit d'où vient chaque passage.
    """
    for code in ("FR-EAF", "FR-EAF-ORAL", "FR-MAI", "PHI", "EDS-HLP"):
        assert etats[code]["diffusable"], (code, etats[code]["motifs"])


def test_aucun_instrument_du_depot_nest_bloque(etats):
    """Le critère de fin : instruments métier tous diffusables."""
    bloques = {c: s["motifs"] for c, s in etats.items() if not s["diffusable"]}
    assert not bloques, bloques
    assert len(etats) == len(DIF.dossiers()), sorted(etats)


def test_une_mise_en_correction_bloque_la_diffusion(tmp_path):
    """Le mécanisme minimal : un motif de plus, jamais un état global parallèle.

    Une instruction de la direction qui retire un instrument de la diffusion doit passer
    par le même calcul que tout le reste — sans quoi le statut rendu et l'instruction
    divergeraient au premier oubli.
    """
    source = RACINE / "instruments" / "EDS-MATH"
    copie = tmp_path / "EDS-MATH"
    shutil.copytree(source, copie)
    assert DIF.statut_dossier(copie)["diffusable"]
    banque = DIF.charger(copie / "banque.json")
    banque[DIF.CHAMP_CORRECTION] = "essai de mise en correction"
    (copie / "banque.json").write_text(
        json.dumps(banque, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    s = DIF.statut_dossier(copie)
    assert not s["diffusable"]
    assert [m["motif"] for m in s["motifs"]] == ["correction_en_cours"]
    assert "essai de mise en correction" in s["motifs"][0]["detail"]


def test_un_instrument_sans_support_externe_est_diffusable(etats):
    for code in ("EDS-MATH", "TC-ES", "QP", "GO", "MET"):
        assert etats[code]["diffusable"], etats[code]["motifs"]


def test_un_texte_sans_edition_renseignee_ne_passe_pas(tmp_path):
    """Contre-mesure : un texte seul ne fait pas un support.

    Effacer la consigne d'insertion sans dire d'où vient le texte laissait passer un
    support dont personne ne peut vérifier la provenance. Le contrôle porte sur les trois
    champs — texte, référence, édition — et non sur le seul texte.
    """
    source = RACINE / "instruments" / "FR-MAI"
    copie = tmp_path / "FR-MAI"
    shutil.copytree(source, copie, ignore=shutil.ignore_patterns("build"))
    assert DIF.statut_dossier(copie)["diffusable"]

    chemin = copie / "assemblages" / "standard.json"
    asm = json.loads(chemin.read_text(encoding="utf-8"))
    for bloc in asm["blocs"]:
        for sup in bloc.get("supports", []):
            if isinstance(sup, dict) and "texte" in sup:
                sup["texte"] = "Un texte de remplacement, sans consigne d'insertion."
                sup["edition"] = "[À COMPLÉTER]"
    chemin.write_text(json.dumps(asm, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")

    s = DIF.statut_dossier(copie)
    assert not s["diffusable"], "l'édition non renseignée ne bloque plus"
    motifs = {m["motif"] for m in s["motifs"]}
    assert "support_a_completer" in motifs
    assert any("edition" in m["detail"] for m in s["motifs"])


def test_un_support_designant_une_oeuvre_hors_session_est_refuse(tmp_path):
    """L'audit EAF 2027 : une œuvre d'une autre session ne peut pas être un support.

    Le cas historique était « Pot-Bouille », désigné pour le bloc C alors qu'il relève de
    la session 2028 ; l'œuvre a été remplacée par Balzac le 2026-09-10. Le contrôle est
    éprouvé ici en réintroduisant la faute sur une copie.
    """
    import shutil
    source = RACINE / "instruments" / "FR-EAF"
    copie = tmp_path / "FR-EAF"
    shutil.copytree(source, copie, ignore=shutil.ignore_patterns("build"))
    chemin = copie / "assemblages" / "standard.json"
    asm = json.loads(chemin.read_text(encoding="utf-8"))
    for bloc in asm["blocs"]:
        for sup in bloc.get("supports", []):
            if isinstance(sup, dict) and sup.get("oeuvre_au_programme"):
                sup["oeuvre_au_programme"].update({"auteur": "Émile Zola",
                                                   "oeuvre": "Pot-Bouille"})
    chemin.write_text(json.dumps(asm, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    motifs = DIF.statut_dossier(copie)["motifs"]
    validations = [m["detail"] for m in motifs if m["motif"] == "validation"]
    assert any("Pot-Bouille" in d and "2028" in d for d in validations), validations


def test_l_oeuvre_designee_du_bloc_c_est_au_programme_de_la_session():
    """La désignation en vigueur — Balzac — passe le contrôle sans erreur de programme."""
    validations = [m["detail"] for m in DIF.statut("FR-EAF")["motifs"]
                   if m["motif"] == "validation"]
    assert not validations, validations
    prog = DIF.charger(RACINE / "referentiels" / "programmes_examen.json")
    d = prog["designations_oeuvres"]["FR-EAF/bloc_C"]
    assert (d["auteur"], d["oeuvre"]) == ("Balzac", "La Peau de chagrin")
    assert DIF.statut("FR-EAF")["diffusable"], DIF.statut("FR-EAF")["motifs"]


# ─────────────────────────────── V-Instruments dans la chaîne du bilan

def test_le_bilan_de_maquette_porte_le_bandeau(bilan_p3):
    texte, _ = B.rendre(bilan_p3)
    lignes = [l for l in texte.splitlines() if l.strip()]
    assert lignes[1] == B.BANDEAU_MAQUETTE, \
        "le bandeau n'est pas immédiatement sous le titre"
    assert "NON DIFFUSABLE" in B.BANDEAU_MAQUETTE


def test_en_maquette_v_instruments_est_sans_objet_et_nomme_les_bloques(bilan_p3):
    _, verifs = B.rendre(bilan_p3)
    nom, etat, constat = next(x for x in verifs if x[0] == "V-Instruments")
    assert etat is None, "un rendu de maquette ne peut pas réussir V-Instruments"
    assert "sans objet" in constat and "non diffusable" in constat


def test_en_production_un_instrument_bloque_met_le_bilan_en_attente(bilan_p3, monkeypatch):
    """L'interdit de production : un instrument bloqué retient le bilan entier.

    Le dépôt n'en porte plus ; le blocage est donc simulé sur le calcul de statut, ce qui
    éprouve exactement ce que le test doit éprouver — la réaction du bilan, non l'état
    du dépôt.
    """
    b = copy.deepcopy(bilan_p3)
    b.qp["mode_rendu"] = "production"
    monkeypatch.setattr(DIF, "non_diffusables", lambda codes: [
        {"code": "FR-EAF", "diffusable": False,
         "motifs": [{"motif": "emplacement_reserve", "detail": "essai"}]}]
        if "FR-EAF" in codes else [])
    texte, verifs = B.rendre(b)
    assert not B.diffusable(verifs)
    nom, etat, constat = next(x for x in verifs if x[0] == "V-Instruments")
    assert etat is False and "FR-EAF" in constat
    assert "en attente" in texte.lower()
    assert "\n## 5. " not in texte, "le corps a été diffusé malgré un instrument bloqué"


def test_un_bilan_de_production_sur_instruments_diffusables_passe(bilan_p3):
    """Contre-épreuve : sur le dépôt réel, où rien n'est bloqué, le bilan sort."""
    b = copy.deepcopy(bilan_p3)
    b.qp["mode_rendu"] = "production"
    _, verifs = B.rendre(b)
    nom, etat, constat = next(x for x in verifs if x[0] == "V-Instruments")
    assert etat is True, constat
    assert B.diffusable(verifs)


# ─────────────────────────────── le mode est déclaré, jamais déduit

def test_le_mode_est_declare_par_le_jeu_de_donnees():
    for chemin in (MAQ / "qp.json", MAQ / "qp_variante_mineure.json", MAQ_P2 / "qp.json"):
        assert json.loads(chemin.read_text(encoding="utf-8"))["mode_rendu"] == "maquette"


def test_le_mode_par_defaut_est_la_production(bilan_p3):
    b = copy.deepcopy(bilan_p3)
    del b.qp["mode_rendu"]
    assert B.mode_de(b) == "production", \
        "un jeu sans déclaration serait rendu comme une maquette"


def test_le_nom_du_dossier_ne_vaut_pas_declaration(bilan_p3):
    """Un jeu posé dans `_MAQUETTE` mais non déclaré est traité en production.

    Ce qui se vérifie ici est l'absence du bandeau de maquette : le dossier s'appelle
    `_MAQUETTE`, et cela ne suffit pas à faire d'un rendu une maquette.
    """
    b = copy.deepcopy(bilan_p3)
    del b.qp["mode_rendu"]
    assert str(b.dossier).endswith("_MAQUETTE")
    assert B.mode_de(b) == "production"
    texte, _ = B.rendre(b)
    assert B.BANDEAU_MAQUETTE not in texte


def test_un_mode_inconnu_est_refuse(bilan_p3):
    b = copy.deepcopy(bilan_p3)
    b.qp["mode_rendu"] = "brouillon"
    with pytest.raises(ValueError):
        B.mode_de(b)


def test_le_statut_nest_recopie_dans_aucun_fichier():
    """Source unique : personne ne redit « diffusable » ailleurs que le calcul."""
    suspects = []
    for f in list((RACINE / "referentiels").glob("*.json")) + \
            [RACINE / "referentiels" / "catalogue_instruments.json"]:
        texte = f.read_text(encoding="utf-8")
        if '"diffusable"' in texte:
            suspects.append(f.name)
    assert not suspects, f"statut de diffusabilité recopié dans {suspects}"

"""Le manifeste de version : produit depuis le dépôt, jamais recopié.

Une release qui déclare un état que le dépôt ne porte plus n'est pas une release. Ces
tests vérifient que chaque champ du manifeste se recalcule, que le critère de fin est
arithmétique et non déclaratif, et que le document lisible par la direction dérive du
JSON sans rien y ajouter.
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import release as R  # noqa: E402


@pytest.fixture(scope="module")
def manifeste():
    return R.manifeste()


# ─────────────────────────────── le critère de fin

def test_le_critere_de_fin_est_atteint(manifeste):
    c = manifeste["critere_de_fin"]
    assert c["INSTRUMENTS_METIER"] == len(manifeste["instruments"])
    assert c["DIFFUSABLES"] == c["INSTRUMENTS_METIER"]
    assert c["NON_DIFFUSABLES"] == 0
    assert c["PLACEHOLDERS_INSTRUMENTS"] == 0
    assert c["VALIDATION_ERRORS"] == 0
    assert c["PDF_PREFLIGHT_ERRORS"] == 0
    assert c["MISSING_RENDERS"] == 0
    assert c["SOURCE_TEXT_HASH_COLLISIONS"] == 0
    assert manifeste["conforme"]


def test_le_manifeste_couvre_les_seize_instruments(manifeste):
    import diffusabilite as DIF
    assert set(manifeste["instruments"]) == {d.name for d in DIF.dossiers()}
    assert "_FIXTURE" not in manifeste["instruments"], \
        "la fixture technique n'appartient pas au dispositif"


def test_chaque_version_porte_ses_empreintes(manifeste):
    """Banque, assemblage, rendus, PDF : tout ce qui est diffusé est empreint."""
    for code, i in manifeste["instruments"].items():
        porte_items = any(v["nombre_items"] for v in i["versions"].values())
        if porte_items:
            assert i["sha256_banque"], code
        for v, x in i["versions"].items():
            assert x["rendus"], f"{code}/{v} sans rendu"
            for nom, r in x["rendus"].items():
                assert r["sha256"], f"{code}/{v}/{nom} sans empreinte"
                if "pdf" in r:
                    assert r["pdf_sha256"], f"{code}/{v}/{nom} sans PDF"
            assert x["rendus_manquants"] == []


def test_les_empreintes_de_banque_sont_distinctes(manifeste):
    vues = {}
    for code, i in manifeste["instruments"].items():
        h = i["sha256_banque"]
        if h is None:
            continue
        assert h not in vues, f"{code} et {vues[h]} ont la même banque"
        vues[h] = code


def test_les_textes_sources_du_manifeste_sont_ceux_du_registre(manifeste):
    import textes_sources as TS
    assert manifeste["textes_sources"] == TS.registre()["textes"]
    employes = {c for i in manifeste["instruments"].values() for c in i["textes_sources"]}
    assert employes == set(manifeste["textes_sources"])


# ─────────────────────────────── rien n'est recopié

def test_le_manifeste_est_reproductible(manifeste):
    """Deux calculs successifs donnent le même manifeste, hors date et commit de build."""
    a = dict(manifeste)
    b = dict(R.manifeste())
    a.pop("date_de_build"), b.pop("date_de_build")
    a.pop("commit_precedent"), b.pop("commit_precedent")
    assert a == b


def test_un_instrument_bloque_rend_le_manifeste_non_conforme(monkeypatch):
    """Contre-test : le critère de fin n'est pas une phrase, c'est un calcul."""
    import diffusabilite as DIF
    vrai = DIF.statut

    def faux(code):
        if code == "PHI":
            return {"code": "PHI", "diffusable": False,
                    "motifs": [{"motif": "emplacement_reserve", "detail": "essai"}]}
        return vrai(code)

    monkeypatch.setattr(R.DIF, "statut", faux)
    m = R.manifeste()
    assert not m["conforme"]
    assert m["critere_de_fin"]["NON_DIFFUSABLES"] == 1
    assert m["critere_de_fin"]["PLACEHOLDERS_INSTRUMENTS"] == 1


def test_un_rendu_manquant_est_compte(manifeste, monkeypatch, tmp_path):
    """Un PDF absent n'est pas une empreinte nulle : c'est un rendu manquant."""
    monkeypatch.setattr(R, "empreinte_fichier", lambda p: None)
    m = R.manifeste()
    assert m["critere_de_fin"]["MISSING_RENDERS"] > 0
    assert not m["conforme"]


# ─────────────────────────────── le document lisible dérive du JSON

def test_le_markdown_ne_dit_rien_que_le_json_ne_dise(manifeste):
    md = R.markdown(manifeste)
    for code in manifeste["instruments"]:
        assert f"**{code}**" in md
    for cle, t in manifeste["textes_sources"].items():
        assert f"`{cle}`" in md
        assert t["sha256_texte_normalise"][:16] in md
    c = manifeste["critere_de_fin"]
    assert f"{c['DIFFUSABLES']}/{c['INSTRUMENTS_METIER']} diffusables" in md


def test_les_colonnes_suivent_le_meme_ordre_de_versions(manifeste):
    """Une durée alignée sur le nom d'un autre assemblage est un contresens."""
    md = R.markdown(manifeste)
    ligne = next(l for l in md.splitlines() if l.startswith("| **FR-EAF** |"))
    versions = [x.strip() for x in ligne.split("|")[2].split(",")]
    durees = [x.strip() for x in ligne.split("|")[4].replace("min", "").split(",")]
    attendu = [str(manifeste["instruments"]["FR-EAF"]["versions"][v]["duree_cible_min"])
               for v in versions]
    assert durees == attendu


def test_les_fichiers_de_release_sont_a_jour():
    """Le dépôt porte le manifeste du dépôt, pas celui d'hier."""
    assert R.JSON.exists() and R.MD.exists()
    ecrit = json.loads(R.JSON.read_text(encoding="utf-8"))
    courant = R.manifeste()
    for x in (ecrit, courant):
        x.pop("date_de_build", None)
        x.pop("commit_precedent", None)
    assert ecrit == courant, \
        "MANIFESTE_DEPOT.json a dérivé : relancer scripts/release.py"
    assert R.MD.read_text(encoding="utf-8") == R.markdown(json.loads(
        R.JSON.read_text(encoding="utf-8")))

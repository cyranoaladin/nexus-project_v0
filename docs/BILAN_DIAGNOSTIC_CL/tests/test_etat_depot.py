"""README_ETAT ne peut plus dériver du dépôt sans qu'un test le dise.

Le document d'état portait des effectifs saisis à la porte où ils étaient vrais : vingt-quatre
enregistrements au catalogue quand il y en avait vingt-six, vingt-six items HLP pour une banque
qui en comptait vingt-huit, `FR-ORAL` encore listé après son retrait. Ces tests ferment la
dérive : les blocs factuels sont produits depuis le dépôt, et l'état de diffusion d'un
instrument se déduit de sa source, non d'une phrase.
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import etat_depot as E  # noqa: E402


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def readme():
    return (RACINE / "README_ETAT.md").read_text(encoding="utf-8")


# ─────────────────────────────── le README suit le dépôt

@pytest.mark.parametrize("bloc", sorted(E.BLOCS))
def test_le_bloc_calcule_du_readme_est_a_jour(bloc, readme):
    attendu = E.rendu(bloc)
    assert attendu in readme, \
        f"le bloc « {bloc} » du README a dérivé : relancer scripts/etat_depot.py"


def test_le_script_de_verification_est_vert():
    r = subprocess.run([sys.executable, str(RACINE / "scripts" / "etat_depot.py"),
                        "--verifier"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout


def test_un_readme_qui_derive_est_detecte(tmp_path):
    """Contre-épreuve : si le contrôle ne voyait pas une dérive, il ne servirait à rien."""
    texte = (RACINE / "README_ETAT.md").read_text(encoding="utf-8")
    abime = texte.replace("| `EDS-HLP` | banque + assemblages | 28 ",
                          "| `EDS-HLP` | banque + assemblages | 26 ")
    assert abime != texte, "le tableau calculé n'a plus la forme attendue"
    assert E.appliquer(abime) == texte, "la dérive n'est pas corrigée par le script"


# ─────────────────────────────── les faits eux-mêmes

def test_les_effectifs_du_catalogue_et_des_banques_sont_ceux_du_depot():
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    assert f"{len(cat['instruments'])} enregistrements" in E.bloc_referentiels()
    for x in E.instruments():
        banque = RACINE / "instruments" / x["code"] / "banque.json"
        if banque.exists():
            assert x["items"] == len(charger(banque)["items"])


def test_tout_instrument_porteur_dun_emplacement_reserve_est_declare_bloque():
    """Un sujet qui imprimerait « [EXTRAIT À INSÉRER…] » n'est pas diffusable."""
    import diffusabilite as DIF
    bloc = E.bloc_instruments()
    for x in E.instruments():
        statut = DIF.statut(x["code"])
        assert x["diffusable"] == statut["diffusable"], \
            f"{x['code']} : le tableau contredit scripts/diffusabilite.py"
        if not x["diffusable"]:
            assert "non diffusable" in x["etat"]
            assert f"`{x['code']}`" in bloc.split("non diffusables")[1]
        else:
            assert x["etat"] == "diffusable"


def test_eds_hlp_porte_le_support_montaigne():
    """L'état de HLP est un fait vérifiable, pas une appréciation.

    L'instrument était bloqué sur son support de bloc C ; le passage de Montaigne y a été
    transcrit le 2026-09-11, dans les deux versions, depuis l'édition Musart de 1847.
    """
    hlp = next(x for x in E.instruments() if x["code"] == "EDS-HLP")
    assert hlp["items"] == 28
    assert dict(hlp["assemblages"]) == {"N1": 21, "NT": 28}
    assert hlp["diffusable"], hlp["motifs"]
    for version in ("N1", "NT"):
        texte = (RACINE / "instruments" / "EDS-HLP" / "assemblages"
                 / f"{version}.json").read_text(encoding="utf-8")
        assert E.PLACEHOLDER not in texte
        assert "Montaigne" in texte and "Oyez dire métonymie" in texte


def test_fr_oral_ne_figure_plus_dans_le_depot():
    """Q-20 l'a retiré : le README ne doit pas le ressusciter dans un bloc calculé."""
    assert not (RACINE / "instruments" / "FR-ORAL").exists()
    assert "`FR-ORAL`" not in E.bloc_instruments()
    assert "`FR-EAF-ORAL`" in E.bloc_instruments()


def test_aucun_rendu_build_nest_suivi_par_git():
    """Les rendus sont reconstructibles, et certains porteraient un emplacement réservé."""
    r = subprocess.run(["git", "ls-files", "instruments"], cwd=RACINE,
                       capture_output=True, text=True, check=True)
    suivis = [l for l in r.stdout.splitlines() if "/build/" in l]
    assert not suivis, f"rendus versionnés : {suivis[:5]}"


def test_le_plan_de_passation_du_readme_est_celui_du_module():
    import passation as P
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    qp = charger(RACINE / "instruments" / "_MAQUETTE_P2" / "qp.json")
    bloc = E.bloc_passation()
    for config in ("aucune", "ecrit", "oral", "les_deux"):
        qp["reponses"]["epreuves_francais_a_presenter"] = config
        p = P.plan(qp, cat)
        assert (f"| P2 | {config} | {P.duree_lisible(p['total_au_centre'])} | "
                f"{p['nombre_demi_journees']} |") in bloc


def test_le_paragraphe_4_nomme_chaque_texte_source(readme):
    """Le § 4 se veut exhaustif : tout support textuel du dépôt doit y être nommé.

    Il l'était des emplacements réservés tant qu'il y en avait ; il l'est des textes qui
    les ont remplacés. Un support inséré sans figurer au § 4 serait un texte remis à des
    candidats sans que l'état du dépôt le dise.
    """
    import textes_sources as TS
    section = readme.split("## 4. Textes sources insérés", 1)[1].split("\n## 5.", 1)[0]
    for cle, t in TS.registre()["textes"].items():
        assert t["oeuvre"] in section, f"« {t['oeuvre'] } » absent du § 4"
        for u in t["usages"]:
            assert u["instrument"] in section, f"{u['instrument']} absent du § 4"
    # Et aucun emplacement réservé ne subsiste dans un instrument.
    for x in E.instruments():
        assert "emplacement_reserve" not in x["motifs"], x["code"]


# ─────────────────────────────── le décompte : métier et technique, jamais additionnés

def test_le_bloc_des_instruments_separe_le_metier_de_la_fixture():
    """Le bloc des instruments sépare le métier de la fixture."""
    metier = [x["code"] for x in E.instruments()]
    techniques = E.instruments_techniques()
    cat = E.charger(RACINE / "referentiels" / "catalogue_instruments.json")
    assert len(metier) == len({i["code"] for i in cat["instruments"]}), metier
    assert techniques == ["_FIXTURE"], techniques
    assert not any(c.startswith("_") for c in metier)
    bloc = E.bloc_instruments()
    assert f"**{len(metier)} instruments métier + {len(techniques)} fixture technique.**" \
        in bloc
    assert "confondrait le dispositif et son banc d'essai" in bloc


def test_le_perimetre_metier_est_celui_du_catalogue():
    """Les deux sources doivent dire le même périmètre, sinon l'une des deux ment."""
    cat = E.charger(RACINE / "referentiels" / "catalogue_instruments.json")
    codes = {i["code"] for i in cat["instruments"]}
    assert codes == {x["code"] for x in E.instruments()}
    assert "_FIXTURE" not in codes


def test_letat_courant_necrit_jamais_dix_sept_instruments():
    """Le contre-test : le nombre additionné ne désigne nulle part le dispositif.

    L'historique, lui, peut citer l'erreur pour dire qu'elle en était une : ses phrases
    sont datées et citées comme telles.
    """
    import re
    sys.path.insert(0, str(RACINE / "scripts"))
    import audit_readme as A
    texte = (RACINE / "README_ETAT.md").read_text(encoding="utf-8")
    courant = A.etat_courant(texte)
    assert not re.search(r"(dix-sept|17) instruments", courant)
    assert re.search(r"« 17 instruments »", texte), \
        "l'historique ne garde pas trace de l'erreur corrigée"
    # L'audit du README le refuserait de toute façon : les deux gardes se recoupent.
    assert not [e for e in A.auditer(texte) if e.startswith("périmètre")]

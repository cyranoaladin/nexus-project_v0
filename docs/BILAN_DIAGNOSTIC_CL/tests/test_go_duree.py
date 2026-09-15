"""La durée du livret inclut l'écrit, en plus de l'entretien GO de 15 min."""
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import livret as LI
import pack_candidat as PC


@pytest.mark.parametrize("profil", ["P2", "P3"])
def test_duree_annoncee_egale_somme_des_trois_parties(monkeypatch, tmp_path, profil):
    monkeypatch.setattr(LI, "rendre", lambda doc, *_: doc)
    doc = LI.composer("GRAND-ORAL", profil, [("GO", "standard")], tmp_path / "go.pdf")
    temps = re.findall(r"\\partienexus\{\d+\}\{[^}]+\}\{(\d+) min\}", doc)
    assert list(map(int, temps)) == [12, 15, 15]
    total = sum(map(int, temps))
    assert f"{{Durée du diagnostic}}{{{total} min}}" in doc
    assert f"il en échantillonne les tâches en {total} min" in doc
    assert rf"{{\bfseries Durée.}} {total} min" in doc
    assert "2 min incluses" in doc
    assert "Clôture et renseignement de la grille — 2 min" in doc


def test_entretien_coach_reste_quinze_minutes(monkeypatch, tmp_path):
    d = json.loads((ROOT / "instruments/GO/definition.json").read_text())
    assert sum(p["duree_min"] for p in d["deroule"]) == 15
    monkeypatch.setattr(LI, "rendre", lambda doc, *_: doc)
    doc = LI.composer("GRAND-ORAL", "P2", [("GO", "standard")], tmp_path / "coach.pdf", coach=True)
    assert "{Durée du diagnostic}{15 min}" in doc


def test_bordereau_inclut_preparation_et_total_correct(tmp_path):
    out = tmp_path / "pack"
    PC.create_candidate_pack(profil="P2", mode_ep="annuelle",
        spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="PC",
        spes_terminales=["MATH", "NSI"], eaf_due="none",
        candidat_id="TEST-DUREE-GO", output_dir=out, assemble_pdf=False)
    texte = (out / "A_ENVOYER/BORDEREAU_ENVOI.txt").read_text()
    assert "Grand oral (42 min)" in texte
    diagnostics = texte.split("Les tests ci-dessous", 1)[1].split("5. DOCUMENTS", 1)[0]
    total = sum(map(int, re.findall(r"\((\d+) min\)", diagnostics)))
    assert f"Temps total diagnostique estimé : {total} min" in texte
    interne = (out / "_INTERNE_NEXUS/BORDEREAU_OPERATEUR_INTERNE.txt").read_text()
    lignes_go = [l for l in interne.splitlines() if "[GO/standard]" in l]
    assert len(lignes_go) == 2
    assert all("42 min" in l and "entretien de 15 min inclus" in l for l in lignes_go)


def test_la_duree_annoncee_est_celle_de_ce_que_le_livret_imprime():
    """Deux écarts seulement séparent la couverture de la durée du catalogue.

    Le Grand oral en annonce **plus** : le livret ajoute deux tâches écrites à
    l'entretien. Les instruments dont une partie relève d'une épreuve pratique dispensée
    en annoncent **moins** : ces items ne sont pas imprimés, et la couverture de NSI
    portait « 1 h 15 » au-dessus de parties qui totalisaient quarante-sept minutes.

    Partout ailleurs, la durée annoncée est celle du catalogue. Le test dérive l'écart
    des référentiels au lieu de le recopier : il resterait juste si un autre instrument
    se voyait dispensé demain.
    """
    catalogue = json.loads((ROOT / "referentiels/catalogue_instruments.json").read_text())
    exclus = LI.items_hors_livret()
    for it in catalogue["instruments"]:
        code, version = it["code"], it["version"]
        if code == "GO":
            continue
        banque = ROOT / "instruments" / code / "banque.json"
        assemblage = ROOT / "instruments" / code / "assemblages" / f"{version}.json"
        retire = 0
        if banque.exists() and assemblage.exists():
            duree_de = {i["item_id"]: i["duree_min"]
                        for i in json.loads(banque.read_text())["items"]}
            a = json.loads(assemblage.read_text())
            retire = sum(duree_de[i] for bloc in a.get("blocs", [])
                         for i in bloc.get("items", []) if i in exclus and i in duree_de)
        attendu = it["duree_cible_min"] - retire
        assert LI.duree_livret(code, version, it["duree_cible_min"]) == attendu, \
            f"{code}/{version} : durée annoncée qui n'est pas celle du livret composé"


def test_la_couverture_nsi_annonce_la_duree_reellement_imprimee():
    """NSI est le seul instrument dont le livret retire une partie : le cas est tenu ici.

    `NSI-1-PROG-01` et `NSI-T-PROG-02` relèvent de la partie pratique dont le candidat
    individuel est dispensé. Les retirer du livret sans les retirer de la durée annoncée
    faisait cohabiter sur la même page « 1 h 15 » et des parties totalisant 47 min.
    """
    catalogue = json.loads((ROOT / "referentiels/catalogue_instruments.json").read_text())
    banque = json.loads((ROOT / "instruments/EDS-NSI/banque.json").read_text())
    duree_de = {i["item_id"]: i["duree_min"] for i in banque["items"]}
    exclus = LI.items_hors_livret()
    for version in ("N1", "NT"):
        cible = next(i["duree_cible_min"] for i in catalogue["instruments"]
                     if i["code"] == "EDS-NSI" and i["version"] == version)
        a = json.loads((ROOT / f"instruments/EDS-NSI/assemblages/{version}.json").read_text())
        imprime = (a.get("bloc_0", {}).get("duree_min", 0)
                   + sum(duree_de[i] for bloc in a["blocs"] for i in bloc["items"]
                         if i not in exclus))
        annonce = LI.duree_livret("EDS-NSI", version, cible)
        assert annonce < cible, f"EDS-NSI/{version} : la dispense ne raccourcit rien"
        # La fenêtre du catalogue vaut pour le livret composé comme pour l'assemblage.
        assert 0.9 * annonce <= imprime <= annonce, \
            f"EDS-NSI/{version} : {imprime} min imprimées pour {annonce} min annoncées"


@pytest.mark.parametrize("profil", ["PROFIL_B_DEUXIEME_PARTIE", "PROFIL_C_BAC_EN_UNE_SESSION"])
def test_pdf_canonique_duree_coherente(profil):
    import fitz
    path = ROOT / "release/diagnostics-v2/01_LIVRETS_CANDIDAT" / profil / "03_EPREUVES_TERMINALES/GRAND_ORAL.pdf"
    with fitz.open(path) as pdf:
        cover = " ".join(pdf[0].get_text().split())
        texte = " ".join(" ".join(p.get_text() for p in pdf).split())
    assert "DURÉE DU DIAGNOSTIC 42 min" in cover
    assert "Durée. 42 min" in texte
    assert re.findall(r"Temps conseillé : (\d+) min(?! incluses)", texte) == ["12", "15", "15"]
    assert "Temps conseillé : 2 min incluses" in texte

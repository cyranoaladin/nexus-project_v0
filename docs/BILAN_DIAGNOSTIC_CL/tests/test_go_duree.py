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


def test_durees_des_autres_instruments_inchangees():
    catalogue = json.loads((ROOT / "referentiels/catalogue_instruments.json").read_text())
    for it in catalogue["instruments"]:
        if it["code"] != "GO":
            assert LI.duree_livret_candidat(it["code"], it["duree_cible_min"]) == it["duree_cible_min"]


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

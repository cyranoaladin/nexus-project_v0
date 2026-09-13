"""PHI-T-REP-04 : l'attribution fautive se corrige par une attribution exacte.

« Homo homini lupus » est attesté chez Plaute (Asinaria) et repris notamment par Hobbes
(De Cive). Une bonne réponse qui l'attribuait à Hobbes seul remplaçait une erreur par une
imprécision : l'item mesure le repérage d'une attribution fautive, sa clé doit être juste.
"""
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
RELEASE = ROOT / "release" / "diagnostics-v2"
ITEM = "PHI-T-REP-04"
BONNE_REPONSE = ("la formule vient de Plaute et a notamment été reprise par Hobbes ; "
                 "elle n'est pas de Kant")


def item():
    banque = json.loads((ROOT / "instruments/PHI/banque.json").read_text(encoding="utf-8"))
    return next(i for i in banque["items"] if i["item_id"] == ITEM)


def test_la_cle_est_historiquement_exacte():
    it = item()
    assert it["enonce"].startswith("Un candidat écrit : « comme le disait Kant, l'homme est un loup pour l'homme »")
    assert it["propositions"]["A"] == BONNE_REPONSE
    assert it["cle"]["reponse"] == "A"
    assert "Plaute" in it["propositions"]["A"] and "Hobbes" in it["propositions"]["A"]
    assert not any("de Hobbes, non de Kant" in p for p in it["propositions"].values())
    assert set(it["cle"]["distracteurs"]) == {"B", "C", "D"}


def test_bareme_et_competence_inchanges():
    it = item()
    assert (it["score_max"], it["duree_min"], it["type"], it["competence"], it["bloc"]) == (1, 1, "A", "REP", "A")
    assert it["propositions"]["D"] == "l'attribution à Kant est exacte"


@pytest.mark.parametrize("collection", ["01_LIVRETS_CANDIDAT", "02_CORRECTIONS_COACH"])
def test_les_pdf_philosophie_portent_la_reponse_corrigee(collection):
    fitz = pytest.importorskip("fitz")
    pdfs = sorted(p for p in (RELEASE / collection).rglob("PHILOSOPHIE.pdf"))
    if not pdfs:
        pytest.skip("release v2 non construite")
    for pdf in pdfs:
        with fitz.open(pdf) as d:
            texte = " ".join(" ".join(p.get_text() for p in d).split()).replace("’", "'")
        assert ITEM in texte, pdf
        assert "la formule vient de Plaute et a notamment été reprise par Hobbes" in texte, pdf
        assert "de Hobbes, non de Kant" not in texte, pdf
        if collection == "02_CORRECTIONS_COACH":
            zone = texte.split(ITEM, 1)[1][:900]
            assert re.search(r"Réponse\s*:\s*A\b", zone), pdf

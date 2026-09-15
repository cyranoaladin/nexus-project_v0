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


def bonne(it):
    """La proposition désignée par la clé — sa lettre n'est pas l'invariant, son texte l'est.

    Les positions des bonnes réponses ont été redistribuées en septembre 2026 : la bonne
    réponse se tenait en « B » dans deux tiers des QCM de la collection. Un test qui fige
    une lettre mesure la place, pas l'attribution.
    """
    return it["propositions"][it["cle"]["reponse"]]


def test_la_cle_est_historiquement_exacte():
    it = item()
    assert it["enonce"].startswith("Un candidat écrit : « comme le disait Kant, l'homme est un loup pour l'homme »")
    assert bonne(it) == BONNE_REPONSE
    assert "Plaute" in bonne(it) and "Hobbes" in bonne(it)
    assert not any("de Hobbes, non de Kant" in p for p in it["propositions"].values())
    assert set(it["cle"]["distracteurs"]) == set(it["propositions"]) - {it["cle"]["reponse"]}


def test_bareme_et_competence_inchanges():
    it = item()
    assert (it["score_max"], it["duree_min"], it["type"], it["competence"], it["bloc"]) == (1, 1, "A", "REP", "A")
    assert "l'attribution à Kant est exacte" in it["propositions"].values(), \
        "le distracteur qui valide l'attribution fautive a disparu"


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
            lettre = item()["cle"]["reponse"]
            assert re.search(rf"Réponse\s*:\s*{lettre}\b", zone), pdf

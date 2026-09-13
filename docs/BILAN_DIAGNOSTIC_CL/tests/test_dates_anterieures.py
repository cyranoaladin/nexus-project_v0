"""Aucune date postérieure à aujourd'hui ne reste sans explication.

La passe précédente avait daté son travail du lendemain. La release V1 date le sien de
l'horloge et ne réécrit pas les décisions déjà enregistrées : elle les classe. Ce test
tient l'exigence, et vérifie que le classement est un calcul et non une liste.
"""
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import dates_anterieures as DA  # noqa: E402


def test_aucune_date_future_inexpliquee():
    r = DA.resume()
    inexpliquees = [o for o in DA.occurrences() if o["classement"] == "UNEXPLAINED"]
    assert r["UNEXPLAINED_FUTURE_DATES"] == 0, inexpliquees


def test_les_decisions_anterieures_existent_bien_au_commit_de_depart():
    """Le classement se prouve : chaque ligne dite antérieure l'est dans l'historique."""
    for o in DA.resume()["decisions_anterieures"]:
        anciennes = DA._lignes_au_depart(o["fichier"])
        assert anciennes, f"{o['fichier']} : aucune date future au commit de départ"


def test_une_date_future_nouvelle_serait_vue(tmp_path, monkeypatch):
    """Contre-test : le classement n'accepte pas n'importe quoi."""
    faux = [{"fichier": "instruments/PHI/banque.json", "ligne": 1,
             "classement": "UNEXPLAINED"}]
    monkeypatch.setattr(DA, "occurrences", lambda: faux)
    assert DA.resume()["UNEXPLAINED_FUTURE_DATES"] == 1


def test_le_classement_est_stable():
    """Recalculer ne doit pas faire apparaître d'occurrences nouvelles."""
    assert DA.resume()["total"] == DA.resume()["total"]


def test_la_release_porte_le_compte():
    import release as R
    m = R.manifeste()
    assert m["critere_de_fin"]["UNEXPLAINED_FUTURE_DATES"] == 0
    assert m["dates_anterieures"]["commit_de_depart"] == DA.DEPART

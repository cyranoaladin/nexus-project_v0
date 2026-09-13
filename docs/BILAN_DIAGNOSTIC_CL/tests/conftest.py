"""Fixtures partagées : chargement des référentiels et accès aux scripts."""
import copy
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import validate_referentiel as V  # noqa: E402
import rendus_instruments as RI  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def rendus_instruments_presents():
    """Un clone propre n'a pas `instruments/*/build/` : ces rendus déterministes sont
    requis par MANIFESTE_DEPOT.json et le banc de distribution. On les reconstruit une
    fois par session, seulement s'ils manquent (voir scripts/rendus_instruments.py)."""
    RI.reconstruire()
    RI.reconstruire_banc()


@pytest.fixture
def ref():
    return V.charger(V.REFERENTIEL)


@pytest.fixture
def codes_erreur():
    return V.charger(V.CODES_ERREUR)


@pytest.fixture
def termes():
    return V.charger(V.TERMES_BLOQUANTS)


@pytest.fixture
def catalogue():
    return V.charger(V.CATALOGUE)


@pytest.fixture
def abime():
    """Renvoie une copie profonde modifiée par la fonction passée, sans toucher l'original."""
    def _abime(donnees, mutation):
        c = copy.deepcopy(donnees)
        mutation(c)
        return c
    return _abime


# ─────────────────────────────────────────── instrument fictif de test

FIXTURE = RACINE / "instruments" / "_FIXTURE"


@pytest.fixture
def dossier_fixture():
    return FIXTURE


@pytest.fixture
def refs_fixture():
    import validate_instrument as VI
    return VI.charger_referentiels(FIXTURE / "referentiels")


@pytest.fixture
def banque():
    return V.charger(FIXTURE / "banque.json")


@pytest.fixture
def assemblage():
    return V.charger(FIXTURE / "assemblages" / "standard.json")



@pytest.fixture
def regles_bilan():
    return V.charger(V.REGLES_BILAN)

"""Chargement du fichier rendu par le candidat.

Le fichier `rendu.py` est cherché dans le répertoire de travail. S'il est absent, les
tests sont ignorés ; s'il ne s'importe pas, ils échouent tous. Ce fichier accompagne le
sujet : le candidat l'exécute autant de fois qu'il le souhaite pendant l'épreuve.
"""
import importlib.util
import sys
from pathlib import Path

import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "limite: cas limite (liste vide, bornes)")


@pytest.fixture(scope="session")
def rendu():
    chemin = Path.cwd() / "rendu.py"
    if not chemin.exists():
        chemin = Path(__file__).parent / "rendu.py"
    if not chemin.exists():
        pytest.skip("rendu.py absent du répertoire de travail")
    spec = importlib.util.spec_from_file_location("rendu", chemin)
    module = importlib.util.module_from_spec(spec)
    sys.modules["rendu"] = module
    spec.loader.exec_module(module)
    return module

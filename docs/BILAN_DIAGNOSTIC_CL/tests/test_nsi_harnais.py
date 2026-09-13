"""Le harnais de correction des tâches sur machine NSI est éprouvé, non supposé.

Vingt-deux tests des deux tâches NSI étaient ignorés à chaque exécution, faute du fichier
`rendu.py` que le candidat produit pendant la passation. Ils ne prouvaient donc rien : ni
qu'ils s'exécutent, ni qu'ils distinguent une bonne réponse d'une mauvaise, ni que le
barème du référentiel en tire la bonne note.

Ces tests exécutent le harnais dans un répertoire de travail temporaire, contre la
solution de référence puis contre une réponse volontairement fausse, et confrontent le
résultat au barème `bareme_tests_machine`. Les ignorés d'origine subsistent : ils sont le
chemin de la passation réelle, où le fichier vient du candidat.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
NSI = RACINE / "instruments" / "EDS-NSI" / "tests"
REFERENCE = NSI / "rendu_reference.py"

FAUSSE_REPONSE = '''
def compte_pairs(L):
    """Recompte en repassant sur la liste : le résultat est bon, le coût est doublé."""
    n = 0
    for i in range(len(L)):
        for j in range(len(L)):
            if i == j and L[j] % 2 == 0:
                n += 1
    return n


def recherche(L, v):
    """Recherche séquentielle : le résultat est bon, l'algorithme n'est pas celui demandé."""
    for i in range(len(L)):
        if L[i] == v:
            return i
    return -1
'''


@pytest.fixture(scope="module")
def bareme():
    ref = json.loads((RACINE / "referentiels" / "competences.json")
                     .read_text(encoding="utf-8"))
    return ref["conventions"]["bareme_tests_machine"]


def note_du_bareme(part: float, bareme: dict) -> int:
    for seuil in bareme["seuils"]:
        if part >= seuil["part_minimale"]:
            return seuil["note"]
    raise AssertionError("barème incomplet")


def executer(dossier: Path, rendu: str) -> tuple[int, int, int]:
    """Exécute le harnais avec ce rendu ; renvoie (réussis, échoués, ignorés)."""
    (dossier / "rendu.py").write_text(rendu, encoding="utf-8")
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", "--tb=no", "-p", "no:cacheprovider",
                        str(NSI)], cwd=dossier, capture_output=True, text=True)
    ligne = r.stdout.strip().splitlines()[-1]
    nombre = lambda mot: int(m.group(1)) if (m := re.search(rf"(\d+) {mot}", ligne)) else 0
    return nombre("passed"), nombre("failed"), nombre("skipped")


def test_la_solution_de_reference_existe_et_ne_va_pas_au_candidat():
    assert REFERENCE.exists()
    assert not (NSI / "rendu.py").exists(), \
        "un rendu candidat ne doit jamais être versionné (voir .gitignore)"
    modele = (NSI / "rendu_modele.py").read_text(encoding="utf-8")
    assert "def compte_pairs" not in modele, "le modèle remis au candidat porte la solution"


def test_le_harnais_valide_la_solution_de_reference(tmp_path, bareme):
    reussis, echoues, ignores = executer(tmp_path, REFERENCE.read_text(encoding="utf-8"))
    assert (echoues, ignores) == (0, 0), \
        f"{echoues} échec(s) et {ignores} ignoré(s) sur la solution de référence"
    assert reussis >= 2 * bareme["cas_min"], \
        f"{reussis} cas exécutés, moins que le minimum du barème pour deux tâches"
    assert note_du_bareme(1.0, bareme) == 3


def test_le_harnais_sanctionne_une_reponse_fausse(tmp_path, bareme):
    """Les deux réponses donnent le bon résultat : ce sont les algorithmes qui sont faux."""
    reussis, echoues, ignores = executer(tmp_path, FAUSSE_REPONSE)
    assert ignores == 0
    assert echoues > 0, "le harnais accepte une recherche séquentielle et un double parcours"
    part = reussis / (reussis + echoues)
    assert part < 1.0
    assert note_du_bareme(part, bareme) < 3, \
        "le barème accorde la note pleine à une réponse hors spécification"


def test_le_bareme_est_celui_du_referentiel(bareme):
    assert [s["note"] for s in bareme["seuils"]] == [3, 2, 1, 0]
    assert note_du_bareme(0.99, bareme) == 2
    assert note_du_bareme(0.5, bareme) == 1
    assert note_du_bareme(0.0, bareme) == 0


def test_sans_rendu_le_harnais_ignore_au_lieu_de_reussir(tmp_path):
    """Le chemin d'origine : sans fichier candidat, aucun test ne peut prétendre réussir."""
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", "--tb=no",
                        "-p", "no:cacheprovider", str(NSI)],
                       cwd=tmp_path, capture_output=True, text=True)
    ligne = r.stdout.strip().splitlines()[-1]
    assert "skipped" in ligne and "passed" not in ligne, ligne

"""Les mesures disciplinaires ne bougent pas quand le rendu ou le plan changent.

La consolidation portait sur la planification, les priorités, la provenance et le rendu ;
la contre-expertise a ajouté un statut d'instrument, des intitulés versionnés et une règle
de priorité pour P1. Aucun de ces travaux ne doit déplacer un score, un niveau, un palier,
un agrégat, une calibration ou une grille. L'instantané de `tests/instantanes/mesures.json`
en est la preuve : il a été figé au commit qui précédait ces travaux, et il n'a pas changé.

Une différence n'est pas interdite : elle doit être voulue, expliquée, et l'instantané
régénéré sciemment par `python3 scripts/mesures.py tests/instantanes/mesures.json`.
"""
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
INSTANTANE = RACINE / "tests" / "instantanes" / "mesures.json"
sys.path.insert(0, str(RACINE / "scripts"))

import mesures as ME  # noqa: E402


def aplatir(o, prefixe=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from aplatir(v, f"{prefixe}.{k}" if prefixe else k)
    elif isinstance(o, list):
        yield prefixe, json.dumps(o, ensure_ascii=False)
    else:
        yield prefixe, o


@pytest.fixture(scope="module")
def fige():
    return json.loads(INSTANTANE.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def courant():
    return ME.tous()


#: Les périmètres dont les mesures ont bougé sciemment, et pourquoi.
#:
#: « MATH-EA », le 2026-09-11 (EC-33) : la création d'une seconde tâche de production
#: change le barème interne de l'instrument, et rien d'autre.
#:
#: « FR-EAF/REDA », le 2026-09-11 : à l'insertion des textes, `FR-EAF-REDA-02` a reçu le
#: paragraphe d'exemple que son énoncé annonçait sans le fournir, et sa clé nomme
#: désormais l'idée directrice manquante. Le code d'erreur dérivé du jeu de maquette
#: passe donc de `FR-ERR-CITATION` à `FR-ERR-AXE` pour une saisie. Aucun score, aucun
#: niveau, aucun palier, aucun agrégat, aucune calibration ne bouge : seul le relevé des
#: codes d'erreur d'un candidat fictif change, et il change parce que l'item corrige
#: maintenant ce qu'il prétendait corriger.
#: « GO » et « FR-MAI/ORAL », le 2026-09-11 : l'audit de l'épreuve orale terminale contre
#: sa définition officielle a montré que la grille ne mesurait ni la qualité des deux
#: questions que le candidat apporte, ni l'ancrage disciplinaire, ni l'esprit critique.
#: Trois critères ajoutés : la grille passe de 15 à 24 points, et la compétence que le
#: § 7.2 lui reporte suit. Aucun autre périmètre ne bouge.
PERIMETRES_AMENDES = ("MATH-EA", "FR-EAF/REDA.erreurs", "GO", "FR-MAI/ORAL")


def test_aucune_mesure_na_bouge(fige, courant):
    a, b = dict(aplatir(fige)), dict(aplatir(courant))
    diff = [(k, a.get(k, "<absent>"), b.get(k, "<absent>"))
            for k in sorted(set(a) | set(b))
            if a.get(k, "<absent>") != b.get(k, "<absent>")]
    assert not diff, "mesures déplacées :\n" + "\n".join(
        f"  {k} : {x} → {y}" for k, x, y in diff[:20])


def test_rien_na_bouge_hors_des_perimetres_amendes(fige, courant):
    """Les deux amendements voulus n'ont déplacé aucune mesure ailleurs.

    Trois amendements, tous voulus. L'ajout d'une seconde tâche de production à MATH-EA
    (EC-33) change le barème interne de cet instrument. La réécriture de la clé de
    `FR-EAF-REDA-02` sur le texte réel change un code d'erreur relevé. L'audit du Grand
    oral ajoute trois critères à sa grille, qui passe de 15 à 24 points, et la compétence
    FR-MAI/ORAL que le § 7.2 lui reporte suit. Rien d'autre ne devait bouger, et ce test
    le tient : si un score d'EDS-MATH, de PHI ou du tronc commun se déplaçait, il
    apparaîtrait ici.
    """
    a, b = dict(aplatir(fige)), dict(aplatir(courant))
    hors = [k for k in sorted(set(a) | set(b))
            if a.get(k, "<absent>") != b.get(k, "<absent>")
            and not any(x in k for x in PERIMETRES_AMENDES)]
    assert not hors, "mesures déplacées hors du périmètre amendé : " + ", ".join(hors[:20])


def test_l_instantane_couvre_les_quatre_jeux(fige):
    assert set(fige) == set(ME.JEUX) == {"P3", "P3_mineur", "P2_oral", "P1",
                                         "P1_2026_2027"}


def test_l_instantane_couvre_chaque_famille_de_mesure(fige):
    attendu = {"instruments", "perimetres", "competences", "matieres", "bloc_0",
               "calibration_par_competence", "calibration_par_matiere",
               "calibration_non_renseignee", "calibration_sans_domaine",
               "grilles_coach", "profil_met"}
    for jeu, releve in fige.items():
        assert set(releve) == attendu, jeu
        assert releve["competences"] and releve["matieres"]


def test_l_instantane_ne_contient_aucun_libelle_de_module(fige):
    """Un intitulé est un libellé, pas une mesure : le versionner ne doit rien casser."""
    for jeu, releve in fige.items():
        for pc, x in releve["matieres"].items():
            assert "module_entree" not in x
            assert set(x) >= {"competence_module", "module_est_remise_a_niveau"}


def test_une_mesure_modifiee_est_detectee(fige, courant):
    """Contre-épreuve : si l'instantané ne voyait pas une dérive, il ne servirait à rien."""
    abime = json.loads(json.dumps(courant))
    pc = abime["P3"]["perimetres"][0]
    abime["P3"]["matieres"][pc]["global"] = 0.99
    a, b = dict(aplatir(fige)), dict(aplatir(abime))
    assert [k for k in set(a) | set(b) if a.get(k) != b.get(k)]

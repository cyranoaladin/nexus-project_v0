"""La release se reconstruit à l'octet près — et rien ne doit rendre un PDF horodaté.

Deux constructions successives des mêmes sources rendaient cent soixante-sept fichiers
identiques sur cent soixante-treize. Les six autres étaient les quatre PDF composés par
reportlab — guide de l'opérateur, couverture réglementaire, deux matrices — et le
manifeste qui porte leurs empreintes : reportlab horodate chaque document et lui attribue
un identifiant tiré au sort. Le contenu ne changeait pas ; les octets, si. Une release
dont les empreintes bougent sans que rien n'ait bougé ne prouve plus rien.

Reconstruire deux fois la release prend une dizaine de minutes : ce contrôle ne le fait
pas. Il vérifie que les réglages qui rendent la construction déterministe sont en place,
et `audit/RELEASE_REPRODUCIBILITY.json` porte la mesure elle-même, refaite à chaque
clôture.
"""
from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
SCRIPTS = RACINE / "scripts"

#: Les deux fonctions qui composent un PDF sans passer par LaTeX. Toute autre qui
#: apparaîtrait devra, elle aussi, figer son horodatage.
COMPOSITEURS_REPORTLAB = {
    "scripts/distribution.py": "texte_en_pdf",
    "scripts/release_v2.py": "tableau_en_pdf",
}


def appels_canvas(source: str, fonction: str) -> list[ast.Call]:
    arbre = ast.parse(source)
    for noeud in ast.walk(arbre):
        if isinstance(noeud, ast.FunctionDef) and noeud.name == fonction:
            return [n for n in ast.walk(noeud) if isinstance(n, ast.Call)
                    and isinstance(n.func, ast.Attribute) and n.func.attr == "Canvas"]
    pytest.fail(f"fonction {fonction} introuvable")


@pytest.mark.parametrize("chemin,fonction", sorted(COMPOSITEURS_REPORTLAB.items()))
def test_tout_pdf_compose_par_reportlab_est_invariant(chemin, fonction):
    source = (RACINE / chemin).read_text(encoding="utf-8")
    appels = appels_canvas(source, fonction)
    assert appels, f"{chemin}::{fonction} ne compose plus de PDF"
    for appel in appels:
        mots = {k.arg for k in appel.keywords}
        assert "invariant" in mots, (
            f"{chemin}::{fonction} : canvas.Canvas sans « invariant » — le PDF portera "
            f"l'heure de sa construction et un identifiant tiré au sort, et deux "
            f"constructions de la release rendront des octets différents.")


def test_les_rendus_latex_neutralisent_leur_horodatage():
    """LaTeX horodate aussi : SOURCE_DATE_EPOCH et FORCE_SOURCE_DATE l'en empêchent."""
    for chemin in ("scripts/livret.py", "scripts/build_instrument.py"):
        source = (RACINE / chemin).read_text(encoding="utf-8")
        assert "SOURCE_DATE_EPOCH" in source, f"{chemin} : horodatage LaTeX non neutralisé"


def test_la_mesure_de_reproductibilite_est_consignee_et_verte():
    """Le réglage ne suffit pas : la mesure elle-même est versionnée.

    Elle est refaite à chaque clôture — deux constructions complètes, comparées fichier
    par fichier — et ce contrôle refuse une release dont la dernière mesure serait rouge
    ou porterait sur un autre nombre de fichiers que la release versionnée.
    """
    mesure = json.loads(
        (RACINE / "audit/RELEASE_REPRODUCIBILITY.json").read_text(encoding="utf-8"))
    assert mesure["BYTE_REPRODUCIBLE"] == "YES", mesure["fichiers_differents"]
    assert mesure["PATH_REPRODUCIBLE"] == "YES"
    assert mesure["fichiers_differents"] == []
    reels = sum(1 for p in (RACINE / "release/diagnostics-v2").rglob("*") if p.is_file())
    assert mesure["fichiers_compares"] == reels, (
        f"la mesure porte sur {mesure['fichiers_compares']} fichiers, la release en "
        f"compte {reels} : elle est à refaire")

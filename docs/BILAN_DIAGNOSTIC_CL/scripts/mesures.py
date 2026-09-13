#!/usr/bin/env python3
"""Relevé sémantique des mesures diagnostiques d'un jeu de données.

Les travaux de consolidation portent sur la planification, les priorités, la provenance
et le rendu. Aucun d'eux ne doit déplacer une mesure disciplinaire. Ce relevé est la
preuve : il extrait du moteur tout ce qui relève de la mesure — scores, niveaux, paliers,
agrégats, non-réponse, tâche type épreuve, codes d'erreur, calibrations, grilles coach,
module d'entrée et rythme par périmètre — et rien de ce qui relève du plan ou du texte.

Il n'emploie que des lectures présentes dans le moteur depuis la maquette v2, de sorte
qu'il se compare à lui-même d'une révision à l'autre. `tests/test_non_regression.py`
compare le relevé courant aux instantanés de `tests/instantanes/`.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

from maquette_bilan import Bilan  # noqa: E402

JEUX = {
    "P3": ("_MAQUETTE", "qp.json"),
    "P3_mineur": ("_MAQUETTE", "qp_variante_mineure.json"),
    "P2_oral": ("_MAQUETTE_P2", "qp.json"),
    "P1": ("_MAQUETTE_P1", "qp.json"),
    "P1_2026_2027": ("_MAQUETTE_P1_2026_2027_SPECIFIQUES", "qp.json"),
}


def arrondi(x):
    """Les mesures se comparent au dix-millième : un flottant n'est pas un texte."""
    return None if x is None else round(float(x), 6)


def releve(dossier: str, qp: str) -> dict:
    chemin = RACINE / "instruments" / dossier
    b = Bilan(chemin / qp, dossier=chemin).calculer()

    competences = {}
    for (pc, comp), x in sorted(b.res.items()):
        competences[f"{pc}/{comp}"] = {
            "part": arrondi(x["part"]), "obtenu": x["obtenu"], "max": x["max"],
            "mesures": x["n"], "niveau": x["niveau"], "palier": x["palier"],
            "evalue": x["evalue"], "type": x["type"],
            "erreurs": dict(sorted(x["erreurs"].items())),
        }

    matieres = {}
    for pc in sorted(b.perimetres_passes):
        a = b.agr[pc]
        module, code, _ = b.module_entree(pc)  # l'intitulé est un libellé, pas une mesure
        heures, niveau_rythme = b.rythme(pc)
        matieres[pc] = {
            "global": arrondi(a["global"]), "mesures": a["mesures"],
            "prerequis": arrondi(a["prerequis"]),
            "prerequis_points": list(a["prerequis_points"])
            if a["prerequis"] is not None else None,
            "tache": arrondi(a["tache"]),
            "tache_points": list(a["tache_points"]) if a["tache"] is not None else None,
            "non_reponse": arrondi(a["non_reponse"]),
            "competence_module": code,
            "module_est_remise_a_niveau":
                module == b.regles["module_entree"]["libelle_remise_a_niveau"],
            "rythme_perimetre": heures, "niveau_du_rythme": niveau_rythme,
            "reevaluation": sorted(b.evaluation_intermediaire(pc)[0]),
        }

    def calibration(c):
        return None if c is None else {
            "percu": c["percu"], "percu100": arrondi(c["percu100"]),
            "mesure": arrondi(c["mesure"]), "ecart": arrondi(c["ecart"]),
            "signal": c["signal"]["libelle"] if c["signal"] else None,
        }

    par_competence = {f"{k[0]}/{k[1]}": calibration(c)
                      for k, c in b.calibration_competences()}
    par_matiere = {pc: calibration(b.calibration_matiere(pc))
                   for pc in sorted(b.perimetres_passes)}
    sans_reponse, sans_domaine = b.calibrations_absentes()

    grilles = {}
    for code, rel in sorted(b.grilles_coach.items()):
        grilles[code] = {
            "obtenu": rel["obtenu"], "max": rel["max"],
            "criteres": {c: x["score"] for c, x in sorted(rel["criteres"].items())},
        }

    return {
        "instruments": [f"{c}/{v}" for c, v in b.instruments],
        "perimetres": sorted(b.perimetres_passes),
        "competences": competences,
        "matieres": matieres,
        "bloc_0": {f"{k[0]}/{k[1]}": v for k, v in sorted(b.bloc0.items())},
        "calibration_par_competence": par_competence,
        "calibration_par_matiere": par_matiere,
        "calibration_non_renseignee": [f"{a}/{c}" for a, c in sans_reponse],
        "calibration_sans_domaine": [f"{a}/{c}" for a, c in sans_domaine],
        "grilles_coach": grilles,
        "profil_met": {d: x["rang"] for d, x in sorted(b.profils_met().items())},
    }


def tous() -> dict:
    return {nom: releve(*args) for nom, args in JEUX.items()}


def main(argv: list[str]) -> int:
    sortie = Path(argv[1]) if len(argv) > 1 else None
    donnees = tous()
    texte = json.dumps(donnees, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if sortie:
        sortie.write_text(texte, encoding="utf-8", newline="\n")
        print(f"  {sortie} — {len(donnees)} jeux relevés")
    else:
        print(texte, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

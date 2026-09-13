#!/usr/bin/env python3
"""Plan de passation — combien de demi-journées, et lesquelles (§ 1.1, § 3.2, EC-29).

Le § 1.1 pose un invariant : « Aucune demi-journée de passation ne dépasse 3 h 15
d'évaluation effective ; les épreuves de production longue sont placées en début de
session. » Le § 3.2 propose un découpage par profil, mais ce découpage est antérieur aux
configurations du français ouvertes par Q-19, et sa demi-journée P2 dépasse déjà le
plafond de trente minutes (EC-29).

Ce module ne propose rien : il calcule. Les instruments passés se déduisent du
questionnaire, ceux dont le support est « à distance » sortent du décompte, et les autres
sont placés dans le nombre minimal de demi-journées dont aucune ne dépasse le plafond.
Aucun instrument n'est retiré, aucune demi-journée n'est allongée : c'est le nombre de
demi-journées qui augmente.

Les seuils, la liste des supports à distance et l'ordre de placement sont au catalogue.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

from maquette_donnees import (liste_effective_des_instruments_a_passer,  # noqa: E402
                              statut_du_profil)


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def duree_lisible(minutes: int) -> str:
    """195 -> « 3 h 15 » ; 60 -> « 1 h » ; 50 -> « 50 min »."""
    h, m = divmod(int(minutes), 60)
    if not h:
        return f"{m} min"
    return f"{h} h" + (f" {m:02d}" if m else "")


def plan(qp: dict, cat: dict) -> dict:
    """Le plan de passation d'un candidat : ce qui se fait à distance, et le reste.

    Rend le détail par demi-journée, la durée de chacune et le plafond appliqué, de sorte
    que l'invariant du § 1.1 se vérifie sur le rendu lui-même et non sur une intention.
    """
    regle = cat["conventions"]["plan_passation"]
    plafond = regle["duree_max_demi_journee_min"]
    distants = set(regle["supports_a_distance"])
    fiches = {(i["code"], i["version"]): i for i in cat["instruments"]}

    # Le plan se construit sur la liste effective des instruments à passer, et non sur
    # une table « profil × configuration française » qui ajouterait MATH-EA à tout P2 ou
    # P3 : l'épreuve peut être dispensée, sa note conservée, ou le profil non ouvert.
    a_distance, au_centre = [], []
    for code, version in liste_effective_des_instruments_a_passer(qp, cat):
        f = fiches[(code, version)]
        cible = a_distance if f["support"] in distants else au_centre
        cible.append({"code": code, "version": version, "duree": f["duree_cible_min"],
                      "support": f["support"]})

    trop_long = [x for x in au_centre if x["duree"] > plafond]
    if trop_long:
        raise SystemExit(f"instrument plus long qu'une demi-journée : {trop_long}")

    # Les plus longues d'abord : ce sont les productions, que le § 1.1 place en début de
    # session. L'ordre est total — durée décroissante, puis code — donc reproductible.
    ordonnes = sorted(au_centre, key=lambda x: (-x["duree"], x["code"], x["version"]))
    total = sum(x["duree"] for x in ordonnes)

    nombre = max(1, -(-total // plafond)) if ordonnes else 0
    demi_journees: list[list[dict]] = []
    while ordonnes:
        demi_journees = [[] for _ in range(nombre)]
        charges = [0] * nombre
        place = True
        for x in ordonnes:
            for j in range(nombre):
                if charges[j] + x["duree"] <= plafond:
                    demi_journees[j].append(x)
                    charges[j] += x["duree"]
                    break
            else:
                place = False
                break
        if place:
            break
        nombre += 1

    return {
        "statut_profil": statut_du_profil(qp)["statut"],
        "a_distance": a_distance,
        "demi_journees": demi_journees,
        "durees": [sum(x["duree"] for x in dj) for dj in demi_journees],
        "total_au_centre": total,
        "total_a_distance": sum(x["duree"] for x in a_distance),
        "plafond": plafond,
        "nombre_demi_journees": len(demi_journees),
    }


def tableau(qp: dict, cat: dict) -> str:
    """Le plan sous forme lisible, pour le rapport de porte."""
    p = plan(qp, cat)
    r = qp["reponses"]
    lignes = [f"Profil {r['profil']}, configuration française "
              f"« {r['epreuves_francais_a_presenter']} »",
              f"  à distance : "
              + ", ".join(f"{x['code']}/{x['version']} ({x['duree']} min)"
                          for x in p["a_distance"])
              + f" — {duree_lisible(p['total_a_distance'])}",
              f"  au centre : {duree_lisible(p['total_au_centre'])} en "
              f"{p['nombre_demi_journees']} demi-journée(s), plafond "
              f"{duree_lisible(p['plafond'])}"]
    for i, (dj, duree) in enumerate(zip(p["demi_journees"], p["durees"]), 1):
        lignes.append(f"    J{i} — {duree_lisible(duree)} : "
                      + ", ".join(f"{x['code']}/{x['version']}" for x in dj))
    return "\n".join(lignes)


if __name__ == "__main__":
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    chemin = Path(sys.argv[1]) if len(sys.argv) > 1 else \
        RACINE / "instruments" / "_MAQUETTE_P2" / "qp.json"
    qp = charger(chemin)
    configs = sys.argv[2:] or [qp["reponses"]["epreuves_francais_a_presenter"]]
    for config in configs:
        qp["reponses"]["epreuves_francais_a_presenter"] = config
        print(tableau(qp, cat))
        print()

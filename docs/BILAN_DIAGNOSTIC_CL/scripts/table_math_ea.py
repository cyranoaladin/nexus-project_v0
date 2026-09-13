#!/usr/bin/env python3
"""Tableau exhaustif de MATH-EA, item par item — la contre-expertise sous forme lisible.

La direction demande de pouvoir lire, sans ouvrir la banque, ce que chaque item mesure : sa
place dans les assemblages, son registre, son barème, la compétence principale qu'il sert,
les compétences transversales du préambule qu'il exerce réellement, et surtout **la ligne du
programme officiel** à laquelle il se rattache. Un renvoi générique au programme ne dit rien :
le tableau nomme le code de la capacité et son texte.

Rien n'est écrit ici : tout est lu dans `instruments/MATH-EA/banque.json`, dans les deux
assemblages et dans `referentiels/capacites_mathematiques.json`. Le tableau ne peut donc pas
diverger de l'instrument.

Le tableau porte les clés et les critères : c'est un document de correcteur, écrit par défaut
dans `instruments/MATH-EA/build/`, aux côtés du corrigé, et jamais joint au sujet.

  usage : table_math_ea.py [chemin de sortie]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import validate_instrument as VI  # noqa: E402

PARCOURS = ("SPE", "SPECIFIQUES")


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def md(t: str) -> str:
    """Une barre verticale dans une cellule casserait le tableau."""
    return str(t).replace("|", "\\|").replace("\n", " ")


def tableau() -> str:
    banque = {i["item_id"]: i for i in charger(
        RACINE / "instruments" / "MATH-EA" / "banque.json")["items"]}
    refs = VI.charger_referentiels(None)
    caps = refs["capacites_mathematiques"]
    par_code = {c["code"]: c for p in caps["programmes"].values() for c in p["capacites"]}
    par_code.update({c["code"]: c for c in caps["renvois_externes"]})
    comps = {c["code"]: c for p in refs["competences"]["perimetres"]
             if p["code"] == "MATH-EA" for c in p["competences"]}
    prog = refs["programmes_examen"]["epreuves_anticipees"]["session_2027"]["mathematiques"]
    corr = prog["format_epreuve"]["correspondance_blocs"]
    parties = {p["code"]: p["intitule"] for p in prog["format_epreuve"]["parties"]}

    asm = {v: charger(RACINE / "instruments" / "MATH-EA" / "assemblages" / f"{v}.json")
           for v in PARCOURS}
    dans = {v: [i for bl in asm[v]["blocs"] for i in bl["items"]] for v in PARCOURS}
    echelle = refs["competences"]["conventions"]["echelle_grille"]["max"]

    L = ["# MATH-EA — tableau exhaustif des items", "",
         "Produit par `scripts/table_math_ea.py` depuis la banque, les deux assemblages et le "
         "référentiel des capacités officielles. Il ne peut pas diverger de l'instrument.", "",
         "| item_id | assemblage(s) | bloc | partie de l'épreuve | type | durée | points | "
         "compétence principale | compétences transversales | capacité officielle | "
         "palier | réponse ou critères | justification pédagogique |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for iid, it in banque.items():
        versions = [v for v in PARCOURS if iid in dans[v]]
        bloc = it["bloc"]
        partie = next((parties[p] for p in ("partie_1", "partie_2")
                       if bloc in corr[p]["blocs"] and it["type"] in corr[p]["types_item"]),
                      "hors format — diagnostic seul")
        points = (echelle * len(it["grille"])) if it.get("grille") else it["score_max"]
        cap = []
        for v in versions:
            for code in it["capacites_officielles"].get(v, []):
                fiche = par_code[code]
                marque = "" if fiche["nature"] == "capacite_attendue" else \
                    f" *({fiche['nature']})*"
                ligne = f"`{code}`{marque} — {fiche['texte']}"
                if ligne not in cap:
                    cap.append(ligne)
        if it.get("grille"):
            reponse = " · ".join(f"{c['code']} → {c['competence']}" for c in it["grille"])
        elif it["type"] == "A":
            reponse = f"réponse **{it['cle']['reponse']}** — " + " · ".join(
                f"{k} : {v}" for k, v in it["cle"]["distracteurs"].items())
        else:
            reponse = it["cle"]["reponse_2pts"]
        justification = it.get("justification_rattachement") or it["notes_conception"]
        L.append("| `" + iid + "` | " + ", ".join(versions) + " | " + bloc + " | "
                 + md(partie) + " | " + it["type"] + " | " + f"{it['duree_min']:g} min | "
                 + f"{points} | " + md(f"{it['competence']} — {comps[it['competence']]['intitule']}")
                 + " | " + ", ".join(it["competences_math_transversales"]) + " | "
                 + md("<br>".join(cap)) + " | " + it["palier"] + " | " + md(reponse)
                 + " | " + md(justification) + " |")

    L += ["", "## Couverture des six compétences du préambule", "",
          "*Nombre de tâches qui exercent réellement la compétence, par partie de l'épreuve.*",
          "", "| Compétence | " + " | ".join(f"{v} — partie 1 | {v} — partie 2"
                                             for v in PARCOURS) + " |",
          "|---|" + "---|" * (2 * len(PARCOURS))]
    couv = {v: VI.couverture_transversale([banque[i] for i in dans[v]], refs, asm[v])
            for v in PARCOURS}
    for c in caps["competences_transversales"]["liste"]:
        cells = []
        for v in PARCOURS:
            cells += [str(couv[v][c["code"]]["partie_1"]),
                      str(couv[v][c["code"]]["partie_2"])]
        L.append(f"| **{c['code']}** — {c['texte']} | " + " | ".join(cells) + " |")
    seuil = caps["competences_transversales"]["regle_couverture"]["sources_min_partie_2"]
    L += ["", f"Une compétence n'est tenue pour couverte qu'à partir de {seuil} tâches de la "
          f"seconde partie : la première, faite de questions à choix multiple, ne peut porter "
          f"la preuve ni de « communiquer » ni de « chercher ».", ""]

    L += ["## Audit des paliers", "",
          "*Points servis par palier, et détermination au seuil du référentiel.*", "",
          "| Compétence | " + " | ".join(PARCOURS) + " |", "|---|" + "---|" * len(PARCOURS)]
    audit = {v: VI.audit_paliers([banque[i] for i in dans[v]], refs, asm[v])
             for v in PARCOURS}
    for code in comps:
        cells = []
        for v in PARCOURS:
            pal = audit[v]["competences"].get(code)
            cells.append("—" if not pal else ", ".join(
                f"{p} : {x['points']} pts / {x['sources']} sources"
                for p, x in sorted(pal.items())))
        L.append(f"| `{code}` | " + " | ".join(cells) + " |")
    L += ["", f"Seuil de détermination : {audit['SPE']['seuil_points']} points par palier.", ""]
    return "\n".join(L) + "\n"


DEFAUT = RACINE / "instruments" / "MATH-EA" / "build" / "MATH-EA_tableau_expertise.md"


if __name__ == "__main__":
    texte = tableau()
    cible = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAUT
    cible.parent.mkdir(parents=True, exist_ok=True)
    cible.write_text(texte, encoding="utf-8", newline="\n")
    print(f"  {cible.relative_to(RACINE)} — {texte.count(chr(10))} lignes")

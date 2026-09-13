#!/usr/bin/env python3
"""Preuve de registre : le document parent porte les mêmes valeurs, à l'adresse près.

Le § 9 conditionne la version parent au statut de minorité, et le référentiel pose que
seul le registre change. « Seul le registre » est une affirmation : ce script en fait une
démonstration. Il compose les deux versions du même jeu, neutralise les variantes que la
composition a elle-même déclarées — chaque appel à `dit(candidat, parent)` les enregistre —
puis exige que les deux textes soient alors identiques au caractère près, et que les
nombres imprimés le soient sans neutralisation d'aucune sorte.

Aucune liste de tournures n'est tenue à la main : ce qui est autorisé à différer est ce que
le code a déclaré différent.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
from maquette_bilan import Bilan  # noqa: E402

JETON = "«REGISTRE»"


def neutraliser(texte: str, variantes: list[str]) -> str:
    for v in sorted(variantes, key=len, reverse=True):
        if v:
            texte = texte.replace(v, JETON)
    return texte


def comparer(b: Bilan) -> dict:
    candidat, p_cand = B.composer(b, "candidat")
    parent, p_par = B.composer(b, "parent")

    # Les deux compositions suivent le même chemin : le k-ième appel à `dit` est le même
    # des deux côtés. On apparie donc la formulation *retenue* de chaque version, et non
    # les deux branches d'une seule — la branche non retenue porte l'adresse de l'autre
    # registre et n'apparaît nulle part.
    if len(p_cand.variantes) != len(p_par.variantes):
        raise SystemExit("les deux versions n'ont pas suivi le même chemin de composition")
    couples = list(dict.fromkeys(
        (c, x) for (c, _), (_, x) in zip(p_cand.variantes, p_par.variantes)))
    cote_candidat = [c for c, _ in couples] + [B.REGISTRES["candidat"]["titre"],
                                               B.REGISTRES["candidat"]["note"]]
    cote_parent = [x for _, x in couples] + [B.REGISTRES["parent"]["titre"],
                                             B.REGISTRES["parent"]["note"]]

    a = neutraliser(candidat, cote_candidat).splitlines()
    z = neutraliser(parent, cote_parent).splitlines()
    residus = [(i + 1, x, y) for i, (x, y) in enumerate(zip(a, z)) if x != y]
    if len(a) != len(z):
        residus.append((0, f"{len(a)} lignes", f"{len(z)} lignes"))

    nb_cand = re.findall(B.NOMBRE, candidat)
    nb_par = re.findall(B.NOMBRE, parent)
    return {
        "candidat": candidat, "parent": parent,
        "variantes": couples,
        "residus": residus,
        "nombres_identiques": nb_cand == nb_par,
        "nombres": len(nb_cand),
        "lignes": len(candidat.splitlines()),
        "lignes_differentes": sum(1 for x, y in zip(candidat.splitlines(),
                                                    parent.splitlines()) if x != y),
    }


def document(b: Bilan, r: dict) -> str:
    L = [f"# Preuve de registre — candidat `{b.qp['candidate_ref']}`", "",
         "Comparaison automatique des deux versions du même bilan, produite par "
         "`scripts/preuve_registre.py`. Les zones autorisées à différer ne sont pas "
         "énumérées ici à la main : ce sont celles que la composition déclare, appel par "
         "appel, en enregistrant le couple (candidat, parent).", "",
         "| Constat | Valeur |", "|---|---|",
         f"| Lignes du document | {r['lignes']} |",
         f"| Lignes différentes avant neutralisation | {r['lignes_differentes']} |",
         f"| Variantes de registre déclarées par la composition | {len(r['variantes'])} |",
         f"| Lignes encore différentes après neutralisation | **{len(r['residus'])}** |",
         f"| Nombres imprimés | {r['nombres']} |",
         f"| Suite des nombres identique dans les deux versions | "
         f"**{'oui' if r['nombres_identiques'] else 'non'}** |", "",
         "## Zones de registre déclarées", "",
         "| Version candidat | Version parent |", "|---|---|"]
    for c, p in r["variantes"]:
        L.append(f"| {c} | {p} |")
    L += ["", "## Différences résiduelles", ""]
    if not r["residus"]:
        L.append("Aucune. Hors des zones ci-dessus, les deux documents sont identiques au "
                 "caractère près.")
    else:
        L += ["| Ligne | Version candidat | Version parent |", "|---|---|---|"]
        for i, x, y in r["residus"]:
            L.append(f"| {i} | {x} | {y} |")
    return "\n".join(L) + "\n"


def main(argv: list[str]) -> int:
    dossier = Path(argv[1]) if len(argv) > 1 else RACINE / "instruments" / "_MAQUETTE"
    code = 0
    for chemin in sorted(dossier.glob("qp*.json")):
        b = Bilan(chemin, dossier=dossier).calculer()
        if "parent" not in B.registres_a_produire(b):
            continue
        r = comparer(b)
        nom = f"preuve_registre_{b.qp['candidate_ref']}.md"
        (dossier / nom).write_text(document(b, r), encoding="utf-8", newline="\n")
        etat = ("conforme" if not r["residus"] and r["nombres_identiques"]
                else "ÉCART")
        print(f"  {(dossier / nom).relative_to(RACINE)} — {etat} "
              f"({len(r['residus'])} résidu(s), {r['nombres']} nombres)")
        code += 0 if etat == "conforme" else 1
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))

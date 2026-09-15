#!/usr/bin/env python3
"""Répartit la position de la bonne réponse des QCM, sans toucher à leur contenu.

Sur les 267 questions à choix multiple de la collection, la bonne réponse occupait la
position B dans 65,5 % des cas — 100 % en histoire-géographie du tronc commun, 94 % en
enseignement scientifique, 93 % en HGGSP. Un candidat qui cochait B partout, sans lire une
seule question, obtenait deux tiers des points de QCM de la collection. Chaque question
prise isolément était juste ; c'est la distribution qui ne mesurait plus rien, et le bilan,
puis le plan de travail, en héritaient.

Dans chaque banque, les questions sont ordonnées par l'empreinte SHA-256 de leur
identifiant, puis les quatre positions leur sont distribuées à tour de rôle. La
répartition est donc exactement équilibrée — les effectifs de A, B, C et D ne diffèrent
jamais de plus d'un — et elle se recalcule à l'identique : la release reste reproductible.
Un tirage au hasard, lui, aurait rendu une banque déjà équilibrée à la main moins bonne
qu'elle ne l'était.

Les autres propositions conservent leur ordre relatif dans les places restantes. Tout ce
qui désigne une proposition par sa lettre — le libellé de son mécanisme d'erreur, et les
notes de conception imprimées dans le corrigé — suit la permutation dans le même geste.

    python3 scripts/equilibrer_qcm.py --plan     # ce qui changerait
    python3 scripts/equilibrer_qcm.py            # applique
"""
from __future__ import annotations

import collections
import hashlib
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
INSTRUMENTS = RACINE / "instruments"

#: Les façons dont une note ou un libellé désigne une proposition par sa lettre. Les
#: lettres sont réécrites en une seule passe : une substitution séquentielle ferait
#: cascader A vers B puis B vers C.
DESIGNATIONS = [
    re.compile(r"(?P<avant>(?:distracteur|proposition|réponse|libellé|item|choix|phrase|formulation|énoncé)s?\s+)"
               r"(?P<lettre>[A-D])(?![\wÀ-ÿ])", re.I),
    re.compile(r"(?P<avant>\ble\s+)(?P<lettre>[A-D])(?![\wÀ-ÿ])"),
    re.compile(r"(?P<avant>\()(?P<lettre>[A-D])(?=\))"),
    re.compile(r"(?P<avant>«\s*)(?P<lettre>[A-D])(?=\s*»)"),
    re.compile(r"(?P<avant>\b[A-D]\s+et\s+)(?P<lettre>[A-D])(?![\wÀ-ÿ])"),
    re.compile(r"(?P<avant>(?<![\wÀ-ÿ]))(?P<lettre>[A-D])(?=\s+et\s+[A-D](?![\wÀ-ÿ]))"),
]


def positions_cibles(items: list[dict]) -> dict[str, str]:
    """La place de la bonne réponse de chaque QCM d'une banque.

    Les questions sont rangées par empreinte de leur identifiant — un ordre stable, sans
    rapport avec l'ordre d'écriture — puis les positions leur sont distribuées à tour de
    rôle. Deux effectifs de position ne peuvent donc différer que d'une unité.
    """
    qcm = [i for i in items
           if i.get("type") == "A" and (i.get("cle") or {}).get("reponse")]
    if not qcm:
        return {}
    lettres = sorted(qcm[0]["propositions"])
    ordre = sorted(qcm, key=lambda i: hashlib.sha256(i["item_id"].encode("utf-8")).digest())
    return {it["item_id"]: lettres[rang % len(lettres)]
            for rang, it in enumerate(ordre)}


def permutation(item: dict, cible: str) -> dict[str, str]:
    """ancienne lettre → nouvelle lettre."""
    lettres = sorted(item["propositions"])
    bonne = item["cle"]["reponse"]
    autres = [x for x in lettres if x != bonne]
    carte = {bonne: cible}
    restantes = [p for p in lettres if p != cible]
    for ancienne, nouvelle in zip(autres, restantes):
        carte[ancienne] = nouvelle
    assert sorted(carte.values()) == lettres
    return carte


def reecrire_lettres(texte: str, carte: dict[str, str]) -> tuple[str, int, list[str]]:
    """Applique la permutation à toutes les lettres que le texte désigne, en une passe.

    Renvoie aussi ce qui n'a pas été reconnu : une lettre isolée qu'on laisserait telle
    quelle désignerait après coup une autre proposition qu'avant. Mieux vaut la relire.
    """
    if not texte:
        return texte, 0, []
    marques: list[tuple[int, int, str]] = []
    for motif in DESIGNATIONS:
        for m in motif.finditer(texte):
            d, f = m.span("lettre")
            if all(f <= a or d >= b for a, b, _ in marques):
                marques.append((d, f, carte.get(m.group("lettre").upper(),
                                                m.group("lettre"))))
    couverts = {(a, b) for a, b, _ in marques}
    suspects = [texte[max(0, m.start() - 45):m.end() + 25]
                for m in SUSPECT.finditer(texte)
                if (m.start(), m.end()) not in couverts
                and not HORS_PROPOSITION.search(texte[max(0, m.start() - 12):m.start()])]
    for d, f, nouvelle in sorted(marques, reverse=True):
        texte = texte[:d] + nouvelle + texte[f:]
    return texte, len(marques), suspects


def appliquer(item: dict, cible: str) -> tuple[int, list[str]]:
    carte = permutation(item, cible)
    anciennes = item["propositions"]
    item["propositions"] = {carte[l]: t for l, t in anciennes.items()}
    cle = item["cle"]
    cle["reponse"] = carte[cle["reponse"]]
    if cle.get("distracteurs"):
        cle["distracteurs"] = {carte[l]: t for l, t in cle["distracteurs"].items()}
    touchees, suspects = 0, []
    if item.get("notes_conception"):
        item["notes_conception"], n, s = reecrire_lettres(item["notes_conception"], carte)
        touchees += n
        suspects += s
    for l, t in list(cle.get("distracteurs", {}).items()):
        cle["distracteurs"][l], n, s = reecrire_lettres(t, carte)
        touchees += n
        suspects += s
    return touchees, suspects


#: Une lettre isolée qui subsisterait sans avoir été reconnue : on la signale plutôt que
#: de la laisser désigner silencieusement une autre proposition qu'avant.
SUSPECT = re.compile(r"(?<![\wÀ-ÿ'’])[A-D](?![\wÀ-ÿ'’])")

#: « bloc A », « palier A » : une lettre qui ne désigne pas une proposition. La permuter
#: renommerait un bloc de l'assemblage.
HORS_PROPOSITION = re.compile(r"\b(?:bloc|blocs|palier|paliers|annexe|partie|point|points|sommet|vecteur|droite|figure|document|colonne|ligne)\s+(?:[A-D]\s*)?$", re.I)


def instruments_reels() -> list[Path]:
    return [d for d in sorted(INSTRUMENTS.iterdir())
            if d.is_dir() and not d.name.startswith("_") and (d / "banque.json").exists()]


def repartition() -> collections.Counter:
    c = collections.Counter()
    for d in instruments_reels():
        for it in json.loads((d / "banque.json").read_text(encoding="utf-8"))["items"]:
            if it.get("type") == "A" and (it.get("cle") or {}).get("reponse"):
                c[it["cle"]["reponse"]] += 1
    return c


def main() -> int:
    plan = "--plan" in sys.argv
    avant = repartition()
    total_items = total_lettres = 0
    restes: list[str] = []
    for d in instruments_reels():
        p = d / "banque.json"
        brut = p.read_text(encoding="utf-8")
        banque = json.loads(brut)
        # On réécrit le fichier dans sa propre mise en forme : une migration qui
        # reformaterait tout noierait la correction dans un diff illisible.
        fin = "\n" if brut.endswith("\n") else ""
        assert json.dumps(banque, ensure_ascii=False, indent=2) + fin == brut, \
            f"{p} : format non reproductible, migration refusée"
        cibles = positions_cibles(banque["items"])
        for it in banque["items"]:
            if it["item_id"] not in cibles:
                continue
            total_items += 1
            n, suspects = appliquer(it, cibles[it["item_id"]])
            total_lettres += n
            restes += [f"{it['item_id']} : « …{x}… »" for x in suspects]
        if not plan:
            p.write_text(json.dumps(banque, ensure_ascii=False, indent=2) + fin,
                         encoding="utf-8")
    apres = repartition() if not plan else None
    n = sum(avant.values())
    print(f"QCM traités : {total_items} ; désignations par lettre réécrites : {total_lettres}")
    print("avant :", {l: f"{avant.get(l, 0)} ({avant.get(l, 0)/n:.1%})" for l in "ABCD"})
    if apres:
        m = sum(apres.values())
        print("après :", {l: f"{apres.get(l, 0)} ({apres.get(l, 0)/m:.1%})" for l in "ABCD"})
    if restes:
        print(f"\n{len(restes)} lettre(s) isolée(s) non reconnue(s) — à relire :")
        for r in restes[:40]:
            print("  ", r)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

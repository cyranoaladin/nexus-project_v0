#!/usr/bin/env python3
"""Statut de diffusabilité d'un instrument — calculé, jamais déclaré à la main.

Un bilan dont tous les contrôles de chaîne réussissent alors que l'un de ses instruments
sources n'est pas imprimable ment sur son propre état. Le § 6.3 contrôle la saisie et le
rendu ; il ne dit rien de l'instrument qui a produit cette saisie. Ce module comble ce
trou, et il est la **source unique** du statut : aucun fichier ne le recopie, ni le
README, ni le catalogue, ni le bilan.

Un instrument est DIFFUSABLE quand tous ses éléments obligatoires sont présents et
valides :

- aucune mise en correction déclarée dans sa source ;
- aucun emplacement réservé actif dans sa source — banque, assemblages, définition ;
- pour chaque support de bloc : un texte réel, une référence, une édition renseignée ;
- une désignation d'œuvre au programme conforme au référentiel des programmes ;
- la validation d'instrument sans erreur.

Il ne l'est pas autrement, et le motif est nommé. Le statut se calcule depuis les fichiers :
retirer un emplacement réservé sans renseigner l'édition ne suffit pas à le rendre
diffusable.
"""
from __future__ import annotations

import functools
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import validate_instrument as VI  # noqa: E402

#: Ce qui signale un emplacement réservé ou une valeur restée à compléter.
MOTIF_RESERVE = re.compile(r"\[\s*(EXTRAIT À INSÉRER|À COMPLÉTER)", re.IGNORECASE)

#: Les deux modes de rendu d'un bilan. Un mode inconnu est refusé, jamais deviné.
MODES = ("production", "maquette")


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def dossiers() -> list[Path]:
    return [d for d in sorted((RACINE / "instruments").iterdir())
            if d.is_dir() and not d.name.startswith("_")]


def _fichiers_source(d: Path) -> list[Path]:
    return sorted(list(d.glob("*.json")) + list(d.glob("assemblages/*.json")))


def _supports(d: Path):
    for f in sorted(d.glob("assemblages/*.json")):
        asm = charger(f)
        for b in asm["blocs"]:
            for sup in b.get("supports", []):
                if isinstance(sup, dict):
                    yield f.stem, b["bloc"], sup


@functools.lru_cache(maxsize=None)
def statut(code: str) -> dict:
    """Le statut d'un instrument du dépôt, mis en cache pour la durée du processus.

    Le bilan interroge le statut de chaque instrument qu'il a employé ; la validation
    complète des quinze instruments coûte moins d'une seconde.
    """
    d = RACINE / "instruments" / code
    if not d.exists():
        return {"code": code, "diffusable": False,
                "motifs": [{"motif": "instrument_absent",
                            "detail": f"{code} n'existe pas dans le dépôt"}]}
    return statut_dossier(d)


#: Fichiers où une mise en correction peut être déclarée, et le champ qui la porte.
SOURCES_CORRECTION = ("banque.json", "definition.json", "formulaire.json")
CHAMP_CORRECTION = "correction_en_cours"


def statut_dossier(d: Path) -> dict:
    """Le même calcul sur un dossier quelconque — ce que les tests adversariaux emploient."""
    code = d.name
    motifs = []
    # Une mise en correction est un motif de non-diffusabilité comme un autre : elle
    # n'ouvre aucun état global, elle ajoute une ligne au relevé. La conception déclare
    # le motif dans la source de l'instrument ; tant qu'il y est, le statut est calculé
    # « non diffusable » et V-Instruments l'oppose au bilan comme n'importe quel autre.
    # C'est le seul moyen de retirer un instrument de la diffusion sans mentir sur son
    # état — et le seul moyen de le rendre à nouveau : retirer le champ.
    for nom in SOURCES_CORRECTION:
        f = d / nom
        if not f.exists():
            continue
        motif = charger(f).get(CHAMP_CORRECTION)
        if motif:
            motifs.append({"motif": "correction_en_cours",
                           "detail": f"{nom} : {motif}"})
    for f in _fichiers_source(d):
        n = len(MOTIF_RESERVE.findall(f.read_text(encoding="utf-8")))
        if n:
            motifs.append({"motif": "emplacement_reserve",
                           "detail": f"{n} emplacement(s) réservé(s) dans "
                                     f"{f.relative_to(d)}"})
    for version, bloc, sup in _supports(d):
        ou = f"{version}, bloc {bloc}"
        if sup.get("type") in ("tableau", "figure"):
            continue
        for champ in ("texte", "reference", "edition"):
            valeur = (sup.get(champ) or "").strip()
            if not valeur:
                motifs.append({"motif": "support_incomplet",
                               "detail": f"{ou} : support sans « {champ} »"})
            elif MOTIF_RESERVE.search(valeur):
                motifs.append({"motif": "support_a_completer",
                               "detail": f"{ou} : « {champ} » reste à compléter"})

    err, _ = VI.valider(d)
    for e in err:
        motifs.append({"motif": "validation", "detail": e})

    return {"code": code, "diffusable": not motifs, "motifs": motifs,
            "supports": sum(1 for _ in _supports(d))}


def tous() -> dict:
    return {d.name: statut(d.name) for d in dossiers()}


def non_diffusables(codes) -> list[dict]:
    """Les instruments d'une liste qui ne sont pas diffusables, dans l'ordre reçu."""
    vus, out = set(), []
    for code in codes:
        if code in vus:
            continue
        vus.add(code)
        s = statut(code)
        if not s["diffusable"]:
            out.append(s)
    return out


def main(argv: list[str]) -> int:
    etats = tous()
    for code, s in etats.items():
        marque = "diffusable" if s["diffusable"] else "NON DIFFUSABLE"
        print(f"{code:14s} {marque}")
        for m in s["motifs"]:
            print(f"    - {m['motif']} : {m['detail']}")
    bloques = [c for c, s in etats.items() if not s["diffusable"]]
    print(f"\n{len(bloques)} instrument(s) non diffusable(s) sur {len(etats)}.")
    return 1 if bloques and "--strict" in argv else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

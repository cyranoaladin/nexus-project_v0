#!/usr/bin/env python3
"""Assigne les lettres A/B/C/D aux options sémantiques d'un lot d'items, au moment de
composer une FORME — jamais avant. La lettre est un fait de rendu, jamais de
rédaction (voir referentiels/item_lifecycle.json et le durcissement du 2026-09-16,
déclenché par une concentration de 7 bonnes réponses « A » sur 8 QCM produits avec
l'ancien schéma).

Algorithme : round-robin déterministe. Les items sont triés par `item_id` (ordre
stable, reproductible), et pour l'item d'indice i (0-indexé) dans cet ordre, la bonne
réponse est placée en position `i mod n_lettres`. Les options incorrectes remplissent
les emplacements restants dans l'ordre où elles apparaissent dans `options` (donc
l'ordre alphabétique de rédaction fixé par la migration, lui-même sans rapport avec
la position finale).

Un round-robin garantit mécaniquement l'invariant demandé — pour n items et k lettres,
chaque lettre reçoit soit floor(n/k) soit ceil(n/k) occurrences, donc
max(compte) - min(compte) <= 1 — sans avoir besoin de le vérifier après coup ni de
recourir à un hash qui pourrait, par accident, concentrer les bonnes réponses (c'est
exactement le risque écarté explicitement : `hash(item_id) % 4` n'offre aucune
garantie de ce type).

Usage : python3 scripts/qcm_position_assembler.py <items.json> --form-id FORM_A [--out rendu.json]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

LETTRES = ["A", "B", "C", "D"]


def assembler(items: list[dict], form_id: str) -> list[dict]:
    items_tries = sorted(items, key=lambda it: it["item_id"])
    rendu = []
    for i, it in enumerate(items_tries):
        options = it["options"]
        n = len(options)
        lettres = LETTRES[:n]
        pos_correcte = i % n

        correct_id = it["correct_option_id"]
        correcte = next(o for o in options if o["id"] == correct_id)
        autres = [o for o in options if o["id"] != correct_id]

        assignation = {}
        assignation[lettres[pos_correcte]] = correcte
        autres_iter = iter(autres)
        for lettre in lettres:
            if lettre == lettres[pos_correcte]:
                continue
            assignation[lettre] = next(autres_iter)

        item_rendu = {k: v for k, v in it.items() if k not in ("options", "correct_option_id")}
        item_rendu["form_id"] = form_id
        item_rendu["propositions"] = {l: assignation[l]["text"] for l in lettres}
        item_rendu["cle"] = {
            "reponse": lettres[pos_correcte],
            "distracteurs": {l: assignation[l]["error_code"] for l in lettres if l != lettres[pos_correcte]},
        }
        rendu.append(item_rendu)
    return rendu


def verifier_equilibre(rendu: list[dict]) -> dict:
    comptes = {l: 0 for l in LETTRES}
    for it in rendu:
        comptes[it["cle"]["reponse"]] += 1
    non_nuls = [c for c in comptes.values() if c > 0]
    ecart = (max(non_nuls) - min(non_nuls)) if non_nuls else 0
    return {"comptes": comptes, "ecart_max_min": ecart, "equilibre": ecart <= 1}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("items", type=Path)
    ap.add_argument("--form-id", required=True)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)

    items = json.loads(args.items.read_text(encoding="utf-8"))
    rendu = assembler(items, args.form_id)
    equilibre = verifier_equilibre(rendu)

    print(json.dumps({"form_id": args.form_id, "n_items": len(rendu), **equilibre}, ensure_ascii=False, indent=2))

    if args.out:
        args.out.write_text(json.dumps(rendu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"écrit : {args.out}", file=sys.stderr)

    return 0 if equilibre["equilibre"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

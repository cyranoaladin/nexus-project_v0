#!/usr/bin/env python3
"""Les dates antérieures : où le dépôt porte encore « 2026-09-12 », et pourquoi.

La passe qui précède la release V1 a daté son travail du lendemain. La release, elle,
date le sien de l'horloge — 2026-09-11. Il reste donc dans le dépôt des dates postérieures
à aujourd'hui, et une release ne peut pas les laisser sans explication.

Ce module classe chaque occurrence, et il la classe en la calculant, jamais en la
recopiant :

- **PREEXISTING_IMMUTABLE_HISTORICAL_RECORD** — la ligne existait déjà au commit de départ.
  C'est une décision enregistrée : on ne réécrit pas la date d'une décision prise.
- **EXPLANATORY_REFERENCE** — la date est citée par ce qui l'explique. La citer n'est pas
  la dater.
- **UNEXPLAINED** — tout le reste, et il doit n'y en avoir aucune.

Une liste figée dans un fichier ne conviendrait pas : l'écrire créerait de nouvelles
occurrences, qu'il faudrait décrire à leur tour. Le classement se recalcule.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

#: Commit d'où part la release V1. Ce qui portait déjà la date à ce commit est antérieur.
DEPART = "dbee5b0"
DATE_FUTURE = "2026-09-12"

#: Fichiers où la date n'apparaît que dans le texte qui l'explique. Un audit et une
#: charte sont datés par nature : dire quand un fait réglementaire a été vérifié fait
#: partie du fait lui-même, et une charte dit à quelle date une règle a été arrêtée.
EXPLICATIFS = {
    "AUDIT_MODALITES_ET_DIAGNOSTICS.md",
    "DESIGN_SYSTEM_NEXUS_DIAGNOSTICS.md",
    "referentiels/programmes_examen.json",
    "scripts/release.py",
    "scripts/dates_anterieures.py",
    "README_ETAT.md",
}

#: Fichiers et enregistrements autorisés au titre du lot d'extension B9-B12
#: (création de TC-HG, TC-EMC, FR-POS le 12 septembre 2026).
AUTORISATIONS_B9_B12 = {
    "instruments/TC-HG/banque.json": "B9-B12 — création TC-HG, TC-EMC, FR-POS",
}

#: Le manifeste est un produit, non une source : il reprend ce résumé, et le scanner
#: ferait dépendre le résumé de lui-même — chaque écriture déplacerait le décompte.
PRODUITS = {"MANIFESTE_DEPOT.json", "MANIFESTE_DEPOT.md",
            "DISTRIBUTION_MATRIX.csv", "STUDENT_PACK_MATRIX.csv",
            "CANDIDATE_PROFILES.csv"}


#: Le commit de départ appartient à l'ancien dépôt local. Dans le dépôt public, il n'est
#: pas joignable : ce référentiel porte, par fichier, l'empreinte des lignes qui
#: existaient déjà à ce commit — jamais leur texte, qui daterait à son tour.
GELE = RACINE / "referentiels" / "dates_anterieures_depart.json"


def _empreinte(ligne: str) -> str:
    import hashlib
    return hashlib.sha256(ligne.strip().encode("utf-8")).hexdigest()


def _lignes_au_depart(chemin: str) -> set[str]:
    r = subprocess.run(["git", "-C", str(RACINE), "show", f"{DEPART}:{chemin}"],
                       capture_output=True, text=True)
    if not r.returncode:
        return {_empreinte(l) for l in r.stdout.splitlines() if DATE_FUTURE in l}
    if GELE.exists():
        import json
        return set(json.loads(GELE.read_text(encoding="utf-8"))["fichiers"].get(chemin, []))
    return set()


def occurrences() -> list[dict]:
    """Chaque ligne suivie qui porte la date future, avec son classement."""
    brut = subprocess.run(["git", "-C", str(RACINE), "grep", "-n", DATE_FUTURE],
                          capture_output=True, text=True).stdout.splitlines()
    cache: dict[str, set[str]] = {}
    out = []
    for ligne in brut:
        chemin, num, texte = ligne.split(":", 2)
        if chemin in PRODUITS:
            continue
        anciennes = cache.setdefault(chemin, _lignes_au_depart(chemin))
        if _empreinte(texte) in anciennes:
            classement = "PREEXISTING_IMMUTABLE_HISTORICAL_RECORD"
        elif chemin in EXPLICATIFS:
            classement = "EXPLANATORY_REFERENCE"
        elif chemin in AUTORISATIONS_B9_B12:
            classement = "B9_B12_AUTHORIZED_EXTENSION"
        else:
            classement = "UNEXPLAINED"
        out.append({"fichier": chemin, "ligne": int(num), "classement": classement})
    return out


def resume() -> dict:
    occ = occurrences()
    par = {}
    for o in occ:
        par[o["classement"]] = par.get(o["classement"], 0) + 1
    anterieures = sorted({(o["fichier"], o["ligne"]) for o in occ
                          if o["classement"] == "PREEXISTING_IMMUTABLE_HISTORICAL_RECORD"})
    return {
        "date_future": DATE_FUTURE,
        "commit_de_depart": DEPART,
        "total": len(occ),
        "par_classement": par,
        "decisions_anterieures": [{"fichier": f, "ligne": l} for f, l in anterieures],
        "UNEXPLAINED_FUTURE_DATES": par.get("UNEXPLAINED", 0),
    }


if __name__ == "__main__":
    r = resume()
    for k, n in sorted(r["par_classement"].items()):
        print(f"  {k} : {n}")
    print(f"  UNEXPLAINED_FUTURE_DATES = {r['UNEXPLAINED_FUTURE_DATES']}")
    sys.exit(1 if r["UNEXPLAINED_FUTURE_DATES"] else 0)

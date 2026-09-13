#!/usr/bin/env python3
"""Planche de contact : toutes les couvertures et des pages intérieures, sur une image.

La direction ne va pas ouvrir soixante-douze PDF. Elle regarde une planche, et voit
immédiatement si la collection se tient : même gabarit, même place du logo, même
hiérarchie, et le bordeaux qui signale un corrigé.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
V2 = RACINE / "release" / "diagnostics-v2"
SORTIE = V2 / "00_GUIDE"


def vignette(pdf: Path, page: int, dossier: Path, largeur: int = 460) -> Path | None:
    base = dossier / f"{pdf.stem}_{page}"
    subprocess.run(["pdftoppm", "-r", "60", "-f", str(page), "-l", str(page), "-png",
                    str(pdf), str(base)], capture_output=True)
    trouve = sorted(dossier.glob(f"{pdf.stem}_{page}-*.png"))
    if not trouve:
        return None
    cible = dossier / f"v_{pdf.stem}_{page}.png"
    subprocess.run(["convert", str(trouve[0]), "-resize", f"{largeur}x",
                    "-bordercolor", "#D9DCE1", "-border", "1", str(cible)],
                   capture_output=True)
    return cible if cible.exists() else None


def planche(pdfs: list[tuple[Path, int]], cible: Path, colonnes: int, titre: str) -> Path:
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        vues = [v for v in (vignette(p, n, d) for p, n in pdfs) if v]
        if not vues:
            raise SystemExit("aucune vignette produite")
        cible.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["montage", *[str(v) for v in vues], "-tile", f"{colonnes}x",
                        "-geometry", "+8+8", "-background", "white",
                        "-title", titre, str(cible)], capture_output=True)
    return cible


def produire() -> list[Path]:
    """Les trois planches, dans 00_GUIDE. Appelé par la construction de la release.

    Elles sont produites **avant** le manifeste : sans quoi elles se retrouvent dans la
    release sans y être décrites, et la règle « tout fichier est manifesté » tombe.
    """
    if not V2.exists():
        raise SystemExit("release v2 absente")
    cand = sorted((V2 / "01_LIVRETS_CANDIDAT").rglob("*.pdf"))
    coach = sorted((V2 / "02_CORRECTIONS_COACH").rglob("*.pdf"))
    planche([(p, 1) for p in cand], SORTIE / "PLANCHE_COUVERTURES_CANDIDAT.png", 6,
            "Diagnostics Nexus V2 — couvertures candidat")
    planche([(p, 1) for p in coach[:12]], SORTIE / "PLANCHE_COUVERTURES_COACH.png", 6,
            "Diagnostics Nexus V2 — couvertures correction coach")
    interieures = []
    for p in cand:
        n = int(subprocess.run(["pdfinfo", str(p)], capture_output=True,
                               text=True).stdout.split("Pages:")[1].split()[0])
        interieures += [(p, 2)] + ([(p, min(4, n))] if n >= 4 else [])
    planche(interieures[:24], SORTIE / "PLANCHE_PAGES_INTERIEURES.png", 6,
            "Diagnostics Nexus V2 — pages intérieures")
    return sorted(SORTIE.glob("PLANCHE_*.png"))


def main() -> int:
    for f in produire():
        print(f"  {f.relative_to(RACINE)}  {f.stat().st_size // 1024} Ko")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Reconstruit les rendus `instruments/*/build/` absents, de façon déterministe.

Les rendus (sujet candidat, clé et grilles, feuille de réponses, saisie vierge, formulaire
de secours, grille coach — en Markdown, CSV et PDF) sont produits par
`scripts/build_instrument.py` octet à octet depuis la source unique. Ils ne sont pas
versionnés dans le dépôt public, mais `MANIFESTE_DEPOT.json` porte leurs empreintes et
le banc de distribution les lit : un clone propre doit pouvoir les recréer avant de
lancer la suite de tests ou la release.

    python3 scripts/rendus_instruments.py            # reconstruit ce qui manque
    python3 scripts/rendus_instruments.py --force    # reconstruit tout
    python3 scripts/rendus_instruments.py --verifier # liste ce qui manque, code 1 si vide

Le banc de contrôle `build/controle-diffusion/` (scripts/distribution.py) est reconstruit
de la même façon s'il manque. La suite de tests appelle `reconstruire()` puis
`reconstruire_banc()` une fois par session (tests/conftest.py).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
INSTRUMENTS = RACINE / "instruments"
BUILDER = RACINE / "scripts" / "build_instrument.py"


def dossiers_a_rendre() -> list[Path]:
    """Chaque instrument qui possède une source composable, maquettes exclues."""
    out = []
    for d in sorted(INSTRUMENTS.iterdir()):
        if not d.is_dir() or d.name.startswith("_MAQUETTE"):
            continue
        if (d / "banque.json").exists() or (d / "formulaire.json").exists() \
                or list(d.glob("definition*.json")):
            out.append(d)
    return out


def manquants() -> list[Path]:
    """Les instruments dont le dossier de rendus est absent ou vide."""
    return [d for d in dossiers_a_rendre()
            if not (d / "build").is_dir() or not any((d / "build").iterdir())]


def reconstruire(force: bool = False, pdf: bool = True) -> list[Path]:
    """Reconstruit les rendus manquants (ou tous avec `force`) ; renvoie les dossiers rendus."""
    cibles = dossiers_a_rendre() if force else manquants()
    for d in cibles:
        cmd = [sys.executable, str(BUILDER), str(d)] + (["--pdf"] if pdf else [])
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit(f"rendus de {d.name} : échec — {r.stderr.strip()[-400:]}")
    return cibles


BANC = RACINE / "build" / "controle-diffusion"


def reconstruire_banc(force: bool = False) -> bool:
    """Le banc de contrôle de la chaîne de diffusion (`build/controle-diffusion/`), écrit
    par `scripts/distribution.py` depuis les rendus : liens durs vers le catalogue,
    preflight, packs. Plusieurs tests le lisent ; un clone propre le reconstruit."""
    if BANC.is_dir() and any(BANC.iterdir()) and not force:
        return False
    import distribution as DIS
    r = DIS.construire()
    if r.get("erreurs"):
        raise SystemExit("banc de distribution : " + " | ".join(r["erreurs"][:4]))
    return True


def main(argv: list[str]) -> int:
    if "--verifier" in argv:
        m = manquants()
        for d in m:
            print(f"  manquant : {d.relative_to(RACINE)}/build")
        print(f"  {len(m)} instrument(s) sans rendus")
        return 1 if m else 0
    rendus = reconstruire(force="--force" in argv)
    for d in rendus:
        print(f"  rendu : {d.relative_to(RACINE)}/build")
    print(f"  {len(rendus)} instrument(s) reconstruit(s)")
    if reconstruire_banc(force="--force" in argv):
        print(f"  banc : {BANC.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

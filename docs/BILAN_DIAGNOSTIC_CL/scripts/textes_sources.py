#!/usr/bin/env python3
"""Le registre des textes sources, et les contrôles qui le rendent opposable.

Un support littéraire ou philosophique n'est pas une donnée comme une autre : il vient
d'une édition, il a des bornes, et deux diagnostics ne doivent jamais faire travailler un
candidat sur le même passage. Trois contrôles suffisent à tenir cela, et ils ne se
contentent pas de lire ce que le registre déclare :

- **appariement** — tout support qui déclare une source doit correspondre, par empreinte,
  à une entrée du registre. Un texte modifié sans que le registre le soit se voit ;
- **collision** — deux entrées du registre ne peuvent pas porter la même empreinte, et un
  même passage ne peut pas servir dans deux instruments. Collision = échec du build ;
- **usages** — le registre déclare où chaque texte a le droit d'apparaître ; un support
  qui l'emploie ailleurs est une contamination, et elle est refusée ;
- **longueur** — la fenêtre fixée par la conception est vérifiée sur la grandeur que le
  registre définit, les lignes pleines équivalentes : les lignes du PDF diminuées des
  coupures de paragraphe de l'édition, qui n'ajoutent rien à lire.

Les champs calculés — nombre de mots, empreinte — ne sont pas recopiés à la main : ce
module les recalcule depuis les instruments et refuse le registre qui s'en écarte.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
REGISTRE = RACINE / "referentiels" / "textes_sources.json"

#: Champs recalculés depuis les instruments, jamais recopiés.
CALCULES = ("nombre_mots", "sha256_texte_normalise", "nombre_paragraphes")


def normaliser(t: str) -> str:
    """Normalisation d'EXTRACTION, jamais du texte.

    Les blancs multiples et les retours de ligne deviennent une espace simple ; l'espace
    parasite devant le point et la virgule, produite par les balises d'italique de la
    source, disparaît. L'espace fine insécable devant ; : ! ? » est conservée : elle
    appartient à la typographie française, pas à l'extraction.
    """
    t = re.sub(r"\s+", " ", t).strip()
    return re.sub(r"\s+([.,])", r"\1", t)


def empreinte(t: str) -> str:
    """L'empreinte d'un texte : c'est elle qui prouve qu'un support est bien celui-là."""
    return hashlib.sha256(normaliser(t).lower().encode("utf-8")).hexdigest()


def charger(p: Path) -> dict:
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def registre() -> dict:
    return charger(REGISTRE)


def supports_du_depot() -> list[dict]:
    """Tous les supports textuels des instruments métier, avec leur provenance.

    Un support se reconnaît à ce qu'il porte un texte et le déclare : `source_texte`
    nomme l'entrée du registre. Les dossiers préfixés d'un souligné — jeux de maquette,
    fixture technique — ne sont pas des instruments et n'entrent pas dans le contrôle.
    """
    out = []
    for dossier in sorted((RACINE / "instruments").iterdir()):
        if not dossier.is_dir() or dossier.name.startswith("_"):
            continue
        for f in sorted(dossier.rglob("*.json")):
            if "build" in f.parts:
                continue
            _collecter(charger(f), f, dossier.name, out)
    return out


def _collecter(noeud, fichier: Path, instrument: str, out: list, bloc: str | None = None):
    if isinstance(noeud, dict):
        if noeud.get("source_texte") and "texte" in noeud:
            out.append({"instrument": instrument,
                        "fichier": str(fichier.relative_to(RACINE)),
                        "assemblage": fichier.stem, "bloc": bloc,
                        "titre": noeud.get("titre"), "source": noeud["source_texte"],
                        "texte": noeud["texte"]})
        for cle, v in noeud.items():
            _collecter(v, fichier, instrument, out, noeud.get("bloc", bloc))
    elif isinstance(noeud, list):
        for v in noeud:
            _collecter(v, fichier, instrument, out, bloc)


def controler() -> list[str]:
    """Les trois contrôles. Rend la liste des erreurs ; vide, le registre est tenu."""
    reg = registre()
    textes = reg["textes"]
    erreurs: list[str] = []

    # 1. Collision d'empreintes entre deux entrées distinctes du registre.
    par_empreinte: dict[str, list[str]] = {}
    for cle, t in textes.items():
        par_empreinte.setdefault(t["sha256_texte_normalise"], []).append(cle)
    for h, cles in par_empreinte.items():
        if len(cles) > 1:
            erreurs.append(f"collision d'empreinte entre {', '.join(cles)} : "
                           f"un même passage ne peut pas être deux sources ({h[:16]}…)")

    supports = supports_du_depot()

    # 2. Appariement : chaque support déclare une source, et son empreinte la confirme.
    for s in supports:
        t = textes.get(s["source"])
        if t is None:
            erreurs.append(f"{s['fichier']} : source « {s['source']} » absente du registre")
            continue
        h = empreinte(s["texte"])
        if h != t["sha256_texte_normalise"]:
            erreurs.append(
                f"{s['fichier']} · {s['titre']} : le texte ne correspond plus à l'entrée "
                f"« {s['source']} » du registre ({h[:16]}… attendu "
                f"{t['sha256_texte_normalise'][:16]}…)")

    # 3. Contamination : un même passage dans deux instruments différents.
    par_texte: dict[str, set[str]] = {}
    for s in supports:
        par_texte.setdefault(empreinte(s["texte"]), set()).add(s["instrument"])
    for h, instruments in par_texte.items():
        if len(instruments) > 1:
            erreurs.append(f"contamination : le passage {h[:16]}… sert dans "
                           f"{', '.join(sorted(instruments))} — un même extrait ne peut "
                           f"pas fonder deux diagnostics")

    # 4. Usages : le registre dit où chaque texte a le droit d'apparaître.
    for s in supports:
        t = textes.get(s["source"])
        if t is None:
            continue
        permis = {(u["instrument"], a) for u in t["usages"] for a in u["assemblages"]}
        if (s["instrument"], s["assemblage"]) not in permis:
            erreurs.append(f"{s['fichier']} : « {s['source'] }» n'est pas déclaré pour "
                           f"{s['instrument']}/{s['assemblage']} dans le registre")

    # 5. Longueur : la fenêtre de la conception est vérifiée, non seulement déclarée.
    for cle, t in textes.items():
        pleines = t.get("lignes_pleines_equivalentes")
        attendu = (t["nombre_lignes_dans_le_pdf_final"]
                   - (0 if t.get("fenetre_lignes") == [10, 12]
                      else t["nombre_paragraphes"] - 1))
        if pleines != attendu:
            erreurs.append(f"registre · {cle} · lignes_pleines_equivalentes : déclaré "
                           f"{pleines!r}, calculé {attendu!r}")
        f = t.get("fenetre_lignes")
        if f and not (f[0] <= pleines <= f[1]):
            erreurs.append(f"longueur · {cle} : {pleines} lignes pleines équivalentes, "
                           f"hors de la fenêtre {f[0]}-{f[1]} de la conception")
        fm = t.get("fenetre_mots")
        if fm and not (fm[0] <= t["nombre_mots"] <= fm[1]):
            erreurs.append(f"longueur · {cle} : {t['nombre_mots']} mots, hors de la "
                           f"fenêtre {fm[0]}-{fm[1]} de la conception")

    # 6. Champs calculés : le registre ne recopie rien.
    par_source = {}
    for s in supports:
        par_source.setdefault(s["source"], s)
    for cle, t in textes.items():
        s = par_source.get(cle)
        if s is None:
            erreurs.append(f"registre : « {cle} » n'est employé par aucun support")
            continue
        attendu = {"nombre_mots": len(normaliser(s["texte"]).split()),
                   "sha256_texte_normalise": empreinte(s["texte"]),
                   "nombre_paragraphes": s["texte"].count("\n\n") + 1}
        for champ, v in attendu.items():
            if t.get(champ) != v:
                erreurs.append(f"registre · {cle} · {champ} : déclaré {t.get(champ)!r}, "
                               f"calculé {v!r}")
    return erreurs


def rafraichir() -> None:
    """Recalcule les champs dérivés du registre depuis les instruments."""
    reg = registre()
    par_source = {}
    for s in supports_du_depot():
        par_source.setdefault(s["source"], s)
    for cle, t in reg["textes"].items():
        s = par_source.get(cle)
        if s is None:
            continue
        t["nombre_paragraphes"] = s["texte"].count("\n\n") + 1
        t["nombre_mots"] = len(normaliser(s["texte"]).split())
        t["sha256_texte_normalise"] = empreinte(s["texte"])
        t["lignes_pleines_equivalentes"] = (
            t["nombre_lignes_dans_le_pdf_final"]
            - (0 if t.get("fenetre_lignes") == [10, 12]
               else t["nombre_paragraphes"] - 1))
    with open(REGISTRE, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)
        f.write("\n")


def tableau() -> str:
    reg = registre()
    L = ["| Texte | Auteur | Édition | Mots | Lignes PDF | Empreinte |",
         "|---|---|---|---|---|---|"]
    for cle, t in reg["textes"].items():
        L.append(f"| `{cle}` | {t['auteur']}, *{t['oeuvre']}* | {t['edition']} "
                 f"| {t['nombre_mots']} | {t['nombre_lignes_dans_le_pdf_final']} "
                 f"| `{t['sha256_texte_normalise'][:16]}…` |")
    return "\n".join(L)


if __name__ == "__main__":
    if "--maj" in sys.argv:
        rafraichir()
        print("registre rafraîchi")
    erreurs = controler()
    for e in erreurs:
        print(f"  ✗ {e}")
    print(f"{len(erreurs)} erreur(s)")
    if "--tableau" in sys.argv:
        print()
        print(tableau())
    sys.exit(1 if erreurs else 0)

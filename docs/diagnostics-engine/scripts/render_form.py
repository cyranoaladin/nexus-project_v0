#!/usr/bin/env python3
"""Moteur générique de composition des livrets de diagnostic Nexus (V3).

Consomme un fichier JSON conforme à schemas/diagnostics-content.schema.json et compose
un PDF autonome (candidat ou coach) via le gabarit templates/nexus-livret.tex.

Ce module ne contient et ne doit jamais contenir de donnée opérationnelle : ni item
réel, ni clé réelle, ni support réel. Il est testé exclusivement contre
__tests__/fixtures/diagnostic-demo/, une fixture entièrement fictive. Tout contenu réel
vit dans un dépôt privé séparé et est fourni à ce script par chemin de fichier au moment
du build — jamais copié dans ce dépôt.

Reconstruit, en le réécrivant proprement (pas un cherry-pick), le cœur de composition
d'un moteur antérieur retiré de ce dépôt après un incident d'exposition publique de
contenu (2026-09-16) : le gabarit LaTeX lui-même, le contournement du bug de police
WOFF/XeLaTeX, et la compilation en trois passes avec validation du PDF produit sont des
solutions techniques génériques, reprises telles quelles ; la lecture du contenu, elle,
est entièrement neuve, écrite pour le nouveau contrat sémantique (options sans position,
sections plutôt que la structure propre à l'ancien catalogue d'instruments).

Usage :
    python3 render_form.py <form.json> --out candidat.pdf
    python3 render_form.py <form.json> --out coach.pdf --coach
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
GABARIT = RACINE / "templates" / "nexus-livret.tex"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qcm_position_assembler import assembler as assembler_positions  # noqa: E402


# ─────────────────────────────────────────── texte : balisage léger → LaTeX

_LATEX_SPECIAUX = {
    "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_",
    "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
}

_MATH = re.compile(r"\$[^$]+\$")
_CODE_INLINE = re.compile(r"`([^`]+)`")
_GRAS = re.compile(r"\*\*([^*]+)\*\*")
_ITALIQUE = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")


def _echapper(segment: str) -> str:
    return "".join(_LATEX_SPECIAUX.get(c, c) for c in segment)


def tex(source: str | None) -> str:
    """Échappe pour LaTeX et rend le balisage léger (**gras**, *italique*, `code`),
    en laissant passer les formules `$...$` intactes. Une puce en début de ligne
    (`- `) devient un item d'une liste compacte."""
    if source is None:
        return ""
    source = str(source)

    # 1. isoler les segments $...$ : ils ne sont ni échappés ni transformés.
    morceaux: list[tuple[str, str]] = []
    dernier = 0
    for m in _MATH.finditer(source):
        morceaux.append(("texte", source[dernier:m.start()]))
        morceaux.append(("math", m.group(0)))
        dernier = m.end()
    morceaux.append(("texte", source[dernier:]))

    def transformer_texte(s: str) -> str:
        s = _echapper(s)
        s = _CODE_INLINE.sub(lambda m: r"\texttt{" + _echapper(m.group(1)) + "}", s)
        s = _GRAS.sub(lambda m: r"\textbf{" + m.group(1) + "}", s)
        s = _ITALIQUE.sub(lambda m: r"\textit{" + m.group(1) + "}", s)
        return s

    sortie = []
    for genre, contenu in morceaux:
        sortie.append(contenu if genre == "math" else transformer_texte(contenu))
    return "".join(sortie)


def bloc_lignes_code(lignes: list[str]) -> str:
    """Un bloc de code : chaque ligne reste une ligne, aucune typographie française,
    aucun balisage interprété — voir l'environnement `codenexus` du gabarit."""
    corps = "\\\\\n".join(_echapper(l).replace(" ", "~") for l in lignes)
    return "\\begin{codenexus}\n" + corps + "\n\\end{codenexus}"


# ─────────────────────────────────────────── police (contournement WOFF/XeLaTeX)

def options_police(famille: str) -> str:
    """Épingle les fichiers d'une famille par leur nom, pour qu'aucune face ne soit
    servie en WOFF : quand fontconfig sert l'italique d'une police en `.woff`, XeLaTeX
    s'arrête net sans rien signaler dans le log LaTeX, et laisse le PDF de la passe
    précédente en place. Repris tel quel du moteur V2 (solution technique générique)."""
    r = subprocess.run(["fc-match", famille, "-f", "%{family}|%{file}"],
                        capture_output=True, text=True)
    fam, _, chemin = r.stdout.partition("|")
    depart = Path(chemin.strip())
    normalise = famille.lower().replace(" ", "")
    if normalise not in fam.lower().replace(" ", "") or not depart.exists():
        return "Ligatures=TeX"

    voisins = [f for f in depart.parent.iterdir() if f.suffix.lower() in (".ttf", ".otf")]
    familles: dict[str, list[Path]] = {}
    for f in voisins:
        prefixe = re.split(r"-", f.stem)[0]
        familles.setdefault(prefixe, []).append(f)

    def faces(fichiers: list[Path]) -> dict[str, Path]:
        par: dict[str, Path] = {}
        for f in fichiers:
            suffixe = f.stem.split("-", 1)[1] if "-" in f.stem else "Regular"
            gras, ital = "Bold" in suffixe, "Italic" in suffixe
            if suffixe in ("Regular", "Roman") or (not gras and not ital):
                par.setdefault("UprightFont", f)
            elif gras and ital:
                par["BoldItalicFont"] = f
            elif gras:
                par["BoldFont"] = f
            elif ital:
                par["ItalicFont"] = f
        return par

    meilleur = max(familles.values(), key=lambda fs: len(faces(fs)), default=[])
    par = faces(meilleur)
    if "UprightFont" not in par:
        return "Ligatures=TeX"
    options = [f"Path={par['UprightFont'].parent}/", f"UprightFont={par['UprightFont'].name}"]
    for cle in ("BoldFont", "ItalicFont", "BoldItalicFont"):
        if cle in par:
            options.append(f"{cle}={par[cle].name}")
    return ",".join(options) + ",Ligatures=TeX"


# ─────────────────────────────────────────── rendu des items

def rendre_support(support: dict) -> str:
    t = support.get("type")
    if t == "extrait_litteraire":
        return (r"\extrait{" + tex(support.get("titre", "")) + "}{"
                + tex(support.get("texte", "")) + "}{"
                + tex(support.get("reference", "")) + "}")
    if t == "code":
        titre = support.get("titre")
        entete = (r"{\footnotesize\bfseries\color{navy}" + tex(titre) + r"}\par\vspace{0.2\baselineskip}" if titre else "")
        return entete + bloc_lignes_code(support.get("code_lignes", []))
    if t == "figure":
        return (r"\figurenexus{" + tex(support.get("titre", "")) + "}{"
                + support.get("chemin_image", "") + "}{" + tex(support.get("reference", "")) + "}")
    if t == "tableau":
        return (r"\tableaunexus{" + tex(support.get("titre", "")) + "}{"
                + support.get("colonnes", "") + "}{" + support.get("corps", "") + "}{"
                + tex(support.get("reference", "")) + "}")
    raise SystemExit(f"type de support inconnu : {t!r}")


def rendre_item(item: dict, numero: int, coach: bool) -> str:
    L = [r"\question{" + str(numero) + "}{" + f"{item['score_max']} pt" + "}{"
         + f"{item['duree_min']} min" + "}{" + (item["item_id"] if coach else "") + "}"]
    support = item.get("support")
    # Un support de type "code" suit sa phrase d'introduction (« On exécute le
    # programme suivant : » précède le bloc, jamais l'inverse) ; un extrait, une
    # figure ou un tableau se composent avant la question qui les exploite, pour
    # que la question puisse s'y référer (« ci-dessus »).
    if support and support.get("type") == "code":
        L.append(tex(item["enonce"]))
        L.append(rendre_support(support))
    else:
        if support:
            L.append(rendre_support(support))
        L.append(tex(item["enonce"]))

    if item["type"] == "QCM":
        L.append(r"\begin{propositions}")
        for lettre, texte_option in item["propositions"].items():
            marque = ""
            if coach and lettre == item["cle"]["reponse"]:
                marque = r"~{\bfseries\color{bordeaux}[réponse attendue]}"
            L.append(r"\proposition{" + lettre + "}{" + tex(texte_option) + marque + "}")
            if coach and item["cle"]["distracteurs"].get(lettre):
                L.append(r"\item[]{\footnotesize\color{bordeaux}" +
                          tex(item["cle"]["distracteurs"][lettre]) + "}")
        L.append(r"\end{propositions}")
    elif item["type"] in ("REPONSE_COURTE", "TACHE_OUVERTE"):
        L.append(r"\cadreponse{" + str(item.get("lignes_reponse", 3)) + "}")
    elif item["type"] == "PRODUCTION":
        L.append(r"\cadreponse{" + str(item.get("lignes_reponse", 8)) + "}")
        if coach:
            for critere in item.get("grille_notation", []):
                L.append(r"\needspace{6\baselineskip}" + r"{\bfseries\color{navy}"
                          + tex(critere["code"]) + " — " + tex(critere["intitule"]) + "}")
                for niveau, descr in sorted(critere["descripteurs"].items()):
                    L.append(r"\caseqcm~{\footnotesize\textbf{" + niveau + "} — "
                              + tex(descr) + "}")
    else:
        raise SystemExit(f"type d'item inconnu : {item['type']!r}")

    if coach and item.get("notes_conception"):
        L.append(r"{\footnotesize\itshape\color{gristech}Note de conception : "
                  + tex(item["notes_conception"]) + "}")
    return "\n\\par\n".join(L)


def composer_document(form: dict, coach: bool, icone: Path) -> str:
    numero = 0
    corps: list[str] = []
    for i, section in enumerate(form["sections"], start=1):
        duree = f"{section['duree_conseillee_min']} min" if section.get("duree_conseillee_min") else None
        corps.append(r"\partienexus{" + str(i) + "}{" + tex(section["titre"]) + "}{"
                     + (duree or "") + "}")
        for item in section["items"]:
            numero += 1
            corps.append(rendre_item(item, numero, coach))

    gabarit = GABARIT.read_text(encoding="utf-8")
    entete = (gabarit
              .replace(r"\ACCENT", "bordeaux" if coach else "navy")
              .replace(r"\OPTIONSSERIF", options_police("EB Garamond"))
              .replace(r"\POLICECORPS", "Lato")
              .replace(r"\POLICESERIF", "EB Garamond")
              .replace(r"\ICONE", str(icone))
              .replace(r"\MATIERECOURANTE", tex(form["instrument"]))
              .replace(r"\PROFILCOURANT", tex(("Correction — " if coach else "") + form["version"]))
              .replace(r"\PIEDDROIT", tex("CONFIDENTIEL — correction" if coach
                                           else f"Diagnostic {form['instrument']}")))
    return entete + "\n" + "\n\n".join(corps) + "\n\\end{document}\n"


def rendre(doc: str, cible: Path, quoi: str) -> Path:
    """Trois passes XeLaTeX (la pagination de \\pageref{LastPage} ne se stabilise
    qu'à la troisième), puis validation du PDF produit avec pdfinfo — un PDF présent
    n'est pas forcément un PDF valide. Repris tel quel du moteur V2 (solution
    technique générique, sans donnée de contenu)."""
    with tempfile.TemporaryDirectory(prefix="livret-") as t:
        (Path(t) / "l.tex").write_text(doc, encoding="utf-8")
        r = subprocess.CompletedProcess([], 0, "", "")
        for _ in range(3):
            r = subprocess.run(["xelatex", "-interaction=nonstopmode", "l.tex"], cwd=t,
                                capture_output=True, text=True,
                                env={"PATH": "/usr/bin:/bin", "HOME": t,
                                     "SOURCE_DATE_EPOCH": "0", "FORCE_SOURCE_DATE": "1",
                                     "TZ": "UTC"})
        pdf = Path(t) / "l.pdf"
        if not pdf.exists():
            lignes = [x for x in r.stdout.splitlines() if x.startswith("!")][:8]
            raise SystemExit(f"{quoi} : composition échouée — " + " | ".join(lignes))
        v = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True)
        if v.returncode != 0 or "Pages:" not in v.stdout:
            motif = (v.stderr or r.stdout).strip().splitlines()
            raise SystemExit(f"{quoi} : PDF illisible — " + " | ".join(x for x in motif[-4:] if x))
        cible.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pdf, cible)
    return cible


def construire(form_path: Path, cible: Path, coach: bool, icone: Path) -> Path:
    form = json.loads(form_path.read_text(encoding="utf-8"))

    # Assigne les lettres A/B/C/D des QCM au moment du rendu, jamais avant.
    items_qcm = [it for s in form["sections"] for it in s["items"] if it["type"] == "QCM"]
    if items_qcm:
        rendus = {it["item_id"]: it for it in assembler_positions(items_qcm, form["form_id"])}
        for s in form["sections"]:
            s["items"] = [rendus.get(it["item_id"], it) for it in s["items"]]

    doc = composer_document(form, coach, icone)
    return rendre(doc, cible, f"{form['instrument']}/{form['form_id']}" + (" (coach)" if coach else ""))


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("form", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--coach", action="store_true")
    ap.add_argument("--icone", type=Path, required=True,
                     help="chemin d'une image PNG/JPEG pour l'en-tête — jamais fourni par défaut, "
                          "le moteur n'embarque aucune identité visuelle")
    args = ap.parse_args(argv)
    chemin = construire(args.form, args.out, args.coach, args.icone.resolve())
    print(f"écrit : {chemin}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

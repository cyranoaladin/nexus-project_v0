#!/usr/bin/env python3
"""Livrets Nexus : un document autonome par matière, pour le candidat et pour le coach.

Le dépôt produisait quatre rendus par instrument technique, dont deux partaient au
candidat séparément — un sujet, puis une feuille de réponses. Ce n'est pas un produit :
c'est un assemblage de fichiers que l'élève doit recomposer lui-même.

Ce module produit **un livret par matière**. Il compose en LaTeX, à partir du gabarit
`templates/nexus-livret.tex`, et lit les faits réglementaires dans
`referentiels/modalites_epreuves.json` : aucune durée, aucun coefficient, aucune règle de
calculatrice n'est écrite à la main dans une couverture.

Deux regroupements sont éditoriaux, et eux seuls :

- **Français** réunit le diagnostic écrit et la composante orale. Le candidat ne doit pas
  recevoir « FR-EAF » et « FR-EAF-ORAL » comme deux produits ;
- **Mathématiques** réunit l'épreuve anticipée et, s'il la suit, la spécialité.

Les instruments restent distincts dans le moteur : les scores vont dans les mêmes
périmètres qu'avant, et rien de ce que le bilan calcule ne change.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import build_instrument as BI  # noqa: E402
import validate_instrument as VI  # noqa: E402

GABARIT = RACINE / "templates" / "nexus-livret.tex"
MARQUE = RACINE / "assets" / "brand"
LOGO = MARQUE / "nexus-logo-horizontal.png"
ICONE = MARQUE / "nexus-icone.png"

#: Les trois profils, tels qu'un candidat et sa famille les lisent.
PROFILS = {
    "P1": {"libelle": "Première partie", "long": "Première partie du baccalauréat",
           "etapes": 1,
           "contexte": "Vous préparez les épreuves anticipées et, selon votre modalité "
                       "d'inscription, les évaluations ponctuelles de première."},
    "P2": {"libelle": "Deuxième partie", "long": "Deuxième partie du baccalauréat",
           "etapes": 2,
           "contexte": "Vous avez déjà présenté les épreuves anticipées et vous préparez "
                       "la partie terminale du baccalauréat."},
    "P3": {"libelle": "Bac en une session", "long": "Baccalauréat complet en une session",
           "etapes": 2,
           "contexte": "Votre situation vous autorise à présenter les épreuves anticipées "
                       "et les épreuves finales à la même session."},
}

#: Nom de matière lu par le candidat, et sous-titre. Jamais le code technique.
MATIERES = {
    "FRANCAIS": ("Français", "Épreuves anticipées de français"),
    "HISTOIRE-GEOGRAPHIE": ("Histoire-géographie",
                            "Évaluation ponctuelle du contrôle continu"),
    "EMC": ("Enseignement moral et civique",
            "Évaluation ponctuelle du contrôle continu"),
    "MATHEMATIQUES": ("Mathématiques", None),
    "PHILOSOPHIE": ("Philosophie", "Épreuve terminale"),
    "ENSEIGNEMENT-SCIENTIFIQUE": ("Enseignement scientifique",
                                  "Évaluation ponctuelle du contrôle continu"),
    "FRANCAIS-MAITRISE": ("Maîtrise du français",
                          "Le français comme outil de travail — diagnostic Nexus"),
    "SPE-MATHS": ("Spécialité mathématiques", "Épreuve terminale de spécialité"),
    "SPE-PHYSIQUE-CHIMIE": ("Spécialité physique-chimie", "Épreuve terminale de spécialité"),
    "SPE-NSI": ("Spécialité NSI",
                "Numérique et sciences informatiques — épreuve terminale de spécialité"),
    "SPE-SVT": ("Spécialité SVT",
                "Sciences de la vie et de la Terre — épreuve terminale de spécialité"),
    "SPE-SES": ("Spécialité SES",
                "Sciences économiques et sociales — épreuve terminale de spécialité"),
    "SPE-HGGSP": ("Spécialité HGGSP",
                  "Histoire-géographie, géopolitique et sciences politiques"),
    "SPE-HLP": ("Spécialité HLP", "Humanités, littérature et philosophie"),
    "GRAND-ORAL": ("Grand oral", "Épreuve orale terminale"),
    "POSITIONNEMENT-FRANCAIS": ("Positionnement français",
                                "Diagnostic linguistique — outil d'accompagnement"),
    "DOSSIER-ENTREE": ("Dossier d'entrée", "Parcours, situation et méthodes de travail"),
}

#: Quel instrument compose quelle matière. Le regroupement est éditorial.
COMPOSITION = {
    "FRANCAIS": ["FR-EAF", "FR-EAF-ORAL"],
    "POSITIONNEMENT-FRANCAIS": ["FR-POS", "FR-POS-ORAL"],
    "HISTOIRE-GEOGRAPHIE": ["TC-HG"],
    "EMC": ["TC-EMC"],
    "MATHEMATIQUES": ["MATH-EA", "EDS-MATH"],
    "PHILOSOPHIE": ["PHI"],
    "ENSEIGNEMENT-SCIENTIFIQUE": ["TC-ES"],
    "FRANCAIS-MAITRISE": ["FR-MAI"],
    "SPE-PHYSIQUE-CHIMIE": ["EDS-PC"], "SPE-NSI": ["EDS-NSI"], "SPE-SVT": ["EDS-SVT"],
    "SPE-SES": ["EDS-SES"], "SPE-HGGSP": ["EDS-HGGSP"], "SPE-HLP": ["EDS-HLP"],
    "GRAND-ORAL": ["GO"],
}

#: Ce que chaque instrument dit de l'épreuve officielle qu'il prépare.
EPREUVE_DE = {
    "FR-EAF": ["FR-EAF-ECRIT", "FR-EAF-ORAL"], "FR-EAF-ORAL": ["FR-EAF-ORAL"],
    "MATH-EA": ["MATH-EA"], "EDS-MATH": ["EDS-MATH"], "PHI": ["PHI"], "GO": ["GO"],
    "EDS-PC": ["EDS-PC"], "EDS-NSI": ["EDS-NSI"], "EDS-SVT": ["EDS-SVT"],
    "EDS-SES": ["EDS-SES"], "EDS-HGGSP": ["EDS-HGGSP"], "EDS-HLP": ["EDS-HLP"],
}

#: Hauteur de repli de la zone de réponse, en lignes. Une justification courte tient en
#: trois lignes ; une production longue se mesure sur ce que l'énoncé demande d'écrire.
LIGNES_REPONSE = {"A": 0, "B": 3, "C": 6}

#: Les quantités que les énoncés écrivent en toutes lettres.
NOMBRES_ECRITS = {"cinq": 5, "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10,
                  "onze": 11, "douze": 12, "quinze": 15, "vingt": 20, "trente": 30,
                  "dizaine": 10, "quinzaine": 15, "vingtaine": 20, "trentaine": 30}


def _quantite(mot: str) -> int | None:
    mot = (mot or "").lower()
    return int(mot) if mot.isdigit() else NOMBRES_ECRITS.get(mot)


def lignes_attendues(it: dict) -> int:
    """La hauteur de la zone de réponse, mesurée sur ce que la question demande d'écrire.

    Une zone de six lignes sous « expliquez en une vingtaine de lignes » n'est pas une
    zone de réponse : c'est un piège. L'énoncé annonce presque toujours la longueur
    attendue — « une quinzaine de lignes », « en 80 mots », « dix à douze lignes » — et
    c'est cette annonce qui dimensionne le cadre. À défaut, le barème dit l'ampleur :
    une production de douze points n'est pas une réponse de trois lignes.
    """
    if it["type"] == "A":
        return 0
    e = it.get("enonce") or ""
    demandes = [_quantite(g) for m in re.finditer(
        r"(\w+)(?:\s+(?:à|ou)\s+(\w+))?(?:\s+de)?\s+lignes", e) for g in m.groups()]
    demandes += [round(int(m.group(1)) / 10)
                 for m in re.finditer(r"(\d+)\s+mots", e)]
    demandes = [x for x in demandes if x]
    if demandes:
        return min(max(demandes) + 3, 30)
    if it["type"] == "B":
        return LIGNES_REPONSE["B"]
    return min(12 + int(it.get("score_max") or 0), 30)


def modalites() -> dict:
    with open(RACINE / "referentiels" / "modalites_epreuves.json", encoding="utf-8") as f:
        return json.load(f)


def verifier_marque() -> None:
    """Sans les marques, on ne compose pas : un livret sans logo n'est pas un livret Nexus."""
    fiche = json.loads((MARQUE / "MARQUE.json").read_text(encoding="utf-8"))
    import hashlib
    for nom, f in fiche["fichiers"].items():
        p = RACINE / f["fichier"]
        if not p.exists():
            raise SystemExit(f"marque absente : {f['fichier']}")
        if hashlib.sha256(p.read_bytes()).hexdigest() != f["sha256"]:
            raise SystemExit(f"marque altérée : {f['fichier']}")


#: Les énoncés de mathématiques et de sciences portent des formules entre dollars. Elles
#: sont du LaTeX voulu, écrit par la conception, et non du texte à échapper : les traiter
#: comme du texte imprimait « \times » au candidat.
MATH = re.compile(r"\$[^$]*\$")

_ECHAPPE = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
            "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}",
            "^": r"\textasciicircum{}"}


#: Une adresse web imprimée dans une source. Elle n'obéit pas à la typographie française.
URL = re.compile(r"https?://[^\s,)]+")


def _echapper(s: str) -> str:
    out, fin = [], 0
    for m in URL.finditer(s):
        out.append(_typographie(s[fin:m.start()]))
        # Le français compose une espace fine avant les deux-points : « https :// » dans
        # une adresse. \NoAutoSpacing la suspend le temps de l'adresse, sans changer
        # la police — une URL en chasse fixe au milieu d'une ligne de source jurerait.
        # Une adresse ne se coupe nulle part : sans point de coupure, elle sortait de la
        # justification par la droite. On en ouvre après chaque séparateur — sans césure,
        # donc sans trait d'union parasite dans l'adresse.
        adresse = re.sub(r"([/.\-_?&=])", r"\1\\allowbreak{}", _brut(m.group(0)))
        out.append(r"{\NoAutoSpacing " + adresse + "}")
        fin = m.end()
    out.append(_typographie(s[fin:]))
    return "".join(out)


def _brut(s: str) -> str:
    return "".join(_ECHAPPE.get(c, c) for c in s)


def _typographie(s: str) -> str:
    t = _brut(s)
    # La ponctuation double française ne se sépare pas de son mot.
    t = re.sub(r"[ \t]+([;:!?»])", "~\\1", t)
    return re.sub(r"(«)[ \t]+", "\\1~", t)


#: Le balisage léger des énoncés de la banque. Il y est écrit en Markdown — c'est la
#: langue dans laquelle les instruments ont été rédigés et validée comme telle — et il
#: doit devenir de la typographie, non s'imprimer tel quel. Douze livrets candidats
#: portaient « **plan détaillé** » avec ses astérisques.
GRAS = re.compile(r"\*\*(.+?)\*\*|__(.+?)__", re.S)
ITALIQUE = re.compile(r"(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])")
CODE = re.compile(r"`([^`\n]+)`")
PUCE = re.compile(r"(?m)^[ \t]*[-–—•][ \t]+")


def _balisage(t: str) -> str:
    """Convertit le balisage léger **après** l'échappement LaTeX.

    L'ordre compte : échapper d'abord protégerait les astérisques, convertir d'abord
    laisserait passer les accolades du texte. On convertit donc sur le texte déjà
    échappé, où seuls les balises restent reconnaissables.
    """
    t = GRAS.sub(lambda m: r"\textbf{" + (m.group(1) or m.group(2)) + "}", t)
    t = CODE.sub(lambda m: r"\texttt{" + m.group(1) + "}", t)
    t = ITALIQUE.sub(lambda m: r"\emph{" + m.group(1) + "}", t)
    # Une puce Markdown en début de ligne devient une puce composée, pas un tiret collé
    # au texte précédent : les consignes de NSI s'imprimaient toutes sur une seule ligne.
    return PUCE.sub(lambda _: r"\par\hangindent=4mm\hangafter=1 $\bullet$~", t)


#: Un bloc de code clôturé (Markdown) dans un énoncé : un programme, une requête, un
#: pseudo-code. Il se compose ligne à ligne, jamais comme un paragraphe.
CLOTURE = re.compile(r"```[^\n]*\n(.*?)```", re.S)


def bloc_code(code: str) -> str:
    """Compose un bloc de code : lignes et indentation préservées, aucune typographie.

    Les caractères actifs de LaTeX sont échappés, mais ni l'espace fine avant « : »
    ni les guillemets ne s'appliquent : « def s(L) : » n'est plus du Python. Chaque
    espace d'indentation devient une espace de chasse fixe insécable, chaque ligne
    un paragraphe, une ligne vide une ligne vide.
    """
    lignes = code.rstrip("\n").split("\n")
    # Le bloc ne se coupe pas : on réserve sa hauteur, sinon il descend d'une page.
    L = [rf"\needspace{{{len(lignes) + 4}\baselineskip}}", r"\begin{codenexus}"]
    for ligne in lignes:
        marge = len(ligne) - len(ligne.lstrip(" "))
        corps = _brut(ligne[marge:].rstrip())
        L.append((r"\ " * marge + corps) if corps else r"\mbox{}")
        L.append(r"\par")
    L[-1] = r"\end{codenexus}"
    return "\n".join(L)


def tex(s: str) -> str:
    """Échappe pour LaTeX, rend le balisage léger, laisse passer les formules.

    Un bloc de code clôturé est composé à part, avant tout le reste : la typographie
    française et le balisage n'ont rien à y faire.
    """
    if s is None:
        return ""
    s = str(s)
    out, fin = [], 0
    for m in CLOTURE.finditer(s):
        out.append(_tex_prose(s[fin:m.start()]))
        out.append("\n" + bloc_code(m.group(1)) + "\n")
        fin = m.end()
    out.append(_tex_prose(s[fin:]))
    return "".join(out)


def _tex_prose(s: str) -> str:
    out, fin = [], 0
    for m in MATH.finditer(s):
        out.append(_balisage(_echapper(s[fin:m.start()])))
        out.append(m.group(0))
        fin = m.end()
    out.append(_balisage(_echapper(s[fin:])))
    return "".join(out)


def duree(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h} h {m:02d}" if h else f"{m} min"


def _minutes_item(it: dict) -> str:
    v = it["duree_min"]
    return f"{v} min" if float(v) == int(v) else f"{str(v).replace('.', ',')} min"


# ─────────────────────────────────────────────── la couverture

def couverture(matiere: str, profil: str, parties: list[dict], m: dict,
               session: int | None, coach: bool,
               surcharges: dict[str, tuple[str, str]] | None = None,
               candidat: str | None = None,
               regle_calc: tuple[str, str] | None = None) -> str:
    """La couverture. `surcharges` remplace un cartouche (libellé, valeur) par un autre ;
    `candidat` pose le nom à la place de la ligne « référence candidat ». Ni l'un ni
    l'autre ne servent à la release : ils n'existent que pour un export nominatif."""
    titre, soustitre = MATIERES[matiere]
    p = PROFILS.get(profil, {
        "libelle": "Tous profils",
        "long": "Positionnement commun en français",
        "etapes": 1,
        "contexte": "Ce diagnostic linguistique de positionnement permet de mesurer la maîtrise "
                    "des fondamentaux écrits et oraux de la langue française.",
    })
    # Les cartouches réglementaires sont lus, jamais saisis : durée officielle,
    # coefficient, calculatrice viennent de referentiels/modalites_epreuves.json.
    officiels = [m["epreuves_terminales"][c] for x in parties
                 for c in EPREUVE_DE.get(x["code"], []) if c in m["epreuves_terminales"]]
    vus, epreuves = set(), []
    for e in officiels:
        if e["intitule_officiel"] not in vus:
            vus.add(e["intitule_officiel"])
            epreuves.append(e)
    duree_diag = sum(x["duree_min"] for x in parties) or 40
    if epreuves:
        off = " + ".join(f"{duree(e['duree_min'])}, coef. {e['coefficient']}"
                         for e in epreuves)
        calc = "Interdite" if all(e["calculatrice"] is False for e in epreuves) \
            else ("Selon le sujet" if any(e["calculatrice"] == "selon le sujet"
                                          for e in epreuves) else "Interdite")
    else:
        off = "Contrôle continu"
        calc = "Interdite"
    if regle_calc:
        # Une partie se traite avec calculatrice : la couverture le dit, plutôt que de
        # renvoyer au sujet de l'épreuve pendant que la Partie 3 l'autorise.
        calc = regle_calc[0]
    fond = "bordeaux" if coach else "navy"
    L = [r"\thispagestyle{empty}",
         r"\begin{tikzpicture}[remember picture,overlay]",
         rf"  \fill[{fond}] (current page.north west) rectangle "
         r"([yshift=-62mm]current page.north east);",
         rf"  \fill[{'bordeaux!80!black' if coach else 'navyclair'}] "
         r"([yshift=-62mm]current page.north west) rectangle "
         r"([yshift=-64.5mm]current page.north east);",
         r"  \fill[or] ([yshift=-64.5mm]current page.north west) rectangle "
         r"([yshift=-65.7mm]current page.north east);",
         r"  \node[anchor=north west,inner sep=0pt] at "
         r"([shift={(18mm,-20mm)}]current page.north west) "
         rf"{{\includegraphics[width=52mm]{{{LOGO}}}}};",
         r"  \node[anchor=north east,text=ivoire,font=\footnotesize] at "
         r"([shift={(-18mm,-22mm)}]current page.north east) {"
         + ("CORRECTION COACH — CONFIDENTIEL" if coach else "DIAGNOSTIC INITIAL") + "};",
         r"  \node[anchor=north east,inner sep=0pt] at "
         r"([shift={(-18mm,-30mm)}]current page.north east) "
         rf"{{\reperprofil{{{p['etapes']}}}{{{tex(p['libelle'].upper())}}}}};",
         r"\end{tikzpicture}", "",
         r"\vspace*{52mm}",
         rf"{{\fontsize{{30}}{{34}}\selectfont\bfseries\color{{{fond}}} {tex(titre)}\par}}"]
    if soustitre:
        L.append(rf"\vspace{{1mm}}{{\large\color{{gristech}} {tex(soustitre)}\par}}")
    L += [r"\vspace{5mm}", rf"{{\color{{{fond}}}\rule{{18mm}}{{1.2pt}}}}\par\vspace{{3mm}}",
          r"\begin{minipage}{0.78\linewidth}"]
    if coach:
        L.append("Document de correction. Il ne sort pas de chez Nexus et n'est jamais "
                 "remis au candidat ni à sa famille.")
    else:
        L.append(tex(p["contexte"]) + " Ce livret est le diagnostic d'entrée Nexus : il "
                 "n'est pas noté pour l'examen, il sert à situer ce qui est acquis et à "
                 "construire le plan de travail.")
    # Deux \vfill encadrent les cartouches : le blanc de la couverture se répartit au
    # lieu de s'accumuler sous eux en une bande morte.
    L += [r"\end{minipage}", r"\vspace{7mm}", r"\vfill", ""]
    cart = [("Profil", p["long"]),
            ("Session finale", str(session) if session else "selon le dossier"),
            ("Durée du diagnostic", duree(duree_diag)),
            ("Épreuve officielle", off), ("Calculatrice", calc),
            ("Matériel", objets_autorises(epreuves))]
    if surcharges:
        cart = [surcharges.get(a, (a, b)) for a, b in cart]
    for i in range(0, 6, 3):
        L.append(r"\noindent" + r"\hfill".join(
            rf"\begin{{minipage}}[t]{{0.315\linewidth}}"
            rf"\cartouche{{{tex(a)}}}{{{tex(b)}}}\end{{minipage}}"
            for a, b in cart[i:i + 3]))
        L.append(r"\vspace{3mm}")
    L += [r"\vfill", r"{\color{griscadre}\rule{\linewidth}{0.4pt}}", r"\vspace{6mm}", ""]
    if coach:
        L.append(r"\noindent{\scriptsize\color{gristech}CORRECTEUR}\\[3mm]"
                 r"\ligneponse[70mm]\hfill{\scriptsize\color{gristech}DATE}\quad"
                 r"\ligneponse[45mm]")
    elif candidat:
        L.append(r"\noindent\begin{minipage}[t]{0.48\linewidth}"
                 r"{\scriptsize\color{gristech}CANDIDAT :}\\[3mm]"
                 rf"\parbox[t]{{70mm}}{{\raggedright\bfseries\fontsize{{11}}{{13}}\selectfont {tex(candidat)}}}"
                 r"\end{minipage}\hfill\begin{minipage}[t]{0.48\linewidth}"
                 r"{\scriptsize\color{gristech}DATE DE PASSATION}\\[3mm]\ligneponse[70mm]"
                 r"\end{minipage}")
    else:
        L.append(r"\noindent\begin{minipage}[t]{0.48\linewidth}"
                 r"{\scriptsize\color{gristech}RÉFÉRENCE CANDIDAT}\\[3mm]\ligneponse[70mm]"
                 r"\end{minipage}\hfill\begin{minipage}[t]{0.48\linewidth}"
                 r"{\scriptsize\color{gristech}DATE DE PASSATION}\\[3mm]\ligneponse[70mm]"
                 r"\end{minipage}")
    # Le code d'instrument ne figure plus sur la couverture du candidat. La direction l'y
    # tolérait « très discrètement » ; l'audit d'acceptation exige zéro jargon technique
    # dans un document remis à une famille. La traçabilité n'y perd rien : le manifeste
    # porte, pour chaque fichier, son artifact_id, ses instruments et son empreinte.
    codes = ", ".join(f"{x['code']}/{x['version']}" for x in parties) or "QP, MET"
    signature = (r"{\scriptsize\color{gristech}Nexus Réussite \textperiodcentered\ "
                 r"Diagnostic V2"
                 + (rf" \textperiodcentered\ {{\monolivret {tex(codes)}}}" if coach else "")
                 + r"\par}")
    L += ["", r"\vspace{6mm}", signature, r"\clearpage"]
    return "\n".join(L)


def objets_autorises(epreuves: list[dict]) -> str:
    """Ce que le candidat a le droit d'apporter, en un cartouche — lu au référentiel.

    Un cartouche de couverture tient en trois mots. Le référentiel porte donc, pour les
    épreuves dont le matériel se décrit par une phrase, un libellé court : le raccourcir
    ici serait réécrire à la main un fait réglementaire.
    """
    objets = sorted({e.get("materiel_court") or e["materiel"] for e in epreuves
                     if e.get("materiel") and e["materiel"] != "aucun"})
    return " ; ".join(o.rstrip(".") for o in objets) if objets else "Aucun"


def materiel(epreuves: list[dict], regle_calc: tuple[str, str] | None = None) -> str:
    """Le matériel autorisé, lu dans le référentiel — jamais écrit à la main.

    La règle de calculatrice n'est pas la même d'une épreuve à l'autre, et « selon le
    sujet » est une réponse officielle : l'écrire « aucune » serait un faux.
    """
    if not epreuves:
        return "Aucun."
    objets = sorted({e["materiel"] for e in epreuves if e.get("materiel")
                     and e["materiel"] != "aucun"})
    calc = sorted({str(e.get("calculatrice")) for e in epreuves})
    phrase = ("Aucun." if not objets
              else " ".join(o.rstrip(".") + "." for o in objets))
    if regle_calc:
        if "selon le sujet" in calc:
            phrase += " Calculatrice : l'autorisation dépend du sujet de l'épreuve."
        phrase += " " + regle_calc[1]
    elif calc == ["False"]:
        phrase += " Calculatrice interdite à l'épreuve."
    elif "selon le sujet" in calc:
        phrase += (" Calculatrice : l'autorisation dépend du sujet de l'épreuve ; "
                   "ce diagnostic se traite sans calculatrice.")
    return phrase


def avant_de_commencer(matiere: str, parties: list[dict], m: dict,
                       zones: bool = True, regle_calc: tuple[str, str] | None = None) -> str:
    titre = MATIERES[matiere][0]
    total = sum(x["duree_min"] for x in parties)
    epreuves, vus = [], set()
    for x in parties:
        for c in EPREUVE_DE.get(x["code"], []):
            e = m["epreuves_terminales"].get(c)
            if e and e["intitule_officiel"] not in vus:
                vus.add(e["intitule_officiel"])
                epreuves.append(e)
    L = [r"{\Large\bfseries\color{navy}Avant de commencer\par}", r"\vspace{2mm}",
         r"\begin{avantdecommencer}"]
    if epreuves:
        L.append(r"{\bfseries Ce que vous passerez à l'examen.} " + " ".join(
            f"{tex(e['intitule_officiel'])} : {duree(e['duree_min'])}, "
            f"coefficient {e['coefficient']}, épreuve {tex(e['nature'])}."
            for e in epreuves))
        prat = [e for e in epreuves if "partie_pratique" in e]
        if prat:
            L.append(r"{\bfseries La partie pratique ne vous concerne pas.} En tant que "
                     "candidat individuel, vous en êtes dispensé : votre note est celle de "
                     "la partie écrite, rapportée à 20 points. Ce diagnostic porte donc "
                     "sur l'écrit que vous présenterez réellement.")
            # Le livret ne doit pas d'abord dire « vous en êtes dispensé », puis faire
            # travailler la partie pratique. S'il existe un complément Nexus sur machine,
            # il est nommé pour ce qu'il est : facultatif, et hors de l'épreuve.
            if any(e["partie_pratique"].get("complement_nexus") for e in prat):
                L.append("Certaines compétences de programmation peuvent faire l'objet "
                         "d'un diagnostic Nexus complémentaire sur machine ; celui-ci ne "
                         "correspond pas à une épreuve pratique obligatoire pour le "
                         "candidat individuel.")
    L += [r"{\bfseries Ce que ce diagnostic mesure.} Il n'a pas la durée de l'épreuve : "
          f"il en échantillonne les tâches en {duree(total)}, pour situer ce qui est "
          "acquis et ce qui demande du travail.",
          r"{\bfseries Durée.} " + duree(total) + r". {\bfseries Matériel.} "
          + tex(materiel(epreuves, regle_calc)),
          (r"{\bfseries Comment répondre.} Écrivez directement dans les cadres prévus : "
           "leur hauteur indique la longueur attendue. Répondez à toutes les questions sur "
           "ce livret, vous n'avez besoin d'aucune autre feuille." if zones else
           r"{\bfseries Comment se passe ce diagnostic.} Il n'y a rien à écrire : votre "
           "coach conduit l'entretien avec vous et renseigne lui-même ce qu'il observe."),
          r"{\bfseries Gestion du temps.} Les durées indiquées sont des repères. Si une "
          "question résiste, passez à la suivante et revenez-y.",
          r"\end{avantdecommencer}", r"\vspace{3mm}"]
    return "\n".join(L)


# ─────────────────────────────────────────────── le corps

def _colonnes(t: dict) -> str:
    """Alignement des colonnes : à gauche les intitulés, à droite les nombres.

    Un tableau de données se lit par la colonne. Aligner « 916 » sous « 640 » par la
    droite met les ordres de grandeur l'un au-dessus de l'autre ; les aligner à gauche
    les mélange.
    """
    spec = ["l"]
    for i in range(1, len(t["colonnes"])):
        nombres = all(re.fullmatch(r"[-+]?[\d  ]+(?:[.,]\d+)?\s*%?", str(l[i]))
                      for l in t["lignes"])
        spec.append("r" if nombres else "l")
    return "".join(spec)


def _provenance(sup: dict) -> str:
    """La provenance d'un document, dans les termes exacts de la banque.

    Une figure construite pour la question ne « représente » rien : l'annoncer comme une
    source ferait croire au candidat qu'il lit des données réelles.
    """
    if sup.get("construite"):
        return ("Données construites pour cette question ; elles ne représentent aucune "
                "situation réelle.")
    if sup.get("simulee"):
        return "Données simulées à visée pédagogique."
    return f"Source : {sup['source']}"


def _support_tableau(sup: dict) -> str:
    entete = " & ".join(rf"\textbf{{{tex(c)}}}" for c in sup["colonnes"]) + r" \\ \midrule "
    corps = "".join(" & ".join(tex(str(x)) for x in l) + r" \\ " for l in sup["lignes"])
    return (rf"\tableaunexus{{{tex(sup['titre'])}}}{{{_colonnes(sup)}}}"
            rf"{{{entete}{corps}}}{{{tex(_provenance(sup))}}}")


def _support_figure(sup: dict, c: dict) -> str:
    """Trace la figure depuis les données de la banque, par le traceur déjà éprouvé.

    Le tracé n'est pas réécrit ici : `build_instrument.rendre_figure` sait déjà lire les
    genres de la banque — barres, nuage, boîte, cercle trigonométrique — et produit un PDF
    vectoriel déterministe. Le livret n'en reprend que le fichier.
    """
    # Deux livrets se composent en parallèle et partagent le cache de figures : le
    # second tombait sur un fichier à demi écrit et l'embarquait tel quel, produisant un
    # PDF tronqué que rien ne signalait. On écrit à côté, puis on renomme — un lecteur ne
    # voit jamais qu'un fichier complet.
    chemin = c["figures"] / f"{sup['code']}.pdf"
    chemin.parent.mkdir(parents=True, exist_ok=True)
    provisoire = chemin.with_suffix(f".{os.getpid()}.tmp.pdf")
    BI.rendre_figure(sup, provisoire)
    os.replace(provisoire, chemin)
    return (rf"\figurenexus{{{tex(sup['titre'])}}}{{{chemin.as_posix()}}}"
            rf"{{{tex(_provenance(sup))}}}")


#: L'énoncé annonce lui-même où le document se trouve. On le lui obéit.
APRES = re.compile(r"ci-dessous|ci-après|ci-contre", re.I)


def supports_de_l_item(it: dict, c: dict, vus: set[str]) -> tuple[list[str], list[str]]:
    """Les documents que la question exploite : ceux à imprimer, puis ceux à rappeler.

    Le livret ne les imprimait nulle part : le candidat lisait « d'après le tableau
    ci-dessus » sans tableau. Un document neuf est imprimé **avant** la question, comme
    dans un sujet d'examen — sauf si l'énoncé annonce lui-même « ci-dessous », auquel cas
    il le suit. Un document déjà montré est seulement rappelé : le réimprimer allongerait
    le livret sans rien apprendre.
    """
    avant, rappels = [], []
    # « La droite est tracée ci-dessous » et « d'après le tableau ci-dessus » ne demandent
    # pas la même mise en page. Le contenu disciplinaire est validé : c'est la composition
    # qui s'y plie, et non l'inverse.
    apres = bool(APRES.search(it.get("enonce") or ""))
    for sup in it.get("supports") or []:
        if not isinstance(sup, dict):
            rappels.append(rf"\begin{{quote}}{tex(str(sup))}\end{{quote}}")
            continue
        if sup.get("code") in vus:
            rappels.append(rf"\rappelsupport{{{tex(sup['titre'])}}}")
            continue
        vus.add(sup.get("code"))
        if sup.get("type") == "tableau":
            (rappels if apres else avant).append(_support_tableau(sup))
        elif sup.get("type") == "figure":
            (rappels if apres else avant).append(_support_figure(sup, c))
        else:
            (rappels if apres else avant).append(
                rf"\extrait{{{tex(sup.get('titre', ''))}}}{{{tex(sup.get('texte', ''))}}}"
                rf"{{{tex(sup.get('reference', ''))}}}")
    return avant, rappels


def _place_des_supports(it: dict, vus: set[str]) -> int:
    """Lignes à réserver pour les documents encore à imprimer de cette question."""
    n = 0
    for sup in it.get("supports") or []:
        if not isinstance(sup, dict) or sup.get("code") in vus:
            continue
        if sup.get("type") == "figure":
            n += 20                       # 70 mm de tracé, son titre et sa provenance
        elif sup.get("type") == "tableau":
            n += len(sup.get("lignes") or []) + 5
        else:
            n += 8
    return n


def _besoin(it: dict, coach: bool, place_supports: int = 0) -> int:
    """Lignes à réserver pour que l'item ne soit pas coupé au mauvais endroit.

    Un QCM séparé de ses propositions est illisible, et une clé séparée de sa question
    fait corriger de mémoire. On réserve l'en-tête, l'énoncé, les propositions ou la zone
    de réponse, et la clé quand le document est celui du correcteur.
    """
    n = 4
    if it["type"] == "A":
        n += len(it.get("propositions") or {})
    else:
        n += lignes_attendues(it) + 1
    if coach:
        # La clé porte deux lignes de métadonnées — compétence, niveau, palier, bloc —
        # puis la réponse et les distracteurs. Six lignes laissaient la dernière ligne
        # d'un encadré passer seule en haut de la page suivante.
        n += 9 if it["type"] == "A" else 13
    # Un document et la question qui l'exploite ne se séparent pas : le candidat qui
    # tourne la page pour retrouver le tableau perd du temps d'évaluation.
    n += place_supports
    return min(n, 40)          # au-delà, l'item occupe une page : inutile d'en exiger plus


def items_hors_livret() -> set[str]:
    """Les items qui relèvent d'une partie pratique dont le candidat individuel est dispensé.

    Ils restent dans la banque, dans les assemblages et dans le moteur : rien de ce que
    le bilan calcule ne change. Seul le livret ne les imprime pas — on ne demande pas à
    un candidat de traiter sur machine une épreuve dont la page 2 lui dit qu'il en est
    dispensé.
    """
    hors = set()
    for e in modalites()["epreuves_terminales"].values():
        hors.update((e.get("partie_pratique") or {}).get("items_hors_livret_candidat", []))
    return hors


#: La phrase par laquelle une banque déclare qu'une partie se traite avec calculatrice.
#: Le cahier (§ 7.6, § 7.7) la réserve au bloc C des spécialités scientifiques : c'est
#: d'elle, et non d'un réglage de gabarit, que la couverture et l'encadré dérivent la règle.
CALCULATRICE_AUTORISEE = "La calculatrice est autorisée pour cette partie."


def bloc_avec_calculatrice(items: list[dict]) -> bool:
    return any(CALCULATRICE_AUTORISEE in it.get("enonce", "") for it in items)


def regle_calculatrice(parties_calc: list[int], toutes: list[int]) -> tuple[str, str] | None:
    """Le cartouche de couverture et la phrase de l'encadré, quand une partie au moins se
    traite avec calculatrice. Sinon `None` : la règle officielle de l'épreuve suffit."""
    if not parties_calc:
        return None
    def liste(nums):
        nums = [str(n) for n in nums]
        return nums[0] if len(nums) == 1 else ", ".join(nums[:-1]) + " et " + nums[-1]
    def parties(nums):
        return ("Partie " if len(nums) == 1 else "Parties ") + liste(nums)
    interdites = [n for n in toutes if n not in parties_calc]
    cartouche = f"{parties(parties_calc)} uniquement"
    phrase = (f"Calculatrice interdite pour {'la ' if len(interdites) == 1 else 'les '}"
              f"{parties(interdites)} ; " if interdites else "Calculatrice ") + \
        f"autorisée uniquement pour {'la ' if len(parties_calc) == 1 else 'les '}{parties(parties_calc)}."
    return cartouche, phrase[0].upper() + phrase[1:]


def bloc_items(c: dict, numero: list[int], question: list[int], coach: bool,
               calculatrice: list[int] | None = None,
               parties_vues: list[int] | None = None) -> list[str]:
    """Les parties d'un instrument, avec leurs supports, leurs questions et leurs zones.

    `calculatrice` reçoit le numéro des parties qui se traitent avec calculatrice, et
    `parties_vues` celui de toutes les parties composées."""
    L = []
    exclus = items_hors_livret()
    conv = c["conv"]
    # Un document ne se réimprime pas dans le livret : certains énoncés renvoient
    # explicitement à « le document du bloc C » depuis une partie ultérieure.
    vus: set[str] = set()
    for bloc, items, supports in c["blocs"]:
        items = [it for it in items if it["item_id"] not in exclus]
        if not items:
            continue
        L.append(rf"\partienexus{{{numero[0]}}}{{{tex(BI.intitule_bloc(c, bloc))}}}"
                 rf"{{{BI.minutes(BI.duree_bloc(items))} min}}")
        if parties_vues is not None:
            parties_vues.append(numero[0])
        if calculatrice is not None and bloc_avec_calculatrice(items):
            calculatrice.append(numero[0])
        numero[0] += 1
        for sup in supports:
            if sup.get("type") in ("tableau", "figure"):
                continue
            L.append(rf"\extrait{{{tex(sup['titre'])}}}{{"
                     + "\n\n".join(tex(x) for x in sup["texte"].split("\n\n"))
                     + rf"}}{{{tex(sup['reference'])}}}")
        for it in items:
            # La numérotation suit le livret, non l'identifiant de banque : celui-ci
            # repart à 01 à chaque famille de compétence, et le candidat voyait deux
            # « Question 1 » dans le même document.
            question[0] += 1
            pts = f"{it['score_max']} pt" + ("s" if it["score_max"] > 1 else "")
            place = _place_des_supports(it, vus)
            L.append(rf"\needspace{{{_besoin(it, coach, place)}\baselineskip}}")
            # Le document précède la question qui l'exploite : les énoncés disent « d'après
            # le tableau ci-dessus », et c'est aussi l'ordre de lecture d'un sujet
            # d'examen — on lit le document, puis ce qu'on doit en faire.
            avant, rappels = supports_de_l_item(it, c, vus)
            L += avant
            # Une question qui porte un programme se lit d'un seul regard : l'énoncé
            # ne reste pas orphelin en bas de page pendant que le code passe à la
            # suivante. On réserve la hauteur du code et de son énoncé.
            lignes_code = sum(len(m.group(1).rstrip("\n").split("\n"))
                              for m in CLOTURE.finditer(it["enonce"]))
            if lignes_code:
                L.append(rf"\needspace{{{lignes_code + 10}\baselineskip}}")
            L.append(rf"\question{{{question[0]}}}{{{pts}}}{{{_minutes_item(it)}}}"
                     rf"{{{tex(it['item_id'])}}}")
            L.append(tex(it["enonce"]))
            L += rappels
            if it["type"] == "A":
                L.append(r"\begin{propositions}")
                for lettre, t in sorted(it["propositions"].items()):
                    L.append(rf"  \proposition{{{lettre}}}{{{tex(t)}}}")
                L.append(r"\end{propositions}")
            elif it["type"] == "B":
                L.append(rf"\cadreponse{{{lignes_attendues(it)}}}")
            else:
                L.append(rf"\cadreponse{{{lignes_attendues(it)}}}")
            if coach:
                L += cle_de_l_item(it, c, bloc)
    return L


def cle_de_l_item(it: dict, c: dict, bloc: str) -> list[str]:
    """Ce que le correcteur doit voir, et que le candidat ne doit jamais voir."""
    L = [r"\begin{tcolorbox}[enhanced,colback=bordeaux!4,colframe=bordeaux!35,"
         r"boxrule=0.4pt,left=3mm,right=3mm,top=2mm,bottom=2mm,arc=0.6mm,breakable]"]
    comp = c["comps"].get(it["competence"], {})
    # Le bloc figure ici parce qu'il commande l'entrée du plan de travail : un échec sur
    # un prérequis ne se corrige pas comme un échec sur le programme visé.
    L.append(rf"{{\scriptsize\color{{gristech}}{tex(it['competence'])} — "
             rf"{tex(comp.get('intitule', ''))} \textperiodcentered\ niveau "
             rf"{tex(it['niveau'])} \textperiodcentered\ palier {tex(it['palier'])}"
             rf" \textperiodcentered\ type {tex(it['type'])}"
             rf" \textperiodcentered\ bloc {tex(bloc)} — "
             rf"{tex(BI.intitule_bloc(c, bloc))}}}\par\vspace{{1mm}}")
    if it["type"] == "A":
        L.append(rf"{{\bfseries\color{{bordeaux}}Réponse : {tex(it['cle']['reponse'])}}}\par")
        for k, v in sorted(it["cle"]["distracteurs"].items()):
            L.append(rf"{{\footnotesize\textbf{{{k}}} — {tex(v)}}}\par")
    elif it["type"] == "B":
        cle = it["cle"]
        L.append(rf"{{\bfseries\color{{bordeaux}}2 points}} — {tex(cle['reponse_2pts'])}\par")
        for r in cle.get("reponses_1pt", []):
            L.append(rf"{{\footnotesize\textbf{{1 point}} — {tex(r)}}}\par")
        L.append(r"{\footnotesize\textbf{0 point} — toute réponse non listée.}\par")
        L += codes_erreur(cle.get("codes_erreur", []), c)
    else:
        for x in it.get("elements_attendus", []):
            L.append(rf"{{\footnotesize $\bullet$~{tex(x)}}}\par")
        for cr in it["grille"]:
            L.append(rf"\vspace{{1mm}}{{\bfseries\footnotesize {tex(cr['code'])} — "
                     rf"{tex(cr['intitule'])}}}\par")
            for niv in ("0", "1", "2", "3"):
                L.append(rf"{{\footnotesize\textbf{{{niv}}}~— {tex(cr['descripteurs'][niv])}}}\par")
        for x in it.get("reponses_partielles", []):
            L.append(rf"{{\footnotesize $\bullet$~{tex(x)}}}\par")
        L += codes_erreur(it.get("codes_erreur", []), c)
    L.append(r"\end{tcolorbox}")
    return L


def codes_erreur(codes: list[str], c: dict) -> list[str]:
    if not codes:
        return []
    L = [r"\vspace{1mm}{\footnotesize\color{gristech}Codes d'erreur autorisés :}\par"]
    for code in codes:
        x = c["codes"][code]
        L.append(rf"{{\footnotesize{{\monolivret {tex(code)}}} — \textbf{{{tex(x['libelle'])}}}"
                 rf" : {tex(x['description_observable'])}}}\par")
    return L


def duree_livret_candidat(code: str, duree_reference: int) -> int:
    """Le GO ajoute deux tâches écrites à la durée catalogue de l'entretien."""
    if code != "GO":
        return duree_reference
    d = json.loads((RACINE / "instruments/GO/definition.json").read_text(encoding="utf-8"))
    prep = d["preparation_livret"]
    return (prep["questions_min"] + prep["preparation_min"]
            + sum(p["duree_min"] for p in d["deroule"]))


def grand_oral_candidat(d: dict, numero: list[int], m: dict) -> list[str]:
    """La passation du Grand oral, côté candidat : une vraie tâche et de vraies zones.

    Le livret précédent tenait en deux pages et ne portait aucune question, aucune zone —
    tout en écrivant au candidat « répondez à toutes les questions sur ce livret ». Or
    l'épreuve commence par un acte du candidat : il apporte **deux questions**, et le jury
    en choisit une. C'est cet acte que le diagnostic doit d'abord recueillir ; le reste —
    problématique, connaissances, plan, arguments, conclusion — est la préparation qu'il
    conduira le jour de l'épreuve, et qu'il pose ici par écrit pour que son coach la voie.
    """
    off = m["epreuves_terminales"].get("GO", {})
    prep = d["preparation_livret"]
    entretien_min = sum(p["duree_min"] for p in d["deroule"])
    L = []

    L.append(rf"\partienexus{{{numero[0]}}}{{Vos questions de Grand oral}}{{{prep['questions_min']} min}}")
    numero[0] += 1
    L.append("À l'épreuve, c'est vous qui apportez deux questions : le jury en choisit "
             "une. Elles portent sur vos enseignements de spécialité, pris séparément ou "
             "croisés. Écrivez-les ici, telles que vous les présenteriez au jury.")
    for n in ("Question 1", "Question 2"):
        L.append(rf"{{\bfseries\color{{navy}}{n}}}\par")
        L.append(r"\cadreponse{3}")
    L.append(r"{\footnotesize\color{gristech}Si vous n'avez pas encore construit vos deux "
             r"questions, ne les inventez pas ici~: dites-le à votre coach. Il conduira la "
             r"passation en partant de vos spécialités, et cette partie du diagnostic "
             r"portera sur la construction de la question elle-même.}\par")

    L.append(rf"\souspartienexus{{La question retenue pour ce diagnostic}}{{2 min incluses}}")
    L.append("Votre coach en retient une. Recopiez-la ici : c'est celle que vous "
             "préparerez et exposerez.")
    L.append(r"\cadreponse{3}")

    L.append(rf"\partienexus{{{numero[0]}}}{{Votre préparation}}{{{prep['preparation_min']} min}}")
    numero[0] += 1
    L.append("Préparez par écrit, comme vous le feriez le jour de l'épreuve. Vous ne "
             "lirez pas ces notes pendant l'exposé : elles servent à construire, et à "
             "votre coach pour situer ce qui est acquis.")
    for titre, lignes, aide in [
            ("Problématique", 3, "ce que la question met en tension, en une phrase"),
            ("Connaissances disciplinaires mobilisées", 6,
             "notions, résultats, repères du programme que vous convoquez"),
            ("Plan de l'exposé", 6, "deux ou trois moments, dans l'ordre où vous parlerez"),
            ("Arguments et exemples", 8,
             "pour chaque moment, ce qui l'établit — un exemple précis vaut mieux qu'un général"),
            ("Conclusion", 3, "ce que vous répondez, et ce que la question laisse ouvert")]:
        L.append(rf"{{\bfseries\color{{navy}}{tex(titre)}}}\quad"
                 rf"{{\footnotesize\color{{gristech}}{tex(aide)}}}\par")
        L.append(rf"\cadreponse{{{lignes}}}")

    L.append(rf"\partienexus{{{numero[0]}}}{{La passation avec votre coach}}{{{entretien_min} min}}")
    numero[0] += 1
    L.append("Cette partie n'est pas un écrit : votre coach la conduit avec vous, à "
             "partir de ce que vous venez de préparer. Voici son déroulement.")
    for ph in d["deroule"]:
        L.append(rf"\par\hangindent=4mm\hangafter=1 $\bullet$~"
                 rf"{{\bfseries {tex(ph['phase'])} — {ph['duree_min']} min}}")
    if off:
        L.append(r"\vspace{2mm}\begin{avantdecommencer}"
                 r"{\bfseries Repère — l'épreuve officielle.} "
                 + tex(f"{off['intitule_officiel']} : {duree(off['duree_min'])} d'épreuve, "
                       f"coefficient {off['coefficient']}, après {off.get('preparation_min', 20)} min "
                       f"de préparation. {off.get('structure', '')}")
                 + r"\end{avantdecommencer}")
    return L


def entretien_candidat(d: dict, numero: list[int]) -> list[str]:
    """Ce qu'un candidat reçoit d'un entretien : le texte, la question, le déroulé.

    Jamais la grille. Elle porte les descripteurs de niveau qui servent à le noter :
    la lui remettre, c'est lui remettre le corrigé de l'épreuve. Le défaut existait — le
    livret de français composait la grille de l'entretien oral dans le document du
    candidat — et c'est le test de design qui l'a trouvé.
    """
    L = [rf"\partienexus{{{numero[0]}}}{{Déroulement de l'entretien}}{{}}",
         "Cette partie n'est pas un écrit : votre coach la conduit avec vous. Voici son "
         "déroulement, pour que vous sachiez à quoi vous attendre.", r"\vspace{2mm}"]
    for p in d["deroule"]:
        if "grille" in p["phase"].lower():
            continue
        L.append(rf"{{\bfseries {tex(p['phase'])} — {p['duree_min']} min}}\par")
    for sup in d.get("supports", []):
        L.append(_extrait_support(sup))
    q = d.get("question_grammaire")
    if q:
        L += [rf"\souspartienexus{{Question de grammaire}}{{}}",
              rf"{{\footnotesize\color{{gristech}}Phrase désignée : {tex(q['reperage'])}.}}\par",
              rf"\begin{{tcolorbox}}[enhanced,colback=ivoire,colframe=griscadre,"
              rf"boxrule=0.4pt,left=3mm,right=3mm,top=1.5mm,bottom=1.5mm,arc=0.6mm]"
              rf"{tex(q['phrase'])}\end{{tcolorbox}}",
              rf"{{\bfseries {tex(q['question'])}}}\par"]
    numero[0] += 1
    return L


def _extrait_support(sup: dict) -> str:
    if sup.get("forme") == "vers":
        vers = r"\\".join(
            (rf"\textbf{{{tex(r['locuteur'])}}}\\" + r"\\".join(tex(v) for v in r["vers"]))
            for r in sup["repliques"])
        return rf"\extrait{{{tex(sup['titre'])}}}{{{vers}}}{{{tex(sup['reference'])}}}"
    return (rf"\extrait{{{tex(sup['titre'])}}}{{{tex(sup['texte'])}}}"
            rf"{{{tex(sup['reference'])}}}")


def grille_coach_tex(d: dict, numero: list[int]) -> list[str]:
    """Un instrument d'entretien : le coach n'a pas de sujet, il a un déroulé et une grille."""
    L = [rf"\partienexus{{{numero[0]}}}{{Déroulé de l'entretien}}{{}}"]
    for p in d["deroule"]:
        L.append(rf"{{\bfseries {tex(p['phase'])} — {p['duree_min']} min}}\par")
        L.append(rf"\begin{{tcolorbox}}[enhanced,colback=ivoire,colframe=griscadre,"
                 rf"boxrule=0.4pt,left=3mm,right=3mm,top=1.5mm,bottom=1.5mm,arc=0.6mm]"
                 rf"«~{tex(p['consigne_prononcee'])}~»\end{{tcolorbox}}")
    for sup in d.get("supports", []):
        L.append(_extrait_support(sup))
    q = d.get("question_grammaire")
    if q:
        L += [rf"\souspartienexus{{Question de grammaire}}{{}}",
              rf"{{\footnotesize\color{{gristech}}Phrase désignée : {tex(q['reperage'])}.}}\par",
              rf"\begin{{tcolorbox}}[enhanced,colback=ivoire,colframe=griscadre,"
              rf"boxrule=0.4pt,left=3mm,right=3mm,top=1.5mm,bottom=1.5mm,arc=0.6mm]"
              rf"{tex(q['phrase'])}\end{{tcolorbox}}",
              rf"{{\bfseries {tex(q['question'])}}}\par"]
    numero[0] += 1
    L.append(rf"\partienexus{{{numero[0]}}}{{Grille d'évaluation}}{{}}")
    numero[0] += 1
    for cr in d["criteres"]:
        L.append(rf"\needspace{{7\baselineskip}}{{\bfseries\color{{navy}} {tex(cr['code'])} — "
                 rf"{tex(cr['intitule'])}}}\par")
        for niv in ("0", "1", "2", "3"):
            L.append(rf"\caseqcm~{{\footnotesize\textbf{{{niv}}} — "
                     rf"{tex(cr['descripteurs'][niv])}}}\par")
        L.append(r"{\footnotesize\color{gristech}Score du critère :}~\ligneponse[18mm]"
                 r"\par\vspace{2mm}")
    return L


# ─────────────────────────────────────────────── la composition

def options_police(famille: str) -> str:
    """Épingle les fichiers d'une famille, pour qu'aucune face ne soit servie en WOFF.

    Une même famille peut être installée en OpenType, en TrueType **et** en WOFF. Quand
    fontconfig sert la face italique d'EB Garamond en `.woff`, le pilote de sortie
    s'arrête net — « Cannot proceed without the font » — et XeLaTeX rend un PDF tronqué
    sans que rien n'ait échoué dans le log LaTeX. On nomme donc les fichiers, et on
    retient la taille optique qui possède le plus de faces : à défaut, le gras d'un
    extrait retomberait sur le romain sans que personne ne le voie.
    """
    r = subprocess.run(["fc-match", famille, "-f", "%{family}|%{file}"],
                       capture_output=True, text=True)
    fam, _, chemin = r.stdout.partition("|")
    depart = Path(chemin.strip())
    normalise = famille.lower().replace(" ", "")
    if normalise not in fam.lower().replace(" ", "") or not depart.exists():
        return "Ligatures=TeX"

    voisins = [f for f in depart.parent.iterdir()
               if f.suffix.lower() in (".ttf", ".otf")]
    familles = {}
    for f in voisins:
        prefixe = re.split(r"-", f.stem)[0]
        familles.setdefault(prefixe, []).append(f)

    def faces(fichiers):
        par = {}
        for f in fichiers:
            suffixe = f.stem.split("-", 1)[1] if "-" in f.stem else "Regular"
            gras, ital = "Bold" in suffixe, "Italic" in suffixe
            if suffixe in ("Regular", "Roman") or (not gras and not ital):
                par.setdefault("UprightFont", f)
            elif gras and ital:
                par["BoldItalicFont"] = f
            elif gras:
                par["BoldFont"] = f
            else:
                par["ItalicFont"] = f
        return par

    meilleur = max((faces(v) for v in familles.values()),
                   key=lambda d: (len(d), "UprightFont" in d), default={})
    if "UprightFont" not in meilleur:
        return "Ligatures=TeX"
    base = meilleur["UprightFont"].parent
    opts = [f"Path={base.as_posix()}/"] + [f"{o}={f.name}" for o, f in meilleur.items()]
    return ",".join(opts) + ",Ligatures=TeX"


def _habiller(gabarit: str, entete: str, profil: str, coach: bool) -> str:
    """Substitue dans le gabarit ce qui change d'un livret à l'autre.

    L'accent, l'en-tête courant et la mention de pied distinguent le document du
    candidat de celui du correcteur : ils sont posés en un seul endroit, pour qu'un
    livret coach ne puisse pas sortir avec le pied d'un livret candidat.
    """
    return (gabarit
            .replace(r"\ACCENT", "bordeaux" if coach else "navy")
            .replace(r"\OPTIONSSERIF", options_police("EB Garamond"))
            .replace(r"\POLICECORPS", "Lato")
            .replace(r"\POLICESERIF", "EB Garamond")
            .replace(r"\ICONE", str(ICONE))
            .replace(r"\MATIERECOURANTE", tex(entete))
            .replace(r"\PROFILCOURANT",
                     tex(("Correction — " if coach else "") + PROFILS.get(profil, {"libelle": "Tous profils"})["libelle"]))
            .replace(r"\PIEDDROIT",
                     tex("CONFIDENTIEL — correction" if coach else "Diagnostic Nexus V2")))


#: Ce que le dossier d'entrée n'a plus à demander quand Nexus le sait déjà : l'identifiant
#: de la question du formulaire QP, et la clé de la situation qui y répond.
QUESTIONS_CONNUES = {"QP-01": "profil", "QP-02": "session", "QP-06": "eaf",
                     "QP-07": "specialites", "QP-09": "spe_non_poursuivie",
                     "QP-19": "mode_passation_ea", "QP-31": "mode_ep"}
#: La section du formulaire QP qui ne s'ouvre que pour un passage en une même session.
SECTION_MEME_SESSION = "eligibilite_meme_session"
#: Le dossier d'entrée générique annonce 40 min pour l'ensemble des questions.
DUREE_DOSSIER_ENTREE_MIN = 40


def _libelle_option(q: dict, code: str) -> str:
    return next((o["libelle"] for o in q.get("options", [])
                 if str(o.get("valeur", o.get("code"))) == str(code)), code)


def _minuscule_initiale(texte: str) -> str:
    return texte[:1].lower() + texte[1:]


def plan_formulaire_entree(formulaires: list[tuple[str, dict]], situation: dict) -> dict:
    """Ce que l'export nominatif demande encore, ce qu'il rappelle, ce qu'il écarte.

    Les mentions sont lues dans les libellés d'options du formulaire : la phrase que le
    candidat aurait cochée est celle qu'on lui rappelle.
    """
    qp = dict(formulaires)["QP"]
    questions = {q["id"]: q for q in qp["questions"]}
    profil = situation["profil"]
    meme_session = situation.get("mode_passation_ea") == "meme_session"
    spes = ", ".join(_libelle_option(questions["QP-07"], c) for c in situation["specialites"])
    abandon = situation.get("spe_non_poursuivie")
    eaf = situation["eaf"]
    mentions = {
        "QP-01": f"{PROFILS[profil]['long']} — {_minuscule_initiale(_libelle_option(questions['QP-01'], profil))}.",
        "QP-02": f"{_libelle_option(questions['QP-02'], str(situation['session']))}.",
        "QP-06": ("Aucune épreuve anticipée de français à présenter : vous les avez déjà "
                  "présentées et vos notes sont conservées."
                  if eaf == "aucune" else f"{_libelle_option(questions['QP-06'], eaf)}."),
        "QP-07": f"{spes}.",
        "QP-09": (f"{_libelle_option(questions['QP-09'], abandon)}."
                  if abandon and abandon != "aucune" else "Aucune spécialité abandonnée."),
        "QP-19": (f"{_libelle_option(questions['QP-19'], 'meme_session')}." if meme_session
                  else ("Épreuves anticipées déjà présentées lors d'une session antérieure : "
                        "le passage de toutes les épreuves à la même session ne vous concerne pas."
                        if profil == "P2" else f"{_libelle_option(questions['QP-19'], 'anticipation')}.")),
        "QP-31": f"{_libelle_option(questions['QP-31'], situation['mode_ep'])}.",
    }
    exclues = [] if meme_session else [q["id"] for q in qp["questions"]
                                      if q.get("section") == SECTION_MEME_SESSION]
    total = sum(len(d["questions"]) for _, d in formulaires)
    posees = total - len(mentions) - len(exclues)
    duree_min = -(-DUREE_DOSSIER_ENTREE_MIN * posees // total // 5) * 5
    if abandon and abandon != "aucune":
        abandon_lisible = _libelle_option(questions["QP-09"], abandon)
    else:
        abandon_lisible = None
    encadre = [("Profil", PROFILS[profil]["long"]), ("Session", str(situation["session"])),
               ("Spécialités suivies en Première" if profil == "P1"
                else "Spécialités présentées en Terminale", spes)]
    if abandon_lisible:
        encadre.append(("Spécialité abandonnée en fin de Première" if profil == "P1"
                        else "Spécialité non poursuivie après la Première", abandon_lisible))
    encadre += [("Épreuves anticipées de français",
                 "déjà présentées" if eaf == "aucune"
                 else _libelle_option(questions["QP-06"], eaf).lower()),
                ("Mode des évaluations ponctuelles",
                 "annuel" if situation["mode_ep"] == "annuelle" else "global en fin de cycle")]
    return {"mentions": mentions, "exclues": exclues, "posees": posees, "total": total,
            "duree_min": duree_min, "encadre": encadre,
            "specialites": [_libelle_option(questions["QP-07"], c) for c in situation["specialites"]]}


def encadre_situation_connue(encadre: list[tuple[str, str]]) -> str:
    L = [r"\begin{avantdecommencer}",
         r"{\bfseries\color{navy}Situation déjà enregistrée par Nexus}\par\vspace{1mm}",
         "Ces éléments ont servi à composer votre pack : vous n'avez pas à les ressaisir. "
         "Signalez à votre coach toute information qui ne serait plus exacte.",
         r"\par\vspace{1mm}\begin{propositions}"]
    L += [rf"  \item[]{{\bfseries {tex(a)}~:}} {tex(b)}" for a, b in encadre]
    L += [r"\end{propositions}", r"\end{avantdecommencer}", r"\vspace{2mm}"]
    return "\n".join(L)


def formulaires_entree() -> list[tuple[str, dict]]:
    """Les formulaires sources du dossier d'entrée, dans l'ordre du livret."""
    formulaires = []
    for code in ("QP", "MET"):
        f = RACINE / "instruments" / code / "formulaire.json"
        if f.exists():
            formulaires.append((code, json.loads(f.read_text(encoding="utf-8"))))
    if not formulaires:
        raise SystemExit("dossier d'entrée : aucun formulaire source")
    return formulaires


def duree_dossier_entree(situation: dict | None = None) -> int:
    """La durée que la couverture du dossier d'entrée annonce : celle du livret générique,
    ou celle recalculée sur les questions réellement posées dans un export nominatif."""
    if situation is None:
        return DUREE_DOSSIER_ENTREE_MIN
    return plan_formulaire_entree(formulaires_entree(), situation)["duree_min"]


def formulaire_entree(profil: str, cible: Path, situation: dict | None = None) -> Path:
    """Le dossier d'entrée : parcours, situation, contraintes et méthodes, en un livret.

    Le candidat recevait deux formulaires de secours composés par une autre chaîne : une
    typographie étrangère à la collection, et — plus grave — la section « Dépouillement,
    réservé au coach » du questionnaire de méthodes, avec ses seuils, imprimée dans un
    document remis au candidat. Le dossier est donc recomposé ici, sur le gabarit Nexus
    et sans rien qui appartienne au correcteur.
    """
    verifier_marque()
    formulaires = formulaires_entree()
    plan = plan_formulaire_entree(formulaires, situation) if situation else None
    if plan:
        surcharges = {"Épreuve officielle": ("Nature du document", "Questionnaire Nexus"),
                      "Calculatrice": ("Calculatrice", "Non nécessaire"),
                      "Durée du diagnostic": ("Durée du diagnostic", duree(plan["duree_min"]))}
        corps = [couverture("DOSSIER-ENTREE", profil, [], modalites(), situation["session"],
                            False, surcharges=surcharges, candidat=situation["nom"])]
    else:
        corps = [couverture("DOSSIER-ENTREE", profil, [], modalites(), None, False)]
    corps.append(entree_avant_de_commencer(formulaires, nominatif=bool(plan)))
    numero, question = [1], [0]
    for code, d in formulaires:
        corps.append(rf"\partienexus{{{numero[0]}}}{{{tex(d['titre'])}}}{{}}")
        numero[0] += 1
        corps.append(rf"{{\small {tex(d['consigne_liminaire'])}}}")
        if plan and code == "QP":
            corps.append(encadre_situation_connue(plan["encadre"]))
        corps += questions_de_formulaire(
            d, question, mentions=plan["mentions"] if plan else None,
            exclues=set(plan["exclues"]) if plan else None,
            repetitions={"specialites": plan["specialites"]} if plan else None)

    return rendre(_habiller(GABARIT.read_text(encoding="utf-8"), "Dossier d'entrée",
                            profil, False)
                  + "\n" + "\n\n".join(corps) + "\n\\end{document}\n",
                  cible, f"dossier d'entrée/{profil}")


def entree_avant_de_commencer(formulaires: list[tuple[str, dict]],
                              nominatif: bool = False) -> str:
    """Ce que le dossier d'entrée est, et ce qu'il n'est pas."""
    identification = (
        r"{\bfseries Ce que Nexus ne vous demande pas ici.} Ne recopiez pas vos coordonnées "
        "personnelles dans les réponses : l'identification du dossier figure déjà sur la "
        "couverture. Les pièces justificatives sont transmises séparément."
        if nominatif else
        r"{\bfseries Ce que Nexus ne vous demande pas ici.} Aucun nom, aucune "
        "coordonnée : seule la référence candidat portée sur la couverture identifie ce "
        "dossier. Les pièces justificatives sont transmises séparément.")
    L = [r"{\Large\bfseries\color{navy}Avant de commencer\par}", r"\vspace{2mm}",
         r"\begin{avantdecommencer}",
         r"{\bfseries Ce dossier ne mesure aucune compétence.} Il réunit ce qui situe "
         "votre parcours, votre situation au regard de l'examen, vos contraintes et vos "
         "habitudes de travail. Ces éléments servent à interpréter vos diagnostics et à "
         "construire un plan adapté : il n'y a ni bonne ni mauvaise réponse.",
         r"{\bfseries Comment répondre.} Cochez ou écrivez directement sur ce livret. "
         "Répondez à tout ce qui vous concerne ; une section vous dit, le cas échéant, "
         "qu'elle ne s'adresse qu'à certaines situations.",
         identification,
         r"\end{avantdecommencer}", r"\vspace{3mm}"]
    return "\n".join(L)


def questions_de_formulaire(d: dict, question: list[int],
                            mentions: dict[str, str] | None = None,
                            exclues: set[str] | None = None,
                            repetitions: dict[str, list[str]] | None = None) -> list[str]:
    """Les questions d'un formulaire, dans l'ordre, sections conditionnelles comprises.

    Rien de ce qui relève du correcteur n'entre ici : la méthode de dépouillement et les
    seuils du questionnaire de méthodes restent dans le référentiel. Dans un export
    nominatif, `mentions` rappelle la réponse déjà connue à la place de la zone de saisie,
    et `exclues` écarte les questions sans objet pour la situation du candidat ;
    `repetitions` donne, pour une question « répétée pour » une liste que Nexus connaît
    (les spécialités), les éléments à instancier au lieu d'une consigne générique.
    """
    echelle = VI.charger_referentiels(None)["competences"]["conventions"]["echelle_bloc_0"]
    sections = {x["code"]: x for x in d.get("sections", [])}
    ouverte = None
    L = []
    for q in d["questions"]:
        if exclues and q["id"] in exclues:
            continue
        sec = sections.get(q.get("section"))
        if sec and sec["code"] != ouverte:
            ouverte = sec["code"]
            L += [rf"\needspace{{8\baselineskip}}",
                  rf"{{\large\bfseries\color{{navy}}{tex(sec['titre'])}\par}}"
                  r"\vspace{1mm}{\color{or}\rule{14mm}{1.2pt}}\par\vspace{2mm}",
                  r"\begin{avantdecommencer}"
                  rf"{{\bfseries Cette section ne vous concerne que {tex(sec['condition_lisible'])}.}} "
                  rf"{tex(sec['consigne'])} Fondement~: {tex(sec['fondement'])}."
                  r"\end{avantdecommencer}", r"\vspace{2mm}"]
        question[0] += 1
        L.append(rf"\needspace{{{_besoin_demande(q)}\baselineskip}}")
        L.append(rf"\demande{{{question[0]}}}{{{tex(q['id'])}}}")
        libelle = tex(q["libelle"])
        if q.get("condition_lisible"):
            libelle += rf" {{\itshape\small({tex(q['condition_lisible'])})}}"
        elements = (repetitions or {}).get(q.get("repete_pour"))
        if q.get("repete_pour") and not elements:
            libelle += (r" {\itshape\small(une réponse par élément de «~"
                        + tex(q["repete_pour"]) + r"~»)}")
        elif elements:
            libelle += r" {\itshape\small(une réponse par spécialité)}"
        L.append(libelle)
        if elements and q["type"] == "echelle_1_4":
            L += _reponse_de_la_demande({**q, "axes": elements}, echelle)
        elif elements:
            for element in elements:
                L.append(rf"\par\vspace{{0.3\baselineskip}}{{\small\bfseries {tex(element)}}}")
                L += _reponse_de_la_demande(q, echelle)
        elif mentions and q["id"] in mentions:
            L.append(r"\par\vspace{0.5mm}\noindent{\color{or}\rule{2pt}{0.9\baselineskip}}\hspace{2mm}"
                     r"{\small{\bfseries\color{navy}Information déjà enregistrée :} "
                     rf"{tex(mentions[q['id']])}}}\par")
        else:
            L += _reponse_de_la_demande(q, echelle)
    return L


def _besoin_demande(q: dict) -> int:
    if q["type"] in ("choix_unique", "choix_multiple"):
        return min(4 + len(q["options"]), 26)
    if q["type"] == "echelle_1_4":
        return 4 + len(q.get("axes", ["x"]))
    return 8 if q["type"] == "entier" else 10


def _reponse_de_la_demande(q: dict, echelle: list[str]) -> list[str]:
    if q["type"] in ("choix_unique", "choix_multiple"):
        L = [r"\begin{propositions}"]
        L += [rf"  \item[]\caseqcm\hspace{{1.5mm}}{tex(o['libelle'])}"
              for o in q["options"]]
        L.append(r"\end{propositions}")
        if q["type"] == "choix_multiple":
            L.append(rf"{{\small\itshape De {q['min_choix']} à {q['max_choix']} réponses.}}")
        return L
    if q["type"] == "entier":
        return [r"\par\vspace{1mm}\ligneponse[35mm]\quad"
                rf"{{\small\color{{gristech}}{tex(q.get('unite', ''))} "
                rf"(entre {q['min']} et {q['max']})}}"]
    if q["type"] == "echelle_1_4":
        cases = "\\quad ".join(rf"\caseqcm\hspace{{1.5mm}}{tex(n)}" for n in echelle)
        return [rf"\echelle{{{tex(axe)}}}{{{cases}}}"
                for axe in q.get("axes", ["Votre estimation"])]
    return [rf"\cadreponse{{3}}"]


#: Le titre de module d'un instrument dans un livret qui en réunit plusieurs. La clé est
#: le code, ou le couple code/version quand deux assemblages du même instrument ne
#: préparent pas la même chose : `FR-EAF/oral` est un travail écrit qui prépare l'oral, et
#: le titrer « diagnostic de l'écrit » tromperait le candidat qui ne présente que l'oral.
LIBELLE_MODULE = {
    "FR-EAF": "Diagnostic de l'écrit",
    "FR-EAF/oral": "Travail écrit préparatoire à l'oral",
    "FR-EAF/oral_2028": "Travail écrit préparatoire à l'oral",
    "FR-EAF-ORAL": "Diagnostic de l'oral — entretien mené par le coach",
    "FR-POS": "Positionnement linguistique — écrit",
    "FR-POS-ORAL": "Positionnement linguistique — entretien oral coach",
    "MATH-EA": "Épreuve anticipée de mathématiques",
    "EDS-MATH": "Spécialité mathématiques",
}


def module(rang: int, code: str, version: str, intitule: str | None = None) -> str:
    """Le bandeau d'un module. « MODULE A », « MODULE B » : le lecteur sait où il est."""
    lettre = chr(ord("A") + rang)
    libelle = (LIBELLE_MODULE.get(f"{code}/{version}")
               or LIBELLE_MODULE.get(code)
               or (_libelle_court(intitule) if intitule else code))
    return (r"\needspace{10\baselineskip}"
            rf"{{\footnotesize\color{{gristech}}\textsc{{Module {lettre}}}\par}}"
            rf"{{\large\bfseries\color{{navy}}{tex(libelle)}\par}}"
            r"\vspace{1mm}{\color{or}\rule{14mm}{1.2pt}}\par\vspace{2mm}")


def _libelle_court(intitule: str) -> str:
    """« Diagnostic français — épreuve orale seule » se lit « Épreuve orale seule ».

    Le livret dit déjà la matière sur sa couverture et dans son en-tête courant ; la
    répéter à chaque module encombre sans informer.
    """
    court = re.sub(r"^Diagnostic\s+\S+\s*[—–-]\s*", "", intitule).strip()
    return (court[0].upper() + court[1:]) if court else intitule


def composer(matiere: str, profil: str, versions: list[tuple[str, str]],
             cible: Path, coach: bool = False, session: int | None = None) -> Path:
    """Compose un livret de matière et rend le PDF. Une seule pièce, autonome."""
    verifier_marque()
    m = modalites()
    parties, contextes = [], []
    for code, version in versions:
        d = RACINE / "instruments" / code
        cat = next(i for i in VI.charger_referentiels(None)["catalogue"]["instruments"]
                   if i["code"] == code and i["version"] == version)
        parties.append({"code": code, "version": version,
                        "duree_min": (cat["duree_cible_min"] if coach else
                                      duree_livret_candidat(code, cat["duree_cible_min"])),
                        "intitule": cat.get("intitule")})
        contextes.append((code, version, d))

    # Le corps se compose d'abord : la page « avant de commencer » dit au candidat
    # comment répondre, et elle ne peut le dire qu'une fois qu'on sait s'il y a quelque
    # chose à écrire. Le livret du Grand oral promettait « répondez à toutes les
    # questions » sans porter une seule question.
    corps_body = []
    numero, question = [1], [0]
    parties_calc, parties_vues = [], []
    intitules = {(x["code"], x["version"]): x.get("intitule") for x in parties}
    for rang, (code, version, d) in enumerate(contextes):
        if len(contextes) > 1:
            # Un livret qui réunit deux instruments n'est pas leur concaténation : c'est
            # un document, avec une hiérarchie. Les modules se succèdent — A, B — et la
            # numérotation des parties court d'un bout à l'autre, sans repartir à 1.
            corps_body.append(module(rang, code, version,
                                     intitules.get((code, version))))
        def_fichier = d / f"definition_{version}.json"
        if not def_fichier.exists():
            def_fichier = d / "definition.json"
        if def_fichier.exists():
            definition = json.loads(def_fichier.read_text(encoding="utf-8"))
            if coach:
                corps_body += grille_coach_tex(definition, numero)
            elif code == "GO":
                corps_body += grand_oral_candidat(definition, numero, m)
            else:
                corps_body += entretien_candidat(definition, numero)
        else:
            corps_body += bloc_items(BI.contexte(d, version), numero, question, coach,
                                     parties_calc, parties_vues)

    zones = any(r"\cadreponse" in x or r"\begin{propositions}" in x for x in corps_body)
    regle_calc = regle_calculatrice(parties_calc, parties_vues)
    corps = [couverture(matiere, profil, parties, m, session, coach, regle_calc=regle_calc)]
    if not coach:
        corps.append(avant_de_commencer(matiere, parties, m, zones, regle_calc))
    corps += corps_body

    doc = (_habiller(GABARIT.read_text(encoding="utf-8"), MATIERES[matiere][0], profil,
                     coach)
           + "\n" + "\n\n".join(corps) + "\n\\end{document}\n")

    return rendre(doc, cible, f"{matiere}/{profil}")


def rendre(doc: str, cible: Path, quoi: str) -> Path:
    r"""Compose le source XeLaTeX et dépose le PDF.

    Trois passes, et non deux. \pageref{LastPage} vaut, à la passe *n*, ce qu'il valait à
    la passe *n-1* : quand la deuxième passe change la pagination — et elle la change, car
    la première ignore encore le nombre de pages qu'elle imprime en pied —, le folio
    annonce « 2 / 20 » dans un livret de vingt et une pages. La troisième passe referme
    la boucle.
    """
    with tempfile.TemporaryDirectory(prefix="livret-") as t:
        (Path(t) / "l.tex").write_text(doc, encoding="utf-8")
        for _ in range(3):
            r = subprocess.run(["xelatex", "-interaction=nonstopmode", "l.tex"], cwd=t,
                               capture_output=True, text=True,
                               env={"PATH": "/usr/bin:/bin", "HOME": t,
                                    "SOURCE_DATE_EPOCH": "0", "FORCE_SOURCE_DATE": "1",
                                    "TZ": "UTC"})
        pdf = Path(t) / "l.pdf"
        if not pdf.exists():
            lignes = [x for x in r.stdout.splitlines() if x.startswith("!")][:6]
            raise SystemExit(f"{quoi} : composition échouée — " + " | ".join(lignes))
        # Un PDF existant n'est pas un PDF valide : quand le pilote de sortie s'arrête —
        # police introuvable, image tronquée — il laisse derrière lui le fichier de la
        # passe précédente, et la construction se déclarait réussie sur un document
        # illisible. On vérifie avant de le déposer.
        v = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True)
        if v.returncode != 0 or "Pages:" not in v.stdout:
            motif = (v.stderr or r.stdout).strip().splitlines()
            raise SystemExit(f"{quoi} : PDF illisible — "
                             + " | ".join(x for x in motif[-4:] if x))
        cible.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pdf, cible)
    return cible


def separateur(matiere: str, profil: str, cible: Path) -> Path:
    """Intercalaire d'impression : une page, une matière.

    Le pack imprimé perd les signets du PDF. Sans intercalaire, le candidat reçoit une
    liasse de soixante pages où rien ne dit où finit une matière et où commence la
    suivante. La page est sobre et peu encrée : elle sert à séparer, pas à décorer.
    """
    nom, sous_titre = MATIERES.get(matiere, (matiere, ""))
    doc = (GABARIT.read_text(encoding="utf-8")
           .replace(r"\ACCENT", "navy").replace(r"\POLICECORPS", "Lato")
           .replace(r"\OPTIONSSERIF", options_police("EB Garamond"))
           .replace(r"\POLICESERIF", "EB Garamond").replace(r"\ICONE", str(ICONE))
           .replace(r"\MATIERECOURANTE", tex(nom))
           .replace(r"\PROFILCOURANT", tex(PROFILS[profil]["libelle"]))
           .replace(r"\PIEDDROIT", "Intercalaire"))
    doc += "\n" + "\n".join([
        r"\thispagestyle{empty}",
        r"\vspace*{9\baselineskip}",
        rf"\begin{{center}}\includegraphics[height=22mm]{{{ICONE}}}\par\vspace{{9mm}}",
        rf"{{\footnotesize\color{{gristech}}\textsc{{{tex(PROFILS[profil]['long'])}}}}}\par",
        r"\vspace{3mm}{\color{or}\rule{26mm}{1.4pt}}\par\vspace{5mm}",
        rf"{{\Huge\bfseries\color{{navy}}{tex(nom.upper())}}}\par\vspace{{4mm}}",
        rf"{{\normalsize\color{{gristech}}{tex(sous_titre)}}}\par",
        r"\end{center}"]) + "\n\\end{document}\n"
    return rendre(doc, cible, f"séparateur {matiere}")


if __name__ == "__main__":
    verifier_marque()
    cible = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("/tmp/livret.pdf")
    versions = [tuple(x.split("/")) for x in sys.argv[2].split(",")]
    p = composer(sys.argv[1], sys.argv[4] if len(sys.argv) > 4 else "P1", versions, cible,
                 coach="--coach" in sys.argv)
    print(p)

#!/usr/bin/env python3
"""Génère les quatre rendus d'un instrument depuis banque.json et son assemblage.

  <CODE>_<VERSION>_sujet_candidat.md
  <CODE>_<VERSION>_cle_et_grilles_correcteur.md
  <CODE>_<VERSION>_feuille_reponses.md
  <CODE>_<VERSION>_saisie_vierge.csv

et, si --pdf est demandé, le PDF de chaque Markdown.

Déterministe : deux exécutions sur la même source produisent des octets identiques.
Aucune valeur — durée, score, intitulé, échelle, en-tête de colonne — n'est écrite ici :
tout vient de banque.json, de l'assemblage et des référentiels. Les fonctions de ce
module ne contiennent que de la structure.

  usage : build_instrument.py <dossier instrument> [version…] [--pdf]
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import re
import shutil
import subprocess
import tempfile
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_instrument as VI
import validate_referentiel as VR

RACINE = Path(__file__).resolve().parent.parent


# ─────────────────────────────────────────────────────────── outils communs

def contexte(dossier: Path, version: str) -> dict:
    """Tout ce que les rendus ont besoin de lire, résolu une fois."""
    local = dossier / "referentiels"
    refs = VI.charger_referentiels(local if local.exists() else None)
    banque = VR.charger(dossier / "banque.json")
    asm = VR.charger(dossier / "assemblages" / f"{version}.json")
    cat = next(i for i in refs["catalogue"]["instruments"]
               if i["code"] == asm["instrument"] and i["version"] == version)
    per = next(p for p in refs["competences"]["perimetres"] if p["code"] == cat["perimetre"])
    par_id = {i["item_id"]: i for i in banque["items"]}
    return {
        "refs": refs, "banque": banque, "asm": asm, "cat": cat, "perimetre": per,
        "par_id": par_id, "conv": refs["competences"]["conventions"],
        "codes": {c["code"]: c for c in refs["codes_erreur"]["codes"]},
        "comps": {c["code"]: c for c in per["competences"]},
        "blocs": [(b["bloc"], [par_id[i] for i in b["items"] if i in par_id], b.get("supports", []))
                  for b in asm["blocs"] if b["items"]],
        "figures": dossier / "build",
    }


def md(texte: str) -> str:
    """Échappe ce qui serait interprété comme du balisage : un identifiant tel que
    « _FIXTURE » ouvrirait une mise en italique et disparaîtrait du rendu."""
    for c in ("\\", "_", "*", "`"):
        texte = texte.replace(c, "\\" + c)
    return texte


ZONE_ECRITURE = ". " * 19


def duree_bloc(items) -> int | float:
    return sum(i["duree_min"] for i in items)


def minutes(v) -> str:
    """« 15 » et non « 15.0 », « 1,5 » et non « 1.5 » : une durée s'imprime en français."""
    return f"{v:g}".replace(".", ",")


def intitule_bloc(c: dict, bloc: str) -> str:
    """L'intitulé du bloc : celui du référentiel, sauf si l'assemblage en déclare un.

    Les intitulés de bloc sont communs à tout le dépôt, et c'est ce qui les rend lisibles
    d'un instrument à l'autre. Mais un assemblage peut porter deux tâches là où les autres
    n'en portent qu'une : l'intitulé au singulier serait faux pour lui seul. La
    dérogation est déclarée dans l'assemblage, jamais devinée.
    """
    return c["asm"].get("intitules_blocs", {}).get(bloc, c["conv"]["blocs"][bloc])


def duree_totale(c: dict) -> int:
    return (sum(duree_bloc(i) for _, i, _ in c["blocs"])
            + c["asm"].get("bloc_0", {}).get("duree_min", 0))


def ligne_source(d: dict) -> str:
    """Mention de provenance, obligatoire sur tout tableau et toute figure.

    Une figure mathématique ne représente aucune donnée : une droite, une parabole ou un
    résumé en cinq nombres sont construits pour la question. Les présenter comme des
    « données simulées » laisserait croire qu'elles imitent une réalité.
    """
    if d.get("construite"):
        return ("*Données construites pour cette question ; elles ne représentent aucune "
                "situation réelle.*")
    if d.get("simulee"):
        return "*Données simulées à visée pédagogique.*"
    return f"*Source : {d['source']}*"


def rendre_tableau(t: dict) -> list[str]:
    L = [f"**{t['titre']}**", "",
         "| " + " | ".join(t["colonnes"]) + " |",
         "|" + "---|" * len(t["colonnes"])]
    for ligne in t["lignes"]:
        L.append("| " + " | ".join(str(x) for x in ligne) + " |")
    return L + ["", ligne_source(t), ""]


def rendre_figure(f: dict, cible: Path) -> list[str]:
    """Trace la figure depuis les données de la banque. Aucune image externe n'est insérée.

    Le rendu est vectoriel et déterministe : matplotlib en mode Agg, sans horodatage.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    cible.parent.mkdir(parents=True, exist_ok=True)
    # Un cercle doit être rond : la boite du graphique est carrée pour ce genre, sans quoi
    # l'égalité des échelles étire le cadre et le cercle paraît ovale à l'impression.
    genre_fig = f.get("type_graphe", f.get("type"))
    fig, ax = plt.subplots(figsize=(3.6, 3.6) if genre_fig == "cercle_trigo" else (5.5, 3.2))
    x = f["axe_x"]["valeurs"]
    # Le genre de graphique est porté par « type_graphe » : « type » vaut « figure » et
    # distingue le support d'un tableau ou d'un texte. Les lire comme un seul champ
    # faisait tracer en courbe continue les diagrammes en barres — un taux de chômage
    # par diplôme relié d'un trait, alors que l'axe des abscisses est catégoriel.
    genre = f.get("type_graphe", f.get("type"))
    if genre == "barres":
        n = len(f["series"])
        largeur = 0.8 / n
        for i, s in enumerate(f["series"]):
            pos = [j - 0.4 + largeur * (i + 0.5) for j in range(len(x))]
            ax.bar(pos, s["valeurs"], largeur, label=s["label"],
                   color="0.35" if i == 0 else "0.7", edgecolor="black", linewidth=0.5)
        ax.set_xticks(range(len(x)))
        ax.set_xticklabels([str(v) for v in x])
    elif genre == "cercle_trigo":
        # Cercle trigonométrique : la capacité attendue dit « par lecture du cercle », et
        # une valeur remarquable donnée de mémoire n'est pas une lecture. Les points sont
        # placés et étiquetés par leur angle ; les graduations des axes portent la lecture.
        import numpy as np
        t = np.linspace(0, 2 * np.pi, 721)
        ax.plot(np.cos(t), np.sin(t), color="black", linewidth=1.0)
        ax.axhline(0, color="black", linewidth=0.8)
        ax.axvline(0, color="black", linewidth=0.8)
        for label, angle in zip(x, f["series"][0]["valeurs"]):
            cx, cy = np.cos(angle), np.sin(angle)
            ax.plot([cx], [cy], "o", color="black", markersize=5)
            ax.plot([cx, cx], [0, cy], ":", color="0.4", linewidth=0.8)
            ax.plot([0, cx], [cy, cy], ":", color="0.4", linewidth=0.8)
            ax.annotate(label, (cx, cy), textcoords="offset points", xytext=(8, 6),
                        fontsize=9)
        ax.set_xticks([-1, -0.5, 0, 0.5, 1])
        ax.set_yticks([-1, -0.5, 0, 0.5, 1])
        ax.set_xlim(-1.25, 1.45)
        ax.set_ylim(-1.25, 1.35)
        ax.set_aspect("equal")
    elif genre == "boite":
        # Diagramme en boite : chaque série porte [minimum, Q1, médiane, Q3, maximum].
        stats = [{"label": s["label"], "whislo": s["valeurs"][0], "q1": s["valeurs"][1],
                  "med": s["valeurs"][2], "q3": s["valeurs"][3], "whishi": s["valeurs"][4],
                  "fliers": []} for s in f["series"]]
        ax.bxp(stats, vert=False, showfliers=False,
               boxprops={"color": "black"}, medianprops={"color": "black", "linewidth": 1.4},
               whiskerprops={"color": "black"}, capprops={"color": "black"})
    else:
        for i, s in enumerate(f["series"]):
            style = ["-", "--", ":"][i % 3]
            # Une série peut imposer son propre tracé : c'est ce qui permet de superposer
            # un nuage de points et sa droite d'ajustement dans une même figure.
            genre_s = s.get("type", "points" if genre == "nuage" else "ligne")
            if genre_s == "points":
                ax.plot(x, s["valeurs"], "o", color="black", label=s["label"], markersize=4)
            else:
                ax.plot(x, s["valeurs"], style, color="black", label=s["label"], linewidth=1.2)
    ax.set_xlabel(f["axe_x"]["label"])
    ax.set_ylabel(f["axe_y"]["label"])
    if genre not in ("boite", "cercle_trigo") and \
            (len(f["series"]) > 1 or f["series"][0].get("label")):
        ax.legend(frameon=False, fontsize=8)
    ax.grid(True, linewidth=0.3, color="0.8")
    ax.set_axisbelow(True)
    fig.savefig(cible, format="pdf", metadata={"CreationDate": None, "Producer": None,
                                               "Creator": None}, bbox_inches="tight")
    plt.close(fig)
    # Le texte alternatif est laissé vide **à dessein** : pandoc en fait sinon un flottant
    # LaTeX, que le compositeur déplace — la figure quittait sa question et atterrissait
    # une page plus loin, le candidat lisant « la droite tracée ci-dessous » sans droite.
    # Sans texte alternatif, l'image est composée sur place. Le titre est déjà imprimé
    # au-dessus, en gras, et la provenance au-dessous.
    # Le chemin de la figure est relatif au dossier du rendu : un chemin absolu rendait le
    # Markdown — et son empreinte — dépendants de l'emplacement du dépôt sur la machine.
    return [f"**{f['titre']}**", "", f"![]({cible.name})", "", ligne_source(f), ""]


def identifiant_bloc_0(instrument: str, competence: str, conv: dict) -> str:
    """Identifiant imprimé d'un domaine de bloc 0, au format du référentiel."""
    return (conv["identifiant_bloc_0"]["format"]
            .replace("<CODE_INSTRUMENT>", instrument)
            .replace("<COMPETENCE>", competence))


def lignes_bloc_0(b0: dict, conv: dict, instrument: str) -> list[str]:
    """Un domaine par bloc, cases sur une ligne, précédé de son identifiant.

    Un tableau à cinq colonnes rend les intitulés du référentiel illisibles : ils
    sont longs par construction, puisqu'ils doivent être ceux des compétences.
    L'identifiant est imprimé parce que la saisie le référence : sans lui, le bloc 0
    serait rempli par le candidat et lu par personne.
    """
    L = []
    for d in b0["domaines"]:
        ident = identifiant_bloc_0(instrument, d["competence"], conv)
        # Dans un code span, Markdown n'interprète rien : l'échapper y ferait
        # apparaître la barre oblique inverse à l'impression.
        L += [f"`{ident}` — **{md(d['intitule'])}**", "",
              "  ".join(f"☐ {n}" for n in conv["echelle_bloc_0"]), ""]
    return L


def entete(c: dict, titre: str) -> list[str]:
    a, cat = c["asm"], c["cat"]
    return [f"# {md(a['instrument'])} · {md(a['version'])} — {titre}", "",
            f"*{cat['libelle']}*", "",
            f"- Instrument : **{md(a['instrument'])} / {md(a['version'])}** — "
            f"version de banque {c['banque']['version']}",
            f"- Durée de l'épreuve : **{cat['duree_cible_min']} min**",
            f"- Profils concernés : {', '.join(cat['profils'])}",
            f"- Support : {c['refs']['catalogue']['conventions']['supports'][cat['support']]}",
            ""]


def avertissement(c: dict) -> list[str]:
    a = c["banque"].get("avertissement")
    return [f"> **{a}**", ""] if a else []


# ────────────────────────────────────────────────────────── sujet candidat

def sujet_candidat(c: dict) -> str:
    conv, asm, cat = c["conv"], c["asm"], c["cat"]
    L = entete(c, "sujet") + avertissement(c)

    L += ["## Consignes de passation", ""]
    L += [f"- {x}" for x in asm.get("consignes_passation", [])]
    L += [f"- Matériel : {c['refs']['catalogue']['conventions']['materiel'][cat['materiel']]}", ""]

    b0 = asm.get("bloc_0")
    if b0:
        L += [f"## Bloc 0 · {intitule_bloc(c, '0')}", "",
              f"*Durée indicative : {minutes(b0['duree_min'])} min*", "",
              b0["consigne"], ""]
        L += lignes_bloc_0(b0, conv, asm["instrument"])

    for bloc, items, supports in c["blocs"]:
        # Un support littéraire ne se lit pas à cheval sur deux pages, et il ne se lit pas
        # davantage sans la consigne qui dit quoi en faire : le candidat qui tourne la page
        # entre le texte et sa question relit, et ce temps-là n'est pas du temps
        # d'évaluation. Le titre du bloc entre dans le groupe, faute de quoi il resterait
        # seul au bas de la page précédente à annoncer un contenu qui n'y est pas. Le
        # \filbreak ouvert ici se referme après le premier item : titre, texte, référence
        # et consigne tiennent d'une même page. Il ne force la page suivante que si la
        # place manque.
        texte_du_bloc = any(s.get("type") not in ("tableau", "figure") for s in supports)
        if texte_du_bloc:
            L += ["\\filbreak", ""]
        L += [f"## Bloc {bloc} · {intitule_bloc(c, bloc)}", "",
              f"*Durée indicative : {minutes(duree_bloc(items))} min*", ""]
        vus_bloc: set[str] = set()
        for sup in supports:
            if sup.get("type") == "tableau":
                L += rendre_tableau(sup)
            elif sup.get("type") == "figure":
                L += rendre_figure(sup, c["figures"] / f"{sup['code']}.pdf")
            else:
                L += [f"### {sup['titre']}", "", sup["texte"], "",
                      f"*{sup['reference']}*", ""]
        for rang, it in enumerate(items):
            # Un item qui imprime une figure doit tenir d'un bloc : sans cela, le
            # compositeur sépare l'énoncé de sa figure, et le candidat lit « la droite
            # tracée ci-dessous » au bas d'une page dont la droite est absente. \filbreak
            # encadre l'item et interdit la coupure. Celui qui renvoie à une figure déjà
            # montrée — « Voir … ci-dessus » — n'a rien à protéger : l'encadrer le
            # laissait seul sur sa page.
            groupe = any(isinstance(x, dict) and x.get("type") in ("tableau", "figure")
                         and x.get("code") not in vus_bloc
                         for x in it.get("supports", []))
            if groupe:
                L += ["\\filbreak", ""]
            L += [f"**{it['item_id']}** · {it['score_max']} pt"
                  + ("s" if it["score_max"] > 1 else "")
                  + f" · {minutes(it['duree_min'])} min", "",
                  it["enonce"], ""]
            for sup in it.get("supports", []):
                if isinstance(sup, dict) and sup.get("code") in vus_bloc:
                    L += [f"*Voir « {sup['titre']} » ci-dessus.*", ""]
                    continue
                if isinstance(sup, dict) and sup.get("type") == "tableau":
                    vus_bloc.add(sup["code"])
                    L += rendre_tableau(sup)
                elif isinstance(sup, dict) and sup.get("type") == "figure":
                    vus_bloc.add(sup["code"])
                    L += rendre_figure(sup, c["figures"] / f"{sup['code']}.pdf")
                else:
                    L += [f"> {sup}", ""]
            if it["type"] == "A":
                for lettre, texte in sorted(it["propositions"].items()):
                    L.append(f"- ☐ **{lettre}.** {texte}")
                L.append("")
            elif it["type"] == "B":
                L += ["Réponse : " + ZONE_ECRITURE, "", ZONE_ECRITURE, ""]
            else:
                L += ["*Composez cette réponse sur le cahier de composition, "
                      f"en indiquant l'identifiant {it['item_id']}.*", ""]
            if groupe or (texte_du_bloc and rang == 0):
                L += ["\\filbreak", ""]
    return "\n".join(L).rstrip() + "\n"


# ─────────────────────────────────────────────── clé et grilles correcteur

def lignes_code_erreur(code: str, x: dict) -> list[str]:
    """Un code d'erreur : l'identifiant et son libellé d'abord, la description dessous.

    Les trois tenus sur une seule ligne débordaient de la justification : l'identifiant
    est en chasse fixe et ne se coupe pas, le libellé est long, et l'espace insécable qui
    précède le deux-points français ôtait le dernier point de coupure. Le correcteur y
    gagne aussi : il cherche un code, il le trouve en tête de ligne.
    """
    return [f"- `{code}` — **{x['libelle']}**", "",
            f"  {x['description_observable']}", ""]


def cle_correcteur(c: dict) -> str:
    conv, asm = c["conv"], c["asm"]
    L = entete(c, "clé et grilles — document correcteur") + avertissement(c)
    L += ["> Document réservé aux correcteurs habilités. Il n'est jamais imprimé avec le sujet.", "",
          "## Consignes d'harmonisation", "",
          "- Les items de type A sont recalculés depuis la réponse brute saisie.",
          "- Pour un item de type B, choisir un code d'erreur dans la liste fermée de l'item. "
          "Ne rédiger aucun commentaire.",
          "- Pour un item de type C, noter chaque critère de 0 à 3. Ne jamais saisir de total : "
          "il est calculé.",
          "- Double lecture : un second correcteur note une copie sur cinq sur les items de type C. "
          "Un écart supérieur à 2 points sur un critère déclenche une réunion d'harmonisation "
          "avant diffusion.", ""]

    for bloc, items, _ in c["blocs"]:
        L += [f"## Bloc {bloc} · {intitule_bloc(c, bloc)}", ""]
        for it in items:
            comp = c["comps"][it["competence"]]
            # Un corrigé se lit item par item : l'identifiant, la compétence et le barème
            # ne doivent pas rester seuls au bas d'une page dont la clé commence ailleurs.
            # \\needspace réserve la place de cet en-tête et passe à la page suivante si
            # elle manque. \\filbreak ne convenait pas ici : son \\vfil chasse tout ce qui
            # suit et laissait des pages à deux lignes au milieu du corrigé.
            L += ["\\needspace{8\\baselineskip}", "", f"### {it['item_id']}", "",
                  f"- Compétence : {it['competence']} — {comp['intitule']}",
                  f"- Niveau {it['niveau']} · palier {it['palier']} ({conv['paliers'][it['palier']]})",
                  f"- Type {it['type']} · {it['score_max']} point"
                  + ("s" if it["score_max"] > 1 else ""), ""]
            if it["type"] == "A":
                L += [f"**Réponse exacte : {it['cle']['reponse']}**", "", "Distracteurs :", ""]
                L += [f"- **{k}** — {v}" for k, v in sorted(it["cle"]["distracteurs"].items())]
                L.append("")
            elif it["type"] == "B":
                cle = it["cle"]
                L += [f"**2 points** — {cle['reponse_2pts']}", ""]
                if cle["reponses_1pt"]:
                    L += ["**1 point** — réponses acceptées :", ""]
                    L += [f"- {r}" for r in cle["reponses_1pt"]]
                    L.append("")
                L += ["**0 point** — toute réponse non listée ci-dessus.", "",
                      "Codes d'erreur autorisés pour cet item :", ""]
                for code in cle["codes_erreur"]:
                    L += lignes_code_erreur(code, c["codes"][code])
                L.append("")
            else:
                L += ["Total calculé depuis les critères ; ne rien saisir dans une case « total ».", ""]
                # Ce que le support permet réellement d'attendre. Sans cela, un correcteur
                # applique une grille de niveaux à une copie sans savoir ce que le texte
                # offre, et deux correcteurs ne notent pas la même chose.
                if it.get("elements_attendus"):
                    L += ["**Éléments que le texte permet d'attendre.** Ils ne forment pas "
                          "une réponse type : ils disent ce qu'une copie peut légitimement "
                          "mobiliser, et bornent l'exigence.", ""]
                    L += [f"- {x}" for x in it["elements_attendus"]]
                    L.append("")
                for cr in it["grille"]:
                    L += [f"**Critère {cr['code']} — {cr['intitule']}**", "",
                          "| Niveau | Descripteur |", "|---|---|"]
                    for n in ("0", "1", "2", "3"):
                        L.append(f"| {n} | {cr['descripteurs'][n]} |")
                    L.append("")
                # Les copies qui tombent entre deux niveaux sont celles qui font diverger
                # deux correcteurs : le corrigé dit lesquelles le texte rend probables, et
                # où elles se placent.
                if it.get("reponses_partielles"):
                    L += ["**Réponses partiellement exactes, et où les placer**", ""]
                    L += [f"- {x}" for x in it["reponses_partielles"]]
                    L.append("")
                if it.get("codes_erreur"):
                    L += ["Codes d'erreur autorisés pour cet item :", ""]
                    for code in it["codes_erreur"]:
                        L += lignes_code_erreur(code, c["codes"][code])
                    L.append("")
    return "\n".join(L).rstrip() + "\n"


# ────────────────────────────────────────────────────────── feuille de réponses

def feuille_reponses(c: dict) -> str:
    conv, asm = c["conv"], c["asm"]
    L = [f"# {md(asm['instrument'])} · {md(asm['version'])} — feuille de réponses", "",
         "- Code candidat (jamais le nom) : `. . . . . . . . . . . . . . .`",
         f"- Instrument : **{md(asm['instrument'])}/{md(asm['version'])}** — "
         f"version de banque {c['banque']['version']}",
         "- Date de passation : `. . . . / . . . . / . . . . . . . .`",
         "- Code correcteur : `. . . . . . . . . . . . .`", ""]

    b0 = asm.get("bloc_0")
    if b0:
        L += [f"## Bloc 0 · {intitule_bloc(c, '0')}", ""] \
            + lignes_bloc_0(b0, conv, asm["instrument"])

    for bloc, items, _ in c["blocs"]:
        L += [f"## Bloc {bloc}", "", "| Item | Réponse | Score |", "|---|---|---|"]
        for it in items:
            if it["type"] == "A":
                zone = " ".join(f"☐ {l}" for l in sorted(it["propositions"]))
            elif it["type"] == "B":
                zone = ZONE_ECRITURE
            else:
                zone = "→ cahier de composition"
            L.append(f"| {it['item_id']} | {zone} | ___ / {it['score_max']} |")
            if it["type"] == "C":
                for cr in it["grille"]:
                    L.append(f"| &nbsp;&nbsp;↳ {cr['code']} | {cr['intitule']} | ___ / 3 |")
        L.append("")
    L += ["*Le total des items de type C est calculé, jamais reporté à la main.*", ""]
    return "\n".join(L).rstrip() + "\n"


# ─────────────────────────────────────────────────────── CSV de saisie vierge

def saisie_vierge(c: dict) -> str:
    colonnes = [x["colonne"] for x in c["refs"]["catalogue"]["conventions"]["format_saisie"]]
    instrument = f"{c['asm']['instrument']}/{c['asm']['version']} v{c['banque']['version']}"
    tampon = io.StringIO(newline="")
    w = csv.DictWriter(tampon, fieldnames=colonnes, lineterminator="\n")
    w.writeheader()
    b0 = c["asm"].get("bloc_0")
    if b0:
        # Une ligne par domaine : la colonne score reste vide, le bloc 0 ne compte pas
        # dans les résultats (§ 5.4 et convention lignes_bloc_0 du catalogue).
        for d in b0["domaines"]:
            ligne = {k: "" for k in colonnes}
            ligne.update({"instrument": instrument,
                          "item_id": identifiant_bloc_0(c["asm"]["instrument"],
                                                        d["competence"], c["conv"])})
            w.writerow(ligne)
    for _, items, _ in c["blocs"]:
        for it in items:
            lignes = ([{"criterion": cr["code"]} for cr in it["grille"]]
                      if it["type"] == "C" else [{"criterion": ""}])
            for extra in lignes:
                ligne = {k: "" for k in colonnes}
                ligne.update({"instrument": instrument, "item_id": it["item_id"]}, **extra)
                w.writerow(ligne)
    return tampon.getvalue()


# ─────────────────────────────────────────────────────────────── génération

# Rendus dont une page est rasterisée pour inspection visuelle : ceux que le candidat reçoit.
RENDUS_CANDIDAT = ("sujet_candidat", "feuille_reponses")

RENDUS = {
    "sujet_candidat": (sujet_candidat, "md"),
    "cle_et_grilles_correcteur": (cle_correcteur, "md"),
    "feuille_reponses": (feuille_reponses, "md"),
    "saisie_vierge": (saisie_vierge, "csv"),
}


def grille_coach(d: dict, refs: dict) -> str:
    cat = next(i for i in refs["catalogue"]["instruments"]
               if i["code"] == d["instrument"] and i["version"] == d["version"])
    L = [f"# {md(d['instrument'])} · {md(d['version'])} — {d['titre']}", "",
         f"- Instrument : **{md(d['instrument'])} / {md(d['version'])}**",
         f"- Durée de l'entretien : **{cat['duree_cible_min']} min**",
         f"- Profils concernés : {', '.join(cat['profils'])}",
         f"- Support : {refs['catalogue']['conventions']['supports'][cat['support']]}", "",
         f"> {d['avertissement']}", "",
         "- Code candidat (jamais le nom) : `. . . . . . . . . . . . . . .`",
         "- Date de passation : `. . . . / . . . . / . . . . . . . .`",
         "- Code coach : `. . . . . . . . . . . . .`", "",
         "## Déroulé de la passation", ""]
    for p in d["deroule"]:
        L += [f"**{p['phase']} — {p['duree_min']} min**", "",
              f"> « {p['consigne_prononcee']} »", ""]
    # L'extrait et la question de grammaire n'étaient imprimés nulle part : le coach
    # devait remettre au candidat un texte que le document ne portait pas. Les voici,
    # avant la grille, puisque c'est dans cet ordre que l'entretien se déroule.
    for sup in d.get("supports", []):
        L += ["---", "", f"## {sup['titre']}", ""]
        if sup.get("forme") == "vers":
            # Un bloc de lignes de pandoc : chaque vers garde sa ligne, et le nom du
            # locuteur la sienne. Un paragraphe ordinaire les recollerait en prose.
            for r in sup["repliques"]:
                L.append(f"| **{md(r['locuteur'])}**")
                L += [f"| {md(v)}" for v in r["vers"]]
                L.append("|")
            L += ["", f"*{md(sup['reference'])}*", ""]
        else:
            L += [sup["texte"], "", f"*{md(sup['reference'])}*", ""]
    q = d.get("question_grammaire")
    if q:
        L += ["---", "", "## Question de grammaire", "",
              f"*Phrase désignée au candidat : {md(q['reperage'])}.*", "",
              f"> {md(q['phrase'])}", "",
              f"**{md(q['question'])}**", ""]
    L += ["## Consignes au correcteur", ""]
    L += [f"- {x}" for x in d["consignes_correcteur"]]
    L += ["", "## Grille", ""]
    for cr in d["criteres"]:
        L += [f"### {cr['code']} — {cr['intitule']}", "",
              f"*Compétence alimentée : {cr['competence']}*", ""]
        # Une liste plutôt qu'un tableau : les descripteurs sont longs par construction,
        # une colonne les comprimerait au point de les rendre pénibles à lire en entretien.
        for n in ("0", "1", "2", "3"):
            L.append(f"- ☐ **{n}** — {cr['descripteurs'][n]}")
        L += ["", "Score du critère : ___ / 3", ""]
    if q:
        L += ["---", "", "## Question de grammaire — analyse attendue *(correcteur)*", "",
              f"*{md(q['programme'])}*", "",
              md(q["analyse_attendue"]), "", "**Critères de réussite**", ""]
        L += [f"- {md(x)}" for x in q["criteres_de_reussite"]]
        L += ["", "**Réponses partiellement exactes**", ""]
        L += [f"- {md(x)}" for x in q["reponses_partielles"]]
        L += ["", f"**Vigilance.** {md(q['vigilance'])}", ""]
    L += ["*Le total est calculé depuis les critères, jamais reporté à la main.*", ""]
    return "\n".join(L).rstrip() + "\n"


def saisie_grille_coach(d: dict, refs: dict) -> str:
    colonnes = [x["colonne"] for x in refs["catalogue"]["conventions"]["format_saisie"]]
    tampon = io.StringIO(newline="")
    w = csv.DictWriter(tampon, fieldnames=colonnes, lineterminator="\n")
    w.writeheader()
    for cr in d["criteres"]:
        ligne = {k: "" for k in colonnes}
        ligne.update({"instrument": f"{d['instrument']}/{d['version']}",
                      "item_id": f"{d['instrument']}-GRILLE", "criterion": cr["code"]})
        w.writerow(ligne)
    return tampon.getvalue()


def formulaire(d: dict, refs: dict) -> str:
    cat = next(i for i in refs["catalogue"]["instruments"]
               if i["code"] == d["instrument"] and i["version"] == d["version"])
    est_qp = d["instrument"] == "QP"
    L = [f"# {md(d['instrument'])} · {md(d['version'])} — {d['titre']}", "",
         f"- Instrument : **{md(d['instrument'])} / {md(d['version'])}**",
         f"- Durée indicative : **{cat['duree_cible_min']} min**",
         f"- Profils concernés : {', '.join(cat['profils'])}", "",
         f"> {d['avertissement']}", "",
         f"> {d['saisie']['note_papier']}", "",
         "- Code candidat (jamais le nom) : `. . . . . . . . . . . . . . .`",
         "- Date : `. . . . / . . . . / . . . . . . . .`", "",
         d["consigne_liminaire"], ""]
    echelle = refs["competences"]["conventions"]["echelle_bloc_0"]
    # Une section conditionnelle doit se voir sur le papier, et pas seulement dans la
    # logique de la plateforme : un candidat qui remplit le formulaire de secours doit
    # savoir qu'il peut sauter le bloc entier, sans quoi il répondra à l'article 3 sans
    # le solliciter — exactement ce que la section conditionnelle évite en ligne.
    sections = {x["code"]: x for x in d.get("sections", [])}
    section_ouverte = None
    for q in d["questions"]:
        section = sections.get(q.get("section"))
        if section and section["code"] != section_ouverte:
            section_ouverte = section["code"]
            L += ["---", "", f"## {section['titre']}", "",
                  f"> **Cette section ne vous concerne que {section['condition_lisible']}.** "
                  + section["consigne"]
                  + f" Fondement : {section['fondement']}.", ""]
        titre = f"**{q['id']}** · {q['libelle']}"
        if q.get("condition"):
            titre += f"  *(si {q['condition']})*"
        # La condition n'est rappelée sur la question que si elle est plus étroite que
        # celle de sa section : la répéter à l'identique sous chaque question alourdirait
        # le formulaire sans rien apprendre.
        if q.get("condition_lisible") and (not section
                                           or q["conditionnelle"] != section["conditionnelle"]):
            titre += f"  *({q['condition_lisible']})*"
        if q.get("repete_pour"):
            titre += f"  *(une réponse par élément de « {q['repete_pour']} »)*"
        L += [titre, ""]
        if q["type"] in ("choix_unique", "choix_multiple"):
            for o in q["options"]:
                L.append(f"- ☐ {o['libelle']}")
            if q["type"] == "choix_multiple":
                L.append(f"  *(de {q['min_choix']} à {q['max_choix']} réponses)*")
        elif q["type"] == "entier":
            L.append(f"- `. . . . .` {q.get('unite', '')} "
                     f"*(entre {q['min']} et {q['max']})*")
        elif q["type"] == "echelle_1_4":
            for axe in q.get("axes", ["Votre estimation"]):
                L += [f"- {axe} : " + "  ".join(f"☐ {n}" for n in echelle)]
        else:
            L += [ZONE_ECRITURE, "", f"*({q['max_caracteres']} caractères au plus)*"]
        L.append("")
    if not est_qp:
        L += ["---", "", "## Dépouillement — réservé au coach", "",
              d["calcul"]["methode"], "",
              f"Les seuils et les recommandations d'outillage sont dans "
              f"`{d['calcul']['reference']}`. Ils ne figurent pas sur ce formulaire.", ""]
    return "\n".join(L).rstrip() + "\n"


def variables_formulaire(d: dict, refs: dict) -> str:
    """CSV des variables renseignées, une ligne par question."""
    est_qp = d["instrument"] == "QP"
    colonnes = ["question_id", "cible", "type", "obligatoire", "section_bilan" if est_qp else "dimension"]
    variables = {v["code"]: v for v in refs["variables_qp"]["variables"]}
    tampon = io.StringIO(newline="")
    w = csv.DictWriter(tampon, fieldnames=colonnes, lineterminator="\n")
    w.writeheader()
    for q in d["questions"]:
        cible = q.get("cible") or q.get("cible_dimension")
        ligne = {"question_id": q["id"], "cible": cible, "type": q["type"],
                 "obligatoire": "oui" if q.get("obligatoire", True) else "non"}
        ligne[colonnes[-1]] = (variables.get(cible, {}).get("section_bilan", "") if est_qp
                               else cible)
        w.writerow(ligne)
    return tampon.getvalue()


#: Espace insécable. La ponctuation double française ne se sépare pas de son mot : sans
#: cela, le compositeur renvoie le point d'interrogation en tête de ligne suivante, et le
#: candidat lit « si vous ne les lui baillez » puis, une ligne plus bas, « ? ».
INSECABLE = "\u00a0"
#: Ponctuations qui appellent une espace insécable avant elles, et après « pour l'ouvrante.
_AVANT = re.compile(r"[ \t]+([;:!?»])")
_APRES = re.compile(r"(«)[ \t]+")


def espaces_francaises(texte: str) -> str:
    """Rend l'espace française insécable devant ; : ! ? » et après «.

    Appliqué au rendu, jamais à la donnée : le texte transcrit garde l'espace de sa
    source, et l'empreinte du support ne bouge pas — la normalisation ramène toute espace
    à une espace simple.
    """
    lignes = []
    for l in texte.split("\n"):
        if l.startswith("\\"):            # ligne de commande LaTeX : on n'y touche pas
            lignes.append(l)
            continue
        lignes.append(_APRES.sub(r"\1" + INSECABLE, _AVANT.sub(INSECABLE + r"\1", l)))
    return "\n".join(lignes)


def construire_formulaire(dossier: Path, pdf: bool = False) -> list[Path]:
    local = dossier / "referentiels"
    refs = VI.charger_referentiels(local if local.exists() else None)
    d = VR.charger(dossier / "formulaire.json")
    sortie = dossier / "build"
    sortie.mkdir(exist_ok=True)
    prefixe = f"{d['instrument']}_{d['version']}"
    ecrits = []
    p = sortie / f"{prefixe}_formulaire_secours.md"
    p.write_text(espaces_francaises(formulaire(d, refs)), encoding="utf-8",
             newline="\n")
    ecrits.append(p)
    c = sortie / f"{prefixe}_variables.csv"
    c.write_text(variables_formulaire(d, refs), encoding="utf-8", newline="\n")
    ecrits.append(c)
    if pdf:
        cible = vers_pdf(p)
        ecrits.append(cible)
        ecrits += apercus(cible, sortie / "preview")
    return ecrits


def construire_grille_coach(dossier: Path, fichier_def: Path | None = None, pdf: bool = False) -> list[Path]:
    local = dossier / "referentiels"
    refs = VI.charger_referentiels(local if local.exists() else None)
    d = VR.charger(fichier_def or (dossier / "definition.json"))
    sortie = dossier / "build"
    sortie.mkdir(exist_ok=True)
    prefixe = f"{d['instrument']}_{d['version']}"
    ecrits = []
    p = sortie / f"{prefixe}_grille_coach.md"
    p.write_text(espaces_francaises(grille_coach(d, refs)), encoding="utf-8",
             newline="\n")
    ecrits.append(p)
    c = sortie / f"{prefixe}_saisie_vierge.csv"
    c.write_text(saisie_grille_coach(d, refs), encoding="utf-8", newline="\n")
    ecrits.append(c)
    if pdf:
        cible = vers_pdf(p)
        ecrits.append(cible)
        ecrits += apercus(cible, sortie / "preview")
    return ecrits


def construire(dossier: Path, version: str, pdf: bool = False) -> list[Path]:
    c = contexte(dossier, version)
    sortie = dossier / "build"
    sortie.mkdir(exist_ok=True)
    prefixe = f"{c['asm']['instrument']}_{version}"
    ecrits = []
    for nom, (fn, ext) in RENDUS.items():
        p = sortie / f"{prefixe}_{nom}.{ext}"
        rendu = fn(c)
        p.write_text(espaces_francaises(rendu) if ext == "md" else rendu,
                     encoding="utf-8", newline="\n")
        ecrits.append(p)
        if pdf and ext == "md":
            cible = vers_pdf(p)
            ecrits.append(cible)
            if nom in RENDUS_CANDIDAT:
                ecrits += apercus(cible, sortie / "preview")
    return ecrits


MOTIF_ID_PDF = re.compile(
    rb"/ID\s*\[\s*<[0-9A-Fa-f]{32}>\s*<[0-9A-Fa-f]{32}>\s*\]")

# DejaVu Sans est la seule des polices installées à couvrir U+2610 (case à cocher),
# employée par le bloc 0, les items de type A et la feuille de réponses.
POLICES = ["-V", "mainfont=DejaVu Sans", "-V", "monofont=DejaVu Sans Mono"]

#: Préambule commun à tous les rendus.
#:
#: `needspace` réserve la place d'un en-tête d'item en bas de page (voir cle_correcteur).
#:
#: `polyglossia` en français n'est pas un ornement : sans lui, le compositeur applique au
#: texte français les règles de coupure de l'anglais. Un mot précédé d'une apostrophe ne
#: se coupait pas du tout — « l'intersection » sortait de la justification de onze points
#: dans le corrigé de MATH-EA —, « algébrique » passait à la ligne entier, et les espaces
#: de la ponctuation double n'étaient pas celles du français. Les documents sont remis à
#: des candidats français : ils doivent être composés en français.
PREAMBULE = (r"\usepackage{needspace}"
             r"\usepackage{polyglossia}\setmainlanguage{french}")


def vers_pdf(source: Path) -> Path:
    """PDF via pandoc et xelatex, rendu reproductible.

    SOURCE_DATE_EPOCH et FORCE_SOURCE_DATE neutralisent l'horodatage. Reste l'identifiant
    /ID, qu'xdvipdfmx tire au hasard à chaque exécution ; il est remplacé par une empreinte
    du Markdown source, de longueur identique, ce qui laisse les tables de références
    croisées intactes. Le remplacement est vérifié : s'il n'a pas lieu, le build échoue,
    car un PDF au /ID aléatoire n'est pas reproductible.
    """
    cible = source.with_suffix(".pdf")
    # HOME isolé par appel : xelatex y écrit ses fichiers auxiliaires, et deux compilations
    # concurrentes qui les partagent se gênent — c'est ce qui rendait le test de
    # déterminisme intermittent lorsque la suite complète s'exécutait.
    with tempfile.TemporaryDirectory(prefix="build-instrument-") as foyer:
        r = subprocess.run(
            ["pandoc", str(source), "-o", str(cible), "--pdf-engine=xelatex",
             f"--resource-path={source.parent}",
             "-V", "papersize=a4", "-V", "geometry:margin=2cm", *POLICES,
             "-V", "colorlinks=false", "-V", f"header-includes={PREAMBULE}"],
            check=True, capture_output=True, text=True,
            env={"PATH": "/usr/bin:/bin", "SOURCE_DATE_EPOCH": "0",
                 "FORCE_SOURCE_DATE": "1", "TZ": "UTC", "HOME": foyer})
    # Un glyphe absent de la police disparaît du PDF sans erreur : une case à cocher
    # manquante rendrait la feuille inutilisable. On refuse le rendu.
    manquants = sorted(set(re.findall(r"Missing character: There is no (\S+)", r.stderr)))
    if manquants:
        raise RuntimeError(f"{source.name} : caractère(s) absent(s) de la police — "
                           f"{' '.join(manquants)}")
    # xdvipdfmx range parfois le trailer dans un flux compressé, et /ID n'apparaît alors
    # pas en clair : le patch échouait au hasard, ce qui rendait le rendu non reproductible
    # une fois sur trois. qpdf désactive les flux d'objets, ce qui met le trailer en clair
    # à chaque fois.
    ouvert = cible.with_suffix(".ouvert.pdf")
    subprocess.run(["qpdf", "--object-streams=disable", "--", str(cible), str(ouvert)],
                   check=True, capture_output=True)
    ouvert.replace(cible)

    empreinte = hashlib.sha256(source.read_bytes()).hexdigest()[:32].encode()
    octets = cible.read_bytes()
    fige, n = MOTIF_ID_PDF.subn(b"/ID [<" + empreinte + b"><" + empreinte + b">]", octets)
    if n != 1:
        # Sans identifiant figé, deux rendus du même contenu diffèrent : le build doit
        # échouer plutôt que livrer un PDF non reproductible.
        raise RuntimeError(f"{cible.name} : identifiant /ID introuvable ou multiple "
                           f"({n} occurrence(s)) — le rendu ne serait pas reproductible")
    cible.write_bytes(fige)
    preflight_pdf(source, cible)
    return cible


def preflight_pdf(source: Path, pdf: Path) -> None:
    r"""Le texte extrait du PDF ne doit contenir aucun nom de commande LaTeX de la source.

    Une commande qui s'imprime est une commande qui n'a pas été interprétée. Le défaut
    est invisible partout ailleurs : le fichier JSON écrit déjà toute barre oblique
    doublée, et le Markdown n'interprète pas les commandes. Il ne se voit qu'ici. Le
    sujet de spécialité remis le 2026-09-11 imprimait « times », « mathbb » et « div ».

    Deux familles sont hors du préflight, déclarées au catalogue : les noms de commande
    qui sont aussi des mots français — « le », « ne », « bar » —, et les opérateurs qui
    composent leur propre nom en romain, « \cos » donnant « cos ». Les chercher dans le
    texte extrait signalerait un défaut là où le rendu est correct. Le contrôle de source,
    qui lit la chaîne décodée et non le PDF, les couvre tous.
    """
    conv = VR.charger(RACINE / "referentiels" / "catalogue_instruments.json")[
        "conventions"].get("preflight_rendu")
    if not conv:
        return
    commandes = {m for m in re.findall(r"\\([a-zA-Z]+)", source.read_text(encoding="utf-8"))}
    commandes -= set(conv["homographes_admis"]) | set(conv["operateurs_nommes"])
    if not commandes:
        return
    r = subprocess.run([conv["outil"], str(pdf), "-"], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{pdf.name} : préflight impossible, {conv['outil']} a échoué")
    imprimes = sorted(c for c in commandes
                      if re.search(rf"(?<![A-Za-zÀ-ÿ]){re.escape(c)}(?![A-Za-zÀ-ÿ])",
                                   r.stdout))
    if imprimes:
        raise RuntimeError(
            f"{pdf.name} : commande(s) LaTeX imprimée(s) en toutes lettres — "
            f"{' '.join(imprimes)}. La source porte un double échappement, ou la "
            f"commande n'est pas dans un groupe mathématique.")


def empreintes(dossier: Path) -> dict[str, str]:
    return {str(p.relative_to(dossier)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(dossier.rglob("*")) if p.is_file()}


def apercus(pdf: Path, dossier: Path, pages: int = 1) -> list[Path]:
    """Rasterise les premières pages : un hash prouve la reproductibilité, pas la lisibilité.

    Ces images sont un artefact de build, hors dépôt, destiné à être regardé avant
    chaque livraison — c'est ainsi qu'ont été trouvés les QCM sans propositions.
    """
    dossier.mkdir(parents=True, exist_ok=True)
    prefixe = dossier / pdf.stem
    subprocess.run(["pdftoppm", "-r", "100", "-png", "-f", "1", "-l", str(pages),
                    str(pdf), str(prefixe)], check=True, capture_output=True)
    return sorted(dossier.glob(f"{pdf.stem}-*.png"))


def verifier_determinisme(dossier: Path, versions: list[str], pdf: bool) -> int:
    """Construit deux fois et compare. Archive les divergences pour les rendre analysables."""
    sortie = dossier / "build"
    passes = []
    for _ in range(2):
        if sortie.exists():
            shutil.rmtree(sortie)
        if (dossier / "formulaire.json").exists():
            construire_formulaire(dossier, pdf)
        elif sorted(dossier.glob("definition_*.json")):
            for fdef in sorted(dossier.glob("definition_*.json")):
                construire_grille_coach(dossier, fdef, pdf)
        elif (dossier / "definition.json").exists():
            construire_grille_coach(dossier, None, pdf)
        else:
            for v in versions:
                construire(dossier, v, pdf)
        emp = empreintes(sortie)
        passes.append((emp, {p: (sortie / p).read_bytes() for p in emp}))
    a, b = passes[0][0], passes[1][0]
    divergents = sorted({k for k in set(a) | set(b) if a.get(k) != b.get(k)})
    if not divergents:
        print(f"  déterminisme vérifié : {len(a)} fichiers identiques sur deux exécutions")
        return 0
    archive = sortie / "divergences"
    archive.mkdir(parents=True, exist_ok=True)
    print(f"  DIVERGENCE sur {len(divergents)} fichier(s) :")
    for nom in divergents:
        base = Path(nom).name
        for i, (_, contenu) in enumerate(passes, 1):
            if nom not in contenu:
                continue
            brut = archive / f"{base}.passe{i}"
            brut.write_bytes(contenu[nom])
            if base.endswith(".pdf"):
                # qpdf --qdf rend le PDF lisible ligne à ligne, donc diffable
                subprocess.run(["qpdf", "--qdf", "--object-streams=disable",
                                str(brut), str(archive / f"{base}.passe{i}.qdf.pdf")],
                               capture_output=True)
        print(f"    {nom}\n      {a.get(nom, '(absent)')[:16]} / {b.get(nom, '(absent)')[:16]}")
    print(f"  copies et versions qdf archivées dans {archive}")
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("dossier")
    ap.add_argument("versions", nargs="*")
    ap.add_argument("--pdf", action="store_true", help="générer aussi les PDF")
    ap.add_argument("--check-determinisme", action="store_true",
                    help="construire deux fois et comparer ; archive les divergences")
    a = ap.parse_args()

    d = Path(a.dossier)
    if (d / "formulaire.json").exists():
        if a.check_determinisme:
            return verifier_determinisme(d, [], a.pdf)
        for p in construire_formulaire(d, a.pdf):
            print(f"  {p}")
        return 0
    if sorted(d.glob("definition_*.json")):
        defs = sorted(d.glob("definition_*.json"))
        if a.versions:
            defs = [f for f in defs if any(f.name == f"definition_{v}.json" for v in a.versions)]
        if a.check_determinisme:
            return verifier_determinisme(d, [], a.pdf)
        for fdef in defs:
            for p in construire_grille_coach(d, fdef, a.pdf):
                print(f"  {p}")
        return 0
    if (d / "definition.json").exists():
        if a.check_determinisme:
            return verifier_determinisme(d, [], a.pdf)
        for p in construire_grille_coach(d, None, a.pdf):
            print(f"  {p}")
        return 0
    versions = a.versions or sorted(p.stem for p in (d / "assemblages").glob("*.json"))
    if a.check_determinisme:
        return verifier_determinisme(d, versions, a.pdf)
    for v in versions:
        for p in construire(d, v, a.pdf):
            print(f"  {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

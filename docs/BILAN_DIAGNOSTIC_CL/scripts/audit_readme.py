#!/usr/bin/env python3
"""Audit du README d'état : l'état courant ne peut plus contredire le dépôt.

Les blocs calculés du § 1 bis empêchaient leur propre dérive, mais le reste du document
continuait d'affirmer des effectifs recopiés à la main, de nommer un instrument retiré, de
présenter comme ouverte une question tranchée, et d'annoncer une œuvre qui relève d'une
autre session. Ce script relit le document et refuse ces six familles d'incohérence.

Le document est coupé en deux par des marqueurs : l'**état courant**, qui doit être vrai
aujourd'hui, et l'**historique des décisions**, où une phrase datée peut légitimement citer
un nom retiré ou une valeur ancienne. Seul l'état courant est audité.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import diffusabilite as DIF  # noqa: E402

DEBUT_HISTORIQUE = "<!-- HISTORIQUE début : phrases datées, citées comme telles -->"
FIN_HISTORIQUE = "<!-- HISTORIQUE fin -->"

#: Formulations qui replacent le Cahier au-dessus des textes réglementaires.
ABSOLUTISMES = [
    r"[Ll]e Cahier fait foi",
    r"tranchée? en faveur du Cahier",
    r"le Cahier l'emporte",
    r"le Cahier prime",
]

#: Noms retirés du dépôt : légitimes dans l'historique, interdits dans l'état courant.
NOMS_RETIRES = {
    "FR-ORAL": "instrument retiré par Q-20, remplacé par FR-EAF-ORAL",
}

#: Questions tranchées : elles ne peuvent plus figurer au registre des questions ouvertes.
QUESTIONS_CLOSES = {
    "Q-13": "tranchée à la Porte 6 — barème de conversion des tests machine",
    "Q-14": "tranchée à la Porte 5 — critères de grille rattachés à leur compétence",
    "Q-08": "tranchée aux Portes 4 et 7 — definition.json pour les instruments sans items",
    "Q-19": "tranchée — configurations du français",
    "Q-20": "tranchée — FR-EAF-ORAL remplace FR-ORAL",
    "Q-21": "tranchée — trois assemblages FR-EAF",
    "Q-22": "tranchée — FR-MAI conservé, groupe de planification",
    "Q-23": "close sans arbitrage — couverture P1 produite",
    "Q-25": "tranchée — le séquencement descend du plan",
}


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def normaliser(texte: str) -> str:
    """Le texte réel, débarrassé de l'emphase Markdown.

    « **seize instruments** » ne se lit pas « seize instruments » pour une expression
    régulière naïve : les astérisques s'intercalent. Une affirmation mise en gras échappait
    donc à tous les contrôles sémantiques — et c'est exactement sous cette forme que le
    périmètre périmé a survécu à l'audit précédent. Les backticks sont conservés : ils
    désignent un chemin ou un identifiant, pas une emphase.
    """
    texte = re.sub(r"\*\*(.+?)\*\*", r"\1", texte, flags=re.S)
    texte = re.sub(r"__(.+?)__", r"\1", texte, flags=re.S)
    texte = re.sub(r"(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])", r"\1", texte)
    return texte


def etat_courant(texte: str) -> str:
    i, j = texte.find(DEBUT_HISTORIQUE), texte.find(FIN_HISTORIQUE)
    if i < 0 or j < 0:
        raise SystemExit("marqueurs d'historique absents du README")
    return normaliser(texte[:i] + texte[j + len(FIN_HISTORIQUE):])


def effectifs_attendus() -> dict:
    ref = charger(RACINE / "referentiels" / "competences.json")
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    err = charger(RACINE / "referentiels" / "codes_erreur.json")
    tb = charger(RACINE / "referentiels" / "termes_bloquants.json")
    var = charger(RACINE / "referentiels" / "variables_qp.json")
    comps = [c for p in ref["perimetres"] for c in p["competences"]]
    return {
        r"(\d+)\s+compétences": len(comps),
        r"(\d+)\s+chapitres": sum(len(c["chapitres"]) for c in comps),
        r"(\d+)\s+périmètres": len(ref["perimetres"]),
        r"(?<!≥ )(\d+)\s+codes\b(?!\s+d'items)(?!\s+par)": len(err["codes"]),
        r"(\d+)\s+expressions": len(tb["expressions"]),
        r"(\d+)\s+variables": len(var["variables"]),
        r"(\d+)\s+enregistrements": len(cat["instruments"]),
        r"(\d+)\s+écarts": len(ref["ecarts_cahier"]),
    }


def items_attendus() -> dict:
    out = {}
    for d in DIF.dossiers():
        banque = d / "banque.json"
        if banque.exists():
            out[d.name] = len(charger(banque)["items"])
    return out


def oeuvres_hors_session() -> dict:
    prog = charger(RACINE / "referentiels" / "programmes_examen.json")
    visee = next(s for s, x in prog["sessions"].items()
                 if x.get("session_visee_du_dispositif"))
    au_programme, ailleurs = set(), {}
    for session, fiche in prog["sessions"].items():
        for voie in fiche["voies"].values():
            if not isinstance(voie, dict):
                continue
            for liste in voie.values():
                if not isinstance(liste, list):
                    continue
                for x in liste:
                    (au_programme if session == visee else
                     ailleurs.setdefault(x["oeuvre"], set())).add(
                        x["oeuvre"] if session == visee else session)
    return {o: s for o, s in ailleurs.items() if o not in au_programme}, visee



#: Verbes par lesquels une phrase de l'état courant cite une décision dépassée au lieu de
#: l'affirmer. Une formulation interdite n'est tolérée qu'entre guillemets français, sur
#: une ligne qui porte l'un d'eux : c'est ainsi qu'on rappelle une décision sans la
#: remettre en vigueur.
MARQUEURS_SUPERSEDE = ("décrivait", "décrivaient", "était vrai", "étaient vrais",
                       "historique", "HISTORIQUE", "révisé", "révisée", "n'est plus",
                       "abrogé", "abrogée", "levé", "levée", "ne décrit pas l'état courant")

#: Affirmations qui ne peuvent plus décrire l'état courant. La valeur dit pourquoi.
AFFIRMATIONS_PERIMEES = {
    r"généralisation non autoris[ée]e?": "la généralisation est autorisée : GO_LIVE_READY vaut YES",
    r"soumise? à validation": "toutes les portes sont closes et la release est en service",
    r"seize instruments": "le périmètre courant est calculé au § 0, et il en compte vingt",
    r"les seize sont (?:produits|diffusables)": "le périmètre courant est calculé au § 0",
    r"36 livrets": "les effectifs de release sont calculés au § 0",
    r"1 ?027 combinaisons": "les effectifs du domaine candidat sont calculés au § 0",
    r"un PDF par profil": "03_IMPRESSION porte plusieurs catalogues opérateur par profil",
    r"aucun remote": "le dossier est versé dans le dépôt parent et poussé sur origin",
    r"HG, LV et EMC hors périmètre": "TC-HG et TC-EMC sont au périmètre depuis B9 et B10",
    r"HLP « en cours »": "EDS-HLP est diffusable",
    r"PHI et FR-MAI non diffusables": "PHI et FR-MAI sont diffusables",
}


def citation_superseded(ligne: str, expression: str) -> bool:
    """La formulation est-elle citée comme dépassée, plutôt qu'affirmée ?

    Deux conditions, et les deux ensemble : l'expression est entre guillemets français —
    donc rapportée —, et la phrase porte un verbe qui la donne pour dépassée. L'une sans
    l'autre ne suffit pas : citer sans dire que c'est révolu laisse l'affirmation debout.
    """
    bas = ligne.lower()
    if not any(v.lower() in bas for v in MARQUEURS_SUPERSEDE):
        return False
    return any(expression in g for g in re.findall(r"«([^»]*)»", ligne))


def affirmations_perimees(courant: str) -> list[str]:
    err = []
    for motif, motif_erreur in AFFIRMATIONS_PERIMEES.items():
        for m in re.finditer(motif, courant):
            debut = courant.rfind("\n", 0, m.start()) + 1
            fin = courant.find("\n", m.end())
            ligne = courant[debut:fin if fin > 0 else len(courant)]
            if citation_superseded(ligne, m.group(0)):
                continue
            err.append(f"état périmé : « {m.group(0)} » — {motif_erreur}")
    return err


def verdict_et_effectifs(courant: str) -> list[str]:
    """L'état courant ne peut pas contredire les sources canoniques du § 0."""
    import etat_depot as ED
    err = []
    e = ED.etat_courant()
    if e["GO_LIVE_READY"] == "YES":
        for motif in (r"généralisation non autoris", r"soumise? à validation"):
            if re.search(motif, courant):
                err.append(f"verdict : GO_LIVE_READY vaut YES, mais l'état courant porte "
                           f"encore une réserve de type « {motif} »")
    # Le nombre d'instruments ne peut être affirmé qu'à la valeur dérivée.
    for m in re.finditer(r"(\w+)\s+instruments?\s+métier", courant):
        mot = m.group(1)
        if mot.isdigit() and int(mot) != e["instruments"]:
            err.append(f"périmètre : « {m.group(0)} » alors que le catalogue en dérive "
                       f"{e['instruments']}")
        elif mot in NOMBRES_ECRITS and NOMBRES_ECRITS[mot] != e["instruments"]:
            err.append(f"périmètre : « {m.group(0)} » alors que le catalogue en dérive "
                       f"{e['instruments']}")
    # Les effectifs de release se lisent au manifeste, et nulle part ailleurs.
    for motif, attendu, quoi in (
            (r"(\d+)\s+livrets candidat", e["livrets_candidat"], "livrets candidat"),
            (r"(\d+)\s+corrections coach", e["corrections_coach"], "corrections coach"),
            (r"(\d+)\s+catalogues opérateur", e["catalogues_operateur"],
             "catalogues opérateur")):
        for m in re.finditer(motif, courant):
            if int(m.group(1)) != attendu:
                err.append(f"release : « {m.group(0)} » alors que le manifeste en porte "
                           f"{attendu} {quoi}")
    return err


#: Les nombres que le document écrit en toutes lettres.
NOMBRES_ECRITS = {"quinze": 15, "seize": 16, "dix-sept": 17, "dix-huit": 18,
                  "dix-neuf": 19, "vingt": 20, "vingt et un": 21, "vingt-deux": 22}


def questions_closes_ailleurs(texte: str) -> list[str]:
    """Une question tranchée ne peut pas figurer au registre des questions reportées."""
    err = []
    i = texte.find("## 8. Questions d'arbitrage reportées")
    j = texte.find("## 8 bis.")
    if i < 0 or j < 0 or j < i:
        return ["structure : les sections 8 et 8 bis sont introuvables ou inversées"]
    section = normaliser(texte[i:j])
    # Une question n'est « reportée » que si elle est *listée* comme telle : une ligne de
    # tableau. La nommer en prose pour dire qu'elle est tranchée est au contraire ce qu'on
    # attend d'un registre vidé.
    lignes_de_tableau = [l for l in section.splitlines() if l.lstrip().startswith("|")]
    for code in sorted(set(QUESTIONS_CLOSES) | {"Q-24", "Q-26"}):
        for ligne in lignes_de_tableau:
            if re.search(rf"\b{code}\b", ligne):
                err.append(f"question : {code} est tranchée mais figure encore au registre "
                           f"des questions reportées")
                break
    return err


def catalogues_operateur_pluriels() -> bool:
    """Le référentiel décrit-il plusieurs catalogues d'impression pour un même profil ?"""
    ref = RACINE / "referentiels" / "catalogues_operateur.json"
    if not ref.exists():
        return False
    d = charger(ref)
    entrees = d.get("catalogues", d if isinstance(d, list) else [])
    par_profil = {}
    for c in entrees if isinstance(entrees, list) else []:
        par_profil.setdefault(c.get("profil"), 0)
        par_profil[c.get("profil")] += 1
    return any(n > 1 for n in par_profil.values())


def auditer(texte: str) -> list[str]:
    courant = etat_courant(texte)
    err = []

    # 0 · affirmations périmées, verdict, effectifs de release et questions closes
    err += affirmations_perimees(courant)
    err += verdict_et_effectifs(courant)
    err += questions_closes_ailleurs(texte)
    if catalogues_operateur_pluriels() and "un PDF par profil" in courant:
        err.append("release : « un PDF par profil » alors que le référentiel des "
                   "catalogues opérateur en décrit plusieurs par profil")

    # 1 · hiérarchie des sources
    for motif in ABSOLUTISMES:
        for m in re.finditer(motif, courant):
            err.append(f"hiérarchie : « {m.group(0)} » — le Cahier ne l'emporte pas sur un "
                       f"texte réglementaire applicable")

    # 2 · effectifs recopiés
    for motif, attendu in effectifs_attendus().items():
        for m in re.finditer(motif, courant):
            if int(m.group(1)) != attendu:
                extrait = courant[max(0, m.start() - 40):m.end() + 20].replace("\n", " ")
                err.append(f"effectif : « {m.group(0)} » alors que le dépôt en compte "
                           f"{attendu} — … {extrait} …")

    # 3 · effectifs d'items par instrument
    for code, n in items_attendus().items():
        motif = rf"{re.escape(code)}[^|\n]{{0,80}}?(?:banque de |)(\d+)\s+items en banque"
        for m in re.finditer(motif, courant):
            if int(m.group(1)) != n:
                err.append(f"effectif : {code} annoncé à {m.group(1)} items, "
                           f"la banque en compte {n}")

    # 4 · noms retirés
    for nom, motif in NOMS_RETIRES.items():
        for m in re.finditer(rf"(?<![\w-]){re.escape(nom)}(?![\w-])", courant):
            ligne = courant[courant.rfind("\n", 0, m.start()) + 1:
                            courant.find("\n", m.end())]
            # Une mention explicitement datée du retrait est légitime : « FR-ORAL, retiré
            # par Q-20 ». Le nom nu, présenté comme un état, ne l'est pas.
            if "retiré" in ligne or "Q-20" in ligne:
                continue
            extrait = ligne[:160]
            err.append(f"nom retiré : « {nom} » dans l'état courant ({motif}) — "
                       f"… {extrait} …")

    # 5 · œuvres d'une autre session
    hors, visee = oeuvres_hors_session()
    for oeuvre, sessions in hors.items():
        for m in re.finditer(re.escape(oeuvre), courant):
            ligne = courant[courant.rfind("\n", 0, m.start()) + 1:
                            courant.find("\n", m.end())]
            if any(s in ligne for s in sessions):
                continue          # citée avec sa session : c'est une donnée réglementaire
            err.append(f"œuvre : « {oeuvre} » citée sans sa session "
                       f"({', '.join(sorted(sessions))}) alors que le dispositif vise "
                       f"la session {visee}")

    # 6 · questions closes présentées comme ouvertes
    bloc = courant.split("## 8. Questions d'arbitrage")
    if len(bloc) > 1:
        ouvertes = set(re.findall(r"\|\s*\*{0,2}(Q-\d+)\*{0,2}\s*\|",
                                  bloc[1].split("\n## ")[0]))
        for q in sorted(ouvertes & set(QUESTIONS_CLOSES)):
            err.append(f"question : {q} figure au registre des questions ouvertes alors "
                       f"qu'elle est {QUESTIONS_CLOSES[q]}")

    # 7 · attentes réglementaires périmées
    prog = charger(RACINE / "referentiels" / "programmes_examen.json")
    visee = next(s_ for s_, x in prog["sessions"].items()
                 if x.get("session_visee_du_dispositif"))
    if prog["sessions"][visee]["source"]["confiance"] == "haute":
        for m in re.finditer(r"(?<!~~)(?:œuvres[^.\n]{0,60}(?:ne sont pas vérifiables|"
                             r"à confirmer)|la direction fournira la note de service)",
                             courant):
            ligne = courant[courant.rfind("\n", 0, m.start()) + 1:
                            courant.find("\n", m.end())]
            if "Levé" in ligne or "levé" in ligne:
                continue
            err.append(f"réglementaire : « {m.group(0)[:60]} » alors que le programme de la "
                       f"session {visee} est vérifié au référentiel")

    # 8 · support désigné contredit
    d = prog["designations_oeuvres"]["FR-EAF/bloc_C"]
    for m in re.finditer(r"(?:support|bloc C)[^.\n]{0,120}", courant):
        bloc = m.group(0)
        if "Zola" in bloc and d["auteur"] not in bloc and "2028" not in bloc:
            err.append(f"désignation : « {bloc[:80]} » — l'œuvre désignée du bloc C est "
                       f"{d['auteur']}, {d['oeuvre']}")

    # 9 · périmètre d'instruments : le nombre du Cahier n'est pas le périmètre corrigé
    reels = len(DIF.dossiers())
    for m in re.finditer(r"(quinze|seize|\d+) instruments", courant):
        mot = m.group(1)
        ligne = courant[courant.rfind("\n", 0, m.start()) + 1:
                        courant.find("\n", m.end())]
        attendu = {"quinze": 15, "seize": 16}.get(mot)
        if attendu is None:
            attendu = int(mot) if mot.isdigit() else None
            if attendu is not None and attendu != reels:
                err.append(f"périmètre : « {m.group(0)} » alors que le dépôt en compte "
                           f"{reels}")
            continue
        if mot == "quinze" and "Cahier" not in ligne:
            err.append("périmètre : « quinze instruments » sans préciser qu'il s'agit du "
                       "périmètre du Cahier initial — le dépôt en compte "
                       f"{reels} depuis la création de MATH-EA (Q-24)")
        if mot == "seize" and reels != 16:
            err.append(f"périmètre : « seize instruments » alors que le dépôt en compte "
                       f"{reels}")

    # 10 · statuts d'instruments contredits par le calcul
    for code, statut in DIF.tous().items():
        if statut["diffusable"]:
            continue
        for m in re.finditer(rf"{re.escape(code)}[^|\n]{{0,60}}(terminé|diffusable)(?!s? à)",
                             courant):
            ligne = courant[courant.rfind("\n", 0, m.start()) + 1:
                            courant.find("\n", m.end())]
            if "non diffusable" in ligne or "bloqué" in ligne:
                continue
            err.append(f"statut : {code} présenté comme « {m.group(1)} » alors qu'il n'est "
                       f"pas diffusable")
    return err


def main(argv: list[str]) -> int:
    texte = (RACINE / "README_ETAT.md").read_text(encoding="utf-8")
    err = auditer(texte)
    for e in err:
        print(f"INCOHÉRENCE : {e}")
    print(f"{len(err)} incohérence(s) dans l'état courant du README.")
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

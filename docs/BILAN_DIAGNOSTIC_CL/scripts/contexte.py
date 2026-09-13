#!/usr/bin/env python3
"""Contexte réglementaire d'un candidat : trois axes, et ce qui s'en déduit.

Le dispositif n'avait qu'un champ, `session_visee`, et lui faisait porter deux décisions
différentes : quel programme d'œuvres s'applique à l'épreuve anticipée de français, et quel
programme de mathématiques s'applique à l'épreuve anticipée de mathématiques. Or les deux
ne suivent pas le même axe. En juin 2027, deux candidats composent le même jour : l'un au
titre de la session finale 2027, l'autre par anticipation au titre de la session 2028. Même
année de passation, programmes d'œuvres différents.

Trois axes, donc :

- `session_baccalaureat_finale` — commande le programme d'œuvres de l'EAF et la conservation ;
- `annee_scolaire_passation_ea` — commande le programme de mathématiques évalué (MENE2515469N) ;
- `mode_passation_ea` — `anticipation` ou `meme_session`, ce dernier étant réservé aux
  situations de l'article 3 (Q-26).

Ce module dérive le contexte, refuse de le deviner depuis le seul champ déprécié, et en
tire le statut de l'épreuve anticipée de mathématiques : le candidat ne décide pas s'il doit
la présenter, les faits le décident.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

MODES = ("anticipation", "meme_session")

#: Statuts possibles de l'épreuve anticipée de mathématiques pour un candidat donné.
STATUTS_MATH = ("a_presenter_spe", "a_presenter_specifiques", "dispensee",
                "note_conservee", "deja_presentee_valable", "sans_objet", "a_verifier")

PARCOURS = {"specialite": "a_presenter_spe", "specifiques": "a_presenter_specifiques"}


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def referentiel() -> dict:
    return charger(RACINE / "referentiels" / "programmes_examen.json")


class ContexteIncomplet(Exception):
    """Les trois axes ne sont pas tous déclarés : le contexte ne se devine pas."""


def contexte(reponses: dict) -> dict:
    """Le contexte temporel d'un candidat, à partir des trois axes déclarés.

    `session_visee` est déprécié : il peut rester dans les jeux anciens, mais il ne suffit
    pas à établir un contexte — deux candidats de même session finale peuvent avoir des
    années de passation différentes, et deux candidats de même année de passation des
    sessions finales différentes.
    """
    manquants = [a for a in ("session_baccalaureat_finale", "annee_scolaire_passation_ea",
                             "mode_passation_ea") if a not in reponses]
    if manquants:
        raise ContexteIncomplet(
            f"axes absents : {manquants} — « session_visee » ne les remplace pas")
    mode = reponses["mode_passation_ea"]
    if mode not in MODES:
        raise ValueError(f"mode de passation inconnu : {mode!r}")

    finale = int(reponses["session_baccalaureat_finale"])
    annee = reponses["annee_scolaire_passation_ea"]
    fin_annee_scolaire = int(annee.split("-")[1])
    attendu = fin_annee_scolaire + (1 if mode == "anticipation" else 0)
    coherent = finale == attendu

    ref = referentiel()
    prog_oeuvres = ref["sessions"].get(str(finale))
    prog_maths = ref["programmes_mathematiques"]["par_annee_scolaire"].get(annee)
    return {
        "session_baccalaureat_finale": finale,
        "annee_scolaire_passation_ea": annee,
        "mode_passation_ea": mode,
        "annee_civile_passation_ea": fin_annee_scolaire,
        "coherent": coherent,
        "session_attendue": attendu,
        "programme_oeuvres": prog_oeuvres,
        "programme_oeuvres_connu": prog_oeuvres is not None,
        "programme_mathematiques": prog_maths,
        "programme_mathematiques_connu": prog_maths is not None,
    }


def oeuvres_de_session(session: int) -> set:
    """Les œuvres au programme d'une session finale, voie générale."""
    fiche = referentiel()["sessions"].get(str(session))
    if fiche is None:
        return set()
    voie = fiche["voies"].get("generale", {})
    return {x["oeuvre"] for liste in voie.values() if isinstance(liste, list)
            for x in liste}


def dispense_math(faits: dict, session_finale: int) -> dict | None:
    """La dispense transitoire de l'article 17 applicable, s'il y en a une."""
    ref = referentiel()["epreuves_anticipees"]["session_2027"]["mathematiques"]
    code = faits.get("dispense_transitoire")
    if not code:
        return None
    for d in ref["dispenses_transitoires"]:
        if d["code"] != code:
            continue
        if session_finale in d.get("sessions_dispensees", []):
            return d
        # Les dispenses liées à un aménagement de scolarité valent « pour la session où
        # intervient la décision du jury » : la session n'est pas énumérable a priori.
        if "sessions_dispensees" not in d:
            return d
    return None


def statut_math_ea(faits: dict) -> dict:
    """Le statut de l'épreuve anticipée de mathématiques, dérivé des faits (J).

    Aucune question ne demande au candidat s'il « doit » la présenter : on lui demande sa
    session, son année de passation, son parcours et sa situation, et la règle conclut.
    """
    ctx = contexte(faits)
    finale = ctx["session_baccalaureat_finale"]

    if finale < 2027:
        return {"statut": "sans_objet",
                "motif": "l'épreuve anticipée de mathématiques est créée à compter de la "
                         "session 2027",
                "fondement": "arrêté du 10 juin 2025"}

    # Le droit au passage en une seule session ne se vérifie pas ici. C'est une condition
    # du profil, non de l'instrument : la contrôler dans chaque dérivation d'instrument
    # revenait à la recopier autant de fois qu'il y a d'instruments, et à n'en fermer
    # qu'un seul quand elle échoue. Le gate est en amont — `eligibilite.statut_profil`,
    # appelé une fois par `maquette_donnees.liste_effective_des_instruments_a_passer`.

    d = dispense_math(faits, finale)
    if d:
        return {"statut": "dispensee", "motif": d["situation"], "fondement": d["fondement"]}

    if faits.get("redoublement_premiere") == "oui":
        # Article 2 : le redoublant représente les épreuves anticipées, les nouvelles notes
        # remplacent les précédentes. C'est l'article 2, non l'article 4.
        parcours = faits.get("parcours_mathematiques")
        if parcours in PARCOURS:
            return {"statut": PARCOURS[parcours],
                    "motif": "redoublement de la classe de première : les épreuves "
                             "anticipées sont représentées et les nouvelles notes "
                             "remplacent les précédentes",
                    "fondement": "arrêté du 16 juillet 2018, article 2"}
        return {"statut": "a_verifier", "motif": "parcours mathématique non déclaré",
                "fondement": "arrêté du 16 juillet 2018, article 2"}

    if faits.get("ea_mathematiques_deja_presentee") == "oui":
        if faits.get("session_de_presentation_ea_math") == finale:
            return {"statut": "deja_presentee_valable",
                    "motif": "épreuve déjà présentée au titre de cette session finale",
                    "fondement": "arrêté du 16 juillet 2018"}
        note = faits.get("note_ea_mathematiques")
        if faits.get("conservation_demandee") == "oui":
            if note is not None and note >= 10:
                return {"statut": "note_conservee",
                        "motif": "note égale ou supérieure à 10 sur 20 conservée",
                        "fondement": "code de l'éducation, article D334-13"}
            return {"statut": "a_verifier",
                    "motif": "conservation demandée sans note conservable déclarée",
                    "fondement": "code de l'éducation, article D334-13"}
        if faits.get("empechement_constate") == "oui":
            return {"statut": "note_conservee",
                    "motif": "candidat régulièrement inscrit n'ayant pu subir les épreuves : "
                             "les notes sont conservées pour la session suivante",
                    "fondement": "arrêté du 16 juillet 2018, article 5"}

    parcours = faits.get("parcours_mathematiques")
    if parcours in PARCOURS:
        return {"statut": PARCOURS[parcours],
                "motif": f"épreuve due au titre de la session {finale}, parcours "
                         f"« {parcours} »",
                "fondement": "note de service MENE2515469N"}
    return {"statut": "a_verifier",
            "motif": "parcours mathématique non déclaré ou hors voie générale",
            "fondement": "note de service MENE2515469N"}


def programme_math_applicable(faits: dict) -> dict:
    """Le programme de mathématiques évalué : celui de l'année de passation, jamais l'autre."""
    ctx = contexte(faits)
    prog = ctx["programme_mathematiques"]
    if prog is None:
        raise KeyError(f"aucun programme de mathématiques enregistré pour "
                       f"{ctx['annee_scolaire_passation_ea']}")
    return prog


if __name__ == "__main__":
    exemple = {"session_baccalaureat_finale": 2027,
               "annee_scolaire_passation_ea": "2026-2027",
               "mode_passation_ea": "meme_session",
               "age_au_31_decembre_annee_examen": 21,
               "parcours_mathematiques": "specialite"}
    print(json.dumps(statut_math_ea(exemple), ensure_ascii=False, indent=2))

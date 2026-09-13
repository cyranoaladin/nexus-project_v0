#!/usr/bin/env python3
"""Q-26 — qui peut présenter toutes les épreuves à la même session (article 3).

Le profil P3 du Cahier signifie « épreuves anticipées et épreuves terminales à la même
session ». Ce n'est pas un choix du candidat : l'article 3 de l'arrêté du 16 juillet 2018
énumère les situations qui l'autorisent, sous la condition générale de n'avoir pas présenté
les épreuves anticipées l'année précédente.

Deux dimensions, et non une. Le **droit** — `eligibilite_reglementaire` ∈ {oui, non,
conditionnelle} — dit si une catégorie de l'article 3 couvre la situation. La **preuve** —
`statut_verification` ∈ {verifie, piece_a_verifier, decision_administrative_requise} — dit
ce qu'il reste à produire. Confondre les deux revenait à traiter une pièce non encore
fournie comme une incertitude juridique : un candidat titulaire d'un baccalauréat relève
d'une catégorie explicite, même s'il n'a pas encore montré son diplôme.

Le profil P3 ne s'ouvre en production que si le droit vaut « oui » **et** la vérification
« verifie ». Tout le reste est lu dans la matrice du référentiel ; rien n'est écrit ici.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

ELIGIBILITES = ("oui", "non", "conditionnelle")
VERIFICATIONS = ("verifie", "piece_a_verifier", "decision_administrative_requise")


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def matrice() -> dict:
    return charger(RACINE / "referentiels" / "programmes_examen.json")[
        "eligibilite_meme_session"]


def _rempli(critere: dict, c: dict) -> bool:
    """La situation déclarée invoque-t-elle ce critère ?

    Chaque branche suit la lettre de l'article 3. La résidence permanente à l'étranger n'y
    figure pas seule : elle n'ouvre le passage que dans un pays sans centre d'examen, ou
    dont le centre est trop éloigné de la résidence.
    """
    code = critere["code"]
    if code == "AGE-20":
        age = c.get("age_au_31_decembre_annee_examen")
        return age is not None and age >= 20
    if code == "ENFANT":
        return c.get("enfant_a_charge") == "oui"
    if code == "RETOUR":
        return c.get("retour_formation_initiale") == "oui"
    if code == "FORCE-MAJEURE":
        return c.get("force_majeure_constatee") in ("oui", "en_cours")
    if code == "ETRANGER-TEMPORAIRE":
        return c.get("residence_etranger") == "temporaire_en_premiere"
    if code == "ETRANGER-PERMANENT-SANS-CENTRE":
        return (c.get("residence_etranger") == "permanente"
                and c.get("centre_examen_dans_le_pays") == "non")
    if code == "ETRANGER-PERMANENT-CENTRE-ELOIGNE":
        return (c.get("residence_etranger") == "permanente"
                and c.get("centre_examen_dans_le_pays") != "non"
                and c.get("centre_examen_eloigne") == "oui")
    if code == "ECHEC-ANTERIEUR":
        return c.get("echec_anterieur_baccalaureat") == "oui"
    if code == "EA-SANS-INSCRIPTION-SUIVANTE":
        return c.get("ea_presentees_puis_absence_inscription") == "oui"
    if code == "TITULAIRE-DIPLOME-FR":
        return c.get("diplome_francais_detenu") not in (None, "aucun")
    if code == "TITULAIRE-DIPLOME-ETRANGER":
        return c.get("diplome_etranger_comparable") in ("oui", "a_reconnaitre")
    if code == "CHANGEMENT-VOIE-TERMINALE":
        return c.get("changement_voie_ou_serie") == "oui"
    raise KeyError(f"critère non modélisé : {code}")


def variables() -> dict:
    """Les variables du questionnaire, indexées par code."""
    return {v["code"]: v for v in charger(
        RACINE / "referentiels" / "variables_qp.json")["variables"]}


def section_eligibilite_visible(reponses: dict) -> bool:
    """La section de l'article 3 est-elle présentée à ce candidat ?

    Le questionnaire de parcours n'est pas un questionnaire juridique. Un candidat qui ne
    sollicite ni ne nécessite le passage en une seule session ne voit aucune question de
    l'article 3 : c'est ce que la porte calcule, et rien d'autre ne l'ouvre.
    """
    conv = charger(RACINE / "referentiels" / "variables_qp.json")["conventions"]
    porte = conv["sections_conditionnelles"]["sections"]["eligibilite_meme_session"][
        "condition"]
    return deriver(reponses).get(porte["variable"]) in porte["valeurs"]


def deriver(reponses: dict) -> dict:
    """Complète les réponses par ce qui se déduit d'elles — jamais par ce qui se redemande.

    Trois dérivations, et chacune évite une question. Le mode de passation se déduit du
    profil pour un candidat de première et pour un candidat qui présente tout la même
    année ; seul le redoublant de terminale, qui peut représenter une épreuve anticipée,
    a besoin qu'on le lui demande. La porte de la section d'éligibilité se déduit du mode.
    L'âge au 31 décembre se calcule depuis la date de naissance, déjà connue de la
    plateforme : la redemander sous forme d'âge exposerait le candidat à se tromper.
    L'échec antérieur se lit dans l'historique déclaré, non dans une question de plus.
    """
    r = dict(reponses)
    if "mode_passation_ea" not in r and r.get("profil") in ("P1", "P3"):
        r["mode_passation_ea"] = "anticipation" if r["profil"] == "P1" else "meme_session"
    r["passage_meme_session_sollicite"] = \
        "oui" if r.get("mode_passation_ea") == "meme_session" else "non"
    if "age_au_31_decembre_annee_examen" not in r and r.get("annee_naissance") \
            and r.get("session_baccalaureat_finale"):
        r["age_au_31_decembre_annee_examen"] = (int(r["session_baccalaureat_finale"])
                                                - int(r["annee_naissance"]))
    if "echec_anterieur_baccalaureat" not in r and r.get("examens_anterieurs"):
        r["echec_anterieur_baccalaureat"] = \
            "oui" if r["examens_anterieurs"] == "presente_sans_succes" else "non"
    return r


def _verification(critere: dict, candidat: dict) -> str:
    """Le statut de preuve : « verifie » seulement quand la pièce est au dossier.

    Un fait déclaré n'est pas un fait vérifié. Chaque critère nomme la pièce qui
    l'établit ; tant qu'elle n'est pas au dossier, la preuve reste à faire. Les critères
    dont la prémisse relève d'une appréciation ou d'une source absente du dossier — le
    constat de force majeure, l'absence de centre d'examen dans un pays, la comparabilité
    d'un diplôme étranger — ne peuvent jamais devenir « verifie » par déclaration.
    """
    if critere["verification"] == "decision_administrative_requise":
        return "decision_administrative_requise"
    piece = critere.get("piece_requise")
    au_dossier = set(candidat.get("pieces_justificatives") or [])
    if piece and piece in au_dossier:
        return "verifie"
    return "piece_a_verifier"


def evaluer(candidat: dict) -> dict:
    """Rend le droit, la preuve et le fondement — sans jamais deviner l'un depuis l'autre."""
    m = matrice()
    candidat = deriver(candidat)
    if candidat.get("epreuves_anticipees_presentees_annee_precedente") == "oui":
        p = m["condition_prealable"]
        return {"eligibilite_reglementaire": "non", "statut_verification": "verifie",
                "critere": "condition_prealable", "fondement": p["regle"],
                "source": p["fondement"], "confiance": m["confiance"]}

    retenus = [c for c in m["criteres"] if _rempli(c, candidat)]
    if not retenus:
        d = m["defaut"]
        return {"eligibilite_reglementaire": d["eligibilite"],
                "statut_verification": d["verification"], "critere": None,
                "fondement": d["consequence"], "source": m["fondement"],
                "confiance": m["confiance"]}

    # Le droit le plus établi l'emporte : « oui » avant « conditionnelle ». À droit égal,
    # la preuve la plus avancée l'emporte, dans l'ordre déclaré du référentiel.
    rang_e = {v: i for i, v in enumerate(("oui", "conditionnelle", "non"))}
    rang_v = {v: i for i, v in enumerate(VERIFICATIONS)}
    retenu = min(retenus, key=lambda c: (rang_e[c["eligibilite"]],
                                         rang_v[_verification(c, candidat)]))
    return {"eligibilite_reglementaire": retenu["eligibilite"],
            "statut_verification": _verification(retenu, candidat),
            "piece_requise": retenu.get("piece_requise"),
            "source_de_verification": retenu.get("source_de_verification"),
            "critere": retenu["code"], "fondement": retenu["libelle"],
            "source": retenu["fondement"], "confiance": m["confiance"],
            "autres_criteres": [c["code"] for c in retenus if c is not retenu]}


def passage_meme_session_autorise(candidat: dict) -> bool:
    """L'autorisation effective : le droit établi et la preuve faite."""
    r = evaluer(candidat)
    return (r["eligibilite_reglementaire"] == "oui"
            and r["statut_verification"] == "verifie")


def profils_admis(candidat: dict) -> list[str]:
    """P3 n'est jamais admis sans fondement établi et pièce vérifiée."""
    return ["P1", "P2", "P3"] if passage_meme_session_autorise(candidat) else ["P1", "P2"]


#: Statuts d'ouverture du passage en une seule session. Le gate est unique et en amont :
#: il conditionne le profil, donc la dérivation de **tous** ses instruments.
P3_OUVERT = "P3_OUVERT"
P3_EN_ATTENTE = "P3_EN_ATTENTE_DE_VERIFICATION"
P3_NON_OUVERT = "P3_NON_OUVERT"


def statut_profil(reponses: dict) -> dict:
    """Le profil est-il réglementairement ouvert, avant toute dérivation d'instrument ?

    Q-26 ne porte pas sur un instrument : elle porte sur l'autorisation de présenter les
    épreuves anticipées à la même session que les épreuves terminales. Elle conditionne
    donc le profil, et le gate est placé ici — une seule fois, en amont — plutôt que
    recopié dans la sélection de chaque instrument.
    """
    texte = matrice()["fondement"]
    reponses = deriver(reponses)
    if reponses.get("mode_passation_ea") != "meme_session":
        return {"statut": "sans_objet", "ouvert": True, "texte": texte,
                "motif": "les épreuves anticipées ne sont pas présentées à la même session "
                         "que les épreuves terminales : l'article 3 ne s'applique pas"}
    r = evaluer(reponses)
    if r["eligibilite_reglementaire"] == "oui" and r["statut_verification"] == "verifie":
        return {"statut": P3_OUVERT, "ouvert": True, "critere": r["critere"],
                "motif": r["fondement"], "fondement": r["source"], "texte": texte}
    if r["eligibilite_reglementaire"] in ("oui", "conditionnelle"):
        return {"statut": P3_EN_ATTENTE, "ouvert": False, "critere": r["critere"],
                "motif": f"{r['fondement']} — preuve : {r['statut_verification']}"
                         + (f", pièce attendue « {r['piece_requise']} »"
                            if r.get("piece_requise") else ""),
                "fondement": r.get("source_de_verification") or r["source"],
                "texte": texte}
    return {"statut": P3_NON_OUVERT, "ouvert": False, "critere": r["critere"],
            "motif": r["fondement"], "fondement": r["source"], "texte": texte}


def tableau() -> str:
    m = matrice()
    L = [f"Éligibilité au passage de toutes les épreuves à la même session — "
         f"fondement : {m['fondement']} (confiance : {m['confiance']})", "",
         "| Critère | Situation | Droit | Preuve | Variable |", "|---|---|---|---|---|"]
    for c in m["criteres"]:
        L.append(f"| `{c['code']}` | {c['libelle']} | **{c['eligibilite']}** "
                 f"| {c['verification']} | `{c['variable']}` |")
    L += ["", f"Condition préalable : {m['condition_prealable']['regle']} "
          f"Sinon : **{m['condition_prealable']['effet_si_non_remplie']}**.",
          f"À défaut de tout critère : **{m['defaut']['eligibilite']}** — "
          f"{m['defaut']['consequence']}"]
    return "\n".join(L)


if __name__ == "__main__":
    print(tableau())
    sys.exit(0)

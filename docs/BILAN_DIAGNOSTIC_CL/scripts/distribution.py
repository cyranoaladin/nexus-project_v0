#!/usr/bin/env python3
"""Packs de diffusion : ce que l'équipe envoie, et à qui.

Le dépôt produit des rendus nommés pour la machine — `EDS-MATH_NT_sujet_candidat.pdf` —
dans des dossiers `build/` qu'un humain ne parcourt pas. Ce script en fait une
arborescence de diffusion : des noms lisibles, un dossier par instrument, un dossier par
profil de candidat, les corrigés tenus à part, et deux tableaux qui disent quoi envoyer.

Rien n'est décidé ici. La liste des instruments d'un candidat vient de la même fonction
que celle du bilan — `maquette_donnees.instruments_passes` — de sorte qu'un pack ne peut
pas diverger du diagnostic réellement dérivé. Les noms lisibles sont la seule chose que ce
fichier ajoute, et ils sont déclarés au-dessus.

    python3 scripts/distribution.py            # construit tout et vérifie
    python3 scripts/distribution.py --verifier  # vérifie sans écrire

Trois refus, et ils arrêtent la construction :

- une fuite de correction dans un document candidat ;
- un PDF candidat illisible, vide, tronqué ou incomplet ;
- un pack dont un PDF requis manque.
"""
from __future__ import annotations

import copy
import csv
import hashlib
import itertools
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import diffusabilite as DIF          # noqa: E402
import faits_candidat as FC          # noqa: E402
import maquette_donnees as MD        # noqa: E402

#: **Ce n'est plus la façade remise aux candidats.** Celle-ci est `release/diagnostics-v2/`,
#: produite par `scripts/release_v2.py` : un livret autonome par matière. Ce module reste
#: le banc de contrôle de la chaîne — scan de fuite de correction, preflight PDF,
#: complétude des packs, recensement des doublons — et ses sorties ne sortent pas du
#: dépôt. Les garder sous `release/` faisait cohabiter deux produits et obligeait un
#: opérateur à choisir entre eux.
SORTIE = RACINE / "build" / "controle-diffusion"
# Les noms disent ce que ces dossiers sont : des éprouvettes d'audit. Ils s'appelaient
# « 01_A_ENVOYER_AUX_CANDIDATS » et portaient des « ASSEMBLAGE_AUDIT.pdf » en
# ancienne charte : un opérateur pressé pouvait les prendre pour la release.
INDEX = SORTIE / "preflight"
ENVOI = SORTIE / "audit-fixtures" / "assemblages"
IMPRESSION = SORTIE / "audit-fixtures" / "assemblages-papier"
COACH = SORTIE / "audit-fixtures" / "corrections"
CATALOGUE = SORTIE / "audit-fixtures" / "catalogue"
NSI_MACHINE = SORTIE / "audit-fixtures" / "materiel-nsi"
COMBINAISONS = SORTIE / "audit-fixtures" / "combinaisons"
EXTRAITS = SORTIE / "extracted-text"

#: Les sept spécialités du périmètre V1.
SPECIALITES = ("MATH", "PC", "NSI", "SVT", "SES", "HGGSP", "HLP")

#: Nom lisible d'un instrument dans un dossier de diffusion. Un code interne ne doit
#: jamais être la seule interface d'un humain qui prépare un envoi.
NOM_MATIERE = {
    "QP": "QUESTIONNAIRE-PARCOURS",
    "MET": "METHODES-DE-TRAVAIL",
    "FR-EAF": "FRANCAIS-EAF",
    "FR-EAF-ORAL": "FRANCAIS-ORAL",
    "FR-MAI": "FRANCAIS-MAITRISE",
    "PHI": "PHILOSOPHIE",
    "TC-ES": "ENSEIGNEMENT-SCIENTIFIQUE",
    "GO": "GRAND-ORAL",
    "MATH-EA": "MATHS-EPREUVE-ANTICIPEE",
    "EDS-MATH": "SPE-MATHS",
    "EDS-PC": "SPE-PHYSIQUE-CHIMIE",
    "EDS-NSI": "SPE-NSI",
    "EDS-SVT": "SPE-SVT",
    "EDS-SES": "SPE-SES",
    "EDS-HGGSP": "SPE-HGGSP",
    "EDS-HLP": "SPE-HLP",
    "TC-HG": "HISTOIRE-GEOGRAPHIE",
    "TC-EMC": "EMC",
    "FR-POS": "FRANCAIS-POSITIONNEMENT",
    "FR-POS-ORAL": "FRANCAIS-POSITIONNEMENT-ORAL",
}

#: Niveau auquel une version s'adresse. Déclaré : le catalogue porte les profils, pas le
#: niveau de classe, et un lecteur humain a besoin du niveau pour ranger un envoi.
NIVEAU_VERSION = {
    "N1": "Premiere", "NT": "Terminale", "1RE": "Premiere", "TLE": "Terminale",
    "ETENDUE": "Premiere-et-Terminale", "SPE": "Premiere", "SPECIFIQUES": "Premiere",
    "standard": None, "standard_2028": None, "ecrit": None, "ecrit_2028": None,
    "oral": None, "oral_2028": None,
}
#: L'année scolaire de première correspondant à une session finale du baccalauréat. Un
#: élève de première en 2026-2027 passe l'épreuve anticipée en juin 2027, mais au titre de
#: la session 2028 : c'est ce décalage d'un an que le suffixe « _2028 » portait, et que
#: personne ne lisait ainsi.
ANNEE_PREMIERE = {2027: "PROGRAMME-2025-2026", 2028: "PROGRAMME-2026-2027"}

#: L'année scolaire de première en cours. La version FR-EAF qui lui correspond est celle
#: qu'on remet aujourd'hui ; les autres restent au catalogue sans être courantes.
ANNEE_COURANTE = "2026-2027"

#: Comment un instrument parvient au candidat. Un entretien n'a pas de sujet à envoyer :
#: fabriquer un PDF candidat pour lui serait fabriquer un document qui n'existe pas.
MODE_REMISE = {
    "FR-EAF-ORAL": "COACH_INTERVIEW",
    "GO": "COACH_INTERVIEW",
    "TC-EMC": "COACH_INTERVIEW",
    "FR-POS-ORAL": "COACH_INTERVIEW",
}

#: Niveau des instruments dont la version ne le dit pas.
NIVEAU_CODE = {"QP": "Tous", "MET": "Tous", "GO": "Terminale", "PHI": "Terminale",
               "FR-MAI": "Terminale", "FR-EAF": "Premiere", "FR-EAF-ORAL": "Premiere",
               "FR-POS": "Tous", "FR-POS-ORAL": "Tous"}

#: Rendus remis au candidat, et rendus réservés au correcteur.
CANDIDAT = ("sujet_candidat", "feuille_reponses")
CORRECTEUR = ("cle_et_grilles_correcteur", "saisie_vierge", "grille_coach", "variables")

#: Deux instruments n'ont pas de « sujet » : ce sont des questionnaires que le candidat
#: remplit lui-même. Leur formulaire imprimable est donc un document candidat, et non un
#: document de correction — l'omettre du pack privait l'envoi du questionnaire de parcours
#: et de celui des méthodes de travail, sans lequel aucun bilan n'est interprétable.
FORMULAIRE_CANDIDAT = {"QP", "MET"}

LISEZ_MOI_NSI = """TÂCHE SUR MACHINE — SPÉCIALITÉ NSI

Cette partie de l'épreuve se compose sur l'ordinateur du poste, sans accès à Internet.

1. Ouvrez `rendu_modele.py` et enregistrez-le sous le nom `rendu.py`, dans ce dossier.
2. Écrivez-y la fonction demandée par l'énoncé, en respectant exactement le nom et les
   paramètres indiqués.
3. Vous pouvez vérifier votre travail autant de fois que vous le souhaitez, en lançant
   depuis ce dossier :

       python3 -m pytest -q

   Les tests affichés sont ceux qui serviront à la correction. Un test qui échoue vous
   dit ce qui ne va pas ; rien ne vous est retiré pour les avoir exécutés.
4. À la fin de l'épreuve, laissez le fichier `rendu.py` dans ce dossier. C'est lui qui
   est conservé.

N'écrivez pas votre nom dans le fichier : votre code candidat suffit.
"""

#: Termes qui trahissent un document de correction. Cherchés dans le texte extrait de
#: chaque PDF candidat : leur présence arrête la diffusion.
FUITES = [
    (r"cl[ée]\s+et\s+grilles?\s+correcteur", "titre de document correcteur"),
    (r"document\s+correcteur", "mention de document correcteur"),
    (r"r[ée]serv[ée]\s+aux\s+correcteurs", "avertissement correcteur"),
    (r"r[ée]ponse\s+exacte\s*:", "clé de réponse"),
    (r"\bdistracteurs?\s*:", "analyse des distracteurs"),
    (r"consignes?\s+d[’']harmonisation", "consignes de correction"),
    (r"codes?\s+d[’']erreur\s+autoris", "codes d'erreur du corrigé"),
    (r"[ée]l[ée]ments\s+que\s+le\s+texte\s+permet", "éléments attendus du corrigé"),
    (r"r[ée]ponses?\s+partiellement\s+exactes", "barème intermédiaire"),
    (r"analyse\s+attendue", "corrigé de la question de grammaire"),
    (r"crit[èe]re\s+[A-Z]{3,}\s+—", "grille critériée"),
    (r"\bTODO\b|\bFIXME\b|PLACEHOLDER", "marqueur de travail"),
    # La forme du dépôt est toujours entre crochets — `[EXTRAIT À INSÉRER…]`. Sans eux,
    # « à compléter » est la consigne ordinaire faite au candidat dans le fichier qu'il
    # remplit, et le contrôle refusait le matériel qu'il est censé protéger.
    (r"\[\s*(EXTRAIT À INSÉRER|À COMPLÉTER|TEXTE À INSÉRER)", "emplacement réservé"),
    (r"/home/|/tmp/|C:\\\\", "chemin interne"),
]


def charger(p: Path) -> dict:
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def catalogue() -> dict:
    return charger(RACINE / "referentiels" / "catalogue_instruments.json")


def empreinte(p: Path) -> str | None:
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None


def texte_pdf(p: Path) -> str:
    return subprocess.run(["pdftotext", "-layout", str(p), "-"],
                          capture_output=True, text=True).stdout


def pages(p: Path) -> int:
    sortie = subprocess.run(["pdfinfo", str(p)], capture_output=True, text=True).stdout
    return int(sortie.split("Pages:")[1].split()[0]) if "Pages:" in sortie else 0


# ─────────────────────────────────────────────── § 3 · les seize instruments

def niveau(code: str, version: str) -> str:
    return NIVEAU_VERSION.get(version) or NIVEAU_CODE.get(code, "Tous")


def inventaire() -> list[dict]:
    """Les seize instruments métier, version par version, avec leurs rendus réels."""
    cat = catalogue()
    perim = {p["code"]: p["libelle"]
             for p in charger(RACINE / "referentiels" / "competences.json")["perimetres"]}
    out = []
    for e in cat["instruments"]:
        code, v = e["code"], e["version"]
        d = RACINE / "instruments" / code
        if not d.exists():
            continue
        build = d / "build"
        asm = d / "assemblages" / f"{v}.json"
        bareme = None
        if asm.exists():
            a = charger(asm)
            par = {i["item_id"]: i
                   for i in charger(d / "banque.json")["items"]}
            bareme = sum(par[i]["score_max"] for b in a["blocs"] for i in b["items"]
                         if i in par)
        cand = build / f"{code}_{v}_sujet_candidat.pdf"
        if not cand.exists() and code in FORMULAIRE_CANDIDAT:
            cand = build / f"{code}_{v}_formulaire_secours.pdf"
        coach = build / f"{code}_{v}_cle_et_grilles_correcteur.pdf"
        if not coach.exists():
            coach = build / f"{code}_{v}_grille_coach.pdf"
        if not coach.exists() and code not in FORMULAIRE_CANDIDAT:
            coach = build / f"{code}_{v}_formulaire_secours.pdf"
        out.append({
            "code": code, "version": v,
            "niveau": niveau(code, v),
            "matiere": perim.get(e["perimetre"] or code, e["libelle"]),
            "nom_diffusion": NOM_MATIERE[code],
            "type": "épreuve écrite" if e["porte_items"] else
                    ("grille d'entretien" if e["correction"].startswith("grille")
                     else "formulaire"),
            "delivery_mode": MODE_REMISE.get(code, "SELF_ADMINISTERED"),
            "session": e.get("session_baccalaureat_finale"),
            "courant_pour_2026_2027": (
                code != "FR-EAF"
                or e.get("session_baccalaureat_finale") == 2028),
            "profils": e["profils"],
            "duree_min": e["duree_cible_min"],
            "bareme": bareme,
            "pdf_candidat": cand if cand.exists() else None,
            "pdf_coach": coach if coach.exists() else None,
            "feuille_reponses": (build / f"{code}_{v}_feuille_reponses.pdf"
                                 if (build / f"{code}_{v}_feuille_reponses.pdf").exists()
                                 else None),
            "diffusable": DIF.statut(code)["diffusable"],
        })
    return out


# ─────────────────────────────────────────────── § 4 · les profils réellement couverts

def gabarit_qp() -> dict:
    """Un questionnaire de référence, dont on ne fait varier que ce qui distingue un profil."""
    return charger(RACINE / "instruments" / "_MAQUETTE" / "qp.json")


def profil_reel(profil: str, spes: tuple[str, ...], config: str = "les_deux",
                abandonnee: str = "aucune", mode_ep: str | None = None,
                math_ea_due: bool | None = None, eaf_due: str | None = None,
                fr_mai_requis: bool | None = None, fr_pos_requis: bool | None = None,
                diagnostic_nexus_utile: bool = True,
                same_session_basis: str | None = None) -> dict:
    """Les faits d'un candidat, dans la forme que la dérivation attend.

    Adaptateur d'arguments, et rien de plus : la construction et les règles sont celles
    de `faits_candidat.build_candidate_facts`. `spes` sont les trois spécialités de
    Première (P1, P3) ou les deux de Terminale (P2, avec la non-poursuivie dans
    `abandonnee`) ; `config` est la configuration française du questionnaire.
    """
    abandon = None if abandonnee in (None, "aucune") else abandonnee
    if profil == "P2":
        spes_premiere = list(spes) + ([abandon] if abandon else [])
        spes_terminales = list(spes)
    else:
        spes_premiere = list(spes)
        spes_terminales = [x for x in spes if x != abandon] if abandon else None
    eaf = eaf_due if eaf_due is not None else ("none" if config == "aucune" else config)
    return FC.build_candidate_facts(
        profil=profil, mode_ep=mode_ep, spes_premiere=spes_premiere, spe_non_poursuivie=abandon,
        spes_terminales=spes_terminales, eaf_due=eaf, math_ea_due=bool(math_ea_due),
        fr_pos_requis=bool(fr_pos_requis), fr_mai_requis=bool(fr_mai_requis),
        diagnostic_nexus_utile=diagnostic_nexus_utile, same_session_basis=same_session_basis,
        candidat_id="COMBINAISON")


def _combinaison_de(classe: dict) -> dict:
    """Un enregistrement de combinaison du banc, depuis le représentant d'une classe."""
    e = classe["representant"]
    profil = e["profil"]
    niveau = {"P1": "Premiere", "P2": "Terminale", "P3": "Premiere-et-Terminale"}[profil]
    spes = tuple(e["spes_terminales"]) if profil == "P2" else tuple(e["spes_premiere"])
    return {"profil": profil, "niveau": niveau, "spes": spes,
            "config": "aucune" if e["eaf_due"] == "none" else e["eaf_due"], "eaf_due": e["eaf_due"],
            "abandonnee": e.get("spe_non_poursuivie") or "aucune", "mode_ep": e["mode_ep"],
            "math_ea_due": bool(e.get("math_ea_due")), "fr_pos_requis": bool(e.get("fr_pos_requis")),
            "fr_mai_requis": bool(e.get("fr_mai_requis")),
            "diagnostic_nexus_utile": bool(e.get("diagnostic_nexus_utile", True)),
            "same_session_basis": e.get("same_session_basis"),
            "scenario_id": e["scenario_id"],
            "classe": classe["cle"], "etats_dans_la_classe": len(classe["etats"])}


def classes() -> dict[str, dict]:
    """Les classes de sélection de l'espace d'états valide, avec leur clé."""
    out = FC.classes_de_selection()
    for cle, c in out.items():
        c["cle"] = cle
    return out


def combinaisons() -> list[dict]:
    """Les combinaisons du banc de contrôle : un représentant par classe de sélection
    qui apporte au moins un livret ou un instrument que les précédentes n'ont pas.

    Le banc bâtit une archive par combinaison pour éprouver la chaîne — preflight, fuite
    de corrigé, complétude — et non pour distribuer : couvrir chaque livret physique une
    fois suffit. Les classes elles-mêmes, toutes, sont dans STUDENT_PACK_MATRIX.csv.
    """
    import livret as LI
    couverts: set = set()
    out = []
    for cle, c in sorted(classes().items(), key=lambda kv: (kv[1]["profil"], kv[1]["representant"]["scenario_id"])):
        e = c["representant"]
        livrets = {(c["profil"], mat, versions) for mat, versions in LI.livrets_de(c["instruments"]).items()}
        # Trois familles de clés à couvrir : chaque livret physique, chaque version
        # d'instrument, et chaque combinaison d'options réglementaires (mode, EAF,
        # mathématiques anticipées, FR-POS, FR-MAI, diagnostic_nexus_utile) — un pack
        # « sans EAF » se contrôle aussi, même s'il n'apporte aucun livret nouveau.
        options = (c["profil"], e["mode_ep"], e["eaf_due"], bool(e.get("math_ea_due")),
                   bool(e.get("fr_pos_requis")), bool(e.get("fr_mai_requis")),
                   bool(e.get("diagnostic_nexus_utile", True)))
        cles = livrets | {(c["profil"], code, version) for code, version in c["instruments"]} | {options}
        if cles - couverts:
            couverts |= cles
            out.append(_combinaison_de(c))
    return out


def lignes_des_classes(par_cle: dict, packs: list[dict]) -> list[dict]:
    """Une ligne par classe de sélection de l'espace d'états valide : ce que
    STUDENT_PACK_MATRIX.csv représente. Les états d'une même classe reçoivent les mêmes
    instruments et les mêmes livrets ; la ligne dit combien d'états elle réunit et si le
    banc en a bâti une archive témoin."""
    import livret as LI
    import pack_candidat as PC
    cat = catalogue()
    archives = {k.get("classe"): k for k in packs}
    rows = []
    for cle, c in sorted(classes().items(), key=lambda kv: (kv[1]["profil"], kv[1]["representant"]["scenario_id"])):
        e = c["representant"]
        choisis = [par_cle[k] for k in c["instruments"] if k in par_cle]
        lignes = PC.lignes_diagnostics_famille(list(c["instruments"]), cat, LI.duree_dossier_entree())
        livrets = sorted(nom for nom in (
            __import__("release_v2").nom_livret(mat, c["profil"], versions)
            for mat, versions in LI.livrets_de(c["instruments"]).items()))
        temoin = archives.get(cle)
        rows.append({"classe": cle, "profil": c["profil"], "mode_ep": e["mode_ep"],
                     "spes_premiere": e["spes_premiere"], "spes_terminales": e.get("spes_terminales") or [],
                     "abandonnee": e.get("spe_non_poursuivie") or "inconnue", "eaf_due": e["eaf_due"],
                     "math_ea_due": bool(e.get("math_ea_due")), "fr_pos_requis": bool(e.get("fr_pos_requis")),
                     "fr_mai_requis": bool(e.get("fr_mai_requis")),
                     "diagnostic_nexus_utile": bool(e.get("diagnostic_nexus_utile", True)),
                     "same_session_basis": e.get("same_session_basis") or "",
                     "instruments": list(c["instruments"]),
                     "livrets": livrets, "etats": len(c["etats"]), "representant": e["scenario_id"],
                     "candidats": sum(1 for i in choisis if i["pdf_candidat"]),
                     "coach": sum(1 for i in choisis if i["pdf_coach"]),
                     "duree_totale_min": sum(m for _, m in lignes),
                     "manquants": [f"{i['code']}/{i['version']}" for i in choisis
                                   if not i["pdf_candidat"] and not i["pdf_coach"]],
                     "archive": temoin})
    return rows


def instruments_du_profil(c: dict) -> list[tuple[str, str]]:
    """Les instruments d'une combinaison : les diagnostics utiles que dérive le moteur,
    par le même chemin que les packs candidats."""
    q = profil_reel(c["profil"], c["spes"], c["config"], abandonnee=c.get("abandonnee", "aucune"),
                    mode_ep=c.get("mode_ep"), math_ea_due=c.get("math_ea_due"), eaf_due=c.get("eaf_due"),
                    fr_mai_requis=c.get("fr_mai_requis"), fr_pos_requis=c.get("fr_pos_requis"),
                    diagnostic_nexus_utile=c.get("diagnostic_nexus_utile", True),
                    same_session_basis=c.get("same_session_basis"))
    res = MD.epreuves_reglementaires_dues_vs_diagnostics(q, catalogue())
    if c.get("diagnostic_nexus_utile", True):
        return res["diagnostics_nexus_utiles"]
    return res["epreuves_reglementaires_dues"]



#: Nom lisible de la configuration française dans un nom de pack.
#:
#: « sans-francais » était faux : un candidat qui ne repasse aucune épreuve anticipée de
#: français reçoit quand même le diagnostic de maîtrise du français, qui mesure la langue
#: comme outil de travail et non comme objet d'examen. Ce que la configuration commande,
#: c'est la seule épreuve anticipée.
NOM_CONFIG = {"les_deux": "EAF-ecrit-et-oral", "ecrit": "EAF-ecrit-seul",
              "oral": "EAF-oral-seul", "aucune": "EAF-non-requise"}

#: Le même en toutes lettres, pour les documents lus par un humain.
LIBELLE_CONFIG = {
    "les_deux": "épreuve anticipée — écrit et oral à diagnostiquer",
    "ecrit": "épreuve anticipée — écrit seul",
    "oral": "épreuve anticipée — oral seul",
    "aucune": "aucune épreuve anticipée de français à diagnostiquer ; le diagnostic de "
              "maîtrise du français reste au programme, il mesure la langue comme outil "
              "de travail",
}


def nom_pack(c: dict) -> str:
    base = f"{c['profil']}_{'-'.join(c['spes'])}_{NOM_CONFIG[c['config']]}"
    if c.get("mode_ep") == "fin_cycle" and c["profil"] != "P3":
        base += "_fin-de-cycle"
    if c.get("abandonnee") and c["abandonnee"] != "aucune" and c["profil"] != "P1":
        base += f"_non-poursuivie-{c['abandonnee']}"
    if c.get("math_ea_due"):
        base += "_MATH-EA-due"
    if c.get("eaf_due") and c["eaf_due"] != "none" and c["profil"] == "P2":
        base += f"_EAF-{c['eaf_due']}"
    if c.get("fr_pos_requis"):
        base += "_FR-POS-requis"
    if c.get("fr_mai_requis"):
        base += "_FR-MAI-requis"
    if not c.get("diagnostic_nexus_utile", True):
        base += "_sans-diagnostic-utile"
    return base


# ─────────────────────────────────────────────── § 8 et § 9 · les deux refus

def controler_candidat(pdf: Path) -> list[str]:
    """Un document remis au candidat : imprimable, et sans rien du corrigé."""
    return controler_rendu(pdf) + controler_candidat_fuites(pdf)


#: A4 en points PostScript, marge de 2 cm : au-delà, un mot déborde de la justification.
LARGEUR_A4 = 595.28
MARGE_PT = 2 / 2.54 * 72
#: Trois points de tolérance. La boîte d'un glyphe déborde de sa chasse de deux points
#: environ sur le dernier caractère d'une ligne pleine ; c'est la mesure observée sur les
#: cent et un rendus, et ce n'est pas un débordement. Au-delà, c'en est un : le corrigé de
#: MATH-EA sortait de onze points avant que le français soit déclaré au compositeur.
BORD_DROIT = LARGEUR_A4 - MARGE_PT + 3


def controler_rendu(pdf: Path) -> list[str]:
    """Ce qu'un PDF doit tenir pour être imprimé et lu, candidat ou correcteur.

    Ouvrable, paginé, sans page blanche accidentelle, sans glyphe perdu, sans commande
    du compositeur imprimée, polices embarquées — un PDF dont la police n'est pas
    embarquée se recompose chez le destinataire et ne ressemble plus à ce qui a été
    relu — et sans mot débordant de la justification.
    """
    err = []
    if not pdf.exists():
        return [f"{pdf.name} : absent"]
    n = pages(pdf)
    if n == 0:
        return [f"{pdf.name} : PDF illisible ou sans page"]
    texte = texte_pdf(pdf)
    if not texte.strip():
        err.append(f"{pdf.name} : aucun texte extractible")
    for p in range(1, n + 1):
        t = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p),
                            str(pdf), "-"], capture_output=True, text=True).stdout
        # Le folio ne fait pas le contenu d'une page : une page qui ne porte que son
        # numéro est une page blanche accidentelle, et le contrôle doit la voir.
        sans_folio = re.sub(r"^\s*\d{1,3}\s*$", "", t.replace("\x0c", ""),
                            flags=re.MULTILINE)
        if not sans_folio.strip():
            err.append(f"{pdf.name} : page {p} vide")
    if "\ufffd" in texte:
        err.append(f"{pdf.name} : glyphe manquant (U+FFFD)")
    m = re.search(r"\\[a-zA-Z]{2,}", texte)
    if m:
        err.append(f"{pdf.name} : commande LaTeX imprimée ({m.group(0)})")

    sortie = subprocess.run(["pdffonts", str(pdf)], capture_output=True,
                            text=True).stdout.splitlines()
    # Les colonnes de pdffonts se lisent par la fin : « emb sub uni objet 0 ». Par la
    # gauche, « CID TrueType » compte deux mots ; à position fixe, un nom de police plus
    # long que sa colonne décale tout — « LatinModernMath-Regular-Identity-H » le faisait.
    for ligne in sortie[2:]:
        champs = ligne.split()
        if len(champs) < 6:
            continue
        if champs[-5] != "yes":
            err.append(f"{pdf.name} : police non embarquée — {champs[0]}")

    bbox = subprocess.run(["pdftotext", "-bbox", str(pdf), "-"],
                          capture_output=True, text=True).stdout
    for mot in re.finditer(r'<word xMin="[\d.]+" yMin="[\d.]+" xMax="([\d.]+)"', bbox):
        if float(mot.group(1)) > BORD_DROIT:
            err.append(f"{pdf.name} : texte débordant de la justification "
                       f"(x={float(mot.group(1)):.0f} pt, bord à {BORD_DROIT:.0f} pt)")
            break
    return err


def fuites_texte(source: Path, texte: str) -> list[str]:
    """Les motifs de correction cherchés dans un texte, quel qu'en soit le support."""
    return [f"{source.name} : FUITE — {quoi}"
            for motif, quoi in FUITES if re.search(motif, texte, re.IGNORECASE)]


def controler_candidat_fuites(pdf: Path) -> list[str]:
    """En plus : rien du corrigé ne doit se trouver dans un document remis au candidat."""
    return fuites_texte(pdf, texte_pdf(pdf))


def controler_entete(pdf: Path, inst: dict) -> list[str]:
    """L'en-tête dit le bon instrument et la bonne version : un envoi ne se devine pas."""
    tete = subprocess.run(["pdftotext", "-layout", "-f", "1", "-l", "1", str(pdf), "-"],
                          capture_output=True, text=True).stdout
    err = []
    if inst["code"] not in tete:
        err.append(f"{pdf.name} : l'en-tête ne porte pas le code {inst['code']}")
    if inst["version"] not in tete.replace("\u00a0", " "):
        err.append(f"{pdf.name} : l'en-tête ne porte pas la version {inst['version']}")
    return err


# ─────────────────────────────────────────────── la façade opérationnelle

#: Ordre de composition d'un pack. Le candidat commence par dire d'où il vient, puis
#: comment il travaille, puis il compose ; les spécialités viennent en dernier, dans un
#: ordre stable pour que deux packs se ressemblent.
ORDRE = ["QP", "MET", "TC-ES", "FR-EAF", "FR-EAF-ORAL", "FR-MAI", "MATH-EA", "PHI",
         "EDS-MATH", "EDS-PC", "EDS-NSI", "EDS-SVT", "EDS-SES", "EDS-HGGSP", "EDS-HLP",
         "GO"]


def rang(code: str) -> int:
    """Place d'un instrument dans l'ordre de composition ; les inconnus à la fin."""
    return ORDRE.index(code) if code in ORDRE else len(ORDRE)


def poser(source: Path, cible: Path) -> None:
    """Lie un artefact à sa place. Un lien dur est un vrai fichier, et ne coûte rien.

    C'est ce qui garantit qu'un dérivé ne peut pas diverger de son original : ce n'est
    pas une copie, c'est le même fichier vu d'un autre chemin.
    """
    cible.parent.mkdir(parents=True, exist_ok=True)
    if cible.exists():
        cible.unlink()
    try:
        cible.hardlink_to(source)
    except OSError:
        shutil.copy2(source, cible)


def nom_fichier(inst: dict, role: str) -> str:
    niv = {"Premiere": "1RE", "Terminale": "TLE",
           "Premiere-et-Terminale": "1RE-TLE", "Tous": "TOUS"}[inst["niveau"]]
    suffixe = {"candidat": "QUESTIONNAIRE" if inst["code"] in FORMULAIRE_CANDIDAT
                            else "CANDIDAT",
               "reponses": "FEUILLE-REPONSES", "coach": "CORRECTION"}[role]
    v = "" if inst["version"] in ("standard", "N1", "NT", "1RE", "TLE") \
        else f"_{inst['version'].upper().replace('_', '-')}"
    if inst["code"] == "FR-EAF":
        # « STANDARD-2028 » se lit « pour 2028 » et désigne en réalité la session finale
        # du baccalauréat — donc l'élève de première de 2026-2027. L'opérateur connaît
        # l'année de première de son élève, pas sa session finale : c'est elle qui nomme.
        v = f"_{ANNEE_PREMIERE[inst['session']]}"
        if inst["version"].startswith("ecrit"):
            v += "_ECRIT-SEUL"
        elif inst["version"].startswith("oral"):
            v += "_ORAL-SEUL"
    return f"{niv}_{inst['nom_diffusion']}{v}_DIAGNOSTIC_V1_{suffixe}.pdf"


def dossier_catalogue(i: dict) -> Path:
    """Où vit l'exemplaire canonique d'un artefact.

    Les six versions de FR-EAF ne peuvent pas rester côte à côte : elles ne s'adressent
    pas aux mêmes élèves. Elles sont rangées par année de première, et l'année courante
    est nommée comme telle.
    """
    base = CATALOGUE / i["niveau"] / i["nom_diffusion"]
    if i["code"] == "FR-EAF":
        annee = ANNEE_PREMIERE[i["session"]].replace("PROGRAMME-", "")
        courant = "_COURANT" if i["courant_pour_2026_2027"] else ""
        base = base / f"Premiere-{annee}{courant}"
    return base


def documents_candidat(i: dict) -> list[tuple[Path, str]]:
    """Les fichiers remis au candidat pour cet instrument, dans l'ordre de composition."""
    out = []
    if i["pdf_candidat"]:
        out.append((i["pdf_candidat"], nom_fichier(i, "candidat")))
    if i["feuille_reponses"]:
        out.append((i["feuille_reponses"], nom_fichier(i, "reponses")))
    return out


def fusionner(sources: list[tuple[Path, str]], cible: Path, titre: str) -> int:
    """Un seul PDF, avec ses signets. L'opérateur ouvre un fichier et imprime."""
    import pypdf
    w = pypdf.PdfWriter()
    for source, nom in sources:
        r = pypdf.PdfReader(str(source))
        w.add_outline_item(nom.replace("_DIAGNOSTIC_V1", "").replace(".pdf", ""),
                           len(w.pages))
        for page in r.pages:
            w.add_page(page)
    w.add_metadata({"/Title": titre, "/Producer": "Nexus Réussite — diagnostics V1"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    with open(cible, "wb") as f:
        w.write(f)
    return len(w.pages)


def texte_en_pdf(texte: str, cible: Path, titre: str) -> None:
    """Le mode d'emploi du pack, en PDF, pour qu'il s'imprime avec le reste."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm
    cible.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(cible), pagesize=A4)
    c.setTitle(titre)
    largeur, hauteur = A4
    y = hauteur - 2.5 * cm
    for ligne in texte.split("\n"):
        if y < 2 * cm:
            c.showPage()
            y = hauteur - 2.5 * cm
        gras = ligne.isupper() and ligne.strip()
        c.setFont("Helvetica-Bold" if gras else "Helvetica", 12 if gras else 10)
        c.drawString(2 * cm, y, ligne[:105])
        y -= 0.55 * cm if ligne.strip() else 0.35 * cm
    c.save()


def zipper(dossier: Path, cible: Path) -> None:
    """Un ZIP déterministe : deux constructions du même contenu donnent le même fichier."""
    import zipfile
    cible.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(cible, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(dossier.rglob("*")):
            if f.is_file():
                info = zipfile.ZipInfo(str(f.relative_to(dossier)), (1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, f.read_bytes())



# ─────────────────────────────────────────────── la construction

def construire(verifier: bool = False) -> dict:
    """Bâtit la façade, et refuse de la bâtir si un contrôle tombe.

    L'ordre compte : le catalogue canonique d'abord, puisqu'il est l'autorité ; tout le
    reste est un lien dur vers lui, ou un dérivé calculé à partir de lui.
    """
    inv = inventaire()
    err: list[str] = []

    # § 9 : tous les PDF diffusés passent le preflight, correcteur compris — un corrigé
    # illisible bloque la correction aussi sûrement qu'un sujet illisible bloque la
    # passation. § 8 : les seuls documents candidats passent en plus le scan de fuite.
    vus: set[Path] = set()
    for i in inv:
        for role, pdf in (("candidat", i["pdf_candidat"]),
                          ("reponses", i["feuille_reponses"]),
                          ("coach", i["pdf_coach"])):
            if pdf is None or pdf in vus:
                continue
            vus.add(pdf)
            err += controler_rendu(pdf)
            if role != "coach":
                err += controler_candidat_fuites(pdf)
            if role == "candidat":
                err += controler_entete(pdf, i)

    par_cle = {(i["code"], i["version"]): i for i in inv}
    packs = []
    for c in combinaisons():
        choisis = [par_cle[k] for k in instruments_du_profil(c) if k in par_cle]
        choisis.sort(key=lambda i: rang(i["code"]))
        packs.append({**c, "instruments": choisis,
                      "candidats": [i for i in choisis if i["pdf_candidat"]],
                      "manquants": [f"{i['code']}/{i['version']}" for i in choisis
                                    if not i["pdf_candidat"] and not i["pdf_coach"]],
                      "duree_totale_min": sum(i["duree_min"] for i in choisis)})
    profils = profils_du_projet(par_cle)
    classes_rows = lignes_des_classes(par_cle, packs)

    if err or verifier:
        return {"erreurs": err, "packs": packs, "inventaire": inv, "profils": profils,
                "classes": classes_rows}

    if SORTIE.exists():
        shutil.rmtree(SORTIE)

    # 10 · le catalogue canonique : un exemplaire de chaque artefact, et un seul.
    for i in inv:
        d = dossier_catalogue(i)
        for source, nom in documents_candidat(i):
            poser(source, d / nom)
        if i["pdf_coach"]:
            poser(i["pdf_coach"],
                  COACH / i["niveau"] / i["nom_diffusion"] / nom_fichier(i, "coach"))

    # 20 · le matériel NSI sur machine, en un exemplaire par niveau.
    nsi = RACINE / "instruments" / "EDS-NSI" / "tests"
    for niv, version in (("Premiere", "N1"), ("Terminale", "NT")):
        cible = NSI_MACHINE / niv
        tache = "test_NSI-1-PROG-01.py" if version == "N1" else "test_NSI-T-PROG-02.py"
        for nom in ("rendu_modele.py", "conftest.py", tache):
            poser(nsi / nom, cible / nom)
        # Le mode d'emploi ne dépend pas du niveau : un seul exemplaire, lié deux fois.
        canonique = NSI_MACHINE / "LISEZ-MOI.txt"
        if not canonique.exists():
            canonique.parent.mkdir(parents=True, exist_ok=True)
            canonique.write_text(LISEZ_MOI_NSI, encoding="utf-8")
        poser(canonique, cible / "LISEZ-MOI.txt")
        zipper(cible, NSI_MACHINE / f"COMPLEMENT_NSI_PRATIQUE_{niv.upper()}.zip")

    # 90 · une archive par combinaison. Deux mille quatre cents fichiers posés à plat
    # n'étaient pas une façade : c'était le même contenu répété cent cinquante fois.
    for k in packs:
        k["zip"] = COMBINAISONS / k["niveau"] / f"{nom_pack(k)}.zip"
        k["pages"] = _batir_pack(k, k["zip"].parent / "_tmp", k["zip"])

    # 01 et 02 · les profils que le dépôt connaît réellement.
    #
    # Deux candidats de même profil reçoivent le même pack : il est bâti une fois et lié
    # sous chaque étiquette. Le bâtir deux fois donnerait deux fichiers de même contenu
    # et d'inodes différents — deux vérités pour un seul document.
    bati: dict[tuple, Path] = {}
    x_pages: dict[tuple, int] = {}
    for x in profils:
        k = {"profil": x["profil"], "niveau": x["niveau"], "spes": tuple(x["eds"]),
             "config": x["config_francais"],
             "instruments": sorted([par_cle[c] for c in x["requis"] if c in par_cle],
                                   key=lambda i: rang(i["code"]))}
        k["candidats"] = [i for i in k["instruments"] if i["pdf_candidat"]]
        k["duree_totale_min"] = x["duree_totale_min"]
        base = ENVOI / "PROFILS_DE_REFERENCE" / x["etiquette"]
        signature = (k["profil"], k["spes"], k["config"],
                     tuple(sorted((i["code"], i["version"]) for i in k["instruments"])))
        if signature in bati:
            source = bati[signature]
            base.mkdir(parents=True, exist_ok=True)
            for f in sorted(source.iterdir()):
                poser(f, base / f.name)
            x["pages_pack"] = x_pages[signature]
        else:
            x["pages_pack"] = _batir_pack(k, base, None)
            bati[signature] = base
            x_pages[signature] = x["pages_pack"]
        poser(base / "ASSEMBLAGE_AUDIT.pdf",
              IMPRESSION / x["etiquette"] / "ASSEMBLAGE_PAPIER_AUDIT.pdf")
        poser(base / "00_LISEZ_MOI.pdf", IMPRESSION / x["etiquette"] / "00_LISEZ_MOI.pdf")
        x["pack_envoi"] = str(base.relative_to(RACINE))
        x["pack_impression"] = str(
            (IMPRESSION / x["etiquette"] / "ASSEMBLAGE_PAPIER_AUDIT.pdf").relative_to(RACINE))

    _ecrire_index(inv, packs, profils)
    err += _controler_facade()
    return {"erreurs": err, "packs": packs, "inventaire": inv, "profils": profils,
            "classes": classes_rows}


def _batir_pack(k: dict, dossier: Path, archive: Path | None) -> int:
    """Un pack candidat : le mode d'emploi, le document unique, le matériel NSI.

    Rien d'autre. Pas de corrigé, pas de grille, pas de barème — c'est la seule chose que
    ce dossier doit garantir, et c'est celle qu'un test rejoue en aveugle.
    """
    if dossier.exists():
        shutil.rmtree(dossier)
    dossier.mkdir(parents=True)
    sources = [x for i in k["candidats"] for x in documents_candidat(i)]
    fusion = dossier / "ASSEMBLAGE_AUDIT.pdf"
    pages = fusionner(sources, fusion, f"Diagnostic Nexus Réussite — {nom_pack(k)}")
    # Le document fusionné est celui qui part. Le scanner lui-même, et pas seulement ses
    # sources, ferme le seul chemin par lequel une clé pourrait entrer : la fusion.
    fuites = fuites_texte(fusion, texte_pdf(fusion))
    if fuites:
        raise SystemExit(f"{nom_pack(k)} : " + " ; ".join(fuites))
    texte = lisez_moi(k, k["instruments"], pages)
    (dossier / "00_LISEZ_MOI.txt").write_text(texte, encoding="utf-8")
    texte_en_pdf(texte, dossier / "00_LISEZ_MOI.pdf", f"Pack {nom_pack(k)}")
    if any(i["code"] == "EDS-NSI" for i in k["candidats"]):
        niv = next(i["niveau"] for i in k["candidats"] if i["code"] == "EDS-NSI")
        poser(NSI_MACHINE / f"COMPLEMENT_NSI_PRATIQUE_{niv.upper()}.zip",
              dossier / "COMPLEMENT_NSI_PRATIQUE.zip")
    if archive is not None:
        zipper(dossier, archive)
        shutil.rmtree(dossier)
    return pages


def lisez_moi(k: dict, instruments: list[dict], pages: int) -> str:
    h, m = divmod(k["duree_totale_min"], 60)
    L = [f"DIAGNOSTIC NEXUS RÉUSSITE — {nom_pack(k)}", "",
         f"Niveau      : {k['niveau'].replace('-', ' ')}",
         f"Spécialités : {', '.join(k['spes'])}",
         f"Français    : {LIBELLE_CONFIG[k['config']]}",
         f"Durée totale d'évaluation : {h} h {m:02d}", "",
         "ÉPROUVETTE D'AUDIT — NE PAS ENVOYER", "",
         "  La source officielle d'envoi est release/diagnostics-v2/01_LIVRETS_CANDIDAT.",
         f"  ASSEMBLAGE_AUDIT.pdf   assemblage jetable, {pages} pages, sur lequel",
         "                         portent le scan de fuite et le preflight.", ""]
    if any(i["code"] == "EDS-NSI" for i in k["candidats"]):
        L += ["  COMPLEMENT_NSI_PRATIQUE.zip    complément facultatif sur machine ;",
              "                         le candidat individuel est dispensé de la",
              "                         partie pratique de l'épreuve de NSI.", ""]
    L += ["Aucun corrigé n'est joint. Les corrections sont dans audit-fixtures/corrections.",
          "", "DANS L'ORDRE DE COMPOSITION", ""]
    for i in instruments:
        quoi = ("entretien mené par le coach — rien à remettre au candidat"
                if i["delivery_mode"] == "COACH_INTERVIEW"
                else "questionnaire à remplir" if i["code"] in FORMULAIRE_CANDIDAT
                else "sujet et feuille de réponses" if i["feuille_reponses"]
                else "sujet")
        L.append(f"  {i['nom_diffusion']:26s} {i['duree_min']:>3} min   {quoi}")
    L += ["", "Les spécialités en version Première sont celles que le candidat n'a pas",
          "poursuivies en terminale ; les versions Terminale, celles qu'il poursuit.", ""]
    return "\n".join(L)


# ─────────────────────────────────────────────── l'index et les contrôles de façade

COMMENCER_ICI = """BANC DE CONTRÔLE DE LA CHAÎNE DE DIFFUSION — USAGE INTERNE

CE DOSSIER N'EST PAS UNE RELEASE. RIEN ICI NE S'ENVOIE À UN CANDIDAT.

  SOURCE OFFICIELLE D'ENVOI : release/diagnostics-v2/01_LIVRETS_CANDIDAT

Ce que ce banc produit, c'est la matière des contrôles : des assemblages jetables
sur lesquels on éprouve le scan de fuite de correction, le preflight
d'imprimabilité, la complétude des packs et le recensement des doublons. Les
documents y sont composés par l'ancienne chaîne et n'ont ni la charte, ni la
structure, ni les variantes réglementaires des livrets de la release.

  preflight/                  index et tableaux d'audit
  audit-fixtures/assemblages  assemblages jetables, un par profil de référence
  audit-fixtures/...-papier   les mêmes, préparés pour l'imprimante
  audit-fixtures/corrections  corrigés et grilles — ne sortent jamais de chez Nexus
  audit-fixtures/catalogue    un exemplaire de chaque rendu, par niveau et matière
  audit-fixtures/materiel-nsi complément facultatif sur machine
  audit-fixtures/combinaisons une archive par combinaison — combinatoire de contrôle
  extracted-text/             le texte extrait des PDF, sur lequel portent les scans

Les cent cinquante-quatre combinaisons sont un contrôle, pas un catalogue d'envoi :
le dépôt ne porte aucune liste d'inscrits.
"""



def _controler_facade() -> list[str]:
    """Fail-closed : ce qui part au candidat ne contient rien du correcteur.

    Le contrôle porte sur les fichiers réellement posés, et sur leur contenu — pas sur
    leur nom. Un corrigé renommé passerait le premier filtre et pas le second.
    """
    import zipfile
    err = []
    for base in (ENVOI, COMBINAISONS):
        for f in sorted(base.rglob("*")):
            if not f.is_file():
                continue
            if "CORRECTION" in f.name.upper() or "coach" in f.name.lower():
                err.append(f"fichier correcteur dans {base.name} : {f.name}")
            if f.suffix == ".pdf":
                err += fuites_texte(f, texte_pdf(f))
            elif f.suffix in (".txt", ".py", ".md"):
                err += fuites_texte(f, f.read_text(encoding="utf-8", errors="replace"))
            elif f.suffix == ".zip":
                try:
                    with zipfile.ZipFile(f) as z:
                        mauvais = z.testzip()
                        if mauvais:
                            err.append(f"archive corrompue : {f.name} ({mauvais})")
                        for nom in z.namelist():
                            if "CORRECTION" in nom.upper():
                                err.append(f"corrigé dans {f.name} : {nom}")
                except zipfile.BadZipFile:
                    err.append(f"archive illisible : {f.name}")
    return err


def doublons() -> dict:
    """§ 6 · le recensement des doublons, par contenu et non par nom.

    Un lien dur n'occupe rien et ne peut pas diverger de son original : c'est la forme
    voulue d'un dérivé. Deux fichiers de même contenu mais d'inodes différents seraient
    deux vérités, et il n'en faut qu'une.
    """
    par_hash: dict[str, list[Path]] = {}
    par_inode: dict[int, list[Path]] = {}
    for f in sorted(SORTIE.rglob("*")):
        if not f.is_file():
            continue
        par_hash.setdefault(empreinte(f), []).append(f)
        par_inode.setdefault(f.stat().st_ino, []).append(f)
    attendus = inattendus = collisions = 0
    detail = []
    for h, fichiers in par_hash.items():
        if len(fichiers) == 1:
            continue
        inodes = {f.stat().st_ino for f in fichiers}
        noms = {f.name for f in fichiers}
        if len(inodes) == 1:
            attendus += len(fichiers) - 1
            classement = "EXPECTED_DERIVED_PACK_COPY"
        elif len(noms) == 1:
            collisions += len(fichiers) - 1
            classement = "VERSION_COLLISION"
        else:
            inattendus += len(fichiers) - 1
            classement = "UNEXPECTED_DUPLICATE"
        if classement != "EXPECTED_DERIVED_PACK_COPY":
            detail.append({"empreinte": h[:16], "classement": classement,
                           "fichiers": [str(f.relative_to(SORTIE)) for f in fichiers]})
    return {
        "DISTRIBUTION_FILE_COUNT": sum(len(v) for v in par_hash.values()),
        "DISTRIBUTION_UNIQUE_CONTENT_HASHES": len(par_hash),
        "EXACT_DUPLICATE_FILE_COUNT": attendus + inattendus + collisions,
        "EXPECTED_DERIVED_PACK_COPY": attendus,
        "UNEXPECTED_DUPLICATE": inattendus,
        "VERSION_COLLISION": collisions,
        "detail": detail,
    }


def guard_derives() -> list[str]:
    """§ 5 · un dérivé n'est jamais une autorité.

    Chaque fichier posé dans la façade doit être, octet pour octet, l'artefact canonique
    dont il est tiré. Le vérifier par l'inode ne suffirait pas : un opérateur qui
    remplacerait un PDF dans un pack créerait un fichier neuf, d'inode neuf. On compare
    donc les empreintes au catalogue.
    """
    canonique = {}
    for f in CATALOGUE.rglob("*"):
        if f.is_file():
            canonique.setdefault(f.name, empreinte(f))
    err = []
    for base in (COACH, NSI_MACHINE):
        for f in base.rglob("*"):
            if f.is_file() and f.name in canonique \
                    and empreinte(f) != canonique[f.name]:
                err.append(f"{f.relative_to(SORTIE)} diverge du catalogue canonique")
    for f in IMPRESSION.rglob("*.pdf"):
        jumeau = ENVOI / "PROFILS_DE_REFERENCE" / f.parent.name / \
            f.name.replace("ASSEMBLAGE_PAPIER_AUDIT", "ASSEMBLAGE_AUDIT")
        if jumeau.exists() and f.stat().st_ino != jumeau.stat().st_ino:
            err.append(f"{f.relative_to(SORTIE)} n'est plus le même fichier que son "
                       f"pack d'envoi")
    return err


def _ecrire_index(inv: list[dict], packs: list[dict], profils: list[dict]) -> None:
    INDEX.mkdir(parents=True, exist_ok=True)
    (INDEX / "COMMENCER_ICI.txt").write_text(COMMENCER_ICI, encoding="utf-8")
    texte_en_pdf(COMMENCER_ICI, INDEX / "COMMENCER_ICI.pdf",
                 "Diagnostics Nexus Réussite — commencer ici")
    (INDEX / "INDEX_PACKS.html").write_text(_index_html(packs, profils),
                                            encoding="utf-8")
    (ENVOI / "LISEZ-MOI.txt").write_text(
        "À QUI CE DOSSIER S'ADRESSE\n\n"
        "PROFILS_DE_REFERENCE contient les packs des cinq profils que le dépôt porte.\n"
        "Ce ne sont pas des élèves inscrits : ce sont les profils de référence qui\n"
        "servent à éprouver la chaîne, et leurs identifiants sont des codes, jamais des\n"
        "noms. Le dépôt ne contient aucune liste d'élèves réels.\n\n"
        "POUR UN ÉLÈVE RÉEL\n\n"
        "Éprouvettes d'audit. La source officielle d'envoi est\n"
        "release/diagnostics-v2/01_LIVRETS_CANDIDAT.\n"
        "preflight/INDEX_PACKS.html liste les combinaisons de contrôle\n"
        "et les épreuves de français à diagnostiquer.\n\n"
        "Chaque archive contient la même chose : un mode d'emploi, un PDF unique à\n"
        "envoyer ou à imprimer, et l'archive NSI si la spécialité est concernée.\n"
        "Aucune ne contient de corrigé.\n", encoding="utf-8")
    (IMPRESSION / "LISEZ-MOI.txt").write_text(
        "ASSEMBLAGE_PAPIER_AUDIT.pdf est le même document que l'assemblage d'audit,\n"
        "dans l'ordre de composition, avec ses signets. Ouvrir, Ctrl+P, terminé.\n\n"
        "Pour une combinaison absente, ouvrir l'archive de audit-fixtures/combinaisons :\n"
        "elle contient le même ASSEMBLAGE_AUDIT.pdf, prêt à imprimer.\n",
        encoding="utf-8")
    (COACH / "LISEZ-MOI.txt").write_text(
        "Corrigés, clés et grilles. Ce dossier ne sort jamais de chez Nexus : aucun de\n"
        "ces fichiers ne doit être transmis à un candidat ni à sa famille.\n",
        encoding="utf-8")


def _index_html(packs: list[dict], profils: list[dict]) -> str:
    """Une page locale, sans serveur, qui filtre les combinaisons."""
    lignes = []
    for k in packs:
        lignes.append({
            "pack": nom_pack(k), "niveau": k["niveau"], "profil": k["profil"],
            "eds": " ".join(k["spes"]), "eaf": NOM_CONFIG[k["config"]],
            "duree": k["duree_totale_min"], "pages": k.get("pages", 0),
            "zip": str(k["zip"].relative_to(SORTIE)) if k.get("zip") else "",
        })
    data = json.dumps(lignes, ensure_ascii=False)
    ref = "".join(
        f"<li><b>{x['etiquette']}</b> — {x['niveau'].replace('-', ' ')}, "
        f"{'+'.join(x['eds'])} · <a href=\"../{Path(x['pack_envoi']).relative_to('build/controle-diffusion')}/ASSEMBLAGE_AUDIT.pdf\">pack</a></li>"
        for x in profils)
    return r"""<!doctype html><meta charset="utf-8">
<title>Diagnostics Nexus Réussite — index des packs</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:1100px;padding:0 1rem}
 h1{font-size:1.4rem} p.aide{color:#444}
 .filtres{display:flex;gap:.75rem;flex-wrap:wrap;margin:1.2rem 0;align-items:end}
 label{display:flex;flex-direction:column;font-size:.8rem;color:#555;gap:.2rem}
 select,input{font:inherit;padding:.35rem .5rem;border:1px solid #bbb;border-radius:4px}
 table{border-collapse:collapse;width:100%;font-size:.9rem}
 th,td{text-align:left;padding:.4rem .5rem;border-bottom:1px solid #e5e5e5}
 th{background:#f6f6f6;position:sticky;top:0}
 tr:hover{background:#fafafa} code{font-size:.85em;color:#333}
 .compte{margin:.6rem 0;color:#555;font-size:.9rem}
</style>
<h1>Index des packs de diagnostic</h1>
<p class="aide">Chaque ligne est une archive prête à envoyer. Filtrez, puis ouvrez le
dossier indiqué dans <code>audit-fixtures/combinaisons</code>. Éprouvettes d'audit —
la source officielle d'envoi est <code>release/diagnostics-v2/01_LIVRETS_CANDIDAT</code>.</p>
<h2 style="font-size:1rem">Profils déjà préparés</h2>
<ul>__REF__</ul>
<div class="filtres">
 <label>Niveau<select id=f_niveau><option value="">tous</option></select></label>
 <label>Profil<select id=f_profil><option value="">tous</option></select></label>
 <label>Spécialité<select id=f_eds><option value="">toutes</option></select></label>
 <label>Français<select id=f_eaf><option value="">tous</option></select></label>
 <label>Recherche<input id=f_texte placeholder="MATH NSI…" size=18></label>
</div>
<div class="compte" id=compte></div>
<table><thead><tr><th>Pack</th><th>Niveau</th><th>Profil</th><th>Spécialités</th>
<th>Français</th><th>Durée</th><th>Pages</th><th>Archive</th></tr></thead>
<tbody id=corps></tbody></table>
<script>
const L = __DATA__;
const sel = (id) => document.getElementById(id);
function options(id, valeurs){
  const s = sel(id);
  [...new Set(valeurs)].sort().forEach(v => {
    const o = document.createElement('option'); o.value = v; o.textContent = v;
    s.appendChild(o);
  });
}
options('f_niveau', L.map(x => x.niveau));
options('f_profil', L.map(x => x.profil));
options('f_eds', L.flatMap(x => x.eds.split(' ')));
options('f_eaf', L.map(x => x.eaf));
function rendre(){
  const n = sel('f_niveau').value, p = sel('f_profil').value;
  const e = sel('f_eds').value, a = sel('f_eaf').value;
  const t = sel('f_texte').value.trim().toUpperCase();
  const vus = L.filter(x =>
     (!n || x.niveau === n) && (!p || x.profil === p) &&
     (!e || x.eds.split(' ').includes(e)) && (!a || x.eaf === a) &&
     (!t || t.split(/\s+/).every(m => x.pack.toUpperCase().includes(m))));
  sel('compte').textContent = vus.length + ' pack(s) sur ' + L.length;
  sel('corps').innerHTML = vus.map(x =>
    `<tr><td><code>${x.pack}</code></td><td>${x.niveau.replace(/-/g,' ')}</td>
     <td>${x.profil}</td><td>${x.eds}</td><td>${x.eaf}</td>
     <td>${Math.floor(x.duree/60)} h ${String(x.duree%60).padStart(2,'0')}</td>
     <td>${x.pages}</td><td><a href="../${x.zip}">${x.zip.split('/').pop()}</a></td></tr>`
  ).join('');
}
['f_niveau','f_profil','f_eds','f_eaf'].forEach(i => sel(i).onchange = rendre);
sel('f_texte').oninput = rendre;
rendre();
</script>
""".replace("__DATA__", data).replace("__REF__", ref)


# ─────────────────────────────────────────────── § 13 · les tableaux

def ecrire_matrices(r: dict) -> list[Path]:
    ecrits = []
    p = RACINE / "DISTRIBUTION_MATRIX.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["instrument_code", "level", "subject", "profile", "eds",
                    "delivery_mode", "current_for_2026_2027", "candidate_pdf",
                    "coach_pdf", "duration", "version", "sha256", "ready_to_send"])
        for i in r["inventaire"]:
            cand = i["pdf_candidat"]
            w.writerow([
                i["code"], i["niveau"], i["matiere"], "/".join(i["profils"]),
                i["code"][4:] if i["code"].startswith("EDS-") else "",
                i["delivery_mode"], "oui" if i["courant_pour_2026_2027"] else "non",
                nom_fichier(i, "candidat") if cand else "",
                nom_fichier(i, "coach") if i["pdf_coach"] else "",
                i["duree_min"], i["version"],
                empreinte(cand) if cand else empreinte(i["pdf_coach"]),
                "oui" if i["diffusable"] and (cand or i["pdf_coach"]) else "non"])
    ecrits.append(p)

    # STUDENT_PACK_MATRIX : une ligne par CLASSE D'ÉQUIVALENCE DE SÉLECTION de l'espace
    # d'états candidats valide (faits_candidat.candidate_state_space), et non par état
    # ni par archive du banc. Les états d'une classe reçoivent les mêmes instruments et les
    # mêmes livrets ; `states_in_class` les compte, `representative_state` en nomme un.
    # `archive` n'est renseignée que pour les classes dont le banc bâtit une archive témoin.
    # FR-POS et FR-MAI y sont ce que les faits disent : faux par défaut, vrais sur demande.
    p = RACINE / "STUDENT_PACK_MATRIX.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["selection_class", "level", "profile", "ep_mode", "eds_premiere", "eds_terminale",
                    "eds_non_poursuivie", "eaf_due", "math_ea_due", "fr_pos_requis", "fr_mai_requis",
                    "diagnostic_nexus_utile", "same_session_basis",
                    "instruments", "candidate_booklets", "candidate_pdfs", "coach_keys",
                    "estimated_total_duration_min", "states_in_class", "representative_state",
                    "archive", "missing_pdfs", "ready_to_send"])
        for k in r["classes"]:
            temoin = k["archive"]
            w.writerow([
                k["classe"], {"P1": "Premiere", "P2": "Terminale", "P3": "Premiere-et-Terminale"}[k["profil"]],
                k["profil"], k["mode_ep"], "+".join(k["spes_premiere"]), "+".join(k["spes_terminales"]),
                k["abandonnee"], k["eaf_due"], "oui" if k["math_ea_due"] else "non",
                "oui" if k["fr_pos_requis"] else "non", "oui" if k["fr_mai_requis"] else "non",
                "oui" if k["diagnostic_nexus_utile"] else "non", k["same_session_basis"],
                " ".join(f"{c}/{v}" for c, v in k["instruments"]), " ".join(k["livrets"]),
                k["candidats"], k["coach"], k["duree_totale_min"], k["etats"], k["representant"],
                str(temoin["zip"].relative_to(SORTIE)) if temoin and temoin.get("zip") else "",
                " ".join(k["manquants"]), "oui" if not k["manquants"] else "non"])
    ecrits.append(p)

    # § 17 · la matrice d'impression : une ligne par destinataire réel.
    p = RACINE / "PRINT_MATRIX.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["safe_candidate_or_profile", "level", "session", "eds", "eaf_mode",
                    "paper_pack_pdf", "nsi_machine_zip", "coach_pack", "pages",
                    "ready_to_send", "ready_to_print"])
        for x in r["profils"]:
            nsi = "NSI" in x["eds"]
            w.writerow([
                x["etiquette"], x["niveau"], x["session"], "+".join(x["eds"]),
                NOM_CONFIG[x["config_francais"]],
                x.get("pack_impression", ""),
                f"audit-fixtures/materiel-nsi/COMPLEMENT_NSI_PRATIQUE_"
                f"{('PREMIERE' if x['profil'] == 'P1' else 'TERMINALE')}.zip"
                if nsi else "",
                "03_COACH_CORRECTIONS", x.get("pages_pack", ""),
                "true" if not x["manquants"] else "false",
                "true" if not x["manquants"] and x.get("pack_impression") else "false"])
    ecrits.append(p)
    return ecrits


# ─────────────────────────────────────────────── § 5 · les profils du projet

def profils_du_projet(par_cle: dict | None = None) -> list[dict]:
    """Les profils de candidats libres réellement portés par le dépôt.

    Ce sont les quatre jeux de référence des dossiers `_MAQUETTE*`, et eux seuls : le
    dépôt ne contient aucun dossier nominatif. Leurs identifiants — `CL-2026-000x` — sont
    déjà des étiquettes sûres, sans nom, sans date de naissance, sans coordonnées ; le
    questionnaire lui-même interdit tout champ nominatif hors du code candidat. Rien n'est
    modifié ici : les jeux sont lus, jamais écrits.
    """
    cat = catalogue()
    if par_cle is None:
        par_cle = {(i["code"], i["version"]): i for i in inventaire()}
    out = []
    for qp in sorted((RACINE / "instruments").glob("_MAQUETTE*/qp*.json")):
        q = charger(qp)
        r = q["reponses"]
        requis = MD.instruments_passes(q, cat)
        prets, manquants = [], []
        for k in requis:
            i = par_cle.get(k)
            if i is None:
                manquants.append("/".join(k))
            elif i["pdf_candidat"] or i["pdf_coach"]:
                prets.append("/".join(k))
            else:
                manquants.append("/".join(k))
        out.append({
            "etiquette": q["candidate_ref"],
            "origine": qp.parent.name,
            "niveau": {"P1": "Premiere", "P2": "Terminale",
                       "P3": "Premiere-et-Terminale"}[r["profil"]],
            "profil": r["profil"],
            "eds": r["specialites"],
            "config_francais": r["epreuves_francais_a_presenter"],
            "session": r["session_baccalaureat_finale"],
            "requis": requis, "prets": prets, "manquants": manquants,
            "duree_totale_min": sum(par_cle[k]["duree_min"] for k in requis
                                    if k in par_cle)})
    return out


def ecrire_profils(profils: list[dict]) -> Path:
    p = RACINE / "CANDIDATE_PROFILES.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["candidate_safe_label", "source_dataset", "level", "profile", "eds",
                    "french_config", "required_diagnostics", "ready_pdfs", "missing_pdfs",
                    "estimated_total_duration_min"])
        for x in profils:
            w.writerow([x["etiquette"], x["origine"], x["niveau"], x["profil"],
                        "+".join(x["eds"]), x["config_francais"],
                        " ".join("/".join(k) for k in x["requis"]),
                        len(x["prets"]), " ".join(x["manquants"]),
                        x["duree_totale_min"]])
    return p


def main(argv: list[str]) -> int:
    verifier = "--verifier" in argv
    r = construire(verifier)
    if r["erreurs"]:
        for e in r["erreurs"][:40]:
            print(f"  ✗ {e}")
        print(f"{len(r['erreurs'])} refus — rien n'est diffusé")
        return 1
    sans = [x for x in r["profils"] if x["manquants"]]
    for x in sans:
        print(f"  ✗ {x['etiquette']} : documents manquants {x['manquants']}")
    if sans:
        return 1
    if not verifier:
        for p in ecrire_matrices(r) + [ecrire_profils(r["profils"])]:
            poser(p, INDEX / p.name)
            print(f"  écrit : {p.name}")
        poser(RACINE / "MANIFESTE_DEPOT.json", INDEX / "MANIFESTE_DEPOT.json") \
            if (RACINE / "MANIFESTE_DEPOT.json").exists() else None
        for e in guard_derives():
            print(f"  ✗ {e}")
        d = doublons()
        print(f"  {d['DISTRIBUTION_FILE_COUNT']} fichiers · "
              f"{d['DISTRIBUTION_UNIQUE_CONTENT_HASHES']} contenus distincts · "
              f"{d['EXPECTED_DERIVED_PACK_COPY']} liens dérivés attendus · "
              f"{d['UNEXPECTED_DUPLICATE']} doublon(s) inattendu(s) · "
              f"{d['VERSION_COLLISION']} collision(s)")
    cand = sum(1 for i in r["inventaire"] if i["pdf_candidat"])
    coach = sum(1 for i in r["inventaire"] if i["pdf_coach"])
    print(f"  {len(r['inventaire'])} versions · {cand} sujets candidats · "
          f"{coach} documents correcteur · {len(r['packs'])} combinaisons de profil · "
          f"{len(r['profils'])} profils préparés")
    print(f"  banc de contrôle : {SORTIE.relative_to(RACINE)} "
          f"— la release candidat est release/diagnostics-v2")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

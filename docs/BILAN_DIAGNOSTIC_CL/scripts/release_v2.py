#!/usr/bin/env python3
"""La release opérationnelle v2 : des livrets, trois profils, et rien d'autre à savoir.

La v1 livrait des rendus techniques regroupés en archives. Elle était juste et illisible :
un candidat recevait un sujet et une feuille de réponses comme deux fichiers, un opérateur
devait connaître `standard_2028` et `NT`.

La v2 livre **un livret par matière**, composé dans le gabarit éditorial Nexus, avec sa
couverture, ses cartouches réglementaires lus au référentiel, ses zones de réponse
dimensionnées, et la correction du coach dans un document séparé.

    python3 scripts/release_v2.py            # construit tout
    python3 scripts/release_v2.py --plan     # dit ce qui serait construit, sans composer
"""
from __future__ import annotations

import csv
import hashlib
import os
import json
import shutil
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import distribution as DIS  # noqa: E402
import livret as LI         # noqa: E402

SORTIE = RACINE / "release" / "diagnostics-v2"
GUIDE = SORTIE / "00_GUIDE"
LIVRETS = SORTIE / "01_LIVRETS_CANDIDAT"
CORRECTIONS = SORTIE / "02_CORRECTIONS_COACH"
IMPRESSION = SORTIE / "03_IMPRESSION"
INTERNE = SORTIE / "04_INTERNE"

#: Le dossier de chaque profil, tel qu'un opérateur le lit.
DOSSIER_PROFIL = {"P1": "PROFIL_A_PREMIERE_PARTIE",
                  "P2": "PROFIL_B_DEUXIEME_PARTIE",
                  "P3": "PROFIL_C_BAC_EN_UNE_SESSION"}

#: Instruments qui ne composent pas un livret de matière de profil :
#: QP et MET forment le dossier d'entrée par profil.
#: FR-POS et FR-POS-ORAL forment le livret transversal commun sous 00_COMMUN.
ENTREE = LI.ENTREE
TRANSVERSE = LI.TRANSVERSE
matiere_de = LI.matiere_de
TRONC_COMMUN = LI.TRONC_COMMUN_MATIERES


def sous_dossier_livret(mat: str, profil: str, versions: tuple) -> str:
    """Le sous-dossier thématique d'un livret au sein de son profil."""
    if mat == "DOSSIER-ENTREE":
        return "00_DOSSIER_ENTREE"
    codes = {c for c, _ in versions}
    if mat == "FRANCAIS":
        if profil == "P2":
            return "90_CAS_PARTICULIERS/EAF"
        return "01_EPREUVES_ANTICIPEES"
    if mat == "MATHEMATIQUES":
        if profil == "P2":
            # En Terminale, MATH-EA seul est une dérogation exceptionnelle
            if "MATH-EA" in codes and "EDS-MATH" not in codes:
                return "90_CAS_PARTICULIERS"
            return "04_SPECIALITES"
        # En P1 et P3, les livrets comportant MATH-EA (seul ou avec EDS) comportent une épreuve anticipée
        if "MATH-EA" in codes:
            return "01_EPREUVES_ANTICIPEES"
        return "04_SPECIALITES"
    if mat in ("HISTOIRE-GEOGRAPHIE", "EMC", "ENSEIGNEMENT-SCIENTIFIQUE"):
        return "02_EVALUATIONS_PONCTUELLES"
    if mat in ("PHILOSOPHIE", "GRAND-ORAL"):
        return "03_EPREUVES_TERMINALES"
    if mat.startswith("SPE-"):
        return "04_SPECIALITES"
    if mat == "FRANCAIS-MAITRISE":
        return "05_DIAGNOSTICS_NEXUS"
    return "90_CAS_PARTICULIERS"


def livrets_attendus() -> dict:
    """Les livrets distincts que le dispositif peut avoir à produire.

    Ils se déduisent de la sélection réglementaire, appliquée à toutes les combinaisons
    de profil : un livret est un triplet matière × profil × versions, et deux candidats
    qui appellent le même triplet reçoivent le même livret.
    """
    import faits_candidat as FC
    vus = {}
    # Toutes les classes de sélection de l'espace d'états valide : chaque livret qu'un
    # candidat peut recevoir est composé, et pas seulement ceux du banc de contrôle.
    for cle_classe, classe in FC.classes_de_selection().items():
        profil = classe["profil"]
        session = int(FC.faits_de(classe["representant"])["reponses"]["session_baccalaureat_finale"])
        for mat, versions in LI.livrets_de(classe["instruments"]).items():
            cle = (mat, profil, tuple(versions), session)
            vus.setdefault(cle, []).append(cle_classe)
    return vus


#: Les variantes réglementaires d'une même matière, dans un même profil. Deux candidats
#: du même profil ne présentent pas toujours la même chose : l'un suit la spécialité
#: mathématiques et l'autre non ; l'un doit l'écrit et l'oral de français, l'autre un seul
#: des deux. Ce sont des **livrets différents**, et ils doivent porter des chemins
#: différents — sans quoi le dernier composé écrase les autres et une situation
#: réglementaire entière se retrouve sans document.
def variante(mat: str, versions, profil: str | None = None) -> tuple[str, str]:
    """Le couple (identifiant de variante, suffixe lisible) d'un livret.

    L'identifiant entre dans l'`artifact_id` du manifeste ; le suffixe entre dans le nom
    du fichier, et reste un mot que lit un opérateur — jamais un code technique. Le profil
    distingue ce qui, dans un même profil, appelle deux livrets : en deuxième partie, une
    évaluation ponctuelle de fin de cycle (ETENDUE) à côté de la version annuelle (TLE),
    et la spécialité non poursuivie (N1) à côté des spécialités présentées (NT).
    """
    codes = {c for c, _ in versions}
    vers = dict(versions)
    if mat == "MATHEMATIQUES":
        eds = vers.get("EDS-MATH")
        n1_non_poursuivie = eds == "N1" and profil in ("P2", "P3")
        if eds and not n1_non_poursuivie:
            base = "AVEC_SPECIALITE"
        elif "MATH-EA" in codes:
            base = "SANS_SPECIALITE"
        else:
            base = ""
        if profil == "P2" and "MATH-EA" in codes and eds == "NT":
            base += "_ET_ANTICIPEE"
        if n1_non_poursuivie:
            base = f"{base}_NON_POURSUIVIE" if base else "NON_POURSUIVIE"
        return (base or "UNIQUE", base)
    if mat in TRONC_COMMUN and profil == "P2" and "ETENDUE" in vers.values():
        return ("ETENDUE", "FIN_DE_CYCLE")
    if mat.startswith("SPE-") and profil in ("P2", "P3") and "N1" in vers.values():
        return ("N1_NON_POURSUIVIE", "NON_POURSUIVIE")
    if mat == "FRANCAIS":
        oral = "FR-EAF-ORAL" in codes
        v = vers.get("FR-EAF", "")
        if v == "ecrit":
            return ("ECRIT_SEUL", "ECRIT_SEUL")
        if v == "oral" and oral:
            return ("ORAL_SEUL", "ORAL_SEUL")
        return ("ECRIT_ET_ORAL", "ECRIT_ET_ORAL") if oral else ("ECRIT_SEUL", "ECRIT_SEUL")
    return ("UNIQUE", "")


def nom_matiere(mat: str) -> str:
    """Le nom de matière, sans accent ni espace : un nom de fichier qui voyage."""
    import unicodedata
    t = unicodedata.normalize("NFD", LI.MATIERES[mat][0].upper())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t.replace(" ", "_").replace("'", "")


def nom_livret(mat: str, profil: str, versions=()) -> str:
    """Un nom de fichier qu'on peut envoyer par courriel, archiver et taper au clavier.

    Les accents traversent mal les pièces jointes et les systèmes de fichiers des
    destinataires : le titre lu dans le document les garde, le nom du fichier non. Quand
    une matière a plusieurs variantes réglementaires dans le même profil, le suffixe les
    sépare — `MATHEMATIQUES_AVEC_SPECIALITE.pdf` — et le pack d'un candidat réel reprend
    le nom simple de la matière une fois la variante choisie.
    """
    _, suffixe = variante(mat, tuple(versions), profil)
    return nom_matiere(mat) + (f"_{suffixe}" if suffixe else "") + ".pdf"


def artifact_id(role: str, profil: str, mat: str, versions=()) -> str:
    """L'identité canonique d'un artefact. Unique par construction."""
    dossier = DOSSIER_PROFIL.get(profil, "00_COMMUN" if profil == "COMMUN" else profil)
    return f"{role}.{dossier}.{nom_matiere(mat)}.{variante(mat, tuple(versions), profil)[0]}"


def empreinte(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


# ─────────────────────────────────────────────── le dossier d'entrée

def dossier_entree(profil: str, cible: Path) -> Path:
    """QP et MET ne sont pas des matières : ce sont l'entrée dans le dispositif.

    Les remettre comme deux formulaires techniques obligeait le candidat à comprendre
    l'organisation interne de Nexus avant de répondre à la première question. Le dossier
    est composé sur le gabarit de la collection, depuis les sources des formulaires.
    """
    return LI.formulaire_entree(profil, cible)


# ─────────────────────────────────────────────── le guide et les matrices

GUIDE_TXT = """GUIDE DE L'OPÉRATEUR — DIAGNOSTICS NEXUS V2

SOURCE OFFICIELLE D'ENVOI

  release/diagnostics-v2/01_LIVRETS_CANDIDAT

  C'est la seule. Rien d'autre ne se remet à un candidat ni à sa famille.

  Source de contenu        banques, assemblages, référentiels, gabarits, assets.
                           C'est d'elle que tout est calculé.
  Artefacts de construction instruments/*/build et build/*. Reconstructibles,
                           jetables, jamais envoyés directement.
  Distribution             release/diagnostics-v2/ — ci-dessus.

SITUATIONS CANDIDATES ET TABLEAUX

  Les faits d'un candidat ont une seule construction (scripts/faits_candidat.py) ; l'espace
  des situations valides en est dérivé, et chaque situation est exécutée par la suite de
  tests. 04_INTERNE/STUDENT_PACK_MATRIX.csv porte une ligne par classe d'équivalence de
  sélection (mêmes instruments, mêmes livrets) et non par candidat : « states_in_class »
  compte les situations réunies, « archive » nomme l'archive témoin du banc quand il en
  bâtit une. FR-POS et FR-MAI n'y figurent que sur demande explicite.

TROIS PROFILS CANDIDATS, ET SEULEMENT TROIS

  PREMIÈRE PARTIE      Le candidat prépare les épreuves anticipées, et selon sa
                       modalité d'inscription les évaluations ponctuelles de première.
  DEUXIÈME PARTIE      Il a déjà présenté les anticipées et prépare la partie terminale.
  BAC EN UNE SESSION   Sa situation l'autorise à tout présenter à la même session.

SCOPE TRANSVERSAL — DIAGNOSTIC COMMUN

  00_COMMUN/POSITIONNEMENT_FRANCAIS.pdf
                       Diagnostic linguistique transverse (écrit + entretien oral),
                       applicable à tous les profils pour situer le niveau de maîtrise.

ARBORESCENCE THÉMATIQUE DES PROFILS (6 SOUS-DOSSIERS)

  Chaque profil candidat classe ses livrets en six sous-dossiers thématiques :

    00_DOSSIER_ENTREE/        Questionnaire de parcours et méthodes de travail (QP + MET).
    01_EPREUVES_ANTICIPEES/   Français (écrit + oral) et livrets comportant l'épreuve
                              anticipée de mathématiques (avec ou sans spécialité).
    02_EVALUATIONS_PONCTUELLES/ Histoire-géographie, EMC, Enseignement scientifique.
    03_EPREUVES_TERMINALES/   Philosophie, Grand oral (profils B et C).
    04_SPECIALITES/           Spécialités de terminale et enseignements de spécialité.
    05_DIAGNOSTICS_NEXUS/     Maîtrise du français comme outil de travail (FR-MAI).
    90_CAS_PARTICULIERS/      Dérogations exceptionnelles du Profil B (variantes EAF sous
                              90_CAS_PARTICULIERS/EAF/ et MATH-EA sans spécialité).
                              Ne jamais distribuer en parcours standard.

CE QU'ON IMPRIME

  03_IMPRESSION/                  les livrets assemblés en recueils complets de consultation
                                  (CATALOGUE_RECUEIL_COMPLET_*.pdf), avec un intercalaire par matière.
                                  Pour imprimer le pack sur-mesure d'un candidat réel, utiliser
                                  exclusivement scripts/pack_candidat.py.

CE QU'ON NE DIFFUSE JAMAIS

  02_CORRECTIONS_COACH/           corrigés, clés, grilles. Couverture bordeaux, mention
                                  CONFIDENTIEL sur chaque page. Ne sort pas de chez Nexus.

OÙ SONT LES TABLEAUX

  Chacun existe en PDF, à lire ou à imprimer, et en CSV, à ouvrir dans un tableur.

  00_GUIDE/MATRICE_PROFILS              quel livret pour quel profil
  00_GUIDE/MATRICE_EPREUVES_OFFICIELLES ce que le candidat passera réellement
  00_GUIDE/COUVERTURE_REGLEMENTAIRE     ce que Nexus couvre, et ce qu'il ne couvre pas
  00_GUIDE/PLANCHE_*.png                les couvertures et des pages intérieures, d'un coup d'œil

CE QUE NEXUS NE COUVRE PAS

  Langue vivante A et langue vivante B donnent lieu à des évaluations ponctuelles
  obligatoires pour le candidat individuel — 12 points de coefficient sur 40 —
  et ne font l'objet d'aucun diagnostic Nexus (hors offre). L'éducation physique et
  sportive, 6 points, est une évaluation physique qu'aucun document ne peut remplacer.
  Au total, 18 points de coefficient sur 40 du contrôle continu restent non couverts
  par le dispositif, contre 22 points couverts (histoire-géographie, EMC, enseignement
  scientifique, spécialité abandonnée).

  Le dispositif ne doit donc jamais être présenté comme couvrant l'intégralité du
  baccalauréat.

VERDICTS PRODUIT OFFICIELS

  READY_FOR_NEXUS_SUPPORTED_SCOPE = YES
  Le périmètre soutenu par Nexus est rigoureusement couvert, testé et documenté.

  READY_FOR_FULL_REGULATORY_BAC_COVERAGE = NO
  Le dispositif ne couvre ni les langues vivantes (LVA/LVB) ni l'EPS, et la définition
  réglementaire précise de l'épreuve ponctuelle EMC 2026-2027 reste sous réserve ministérielle.

RÉSERVE OFFICIELLE EMC

  Le diagnostic EMC Nexus évalue les contenus et compétences du programme en vigueur.
  Sa durée de 20/25 minutes est une durée diagnostique interne. La définition
  réglementaire de l'évaluation ponctuelle applicable aux passations de l'année scolaire
  2026-2027 reste à confirmer dès publication d'un texte ministériel.
"""


def tableau_en_pdf(titre: str, sous_titre: str, colonnes: list[str],
                   lignes: list[list[str]], cible: Path) -> Path:
    """Une matrice, en PDF, lisible sans tableur.

    La direction ne doit pas avoir besoin d'ouvrir un CSV pour savoir ce que contient la
    release. Le rendu est volontairement pauvre — A4 paysage, chasse fixe, filets fins —
    parce qu'un tableau de service se lit en colonnes, pas en typographie.
    """
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    largeurs = [max(len(c), *(len(str(l[i])) for l in lignes)) if lignes else len(c)
                for i, c in enumerate(colonnes)]
    total = sum(largeurs) + 3 * (len(colonnes) - 1)
    # 175 caractères tiennent en paysage à 7 pt de Courier ; au-delà, on rogne la
    # colonne la plus large plutôt que de laisser le texte sortir de la page.
    while total > 175:
        i = largeurs.index(max(largeurs))
        largeurs[i] -= 1
        total -= 1

    def ligne_de(vals):
        return "   ".join(str(v)[:largeurs[i]].ljust(largeurs[i])
                          for i, v in enumerate(vals))

    cible.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(cible), pagesize=landscape(A4))
    c.setTitle(titre)
    L, H = landscape(A4)

    def entete():
        c.setFillColorRGB(0.043, 0.122, 0.227)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(1.8 * cm, H - 1.9 * cm, titre)
        c.setFillColorRGB(0.54, 0.56, 0.60)
        c.setFont("Helvetica", 9)
        c.drawString(1.8 * cm, H - 2.45 * cm, sous_titre)
        c.setStrokeColorRGB(0.788, 0.635, 0.153)
        c.setLineWidth(1.2)
        c.line(1.8 * cm, H - 2.7 * cm, 1.8 * cm + 2.6 * cm, H - 2.7 * cm)
        c.setFillColorRGB(0.043, 0.122, 0.227)
        c.setFont("Courier-Bold", 7)
        c.drawString(1.8 * cm, H - 3.4 * cm, ligne_de(colonnes))
        c.setStrokeColorRGB(0.85, 0.86, 0.88)
        c.setLineWidth(0.4)
        c.line(1.8 * cm, H - 3.6 * cm, L - 1.8 * cm, H - 3.6 * cm)
        return H - 4.0 * cm

    y = entete()
    c.setFont("Courier", 7)
    c.setFillColorRGB(0.1, 0.1, 0.12)
    for l in lignes:
        if y < 1.6 * cm:
            c.showPage()
            y = entete()
            c.setFont("Courier", 7)
            c.setFillColorRGB(0.1, 0.1, 0.12)
        c.drawString(1.8 * cm, y, ligne_de(l))
        y -= 0.42 * cm
    c.save()
    return cible


def ecrire_guide(livrets: dict, m: dict) -> list[Path]:
    GUIDE.mkdir(parents=True, exist_ok=True)
    ecrits = []
    p = GUIDE / "GUIDE_OPERATEUR.txt"
    p.write_text(GUIDE_TXT, encoding="utf-8")
    ecrits.append(p)
    DIS.texte_en_pdf(GUIDE_TXT, GUIDE / "GUIDE_OPERATEUR.pdf",
                    "Guide de l'opérateur — diagnostics Nexus V2")
    ecrits.append(GUIDE / "GUIDE_OPERATEUR.pdf")

    p = GUIDE / "MATRICE_PROFILS.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["profil", "profil_libelle", "matiere", "variante", "livret_candidat",
                    "correction_coach", "instruments_internes", "session", "packs_concernes"])
        for (mat, profil, versions, session), packs in sorted(livrets.items(), key=str):
            w.writerow([DOSSIER_PROFIL[profil], LI.PROFILS[profil]["long"],
                        LI.MATIERES[mat][0], variante(mat, versions, profil)[0],
                        nom_livret(mat, profil, versions),
                        nom_livret(mat, profil, versions),
                        " ".join(f"{a}/{b}" for a, b in versions), session, len(packs)])
    ecrits.append(p)
    ecrits.append(tableau_en_pdf(
        "Matrice des profils", "Quel livret pour quel profil — release diagnostics-v2",
        ["Profil", "Matière", "Situation", "Livret candidat", "Instruments", "Session"],
        [[LI.PROFILS[profil]["long"], LI.MATIERES[mat][0],
          variante(mat, versions, profil)[0].replace("_", " ").capitalize(),
          nom_livret(mat, profil, versions),
          " ".join(f"{a}/{b}" for a, b in versions), session]
         for (mat, profil, versions, session) in sorted(livrets, key=str)],
        GUIDE / "MATRICE_PROFILS.pdf"))

    p = GUIDE / "MATRICE_EPREUVES_OFFICIELLES.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["code", "intitule_officiel", "type", "classe", "coefficient",
                    "duree_min", "nature", "candidat_individuel", "source", "confiance"])
        for code, e in m["epreuves_terminales"].items():
            w.writerow([code, e["intitule_officiel"], e["type"], e["classe"],
                        e["coefficient"], e["duree_min"], e["nature"],
                        e.get("candidat_individuel", ""), e["source"], e["confiance"]])
    ecrits.append(p)
    ecrits.append(tableau_en_pdf(
        "Matrice des épreuves officielles",
        "Ce que le candidat individuel présente réellement — source et confiance en regard",
        ["Code", "Intitulé officiel", "Type", "Classe", "Coef.", "Durée", "Nature",
         "Confiance"],
        [[code, e["intitule_officiel"], e["type"], e["classe"], e["coefficient"],
          LI.duree(e["duree_min"]), e["nature"], e["confiance"]]
         for code, e in m["epreuves_terminales"].items()],
        GUIDE / "MATRICE_EPREUVES_OFFICIELLES.pdf"))

    p = GUIDE / "COUVERTURE_REGLEMENTAIRE.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["enseignement", "intitule", "coefficient_total", "statut_nexus",
                    "motif"])
        for x in m["evaluations_ponctuelles"]["enseignements"]:
            couvert = x["couvert_par_nexus"]
            non = next((n for n in m["couverture_nexus"]["non_couverts"]
                        if n["code"] == x["code"]), None)
            w.writerow([x["code"], x["intitule"], x["coefficient_total"],
                        f"couvert par {couvert}" if couvert else non["statut"],
                        "" if couvert else non["motif"]])
    ecrits.append(p)
    ecrits.append(tableau_en_pdf(
        "Couverture réglementaire",
        "Évaluations ponctuelles obligatoires du candidat individuel — "
        "ce que Nexus couvre, et ce qu'il ne couvre pas",
        ["Enseignement", "Coef.", "Statut Nexus"],
        [[x["intitule"], x["coefficient_total"],
          f"couvert par {x['couvert_par_nexus']}" if x["couvert_par_nexus"]
          else next(n["statut"] for n in m["couverture_nexus"]["non_couverts"]
                    if n["code"] == x["code"])]
         for x in m["evaluations_ponctuelles"]["enseignements"]],
        GUIDE / "COUVERTURE_REGLEMENTAIRE.pdf"))
    return ecrits


# ─────────────────────────────────────────────── la construction

def compositeurs() -> int:
    """Combien de livrets se composent en même temps."""
    demande = os.environ.get("NEXUS_COMPOSITEURS")
    if demande and demande.isdigit() and int(demande) > 0:
        return int(demande)
    return max(1, min(6, (os.cpu_count() or 2) // 2))


def _composer_un(t):
    """Compose un livret et son corrigé. Exécuté dans un processus fils."""
    mat, profil, versions, session, _, cible_cand, cible_coach = t
    return (LI.composer(mat, profil, list(versions), cible_cand, coach=False,
                        session=session),
            LI.composer(mat, profil, list(versions), cible_coach, coach=True,
                        session=session))


def _dossier_un(profil):
    return dossier_entree(
        profil, LIVRETS / DOSSIER_PROFIL[profil] / "00_DOSSIER_ENTREE" / "DOSSIER_D_ENTREE_NEXUS.pdf")


def construire(plan_seulement: bool = False) -> dict:
    LI.verifier_marque()
    m = LI.modalites()
    livrets = livrets_attendus()
    if plan_seulement:
        return {"livrets": livrets, "composes": [], "erreurs": []}

    if SORTIE.exists():
        shutil.rmtree(SORTIE)
    for d in (GUIDE, LIVRETS, CORRECTIONS, IMPRESSION, INTERNE):
        d.mkdir(parents=True)
    (LIVRETS / "00_COMMUN").mkdir(parents=True, exist_ok=True)
    (CORRECTIONS / "00_COMMUN").mkdir(parents=True, exist_ok=True)

    # Chaque livret se compose indépendamment des autres : soixante-douze appels à
    # XeLaTeX en série tenaient quarante minutes, et la machine était inoccupée aux
    # quinze seizièmes. L'ordre du résultat reste celui du plan, non celui des retours.
    taches = []
    # Livret transversal commun de positionnement linguistique (FR-POS + FR-POS-ORAL)
    pos_cand = LIVRETS / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf"
    pos_coach = CORRECTIONS / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf"
    pos_versions = (("FR-POS", "standard"), ("FR-POS-ORAL", "standard"))
    taches.append(("POSITIONNEMENT-FRANCAIS", "COMMUN", pos_versions, 2027,
                   len(DIS.combinaisons()), pos_cand, pos_coach))

    for (mat, profil, versions, session), packs in sorted(livrets.items(), key=str):
        nom = nom_livret(mat, profil, versions)
        sd = sous_dossier_livret(mat, profil, versions)
        taches.append((mat, profil, tuple(versions), session, len(packs),
                       LIVRETS / DOSSIER_PROFIL[profil] / sd / nom,
                       CORRECTIONS / DOSSIER_PROFIL[profil] / sd / nom))
    # Deux livrets ne peuvent pas se disputer un chemin : le second effacerait le premier
    # et une situation réglementaire entière disparaîtrait sans bruit.
    chemins = [t[5] for t in taches] + [t[6] for t in taches]
    doublons = sorted({str(c) for c in chemins if chemins.count(c) > 1})
    if doublons:
        raise SystemExit("chemins de livret en collision : " + " ; ".join(doublons))

    composes, erreurs = [], []
    # Huit compositions simultanées saturaient une machine partagée et le noyau tuait la
    # construction. Le défaut est plus prudent, et NEXUS_COMPOSITEURS permet de l'ajuster.
    with ProcessPoolExecutor(max_workers=compositeurs()) as pool:
        entrees = {pool.submit(_composer_un, t): t for t in taches}
        entrees.update({pool.submit(_dossier_un, profil): ("_entree", profil)
                        for profil in DOSSIER_PROFIL})
        resultats = {}
        for f in as_completed(entrees):
            cle = entrees[f]
            try:
                resultats[cle] = f.result()
            except SystemExit as e:
                erreurs.append(str(e))
            except Exception as e:                        # noqa: BLE001
                erreurs.append(f"{cle[0]}/{cle[1]} : {e}")
    for t in taches:
        r = resultats.get(t)
        if r is None:
            continue
        cand, cor = r
        composes.append({"matiere": t[0], "profil": t[1], "session": t[3],
                         "variante": variante(t[0], t[2], t[1])[0],
                         "versions": [f"{a}/{b}" for a, b in t[2]],
                         "candidat": str(cand.relative_to(RACINE)),
                         "coach": str(cor.relative_to(RACINE)),
                         "sha256_candidat": empreinte(cand),
                         "sha256_coach": empreinte(cor),
                         "packs": t[4]})

    # 03 · l'impression : les mêmes livrets, assemblés dans l'ordre de passation. Une
    # matière à plusieurs variantes donne plusieurs packs — imprimer les deux livrets de
    # mathématiques dans la même liasse ferait composer au candidat une spécialité qu'il
    # ne suit pas.
    packs_impression = []
    for profil, dossier in DOSSIER_PROFIL.items():
        src = LIVRETS / dossier
        if not src.exists():
            continue
        packs_impression += assembler_impression(src, IMPRESSION / dossier, profil,
                                                 livrets)

    # 04 · ce qui reste interne : matériel machine complémentaire, tableaux techniques.
    nsi = RACINE / "instruments" / "EDS-NSI" / "tests"
    cible = INTERNE / "COMPETENCES_COMPLEMENTAIRES" / "COMPLEMENT_OPTIONNEL_NSI_PRATIQUE"
    cible.mkdir(parents=True, exist_ok=True)
    for nom in ("rendu_modele.py", "conftest.py", "test_NSI-1-PROG-01.py",
                "test_NSI-T-PROG-02.py"):
        shutil.copy2(nsi / nom, cible / nom)
    (cible / "POURQUOI_CE_DOSSIER_EST_INTERNE.txt").write_text(
        "Les candidats individuels sont dispensés de la partie pratique de l'épreuve de\n"
        "spécialité NSI : leur note est celle de la partie écrite, rapportée à 20 points.\n"
        "Ce matériel sur machine n'est donc pas une partie de l'épreuve qu'ils passeront.\n\n"
        "Il reste un outil pédagogique Nexus : la programmation est au programme, et\n"
        "l'écrire vaut mieux que la lire. Il peut être proposé en complément, jamais\n"
        "présenté comme une épreuve à préparer.\n\n"
        "Les deux items correspondants — NSI-1-PROG-01 et NSI-T-PROG-02 — ne sont plus\n"
        "imprimés dans le livret candidat. Ils restent dans la banque et dans le moteur :\n"
        "aucune mesure ne change, seul le document remis au candidat les omet.\n",
        encoding="utf-8")
    for f in ("DISTRIBUTION_MATRIX.csv", "STUDENT_PACK_MATRIX.csv",
              "CANDIDATE_PROFILES.csv", "PRINT_MATRIX.csv"):
        if (RACINE / f).exists():
            shutil.copy2(RACINE / f, INTERNE / f)

    ecrire_guide(livrets, m)
    # Les planches de contact entrent dans la release : elles sont donc produites avant
    # le manifeste, qui décrit tout ce qui s'y trouve.
    import planche_contact as PC
    try:
        PC.produire()
    except SystemExit as e:
        erreurs.append(f"planches de contact : {e}")
    ecrire_manifeste(livrets, composes, erreurs)
    return {"livrets": livrets, "composes": composes, "erreurs": erreurs}


#: Ordre de passation du pack imprimé : ce qui situe le candidat d'abord, les épreuves
#: ensuite, l'oral en dernier.
ORDRE_IMPRESSION = ["HISTOIRE-GEOGRAPHIE", "EMC", "ENSEIGNEMENT-SCIENTIFIQUE", "FRANCAIS",
                    "FRANCAIS-MAITRISE", "MATHEMATIQUES", "PHILOSOPHIE", "SPE-PHYSIQUE-CHIMIE",
                    "SPE-NSI", "SPE-SVT", "SPE-SES", "SPE-HGGSP", "SPE-HLP", "GRAND-ORAL"]


def assembler_impression(src: Path, dossier: Path, profil: str,
                         livrets: dict) -> list[Path]:
    """Les livrets d'un profil, assemblés dans l'ordre de passation, prêts à imprimer.

    Le pack imprimé perd les signets : chaque matière est donc précédée d'une page
    intercalaire, pour qu'une liasse de soixante feuilles reste une collection de livrets.

    Une matière à plusieurs variantes réglementaires donne **plusieurs packs**. Glisser
    les deux livrets de mathématiques dans la même liasse ferait composer au candidat une
    spécialité qu'il ne suit pas ; n'en glisser qu'un priverait l'autre situation de tout
    document.
    """
    import itertools
    import pypdf

    # Ce que ce profil possède, matière par matière, variante par variante.
    par_matiere: dict[str, list[tuple]] = {}
    for (mat, prof, versions, _s) in livrets:
        if prof == profil:
            if prof == "P2" and mat == "FRANCAIS":
                # L'épreuve anticipée de français ne fait pas partie du parcours standard P2
                continue
            if prof == "P2" and mat == "MATHEMATIQUES" and variante(mat, versions, prof)[0] != "AVEC_SPECIALITE":
                # En P2 standard, les mathématiques sont présentées avec la spécialité
                continue
            par_matiere.setdefault(mat, []).append(versions)
    choix = [[(mat, v) for v in sorted(par_matiere[mat], key=str)]
             for mat in ORDRE_IMPRESSION if mat in par_matiere]
    if not choix:
        return []

    ecrits = []
    inter = dossier / "_intercalaires"
    for combinaison in itertools.product(*choix):
        retenu = dict(combinaison)
        suffixes = [variante(mat, v, profil)[1] for mat, v in combinaison if variante(mat, v, profil)[1]]
        nom = "CATALOGUE_RECUEIL_COMPLET" + ("_" + "_".join(suffixes) if suffixes else "") + ".pdf"
        w = pypdf.PdfWriter()
        entree = src / "00_DOSSIER_ENTREE" / "DOSSIER_D_ENTREE_NEXUS.pdf"
        if entree.exists():
            w.add_outline_item("Dossier d'entrée Nexus", len(w.pages))
            for page in pypdf.PdfReader(str(entree)).pages:
                w.add_page(page)
        for mat in ORDRE_IMPRESSION:
            if mat not in retenu:
                continue
            sd = sous_dossier_livret(mat, profil, retenu[mat])
            f = src / sd / nom_livret(mat, profil, retenu[mat])
            if not f.exists():
                continue
            sep = inter / f"{mat}_{profil}.pdf"
            if not sep.exists():
                LI.separateur(mat, profil, sep)
            w.add_outline_item(LI.MATIERES[mat][0], len(w.pages))
            for page in pypdf.PdfReader(str(sep)).pages:
                w.add_page(page)
            for page in pypdf.PdfReader(str(f)).pages:
                w.add_page(page)
        if not w.pages:
            continue
        dossier.mkdir(parents=True, exist_ok=True)
        cible = dossier / nom
        with open(cible, "wb") as f:
            w.write(f)
        ecrits.append(cible)
    shutil.rmtree(inter, ignore_errors=True)
    return ecrits


# ─────────────────────────────────────────────── le manifeste

#: Les deux seuls fichiers de la release qui ne sont pas manifestés : le manifeste
#: lui-même et sa projection lisible. Tout le reste l'est, sans exception.
HORS_MANIFESTE = {"MANIFESTE_V2.json", "MANIFESTE_V2.md"}

#: Le rôle d'un fichier, déduit du dossier qui le porte. Il dit à l'opérateur ce qu'il
#: a le droit d'en faire.
ROLES = {"00_GUIDE": "guide", "01_LIVRETS_CANDIDAT": "candidat",
         "02_CORRECTIONS_COACH": "coach", "03_IMPRESSION": "impression",
         "04_INTERNE": "interne"}


def tete_git() -> str:
    """Le commit exact d'où sort cette release."""
    r = subprocess.run(["git", "-C", str(RACINE), "rev-parse", "HEAD"],
                       capture_output=True, text=True)
    return r.stdout.strip() or "inconnu"


def ecrire_manifeste(livrets: dict, composes: list[dict], erreurs: list[str]) -> Path:
    """Recense **tous** les fichiers de la release, avec leur identité et leur empreinte.

    Le manifeste précédent décrivait des livrets, non des fichiers : huit entrées se
    partageaient trois chemins et héritaient toutes de l'empreinte du dernier écrit. Il
    attestait donc un contenu qui n'existait pas, et masquait la collision qu'il aurait dû
    révéler. Celui-ci part des fichiers réellement présents, refuse deux identités
    identiques et refuse deux artefacts sur un même chemin.
    """
    par_chemin = {}
    for c in composes:
        par_chemin[c["candidat"]] = ("candidat", c)
        par_chemin[c["coach"]] = ("coach", c)

    artefacts = []
    for f in sorted(SORTIE.rglob("*")):
        if not f.is_file() or f.name in HORS_MANIFESTE:
            continue
        rel = str(f.relative_to(RACINE))
        partie = f.relative_to(SORTIE).parts[0]
        role, c = par_chemin.get(rel, (ROLES.get(partie, "interne"), None))
        a = {"artifact_id": None, "path": rel, "sha256": empreinte(f),
             "octets": f.stat().st_size, "role": role}
        if c is not None:
            a["artifact_id"] = artifact_id(role, c["profil"], c["matiere"],
                                           [tuple(v.split("/")) for v in c["versions"]])
            if c["profil"] in DOSSIER_PROFIL:
                a.update({"profil": DOSSIER_PROFIL[c["profil"]],
                          "profil_libelle": LI.PROFILS[c["profil"]]["long"],
                          "matiere": LI.MATIERES[c["matiere"]][0],
                          "variante": c["variante"], "session": c["session"],
                          "instruments": c["versions"]})
            else:
                a.update({"scope": "commun",
                          "profil": "00_COMMUN",
                          "profil_libelle": "Tous profils (positionnement linguistique)",
                          "matiere": LI.MATIERES[c["matiere"]][0],
                          "variante": c["variante"], "session": c["session"],
                          "instruments": c["versions"]})
        else:
            a["artifact_id"] = f"{role}.{f.relative_to(SORTIE).as_posix()}"
            profil = next((p for p, d in DOSSIER_PROFIL.items()
                           if d in f.relative_to(SORTIE).parts), None)
            if profil:
                a.update({"profil": DOSSIER_PROFIL[profil],
                          "profil_libelle": LI.PROFILS[profil]["long"]})
        artefacts.append(a)

    ids = [a["artifact_id"] for a in artefacts]
    chemins = [a["path"] for a in artefacts]
    doublons_id = sorted({i for i in ids if ids.count(i) > 1})
    doublons_ch = sorted({c for c in chemins if chemins.count(c) > 1})
    if doublons_id:
        raise SystemExit("duplicate artifact_id : " + " ; ".join(doublons_id))
    if doublons_ch:
        raise SystemExit("duplicate canonical path : " + " ; ".join(doublons_ch))

    manifeste = {
        "schema": "manifeste_release/2.0",
        "release_version": "diagnostics-v2",
        "source_git_head": tete_git(),
        "regle": "Tout fichier de release/diagnostics-v2 est décrit ici, sauf le "
                 "manifeste lui-même et sa projection lisible. Chaque artefact porte un "
                 "artifact_id et un chemin uniques ; la construction échoue sur un "
                 "doublon de l'un ou de l'autre.",
        "source_officielle_d_envoi": "release/diagnostics-v2/01_LIVRETS_CANDIDAT",
        "profils": {DOSSIER_PROFIL[k]: LI.PROFILS[k]["long"] for k in DOSSIER_PROFIL},
        "effectifs": {
            "fichiers": len(artefacts),
            "livrets_candidat": sum(1 for a in artefacts if a["role"] == "candidat"),
            "corrections_coach": sum(1 for a in artefacts if a["role"] == "coach"),
            "packs_impression": sum(1 for a in artefacts if a["role"] == "impression"),
            "combinaisons_servies": sum(len(v) for v in livrets.values()),
        },
        "artefacts": artefacts,
        "erreurs": erreurs,
    }
    cible = INTERNE / "MANIFESTE_V2.json"
    cible.write_text(json.dumps(manifeste, ensure_ascii=False, indent=2) + "\n",
                     encoding="utf-8")
    (INTERNE / "MANIFESTE_V2.md").write_text(manifeste_lisible(manifeste),
                                             encoding="utf-8")
    return cible


def manifeste_lisible(m: dict) -> str:
    """Le même manifeste, pour un humain qui vérifie ce qu'il envoie."""
    L = [f"# Manifeste — {m['release_version']}", "",
         f"Commit source : `{m['source_git_head']}`", "",
         f"Source officielle d'envoi : `{m['source_officielle_d_envoi']}`", "",
         "| Rôle | Fichier | Profil | Matière | Variante | SHA-256 |",
         "|---|---|---|---|---|---|"]
    for a in m["artefacts"]:
        L.append(f"| {a['role']} | `{Path(a['path']).name}` | "
                 f"{a.get('profil_libelle', '—')} | {a.get('matiere', '—')} | "
                 f"{a.get('variante', '—')} | `{a['sha256'][:16]}…` |")
    return "\n".join(L) + "\n"


def main(argv: list[str]) -> int:
    r = construire("--plan" in argv)
    for e in r["erreurs"]:
        print(f"  ✗ {e}")
    print(f"  {len(r['livrets'])} livrets distincts · {len(r['composes'])} composés "
          f"· {len(r['erreurs'])} échec(s)")
    if "--plan" not in argv:
        print(f"  release : {SORTIE.relative_to(RACINE)}")
    return 1 if r["erreurs"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

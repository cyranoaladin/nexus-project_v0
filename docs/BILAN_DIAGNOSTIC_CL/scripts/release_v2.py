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
            if vers.get("MATH-EA") == "SPE":
                base = "ANTICIPEE_SPE"
            else:
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
  bâtit une. « operator_print_catalogue_id » désigne le catalogue de référence opérateur
  (OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO). FR-POS et FR-MAI n'y figurent que sur
  demande explicite.

TROIS PROFILS CANDIDATS, ET SEULEMENT TROIS

  PREMIÈRE PARTIE      Le candidat prépare les épreuves anticipées, et selon sa
                       modalité d'inscription les évaluations ponctuelles de première.
  DEUXIÈME PARTIE      Il a déjà présenté les anticipées et prépare la partie terminale.
  BAC EN UNE SESSION   Sa situation l'autorise à tout présenter à la même session.

SCOPE TRANSVERSAL — DIAGNOSTIC COMMUN

  00_COMMUN/POSITIONNEMENT_FRANCAIS.pdf

CE QU'ON DONNE AU CANDIDAT

  01_LIVRETS_CANDIDAT/            les livrets de matière, avec le cartouche du profil.
                                  Remis à la famille pour l'épreuve.
    00_DOSSIER_ENTREE/        Dossier d'entrée (QP + MET) composé sous le gabarit Nexus.
    01_EPREUVES_ANTICIPEES/   Français écrit et oral (profils A et C), épreuve
                              anticipée de mathématiques (avec ou sans spécialité).
    02_EVALUATIONS_PONCTUELLES/ Histoire-géographie, EMC, Enseignement scientifique.
    03_EPREUVES_TERMINALES/   Philosophie, Grand oral (profils B et C).
    04_SPECIALITES/           Spécialités de terminale et enseignements de spécialité.
    05_DIAGNOSTICS_NEXUS/     Maîtrise du français comme outil de travail (FR-MAI).
    90_CAS_PARTICULIERS/      Dérogations exceptionnelles du Profil B (variantes EAF sous
                              90_CAS_PARTICULIERS/EAF/ et MATH-EA sans spécialité).
                              Ne jamais distribuer en parcours standard.

CE QU'ON IMPRIME

  03_IMPRESSION/                  les livrets assemblés en catalogues complets de consultation
                                  et d'impression opérateur (OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO).
                                  Les signatures logiques incluent le dossier d'entrée en tête
                                  (OPERATOR_SIGNATURES_INCLUDE_ENTRY_DOSSIER=YES) et excluent les pages
                                  intercalaires éditoriales (OPERATOR_CATALOGUE_SIGNATURE_EXCLUDES_EDITORIAL_SEPARATORS=YES).
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
  Le dispositif ne couvre ni les langues vivantes (LVA/LVB) ni l'EPS, et aucune
  modalité d'évaluation ponctuelle d'EMC n'est publiée pour l'année 2026-2027.

RÉSERVE OFFICIELLE EMC

  Le diagnostic EMC Nexus évalue les contenus et compétences du programme en vigueur.
  Sa durée de 20/25 minutes est une durée diagnostique interne, et le livret ne
  décrit aucune forme d'épreuve officielle.
  La note de service du 10 décembre 2025 (NOR MENE2531481N, BO n° 48 du 18 décembre
  2025) définit l'évaluation ponctuelle d'EMC — orale, 30 minutes, 30 minutes de
  préparation — pour la seule année scolaire 2025-2026, au titre des sessions 2026 et
  2027. Elle abroge la note de 2021. Aucun texte n'a été publié pour l'année scolaire
  2026-2027 : ce n'est pas une incertitude de documentation, c'est une absence de
  texte, à réévaluer à chaque Bulletin officiel.
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
    # Déterminisme : reportlab horodate chaque PDF et lui donne un identifiant tiré au
    # sort. Deux constructions de la même release rendaient donc quatre PDF différents
    # pour un contenu identique, et le manifeste qui porte leurs empreintes avec eux —
    # six fichiers sur cent soixante-treize. `invariant` fige l'horodatage et
    # l'identifiant ; la release redevient reproductible octet à octet.
    from reportlab import rl_config
    rl_config.invariant = 1


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
    c = canvas.Canvas(str(cible), pagesize=landscape(A4), invariant=1)
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
    for f in ("DISTRIBUTION_MATRIX.csv", "STUDENT_PACK_MATRIX.csv", "STUDENT_PACK_MATRIX.json",
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


def specifications_catalogues_impression() -> list[dict]:
    """Charge le référentiel déclaratif canonique des catalogues d'impression opérateur."""
    ref = RACINE / "referentiels" / "catalogues_operateur.json"
    if not ref.exists():
        raise FileNotFoundError(f"Référentiel manquant : {ref}")
    with open(ref, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("catalogues", [])


def recueil_impression_pour(profil: str, instruments: list | tuple,
                            mode_ep: str | None = None) -> tuple[str, str]:
    """Retourne (catalogue_id, chemin_relatif_release) du catalogue opérateur associé.

    (OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO)
    """
    inst_set = set(instruments)
    has_math_ea_spe = ("MATH-EA", "SPE") in inst_set
    has_eds_math_nt = ("EDS-MATH", "NT") in inst_set
    has_eds_math_n1 = ("EDS-MATH", "N1") in inst_set

    if profil == "P1":
        if has_eds_math_n1:
            cat_id = "CATALOGUE_P1_AVEC_SPECIALITE"
        elif has_math_ea_spe:
            cat_id = "CATALOGUE_P1_ANTICIPEE_SPE"
        else:
            cat_id = "CATALOGUE_P1_SANS_SPECIALITE"
    elif profil == "P2":
        is_fdc = (mode_ep == "fin_cycle")
        prefix = "CATALOGUE_P2_FIN_DE_CYCLE_" if is_fdc else "CATALOGUE_P2_ANNUELLE_"
        if has_eds_math_nt and has_math_ea_spe:
            cat_id = prefix + "AVEC_SPECIALITE_ET_ANTICIPEE"
        elif has_eds_math_nt:
            cat_id = prefix + "AVEC_SPECIALITE"
        elif has_eds_math_n1 and has_math_ea_spe:
            cat_id = prefix + "ANTICIPEE_SPE_NON_POURSUIVIE" if is_fdc else prefix + "ANTICIPEE_SPE"
        elif has_eds_math_n1:
            cat_id = prefix + "NON_POURSUIVIE" if is_fdc else prefix + "ANTICIPEE_SPE"
        elif has_math_ea_spe:
            cat_id = prefix + "ANTICIPEE_SPE"
        else:
            cat_id = prefix + "SANS_SPECIALITE"
    elif profil == "P3":
        if has_eds_math_nt:
            cat_id = "CATALOGUE_P3_AVEC_SPECIALITE"
        elif has_eds_math_n1:
            cat_id = "CATALOGUE_P3_ANTICIPEE_SPE_NON_POURSUIVIE"
        else:
            cat_id = "CATALOGUE_P3_SANS_SPECIALITE"
    else:
        raise ValueError(f"Profil inconnu : {profil}")

    specs = {c["catalogue_id"]: c for c in specifications_catalogues_impression()}
    if cat_id not in specs:
        raise KeyError(f"Catalogue {cat_id} introuvable dans les spécifications")
    cat = specs[cat_id]
    dossier = DOSSIER_PROFIL[profil]
    rel_path = f"release/diagnostics-v2/03_IMPRESSION/{dossier}/{cat['nom_fichier']}"
    return cat_id, rel_path


def assembler_impression(src: Path, dossier: Path, profil: str,
                         livrets: dict | None = None) -> list[Path]:
    """Les livrets d'un profil, assemblés en catalogues de consultation opérateur.

    Chaque catalogue déclaré dans referentiels/catalogues_operateur.json est assemblé
    dans l'ordre de passation, avec intercalaire par matière.
    (OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO)
    """
    import pypdf

    catalogues = [c for c in specifications_catalogues_impression() if c["profil"] == profil]
    if not catalogues:
        return []

    ecrits = []
    inter = dossier / "_intercalaires"
    inter.mkdir(parents=True, exist_ok=True)
    entree = src / "00_DOSSIER_ENTREE" / "DOSSIER_D_ENTREE_NEXUS.pdf"

    for cat in catalogues:
        nom = cat["nom_fichier"]
        w = pypdf.PdfWriter()
        if entree.exists():
            w.add_outline_item("Dossier d'entrée Nexus", len(w.pages))
            for page in pypdf.PdfReader(str(entree)).pages:
                w.add_page(page)

        for mat, v_list in cat["booklets"].items():
            v_tuples = [tuple(v) for v in v_list]
            sd = sous_dossier_livret(mat, profil, v_tuples)
            f = src / sd / nom_livret(mat, profil, v_tuples)
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
        with open(cible, "wb") as f_out:
            w.write(f_out)
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


def table_artefacts_canoniques(livrets: dict | None = None) -> dict[str, dict]:
    """Construit la table canonique des métadonnées métier de tous les PDF candidat et coach.

    Dérivée de façon déterministe depuis livrets_attendus(), nom_livret(),
    sous_dossier_livret() et DOSSIER_PROFIL, ainsi que des livrets transversaux
    (dossier d'entrée et positionnement linguistique).
    """
    if livrets is None:
        livrets = livrets_attendus()

    par_chemin = {}

    # 1. Livrets transversaux communs : Positionnement linguistique
    pos_cand = "release/diagnostics-v2/01_LIVRETS_CANDIDAT/00_COMMUN/POSITIONNEMENT_FRANCAIS.pdf"
    pos_coach = "release/diagnostics-v2/02_CORRECTIONS_COACH/00_COMMUN/POSITIONNEMENT_FRANCAIS.pdf"

    meta_pos = {
        "scope": "commun",
        "profil": "00_COMMUN",
        "profil_libelle": "Tous profils (positionnement linguistique)",
        "matiere": "Positionnement français",
        "variante": "POSITIONNEMENT",
        "session": 2027,
        "instruments": ["FR-POS/standard", "FR-POS-ORAL/standard"],
    }
    par_chemin[pos_cand] = {
        **meta_pos,
        "role": "candidat",
        "artifact_id": "candidat.00_COMMUN.POSITIONNEMENT_FRANCAIS.POSITIONNEMENT",
    }
    par_chemin[pos_coach] = {
        **meta_pos,
        "role": "coach",
        "artifact_id": "coach.00_COMMUN.POSITIONNEMENT_FRANCAIS.POSITIONNEMENT",
    }

    # 2. Dossiers d'entrée de chaque profil
    for prof, dossier in DOSSIER_PROFIL.items():
        entree_cand = f"release/diagnostics-v2/01_LIVRETS_CANDIDAT/{dossier}/00_DOSSIER_ENTREE/DOSSIER_D_ENTREE_NEXUS.pdf"
        meta_entree = {
            "profil": dossier,
            "profil_libelle": LI.PROFILS[prof]["long"],
            "matiere": "Dossier d'entrée",
            "variante": "QP_MET",
            "session": 2027,
            "instruments": ["QP/standard", "MET/standard"],
        }
        par_chemin[entree_cand] = {
            **meta_entree,
            "role": "candidat",
            "artifact_id": f"candidat.{dossier}.DOSSIER_ENTREE.QP_MET",
        }

    # 3. Tous les livrets disciplinaires déclarés dans livrets_attendus()
    for (mat, prof, versions, session), packs in livrets.items():
        nom = nom_livret(mat, prof, versions)
        sd = sous_dossier_livret(mat, prof, versions)
        dossier = DOSSIER_PROFIL[prof]
        cand_path = f"release/diagnostics-v2/01_LIVRETS_CANDIDAT/{dossier}/{sd}/{nom}"
        coach_path = f"release/diagnostics-v2/02_CORRECTIONS_COACH/{dossier}/{sd}/{nom}"
        var_nom = variante(mat, versions, prof)[0]
        inst_list = [f"{a}/{b}" for a, b in versions]

        meta_base = {
            "profil": dossier,
            "profil_libelle": LI.PROFILS[prof]["long"],
            "matiere": LI.MATIERES[mat][0],
            "variante": var_nom,
            "session": session,
            "instruments": inst_list,
        }
        par_chemin[cand_path] = {
            **meta_base,
            "role": "candidat",
            "artifact_id": artifact_id("candidat", prof, mat, versions),
        }
        par_chemin[coach_path] = {
            **meta_base,
            "role": "coach",
            "artifact_id": artifact_id("coach", prof, mat, versions),
        }

    return par_chemin


def ecrire_manifeste(livrets: dict, composes: list[dict] | None = None,
                     erreurs: list[str] | None = None) -> Path:
    """Recense **tous** les fichiers de la release, avec leur identité et leur empreinte.

    Chaque fichier de livret candidat ou coach est enrichi depuis la table canonique
    déterministe, garantissant des métadonnées complètes et stables.
    """
    if erreurs is None:
        erreurs = []
    table_canonique = table_artefacts_canoniques(livrets)

    artefacts = []
    for f in sorted(SORTIE.rglob("*")):
        if not f.is_file() or f.name in HORS_MANIFESTE:
            continue
        rel = str(f.relative_to(RACINE))
        partie = f.relative_to(SORTIE).parts[0]

        if rel in table_canonique:
            meta = table_canonique[rel]
            role = meta["role"]
            a = {
                "artifact_id": meta["artifact_id"],
                "path": rel,
                "sha256": empreinte(f),
                "octets": f.stat().st_size,
                "role": role,
            }
            for k, v in meta.items():
                if k not in ("role", "artifact_id"):
                    a[k] = v
        else:
            role = ROLES.get(partie, "interne")
            a = {"artifact_id": None, "path": rel, "sha256": empreinte(f),
                 "octets": f.stat().st_size, "role": role}
            a["artifact_id"] = f"{role}.{f.relative_to(SORTIE).as_posix()}"
            profil = next((p for p, d in DOSSIER_PROFIL.items()
                           if d in f.relative_to(SORTIE).parts), None)
            if profil:
                a.update({"profil": DOSSIER_PROFIL[profil],
                          "profil_libelle": LI.PROFILS[profil]["long"]})
            if role == "impression":
                cat = next((c for c in specifications_catalogues_impression()
                            if c["nom_fichier"] == f.name and c["profil"] == profil), None)
                if cat:
                    a.update({
                        "catalogue_id": cat["catalogue_id"],
                        "libelle": cat["libelle"],
                        "operator_catalogue_signature": cat["operator_catalogue_signature"],
                        "purpose": cat["purpose"],
                    })
        artefacts.append(a)

    ids = [a["artifact_id"] for a in artefacts]
    chemins = [a["path"] for a in artefacts]
    doublons_id = sorted({i for i in ids if ids.count(i) > 1})
    doublons_ch = sorted({c for c in chemins if chemins.count(c) > 1})
    if doublons_id:
        raise SystemExit("duplicate artifact_id : " + " ; ".join(doublons_id))
    if doublons_ch:
        raise SystemExit("duplicate canonical path : " + " ; ".join(doublons_ch))

    import distribution as DIS
    import faits_candidat as FC
    classes_sel = DIS.classes()
    etats_cand = FC.candidate_state_space()
    catalogues_specs = specifications_catalogues_impression()

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
            "selection_classes": len(classes_sel),
            "candidate_states": len(etats_cand),
            "booklet_class_links": sum(len(v) for v in livrets.values()),
            "operator_print_catalogues": len(catalogues_specs),
            "combinaisons_servies": sum(len(v) for v in livrets.values()),
            "_combinaisons_servies_deprecation": (
                "DEPRECATED: ce compteur represente booklet_class_links (liens livret-classe) "
                "et non le nombre de classes ou d'etats. Utiliser selection_classes ou candidate_states."
            ),
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
                 f"{a.get('profil_libelle', '—')} | {a.get('matiere') or a.get('libelle', '—')} | "
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

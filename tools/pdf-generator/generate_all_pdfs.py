#!/usr/bin/env python3
"""Generate all 7 Nexus Réussite pre-rentrée 2026 PDFs."""

import json
import os
from pathlib import Path
from weasyprint import HTML

TOOL_DIR = Path(__file__).parent
REPO_ROOT = TOOL_DIR.parent.parent
OUT_DIR = TOOL_DIR / "output"
OUT_DIR.mkdir(exist_ok=True)
ARCHIVE_DIR = TOOL_DIR / "archive"
# Official charte logo (sealed visualIdentity)
LOGO_SLOGAN = str(REPO_ROOT / "public" / "images" / "logo_slogan_nexus_x3.png")
LOGO_COMPACT = str(REPO_ROOT / "public" / "images" / "logo_slogan_nexus_x3.png")
_qr = TOOL_DIR / "qr_stage.png"
QR_CODE = str(_qr) if _qr.exists() else ""

# Horaires read EXCLUSIVELY from the sealed campaign JSON (D4-final) — never from .md.
CAMPAIGN = json.loads((REPO_ROOT / "data" / "campaigns" / "pre-rentree-2026.json").read_text(encoding="utf-8"))
_BLOCK_TIMES = {b["id"]: (b["startTime"], b["endTime"]) for b in CAMPAIGN["blocks"]}
SCHEDULE = []
for _wk in CAMPAIGN["schedule"]:
    for _s in _wk["slots"]:
        _st, _et = _BLOCK_TIMES[_s["block"]]
        SCHEDULE.append({**_s, "week": _wk["week"], "startTime": _st, "endTime": _et})

# SVT programmes = données du dépôt (modules.json). Filigrane DRAFT piloté par la décision D2.
_MODULES = json.loads((REPO_ROOT / "content" / "pre-rentree-2026" / "modules.json").read_text(encoding="utf-8"))["modules"]
SVT_MODULES = {m["level"]: m for m in _MODULES if m["subjectId"] == "SVT"}
_DECISIONS = json.loads((REPO_ROOT / "content" / "pre-rentree-2026" / "publication-decisions.owner.json").read_text(encoding="utf-8"))["decisions"]
# DRAFT tant que D2 n'est pas levée. Pour régénérer sans filigrane: passer
# decisions.svtProgramValidation.status à "approved_for_publication" dans publication-decisions.owner.json.
SVT_DRAFT = _DECISIONS.get("svtProgramValidation", {}).get("status") == "draft_until_owner_validation"

DRAFT_CSS = """
.draft-watermark {
    position: fixed;
    top: 45%;
    left: 0;
    width: 100%;
    text-align: center;
    transform: rotate(-30deg);
    font-size: 62pt;
    font-weight: 800;
    color: rgba(190, 40, 40, 0.14);
    letter-spacing: 6px;
    z-index: 9999;
}
"""


def make_svt_programme_body(level_label, module):
    """Programme SVT mono-matière depuis les données du dépôt (extraction fidèle)."""
    header_title = f"Programme SVT · Entrée en {level_label}"
    body = make_cover("Programme détaillé — SVT", f"Entrée en {level_label}")
    if SVT_DRAFT:
        body += '<div class="draft-watermark">DOCUMENT DE TRAVAIL</div>'
        body += ('<p style="color:#BE2828; font-weight:700; text-align:center; margin:0 0 10px;">'
                 'DOCUMENT DE TRAVAIL — programme SVT en attente de validation pédagogique (décision D2).</p>')
    body += make_header(header_title)
    body += (f'<h2>{module["title"]}</h2>'
             f'<p class="intro">{module["subtitle"]}</p>')
    body += """<table class="programme"><thead><tr>
        <th>Séance</th><th>Objectif</th><th>Notions clés</th><th>Livrable</th>
    </tr></thead><tbody>"""
    for s in module["sessions"]:
        seance = f'{s["number"]}. {s["title"]}'
        notions = ", ".join(s["topics"])
        body += (f"<tr><td>{seance}</td><td>{s['objective']}</td>"
                 f"<td>{notions}</td><td>{s['deliverable']}</td></tr>")
    body += "</tbody></table>"
    return body

# ─── Shared CSS ───────────────────────────────────────────────────────────────

COMMON_CSS = """
@page {
    size: A4 portrait;
    margin: 18mm 20mm 18mm 20mm;
    @bottom-center {
        content: none;
    }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Inter', sans-serif;
    color: #1A1A1A;
    font-size: 10pt;
    line-height: 1.5;
}
a { color: #071A3A; text-decoration: none; }

/* Cover page */
.cover {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
}
.cover img.logo-slogan {
    width: 55mm;
    margin-bottom: 30px;
}
.cover h1 {
    color: #071A3A;
    font-size: 22pt;
    font-weight: 700;
    margin-bottom: 8px;
}
.cover .cover-subtitle {
    color: #071A3A;
    font-size: 13pt;
    font-weight: 600;
    margin-bottom: 4px;
}
.cover .cover-info {
    color: #555;
    font-size: 10.5pt;
    margin-top: 20px;
    line-height: 1.7;
}
.cover .cover-band {
    margin-top: 30px;
    padding: 12px 20px;
    border: 1px solid #E0E0E0;
    border-radius: 4px;
    background: #F5F6F8;
    font-size: 10pt;
    color: #071A3A;
    line-height: 1.8;
    font-weight: 500;
}

/* Interior header */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #E0E0E0;
    padding-bottom: 6px;
    margin-bottom: 14px;
}
.page-header img {
    width: 12mm;
}
.page-header .header-title {
    color: #071A3A;
    font-size: 9pt;
    font-weight: 600;
}

/* Footer */
.page-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 7pt;
    color: #999;
    padding-top: 4px;
    border-top: 1px solid #E0E0E0;
}

/* Section titles */
h2 {
    color: #071A3A;
    font-size: 13pt;
    font-weight: 700;
    margin-bottom: 10px;
    border-left: 3px solid #C9A227;
    padding-left: 8px;
}
h3 {
    color: #071A3A;
    font-size: 11pt;
    font-weight: 700;
    margin-top: 14px;
    margin-bottom: 6px;
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
}
thead th {
    background: #071A3A;
    color: #FFFFFF;
    padding: 5px 6px;
    text-align: left;
    font-weight: 600;
    font-size: 8.5pt;
}
tbody td {
    padding: 4px 6px;
    border-bottom: 1px solid #E8E8E8;
    font-size: 9pt;
    vertical-align: top;
}
tbody tr:nth-child(even) td {
    background: #F5F6F8;
}

/* Page break */
.page-break { page-break-before: always; }

/* Prevent row/list-item splitting across pages */
tr, li { break-inside: avoid; }
ol, ul { break-inside: avoid; }
h2, h3 { break-after: avoid; }
table { break-inside: auto; }

/* Guarantees list */
.check-list { list-style: none; padding: 0; }
.check-list li {
    padding-left: 14px;
    position: relative;
    margin-bottom: 4px;
    font-size: 9.5pt;
}
.check-list li::before {
    content: "\\2714";
    position: absolute;
    left: 0;
    color: #C9A227;
    font-weight: 700;
}

/* Intro block */
.intro {
    background: #F5F6F8;
    border-left: 3px solid #C9A227;
    padding: 10px 12px;
    margin-bottom: 14px;
    font-size: 9.5pt;
    line-height: 1.6;
}

/* Compact table for programmes */
table.programme thead th { font-size: 8pt; }
table.programme tbody td { font-size: 9pt; line-height: 1.35; }
table.programme tbody td:first-child { font-weight: 600; width: 14%; }
table.programme tbody td:nth-child(2) { width: 26%; }
table.programme tbody td:nth-child(3) { width: 35%; }
table.programme tbody td:nth-child(4) { width: 25%; }
"""


def make_cover(title, subtitle=""):
    return f"""
    <div class="cover">
        <img class="logo-slogan" src="{LOGO_SLOGAN}" alt="Nexus Réussite">
        <h1>{title}</h1>
        {f'<div class="cover-subtitle">{subtitle}</div>' if subtitle else ''}
        <div class="cover-info">
            Stages de pré-rentrée · 17–28 août 2026<br>
            Mutuelleville, Tunis
        </div>
        <div class="cover-band">
            Groupes de 3 à 5 élèves · 10&nbsp;h par matière · À partir de 480&nbsp;TND<br>
            <a href="https://nexusreussite.academy/stages/pre-rentree-2026" style="color:#C9A227; font-size:9pt;">nexusreussite.academy/stages/pre-rentree-2026</a>
        </div>
    </div>
    """


def make_header(title):
    return f"""
    <div class="page-header">
        <img src="{LOGO_COMPACT}" alt="Nexus Réussite">
        <span class="header-title">{title}</span>
    </div>
    """


FOOTER_HTML = """
<div class="page-footer">
    <a href="tel:+21699192829">+216 99 19 28 29</a> ·
    <a href="mailto:contact@nexusreussite.academy">contact@nexusreussite.academy</a> ·
    <a href="https://nexusreussite.academy">nexusreussite.academy</a>
</div>
"""


def wrap_html(body, title, extra_css=""):
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<meta name="author" content="Nexus Réussite">
<meta name="description" content="Stages de pré-rentrée 2026">
<style>
{COMMON_CSS}
{extra_css}
</style>
</head>
<body>
{body}
{FOOTER_HTML}
</body>
</html>"""


def generate_pdf(html_content, filename, title):
    """Generate PDF with metadata."""
    html = HTML(string=html_content, base_url=str(OUT_DIR))
    doc = html.render()
    doc.metadata.title = title
    doc.metadata.authors = ["Nexus Réussite"]
    doc.metadata.description = "Stages de pré-rentrée 2026"
    doc.write_pdf(str(OUT_DIR / filename))
    size = os.path.getsize(OUT_DIR / filename)
    print(f"  {filename}: {size // 1024} Ko")
    return filename


# ─── Programme docs (1, 2, 3) ─────────────────────────────────────────────────

PROGRAMMES = {
    "Seconde": {
        "lines": (9, 50),  # from doc1
        "matières": [
            ("Mathématiques", "consolider la Troisième, découvrir les attentes du lycée", [
                ("1. Calcul et calcul littéral", "Consolider calcul numérique, développement, factorisation", "Identités remarquables, fractions, puissances, proportionnalité, équations produit-nul", "Fiche méthode calcul littéral avec exemples résolus"),
                ("2. Fonctions : lecture graphique", "Lire et interpréter une courbe, maîtriser le vocabulaire", "Image, antécédent, variations, extremums, fonctions de référence", "Carte mentale du vocabulaire des fonctions"),
                ("3. Équations et inéquations", "Résoudre et mettre en équation des problèmes", "1er degré, inéquations sur un axe, systèmes 2×2, modélisation", "Fiche réflexe résolution"),
                ("4. Géométrie repérée et vecteurs", "Se repérer dans le plan", "Repère orthonormé, distance, milieu, coordonnées de vecteurs, colinéarité", "Formulaire géométrie repérée annoté"),
                ("5. Rédaction et méthodologie", "Structurer un raisonnement, rédiger proprement", "Démonstration, connecteurs logiques, gestion du temps, sujet type", "Grille d'auto-évaluation de la rédaction"),
            ]),
            ("Français", "compréhension, expression, argumentation", [
                ("1. Le paragraphe argumenté", "Rédiger un paragraphe clair avec exemples", "Structure argument-exemple-analyse, connecteurs, registres", "Fiche méthode avec modèles"),
                ("2. Analyse de texte littéraire", "Identifier les procédés, formuler une interprétation", "Champs lexicaux, figures de style, registres, structure", "Boîte à outils des procédés littéraires"),
                ("3. Convaincre et persuader", "Mobiliser les stratégies argumentatives", "Thèse/arguments/exemples, concession, réfutation", "Plan-type d'un développement argumenté"),
                ("4. Grammaire de l'expression", "Maîtriser les outils grammaticaux du lycée", "Subordonnées, temps verbaux, accords complexes, ponctuation", "Mémo grammaire lycée"),
                ("5. Initiation au commentaire", "Comprendre la méthode du commentaire composé", "Paraphrase vs analyse, axe de lecture, intro/conclusion", "Modèle de brouillon commentaire"),
            ]),
            ("Informatique — initiation algorithmique, Python et SNT", None, [
                ("1. Pensée algorithmique", "Comprendre et décomposer un algorithme", "Algorithme, sous-problèmes, pseudo-code, découverte Python", "Premier programme Python commenté"),
                ("2. Variables et conditions", "Créer des programmes interactifs", "Types (int, float, str, bool), input/print, if/elif/else", "Mini-programme interactif (quiz, calculatrice)"),
                ("3. Boucles", "Automatiser des traitements", "for et range(), while, accumulateurs, boucles imbriquées", "Programme à boucles (tables, motifs)"),
                ("4. Données et web", "Comprendre la représentation et la circulation des données", "Binaire, encodage, formats, client/serveur/URL, HTML de base", "Mini page HTML personnelle"),
                ("5. Projet intégrateur", "Mobiliser toutes les notions", "Cahier des charges, fonctions simples, test, documentation", "Programme Python finalisé (jeu ou utilitaire)"),
            ]),
            ("Physique-Chimie", "unités, matière et raisonnement scientifique", [
                ("1. Grandeurs et conversions", "Maîtriser les unités SI et les conversions", "Préfixes, puissances de 10, chiffres significatifs, ordres de grandeur", "Fiche réflexe unités et conversions"),
                ("2. Atomes et molécules", "Décrire la structure de la matière", "Atome, tableau périodique, liaison covalente, Lewis", "Carte mémo atomes-molécules"),
                ("3. Forces et mouvement", "Identifier les forces, décrire un mouvement", "Poids, réaction, tension, diagramme objets-interactions, trajectoire", "Méthode du diagramme de forces"),
                ("4. Exploitation de mesures", "Utiliser les maths pour exploiter l'expérience", "Formules littérales, graphiques, pente, incertitudes", "Fiche méthode graphiques et formules"),
                ("5. Démarche expérimentale", "Appliquer la démarche scientifique complète", "Hypothèses, protocole, compte-rendu, exercice type devoir", "Modèle de rédaction scientifique"),
            ]),
        ]
    },
    "Première": {
        "matières": [
            ("Mathématiques (préparation à la spécialité)", "sécuriser les fondations de la Seconde", [
                ("1. Calcul algébrique et second degré", "Automatiser le calcul, découvrir la forme canonique", "Factorisation, équations/inéquations, forme canonique, racines", "Fiche méthode second degré"),
                ("2. Fonctions de référence et variations", "Consolider l'étude qualitative des fonctions", "Fonctions carré/inverse/racine, variations, taux d'accroissement", "Formulaire fonctions de référence"),
                ("3. Vers la dérivation", "Préparer le concept central de Première", "Taux de variation, sécante/tangente (approche graphique), nombre dérivé (intuition)", "Fiche introduction à la dérivation"),
                ("4. Suites numériques : premiers pas", "Découvrir les modes de génération", "Suite explicite et par récurrence, arithmétique/géométrique (initiation), calculs de termes", "Fiche réflexe suites"),
                ("5. Probabilités et méthodologie", "Consolider les probabilités et la rédaction", "Arbres, tableaux, probabilités conditionnelles (initiation), sujet type", "Grille de rédaction mathématique Première"),
            ]),
            ("Français", "cap sur l'EAF (voies générale et technologique)", [
                ("1. L'année de l'EAF : cartographie", "Comprendre les épreuves et les attendus", "Écrit (commentaire, dissertation, contraction-essai en techno), oral, œuvres au programme", "Carte des épreuves EAF et calendrier de travail"),
                ("2. La lecture linéaire", "Poser la méthode de l'explication orale", "Mouvement du texte, procédés, interprétation, formulation", "Modèle de lecture linéaire pas à pas"),
                ("3. Le commentaire littéraire", "Construire un plan à partir du texte", "Axes, sous-parties, citations intégrées, intro/conclusion", "Plan-type de commentaire réutilisable"),
                ("4. La dissertation sur œuvre", "Problématiser et argumenter à partir d'une œuvre", "Analyse du sujet, thèse, exemples précis, transitions", "Méthode de la dissertation en 6 étapes"),
                ("5. Grammaire et question de langue", "Préparer la question de grammaire de l'oral", "Subordonnées, négation, interrogation, analyse syntaxique", "Mémo grammaire de l'oral EAF"),
            ]),
            ("NSI Première", "bases solides pour démarrer la spécialité", [
                ("1. Python : remise à niveau active", "Consolider variables, conditions, boucles", "Types de base, if/for/while, entrées-sorties, traçage d'exécution", "Batterie d'exercices corrigés commentés"),
                ("2. Fonctions", "Structurer un programme en fonctions", "Définition, paramètres, return, portée des variables, tests simples", "Fiche méthode « écrire une fonction propre »"),
                ("3. Listes et parcours", "Manipuler la structure de données centrale", "Création, indexation, slicing, parcours, construction par compréhension (initiation)", "Programmes types sur les listes"),
                ("4. Représentation des données", "Comprendre le binaire et les encodages", "Base 2/16, entiers, booléens et logique, encodage des caractères", "Fiche conversions et représentations"),
                ("5. Mini-projet algorithmique", "Résoudre un problème complet en autonomie guidée", "Recherche dans une liste, maximum/minimum, moyenne, documentation", "Projet Python documenté et testé"),
            ]),
            ("Physique-Chimie", "consolider la Seconde, anticiper la Première", [
                ("1. Outils du chimiste", "Fiabiliser grandeurs et calculs de chimie", "Masse molaire, quantité de matière (mole), concentrations, dilution", "Fiche réflexe quantité de matière"),
                ("2. Transformations chimiques", "Décrire et ajuster une transformation", "Équation de réaction, ajustement, réactif limitant (initiation)", "Méthode du bilan de matière"),
                ("3. Mouvement et interactions", "Consolider forces et mouvement", "Vitesse, vecteur vitesse (initiation), principe d'inertie, modélisation d'une action", "Fiche mécanique de transition"),
                ("4. Signaux et ondes", "Consolider les signaux de Seconde", "Signal sonore, période/fréquence, spectre, propagation", "Carte mémo ondes et signaux"),
                ("5. Méthodologie de l'épreuve", "Rédiger un exercice de physique-chimie complet", "Analyse d'énoncé, formules littérales d'abord, unités, sujet type", "Modèle de rédaction scientifique Première"),
            ]),
        ]
    },
    "Terminale": {
        "matières": [
            ("Mathématiques (spécialité)", "verrouiller la Première avant l'année décisive", [
                ("1. Dérivation : maîtrise complète", "Automatiser le calcul de dérivées et leurs usages", "Formules et opérations, tangentes, variations, signe de f'", "Formulaire dérivation + exercices types"),
                ("2. Fonction exponentielle", "Consolider LA fonction de Première", "Propriétés algébriques, équations/inéquations, exp et dérivation", "Fiche réflexe exponentielle"),
                ("3. Suites : vers les limites", "Consolider les suites et préparer la récurrence", "Arithmétiques/géométriques, sens de variation, comportement à l'infini (approche), notation Σ (initiation)", "Fiche suites de transition"),
                ("4. Probabilités conditionnelles", "Fiabiliser un chapitre à fort rendement bac", "Arbres pondérés, formule des probabilités totales, indépendance, variables aléatoires", "Méthode des arbres + exercices bac"),
                ("5. Trigonométrie, produit scalaire et méthodo", "Boucler les outils géométriques et la rédaction", "Cercle trigonométrique, produit scalaire (bilan), sujet type bac chronométré", "Plan de travail personnalisé pour la Terminale"),
            ]),
            ("Français / Expression et oral", "écrire et parler au niveau Terminale", [
                ("1. Argumentation écrite de niveau Terminale", "Structurer une réflexion exigeante", "Problématisation, plan dialectique et progressif, exemples précis", "Méthode de la réflexion argumentée (propédeutique philo)"),
                ("2. Synthèse et reformulation", "Comprendre, condenser, restituer", "Idées essentielles, hiérarchisation, reformulation fidèle", "Fiche méthode synthèse de documents"),
                ("3. Prise de parole structurée", "Poser voix, posture et plan à l'oral", "Accroche, annonce du plan, transitions orales, gestion du temps", "Grille d'auto-évaluation de l'oral"),
                ("4. Vers le Grand Oral", "Comprendre l'épreuve et amorcer une question", "Format et attentes du jury, choix des questions, lien avec les spécialités", "Canevas de construction d'une question de Grand Oral"),
                ("5. Entraînement oral filmé/évalué", "S'exercer en conditions avec retour individuel", "Passage individuel, feedback structuré, axes de progrès", "Bilan oral individualisé écrit"),
            ]),
            ("NSI Terminale", "consolider la Première NSI", [
                ("1. Python avancé : fonctions et tests", "Fiabiliser l'écriture de code structuré", "Fonctions, assertions, jeux de tests, documentation", "Gabarit de fonction testée et documentée"),
                ("2. Structures : listes, tuples, dictionnaires", "Choisir la bonne structure de données", "Parcours, dictionnaires clé-valeur, tableaux de tableaux, traitement de données", "Fiche comparative des structures"),
                ("3. Algorithmes de référence", "Consolider les algorithmes de Première", "Recherche séquentielle et dichotomique, tris (insertion, sélection), coût (initiation)", "Fiches algorithmes avec invariants"),
                ("4. Récursivité : première approche", "Préparer un pilier de la Terminale", "Principe, cas de base, appels récursifs simples, pile d'appels (intuition)", "Fiche récursivité avec exemples gradués"),
                ("5. Mini-projet de synthèse", "Mobiliser structures et algorithmes", "Projet guidé (traitement de données ou jeu), découpage en fonctions, tests", "Projet documenté + plan de travail Terminale"),
            ]),
            ("Physique-Chimie", "verrouiller la Première", [
                ("1. Chimie des solutions", "Fiabiliser les calculs de chimie", "Quantité de matière, avancement, tableau d'avancement, titrage (initiation)", "Méthode du tableau d'avancement"),
                ("2. Mécanique", "Consolider mouvement et forces", "Vecteurs vitesse et accélération (approche), lois de Newton (bilan Première)", "Fiche mécanique de transition Terminale"),
                ("3. Énergie", "Consolider les bilans énergétiques", "Énergie cinétique/potentielle/mécanique, travail d'une force, conservation", "Carte des chaînes énergétiques"),
                ("4. Ondes et signaux", "Consolider les ondes mécaniques", "Célérité, période, longueur d'onde, phénomènes ondulatoires", "Formulaire ondes"),
                ("5. Méthodologie type bac", "Rédiger un exercice complet en conditions", "Analyse, résolution littérale, application numérique, unités, sujet type", "Modèle de rédaction + plan de travail Terminale"),
            ]),
        ]
    },
}


def make_programme_body(level_name, data):
    """Generate HTML body for a programme PDF."""
    header_title = f"Programme · Entrée en {level_name}"
    intro_text = ("Chaque séance suit le même cadre : un objectif annoncé, des notions travaillées, "
                  "une méthode active, et un <strong>livrable</strong> que l'élève emporte. "
                  "Un diagnostic est réalisé en début de module et un <strong>bilan écrit est remis aux parents</strong> à l'issue du stage.")

    body = make_cover(f"Programme détaillé", f"Entrée en {level_name}")
    body += make_header(header_title)
    body += f'<div class="intro">{intro_text}</div>'

    for i, (mat_name, mat_sub, sessions) in enumerate(data["matières"]):
        if i > 0 and i % 2 == 0:
            body += f'<div class="page-break"></div>{make_header(header_title)}'

        subtitle = f" — {mat_sub}" if mat_sub else ""
        body += f"<h2>{mat_name}{subtitle}</h2>"
        body += """<table class="programme">
        <thead><tr>
            <th>Séance</th>
            <th>Objectif</th>
            <th>Notions clés</th>
            <th>Livrable</th>
        </tr></thead><tbody>"""
        for seance, objectif, notions, livrable in sessions:
            body += f"<tr><td>{seance}</td><td>{objectif}</td><td>{notions}</td><td>{livrable}</td></tr>"
        body += "</tbody></table>"

    return body


def make_planning_body():
    """Generate HTML body for the planning PDF."""
    header_title = "Planning et informations pratiques"

    level_map = {'TROISIEME': '3e', 'SECONDE': 'Seconde', 'PREMIERE': 'Première', 'TERMINALE': 'Terminale'}
    def subject_label(subject_key, level_key):
        base = {
            'MATHEMATIQUES': 'Mathématiques',
            'FRANCAIS': 'Français',
            'PHYSIQUE_CHIMIE': 'Physique-Chimie',
            'PHILOSOPHIE': 'Philosophie',
            'SVT': 'SVT',
        }
        if subject_key in base:
            return base[subject_key]
        # NSI: "Informatique / SNT" for Seconde, "NSI" for Première/Terminale
        if subject_key == 'NSI':
            return 'Informatique / SNT' if level_key == 'SECONDE' else 'NSI'
        return subject_key

    subject_map = None  # use subject_label() instead

    body = make_cover("Planning et informations pratiques")

    # Page 1: Repères généraux
    body += make_header(header_title)
    body += "<h2>Repères généraux</h2>"
    body += """<table>
    <tbody>
        <tr><td style="width:25%; font-weight:700; color:#071A3A">Dates</td><td>Du lundi 17 au vendredi 28 août 2026 — <em>aucun cours les 22 et 23 août</em></td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Lieu</td><td>Centre Nexus Réussite, Mutuelleville, Tunis</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Public</td><td>Élèves entrant en Seconde, Première ou Terminale (rentrée 2026-2027)</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Format</td><td>1 à 4 matières au choix parmi 5 (SVT en Première et Terminale) · 5 séances de 2 h par matière · 10 h par matière</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Effectif</td><td>Groupes de 3 à 5 élèves maximum</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Blocs horaires</td><td>A : 08:30–10:30 · B : 10:45–12:45 · C : 13:30–15:30 · D : 15:45–17:45</td></tr>
    </tbody></table>"""

    # Planning per level
    for level_key, level_label in [('SECONDE', 'Seconde'), ('PREMIERE', 'Première'), ('TERMINALE', 'Terminale')]:
        slots = [s for s in SCHEDULE if s['level'] == level_key]
        slots.sort(key=lambda s: (s['week'], ['A','B','C','D'].index(s['block'])))

        # For Seconde: show day details; for others: same structure
        week1 = [s for s in slots if s['week'] == 1]
        week2 = [s for s in slots if s['week'] == 2]

        days_w1 = "Lun 17 → Ven 21 août"
        days_w2 = "Lun 24 → Ven 28 août"

        body += f"<h2>Planning — Entrée en {level_label}</h2>"
        body += """<table>
        <thead><tr>
            <th>Matière</th><th>Semaine</th><th>Jours</th><th>Créneau</th><th>Salle</th>
        </tr></thead><tbody>"""

        for s in week1:
            sn = subject_label(s['subject'], level_key)
            body += f"<tr><td>{sn}</td><td>Semaine 1</td><td>{days_w1}</td><td>{s['startTime']}–{s['endTime']} (bloc {s['block']})</td><td>{s['room'].replace('salle-', 'Salle ')}</td></tr>"
        for s in week2:
            sn = subject_label(s['subject'], level_key)
            body += f"<tr><td>{sn}</td><td>Semaine 2</td><td>{days_w2}</td><td>{s['startTime']}–{s['endTime']} (bloc {s['block']})</td><td>{s['room'].replace('salle-', 'Salle ')}</td></tr>"

        body += "</tbody></table>"

    # Vue par semaine/salle
    body += '<div class="page-break"></div>'
    body += make_header(header_title)
    body += "<h2>Vue par semaine et par salle</h2>"

    for week_num, week_label, days_label in [(1, "Semaine 1", "Lun 17 → Ven 21 août"), (2, "Semaine 2", "Lun 24 → Ven 28 août")]:
        body += f"<h3>{week_label} — {days_label}</h3>"
        week_slots = [s for s in SCHEDULE if s['week'] == week_num]
        week_slots.sort(key=lambda s: ['A','B','C','D'].index(s['block']))

        body += """<table>
        <thead><tr><th>Bloc</th><th>Horaire</th><th>Salle 1</th><th>Salle 2</th></tr></thead><tbody>"""

        blocks_in_week = sorted(set(s['block'] for s in week_slots), key=lambda b: ['A','B','C','D'].index(b))
        block_times = {'A': '08:30–10:30', 'B': '10:45–12:45', 'C': '13:30–15:30', 'D': '15:45–17:45'}

        for block in blocks_in_week:
            salle1 = [s for s in week_slots if s['block'] == block and s['room'] == 'salle-1']
            salle2 = [s for s in week_slots if s['block'] == block and s['room'] == 'salle-2']

            def cell_content(slots_list):
                if not slots_list:
                    return "—"
                parts = []
                for s in slots_list:
                    ln = level_map[s['level']]
                    sn = subject_label(s['subject'], s['level'])
                    parts.append(f"{ln} — {sn}")
                return "<br>".join(parts)

            body += f"<tr><td style='font-weight:700'>Bloc {block}</td><td>{block_times[block]}</td><td>{cell_content(salle1)}</td><td>{cell_content(salle2)}</td></tr>"

        body += "</tbody></table>"

    # Organisation pédagogique
    body += "<h2>Organisation pédagogique</h2>"
    body += "<p style='font-size:9.5pt; margin-bottom:12px;'>Trois enseignants, deux salles, une continuité : l'enseignant de Mathématiques assure aussi les modules NSI/SNT (semaine 1 : mathématiques ; semaine 2 : informatique) ; l'enseignant de Français couvre la semaine 1 (Français Seconde, EAF Première, expression et oral Terminale) ; l'enseignant de Physique-Chimie couvre la semaine 2 pour les trois niveaux.</p>"

    # Matériel
    body += "<h2>Matériel à apporter</h2>"
    body += """<table>
    <thead><tr><th>Matière</th><th>Matériel</th></tr></thead>
    <tbody>
        <tr><td>Mathématiques</td><td>Cahier, trousse complète, calculatrice</td></tr>
        <tr><td>Français</td><td>Cahier, trousse complète</td></tr>
        <tr><td>NSI / SNT</td><td><strong>Ordinateur portable personnel</strong> (deux postes de secours disponibles — prévenir Nexus avant le stage si nécessaire)</td></tr>
        <tr><td>Physique-Chimie</td><td>Cahier, trousse complète, calculatrice — accompagnement théorique et méthodologique ; pas de séance de laboratoire</td></tr>
    </tbody></table>
    <p style="font-size:9.5pt; margin-bottom:12px;"><strong>Les supports de travail sont fournis par Nexus</strong> (fiches, exercices, sujets).</p>"""

    # Ouverture des groupes
    body += "<h2>Ouverture des groupes</h2>"
    body += """<ol style="font-size:9.5pt; padding-left:18px; margin-bottom:12px; line-height:1.6;">
        <li>Un groupe ouvre <strong>à partir de 3 élèves</strong> et accueille <strong>5 élèves maximum</strong>.</li>
        <li>Décision d'ouverture communiquée le <strong>10 août 2026 à 18 h 00</strong>.</li>
        <li><strong>Si le groupe n'ouvre pas</strong> : la famille est informée immédiatement et les sommes déjà reçues sont <strong>intégralement restituées</strong>, ou reportées sur un autre module au choix de la famille.</li>
        <li>La pré-inscription en ligne est <strong>sans paiement</strong> : elle ne bloque pas une place et n'engage pas la famille. L'acompte (30 %) n'est demandé qu'après validation du groupe et du profil.</li>
    </ol>"""

    # Déroulé type
    body += "<h2>Déroulé type d'un module (la méthode Nexus)</h2>"
    body += """<ol style="font-size:9.5pt; padding-left:18px; margin-bottom:12px; line-height:1.6;">
        <li><strong>Positionnement</strong> — diagnostic des acquis au démarrage pour cibler les priorités.</li>
        <li><strong>Travail guidé en groupe réduit</strong> — reprise des notions avec consignes et aides différenciées.</li>
        <li><strong>Entraînement et correction</strong> — chaque séance alterne méthode, exercices progressifs et correction explicite.</li>
        <li><strong>Bilan et recommandations</strong> — synthèse écrite des acquis observés et plan de travail pour la rentrée, <strong>remis aux parents</strong>.</li>
    </ol>"""

    # Contact
    body += "<h2>Contact</h2>"
    body += f"""<p style="font-size:9.5pt; line-height:1.8;">
        Téléphone / WhatsApp : <a href="tel:+21699192829">+216 99 19 28 29</a><br>
        Email : <a href="mailto:contact@nexusreussite.academy">contact@nexusreussite.academy</a><br>
        Site : <a href="https://nexusreussite.academy/stages/pre-rentree-2026">nexusreussite.academy/stages/pre-rentree-2026</a><br>
        Centre pédagogique : Mutuelleville, Tunis
    </p>"""
    body += f'<p style="font-size:7.5pt; color:#999; margin-top:8px;">Nexus Réussite — marque exploitée par STE M&amp;M ACADEMY SUARL. Conditions générales : <a href="https://nexusreussite.academy/conditions-generales" style="color:#999;">nexusreussite.academy/conditions-generales</a></p>'

    return body


def make_tarifs_body():
    """Generate HTML body for the tarifs PDF."""
    body = '<div style="text-align:center; margin-bottom:16px;">'
    body += f'<img src="{LOGO_SLOGAN}" alt="Nexus Réussite" style="width:55mm; margin-bottom:10px;"><br>'
    body += '<h1 style="color:#071A3A; font-size:18pt; margin-bottom:4px;">Tarifs et conditions financières</h1>'
    body += '<p style="color:#071A3A; font-size:10pt; font-weight:600;">Stages de pré-rentrée · 17–28 août 2026 · Mutuelleville, Tunis</p>'
    body += '</div><hr style="border:none; border-top:2px solid #C9A227; margin:10px 0 14px 0;">'

    body += '<p style="font-size:9.5pt; margin-bottom:14px; font-style:italic; color:#555;">Des tarifs publics, nets, en dinars. Vous savez exactement ce que vous payez — avant de réserver.</p>'

    body += "<h2>Grille tarifaire</h2>"
    body += """<table>
    <thead><tr>
        <th>Pack</th><th>Volume</th><th style="text-align:right">Prix total</th><th style="text-align:right">Soit par heure</th><th style="text-align:right">Acompte (30 %)</th><th style="text-align:right">Solde</th>
    </tr></thead>
    <tbody>
        <tr><td><strong>1 matière</strong></td><td>10 h</td><td style="text-align:right; font-weight:700; color:#071A3A">480 TND</td><td style="text-align:right">48 TND/h</td><td style="text-align:right">140 TND</td><td style="text-align:right">340 TND</td></tr>
        <tr><td><strong>2 matières</strong></td><td>20 h</td><td style="text-align:right; font-weight:700; color:#071A3A">900 TND</td><td style="text-align:right">45 TND/h</td><td style="text-align:right">270 TND</td><td style="text-align:right">630 TND</td></tr>
        <tr><td><strong>3 matières</strong></td><td>30 h</td><td style="text-align:right; font-weight:700; color:#071A3A">1&#8239;350 TND</td><td style="text-align:right">45 TND/h</td><td style="text-align:right">410 TND</td><td style="text-align:right">940 TND</td></tr>
        <tr><td><strong>4 matières</strong></td><td>40 h</td><td style="text-align:right; font-weight:700; color:#071A3A">1&#8239;800 TND</td><td style="text-align:right">45 TND/h</td><td style="text-align:right">540 TND</td><td style="text-align:right">1&#8239;260 TND</td></tr>
    </tbody></table>
    <p style="font-size:7.5pt; color:#666; font-style:italic; margin-bottom:14px;">Tarifs par élève, toutes matières au choix parmi Mathématiques, Physique-Chimie, Français, NSI/SNT. Non cumulables avec la Carte Nexus et les remises automatiques.</p>"""

    body += "<h2>Ce que le tarif comprend</h2>"
    body += """<ul class="check-list" style="margin-bottom:14px;">
        <li>5 séances de 2 h par matière avec un <strong>enseignant en exercice dans le système français</strong></li>
        <li>Groupe de <strong>3 à 5 élèves maximum</strong></li>
        <li><strong>Diagnostic de positionnement</strong> en début de module</li>
        <li><strong>Tous les supports fournis</strong> : fiches de méthode, exercices corrigés, sujets d'entraînement</li>
        <li>Un <strong>livrable par séance</strong> que l'élève conserve</li>
        <li><strong>Bilan individualisé écrit remis aux parents</strong> en fin de stage, avec recommandations pour la rentrée</li>
    </ul>"""

    body += "<h2>Modalités de paiement</h2>"
    body += """<ol style="font-size:9.5pt; padding-left:18px; margin-bottom:14px; line-height:1.6;">
        <li><strong>Pré-inscription en ligne : gratuite et sans engagement.</strong> Aucun paiement n'est demandé sur le site.</li>
        <li><strong>Acompte de 30 %</strong> demandé uniquement après validation du groupe (à partir de 3 élèves) et du profil de l'élève.</li>
        <li><strong>Solde</strong> réglé avant le début du stage.</li>
        <li>Paiement au centre (Mutuelleville) ou selon les modalités communiquées à la confirmation.</li>
    </ol>"""

    body += '<div style="break-inside:avoid;">'
    body += "<h2>Nos garanties</h2>"
    body += """<table>
    <thead><tr><th>Situation</th><th>Ce qui se passe</th></tr></thead>
    <tbody>
        <tr><td>Le groupe n'atteint pas 3 élèves</td><td><strong>Acompte intégralement remboursé</strong>, ou reporté sur un autre module au choix de la famille</td></tr>
        <tr><td>Vous poursuivez avec Nexus à l'année</td><td><strong>L'acompte du stage est déductible</strong> du parcours annuel</td></tr>
        <tr><td>Vous préférez reporter</td><td>Acompte <strong>reportable sur l'année suivante</strong></td></tr>
        <tr><td>Groupe complet (5 élèves)</td><td>Liste d'attente + proposition d'un créneau alternatif</td></tr>
    </tbody></table></div>"""

    body += "<h2>Le tarif en perspective</h2>"
    body += '<p style="font-size:9.5pt; line-height:1.6; margin-bottom:14px;">À <strong>45–48 TND de l\'heure par élève</strong>, le stage se situe dans la même zone tarifaire horaire qu\'un cours particulier classique du marché. La différence n\'est pas le prix de l\'heure — c\'est ce qu\'elle contient : un enseignant en exercice dans le système français, un programme écrit séance par séance, un groupe de 3 à 5 pour maintenir l\'attention individuelle, des supports conçus pour le stage, et un bilan écrit remis aux parents.</p>'

    body += f"""<p style="font-size:9pt; margin-top:14px; line-height:1.7; border-top:1px solid #E0E0E0; padding-top:8px;">
        Téléphone / WhatsApp : <a href="tel:+21699192829">+216 99 19 28 29</a> ·
        Email : <a href="mailto:contact@nexusreussite.academy">contact@nexusreussite.academy</a> ·
        Site : <a href="https://nexusreussite.academy/stages/pre-rentree-2026">nexusreussite.academy/stages/pre-rentree-2026</a>
    </p>
    <p style="font-size:7.5pt; color:#999;">Nexus Réussite — STE M&amp;M ACADEMY SUARL · CGV : <a href="https://nexusreussite.academy/conditions-generales" style="color:#999;">nexusreussite.academy/conditions-generales</a></p>"""

    return body


def make_dossier_accueil_body():
    """Generate HTML body for the dossier accueil (print-optimized N&B)."""
    body = ""

    # Page 1 - Bienvenue
    body += f"""
    <div style="text-align:center; margin-bottom:20px;">
        <img src="{LOGO_SLOGAN}" alt="Nexus Réussite" style="width:55mm; margin-bottom:12px;"><br>
        <h1 style="color:#071A3A; font-size:18pt; margin-bottom:4px;">Dossier d'accueil famille</h1>
        <p style="color:#071A3A; font-size:10.5pt; font-weight:600;">Stages de pré-rentrée 2026 · À remettre lors de l'inscription au centre</p>
    </div>
    <hr style="border:none; border-top:2px solid #333; margin:12px 0;">
    <p style="font-size:10.5pt; line-height:1.7; margin-bottom:20px;"><strong>Madame, Monsieur,</strong><br><br>
    Merci de votre confiance. Ce dossier récapitule l'inscription de votre enfant au stage de pré-rentrée Nexus Réussite, du 17 au 28 août 2026 à Mutuelleville. Vous y trouverez le programme détaillé de chaque matière choisie, le planning des séances, les conditions financières et nos engagements. Notre principe est simple : <strong>vous savez ce que vous payez, ce que votre enfant va travailler séance par séance, et vous recevez un bilan écrit à la fin.</strong></p>
    <p style="font-size:10.5pt; text-align:right;">L'équipe Nexus Réussite</p>
    """

    # Page 2 - Fiche d'inscription
    body += '<div class="page-break"></div>'
    body += make_header("Dossier d'accueil famille")
    body += "<h2>Fiche d'inscription</h2>"
    body += "<h3>Élève</h3>"

    fields_eleve = [
        ("Nom et prénom de l'élève", ""),
        ("Établissement (2025-2026)", ""),
    ]
    body += '<table class="form-table"><tbody>'
    for label, _ in fields_eleve:
        body += f'<tr><td style="width:40%; font-weight:600; color:#071A3A; vertical-align:top; padding:6px;">{label}</td><td style="border-bottom:1px solid #333; height:8mm; padding:6px;"></td></tr>'
    body += '</tbody></table>'

    # Classe de rentrée with CSS checkboxes
    body += '<p style="font-size:10pt; margin:10px 0 4px 0; font-weight:600; color:#071A3A;">Classe de rentrée 2026</p>'
    body += '<p style="font-size:10pt; margin-bottom:8px;">'
    body += '<span class="checkbox"></span> Seconde &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> Première &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> Terminale</p>'

    body += '<p style="font-size:10pt; margin:6px 0 4px 0; font-weight:600; color:#071A3A;">Voie (si Première/Terminale)</p>'
    body += '<p style="font-size:10pt; margin-bottom:8px;">'
    body += '<span class="checkbox"></span> Générale &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> Technologique &nbsp;&nbsp; Spécialités : '
    body += '<span style="border-bottom:1px solid #333; display:inline-block; width:50mm;">&nbsp;</span></p>'

    body += '<table class="form-table"><tbody>'
    body += '<tr><td style="width:40%; font-weight:600; color:#071A3A; vertical-align:top; padding:6px;">Points d\'attention signalés par la famille</td><td style="border-bottom:1px solid #333; height:8mm; padding:6px;"></td></tr>'
    body += '</tbody></table>'

    # Responsable légal
    body += "<h3 style='margin-top:16px;'>Responsable légal</h3>"
    fields_parent = [
        "Nom et prénom",
        "Téléphone (WhatsApp)",
        "Email",
        "Personne autorisée à récupérer l'élève (si mineur)",
    ]
    body += '<table class="form-table"><tbody>'
    for label in fields_parent:
        body += f'<tr><td style="width:45%; font-weight:600; color:#071A3A; vertical-align:top; padding:6px;">{label}</td><td style="border-bottom:1px solid #333; height:8mm; padding:6px;"></td></tr>'
    body += '</tbody></table>'

    # Matières choisies
    body += '<p style="font-size:10pt; margin:14px 0 6px 0; font-weight:700; color:#071A3A;">Matières choisies</p>'
    body += '<p style="font-size:10pt; margin-bottom:8px;">'
    body += '<span class="checkbox"></span> Mathématiques &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> Physique-Chimie &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> Français &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> NSI/SNT</p>'

    body += '<p style="font-size:10pt; margin:6px 0 4px 0; font-weight:700; color:#071A3A;">Pack</p>'
    body += '<p style="font-size:10pt;">'
    body += '<span class="checkbox"></span> 1 matière (480 TND) &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> 2 matières (900 TND) &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> 3 matières (1&#8239;350 TND) &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> 4 matières (1&#8239;800 TND)</p>'

    # Page 3 - Récapitulatif financier + Informations pratiques (merged)
    body += '<div class="page-break"></div>'
    body += make_header("Dossier d'accueil famille")
    body += "<h2>Récapitulatif financier</h2>"
    body += '<table class="form-table"><tbody>'
    for label in ["Pack choisi", "Acompte versé ce jour (30 %)", "Solde à régler avant le 1er jour du stage"]:
        body += f'<tr><td style="width:50%; font-weight:600; color:#071A3A; padding:6px;">{label}</td><td style="border-bottom:1px solid #333; height:8mm; padding:6px; text-align:right;"><span style="color:#999; font-size:8pt;">TND</span></td></tr>'

    body += '<tr><td style="width:50%; font-weight:600; color:#071A3A; padding:6px;">Mode de règlement de l\'acompte</td><td style="padding:6px;">'
    body += '<span class="checkbox"></span> Espèces &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> Chèque &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> Virement</td></tr>'
    body += '</tbody></table>'

    body += '<div style="background:#F5F6F8; border:1px solid #DDD; padding:8px 12px; margin:10px 0; font-size:9pt; line-height:1.5;">'
    body += '<strong>Rappel des garanties</strong> : si le groupe de votre enfant n\'atteint pas 3 élèves (décision communiquée le 10 août 2026 à 18 h), l\'acompte est intégralement remboursé ou reporté sur un autre module, à votre choix. L\'acompte est déductible d\'un parcours annuel Nexus souscrit ensuite.'
    body += '</div>'

    body += "<h2>Informations pratiques (à conserver par la famille)</h2>"
    body += """<table class="form-table">
    <tbody>
        <tr><td style="width:25%; font-weight:700; color:#071A3A; padding:6px;">Lieu</td><td style="padding:6px;">Centre Nexus Réussite, Mutuelleville, Tunis</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Dates</td><td style="padding:6px;">Du 17 au 28 août 2026 (pas de cours les 22 et 23 août)</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Arrivée</td><td style="padding:6px;">10 minutes avant le début du créneau</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Matériel</td><td style="padding:6px;">Cahier et trousse pour toutes les matières ; calculatrice pour Mathématiques et Physique-Chimie ; <strong>ordinateur portable pour NSI/SNT</strong> (nous prévenir si besoin d'un poste de secours)</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Supports</td><td style="padding:6px;">Toutes les fiches et exercices sont fournis par Nexus</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Absence</td><td style="padding:6px;">Prévenir au +216 99 19 28 29 ; les supports de la séance manquée sont remis à l'élève</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Bilan</td><td style="padding:6px;">Un bilan individualisé écrit vous est remis à l'issue du stage, avec des recommandations de travail pour la rentrée</td></tr>
    </tbody></table>"""
    body += '<p style="font-size:10pt; margin-top:14px; line-height:1.7;"><strong>Contact pendant le stage</strong> : +216 99 19 28 29 (téléphone et WhatsApp) · contact@nexusreussite.academy</p>'

    # Page 5 - Consentements et signature
    body += '<div class="page-break"></div>'
    body += make_header("Dossier d'accueil famille")
    body += "<h2>Consentements et signature</h2>"
    body += '<div style="font-size:10pt; line-height:2.2;">'
    body += '<p><span class="checkbox"></span> J\'ai pris connaissance du programme, du planning et des conditions financières remises dans ce dossier.</p>'
    body += '<p><span class="checkbox"></span> J\'ai pris connaissance des conditions générales (nexusreussite.academy/conditions-generales).</p>'
    body += '<p><span class="checkbox"></span> J\'accepte que Nexus Réussite me contacte par WhatsApp/téléphone/email pour le suivi du stage.</p>'
    body += '<p><span class="checkbox"></span> <em>(Facultatif)</em> J\'accepte de recevoir les conseils mensuels et informations Nexus Réussite.</p>'
    body += '<p><em>(Facultatif)</em> J\'autorise Nexus Réussite à utiliser d\'éventuelles photos de groupe où figure mon enfant sur ses supports de communication : &nbsp; <span class="checkbox"></span> Oui &nbsp; <span class="checkbox"></span> Non</p>'
    body += '</div>'

    body += '<div style="margin-top:30px; font-size:10pt;">'
    body += '<p>Fait à Tunis, le <span style="border-bottom:1px solid #333; display:inline-block; width:10mm;">&nbsp;</span> / <span style="border-bottom:1px solid #333; display:inline-block; width:10mm;">&nbsp;</span> / 2026</p>'
    body += '<div style="display:flex; justify-content:space-between; margin-top:25px;">'
    body += '<div><strong>Signature du responsable légal</strong><br><br><br><br><span style="border-bottom:1px solid #333; display:inline-block; width:55mm;">&nbsp;</span></div>'
    body += '<div><strong>Pour Nexus Réussite</strong><br><br><br><br><span style="border-bottom:1px solid #333; display:inline-block; width:55mm;">&nbsp;</span></div>'
    body += '</div></div>'

    body += f'<p style="font-size:7.5pt; color:#999; margin-top:30px; border-top:1px solid #E0E0E0; padding-top:6px;">Nexus Réussite — marque exploitée par STE M&amp;M ACADEMY SUARL · Siège : Immeuble VENUS, Appt C13, Centre Urbain Nord, 1082 Tunis. Les données collectées servent exclusivement à la gestion pédagogique et administrative du stage.</p>'

    return body


# ─── DOSSIER ACCUEIL EXTRA CSS ────────────────────────────────────────────────

DOSSIER_CSS = """
/* N&B optimized: headers use dark gray instead of blue for print contrast */
thead th {
    background: #333 !important;
    color: #FFF !important;
}
/* CSS checkbox: 4mm square with solid border */
.checkbox {
    display: inline-block;
    width: 4mm;
    height: 4mm;
    border: 1.5pt solid #333;
    vertical-align: middle;
    margin-right: 2px;
}
/* Form table */
table.form-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
}
table.form-table td {
    padding: 6px;
    font-size: 10pt;
    border-bottom: none;
}
table.form-table tbody tr:nth-child(even) td {
    background: transparent;
}
/* Section titles: use black border instead of gold for N&B */
h2 {
    border-left-color: #333 !important;
}
.check-list li::before {
    color: #333 !important;
}
"""

TARIFS_CSS = """
/* No cover page - single/double page document */
"""


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Production des 6 PDF restants ===\n")

    # 1. Programme Seconde
    body = make_programme_body("Seconde", PROGRAMMES["Seconde"])
    html = wrap_html(body, "Nexus Réussite — Programme Seconde — Pré-rentrée 2026")
    generate_pdf(html, "NexusReussite_PreRentree2026_Programme_Seconde.pdf",
                 "Nexus Réussite — Programme détaillé — Entrée en Seconde — Pré-rentrée 2026")

    # 2. Programme Première
    body = make_programme_body("Première", PROGRAMMES["Première"])
    html = wrap_html(body, "Nexus Réussite — Programme Première — Pré-rentrée 2026")
    generate_pdf(html, "NexusReussite_PreRentree2026_Programme_Premiere.pdf",
                 "Nexus Réussite — Programme détaillé — Entrée en Première — Pré-rentrée 2026")

    # 3. Programme Terminale
    body = make_programme_body("Terminale", PROGRAMMES["Terminale"])
    html = wrap_html(body, "Nexus Réussite — Programme Terminale — Pré-rentrée 2026")
    generate_pdf(html, "NexusReussite_PreRentree2026_Programme_Terminale.pdf",
                 "Nexus Réussite — Programme détaillé — Entrée en Terminale — Pré-rentrée 2026")

    # 3bis. Programmes SVT (Première, Terminale) — DRAFT tant que D2 non levée
    for _lvl_key, _lvl_label in [("PREMIERE", "Première"), ("TERMINALE", "Terminale")]:
        _mod = SVT_MODULES.get(_lvl_key)
        if not _mod:
            continue
        body = make_svt_programme_body(_lvl_label, _mod)
        html = wrap_html(body, f"Nexus Réussite — Programme SVT {_lvl_label} — Pré-rentrée 2026", DRAFT_CSS)
        _suffix = "_DRAFT" if SVT_DRAFT else ""
        generate_pdf(html, f"NexusReussite_PreRentree2026_Programme_SVT_{_lvl_label}{_suffix}.pdf",
                     f"Nexus Réussite — Programme détaillé — SVT — Entrée en {_lvl_label} — Pré-rentrée 2026")

    # 4. Planning
    body = make_planning_body()
    html = wrap_html(body, "Nexus Réussite — Planning et informations pratiques — Pré-rentrée 2026")
    generate_pdf(html, "NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf",
                 "Nexus Réussite — Planning et informations pratiques — Pré-rentrée 2026")

    # 5. Tarifs
    body = make_tarifs_body()
    html = wrap_html(body, "Nexus Réussite — Tarifs — Pré-rentrée 2026", TARIFS_CSS)
    generate_pdf(html, "NexusReussite_PreRentree2026_Tarifs.pdf",
                 "Nexus Réussite — Tarifs et conditions financières — Pré-rentrée 2026")

    # 7. Dossier Accueil PRINT
    body = make_dossier_accueil_body()
    html = wrap_html(body, "Nexus Réussite — Dossier d'accueil famille — Pré-rentrée 2026", DOSSIER_CSS)
    generate_pdf(html, "NexusReussite_PreRentree2026_DossierAccueil_PRINT.pdf",
                 "Nexus Réussite — Dossier d'accueil famille — Pré-rentrée 2026")

    print("\n✓ Production terminée")

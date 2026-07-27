#!/usr/bin/env python3
"""Generate the 8 Nexus Réussite pre-rentrée 2026 parent PDFs.

Orchestrator only: the 4 canonical per-level "dossier complet parents" PDFs
(3e, Seconde, Première, Terminale — one per entry level, each consolidating
planning + every subject's detailed programme, SVT included as an ordinary
chapter rather than a separate file) are delegated to generate_level_dossiers.py,
itself backed by pre_rentree_data.py (canonical data) and dossier_design.py
(design system). This file only still builds the 4 shared documents that are
not level-specific: Planning_InfosPratiques, Tarifs, DossierAccueil_PRINT and
FlyerEssentiel.

ROLE (documented 2026-07-25, quality audit §B — two PDF pipelines coexist by design,
not by accident; see DEBTS.md for the full rationale):
This is the ACTIVE PRODUCTION / PUBLIC-DISTRIBUTION pipeline. Its output
(assets/campaigns/pre-rentree-2026/documents-final/ -> public/documents/pre-rentree-2026/)
is what parents actually download. Invoked via `npm run pre-rentree:public-pdfs`.
The old `pre-rentree:legacy-pdfs` command is only a deprecated compatibility
alias; do not treat generate_documents.py as the public pipeline replacement.
The SEPARATE governance/reproducibility review pipeline (hash-bound manifest,
owner-approval workflow, chained into `npm run pre-rentree:ci`) is
scripts/pre-rentree/document_templates.py via generate_documents.py
(`npm run pre-rentree:build`) — its output (.artifacts/pre-rentree-2026/build/)
is an internal review package, never served publicly.
"""

import hashlib
import json
import os
from pathlib import Path
from weasyprint import HTML
from stable_assets import fetch_public_pdf_asset, public_pdf_asset_url

TOOL_DIR = Path(__file__).parent
REPO_ROOT = TOOL_DIR.parent.parent
OUT_DIR = TOOL_DIR / "output"
OUT_DIR.mkdir(exist_ok=True)
# Official charte logo (sealed visualIdentity)
LOGO_SLOGAN = public_pdf_asset_url("logo_slogan_nexus_x3.png")
LOGO_COMPACT = LOGO_SLOGAN
_qr = TOOL_DIR / "qr_stage.png"
QR_CODE = str(_qr) if _qr.exists() else ""
INTER_FONT_URI = public_pdf_asset_url("Inter-Variable.woff2")

# Horaires read EXCLUSIVELY from the sealed campaign JSON (D4-final) — never from .md.
CAMPAIGN = json.loads((REPO_ROOT / "data" / "campaigns" / "pre-rentree-2026.json").read_text(encoding="utf-8"))
PRICING = json.loads((REPO_ROOT / "data" / "pricing.canonical.json").read_text(encoding="utf-8"))
PRE_RENTREE_PACKS = tuple(PRICING["pre_rentree_packs"])
PRE_RENTREE_FOUNDATIONS = tuple(PRICING["pre_rentree_foundations"])
STARTING_PRICE = min(
    offer["price_per_student"]
    for offer in (*PRE_RENTREE_FOUNDATIONS, *PRE_RENTREE_PACKS)
)
ROOM_ASSIGNMENTS_PUBLIC = CAMPAIGN["operationalGates"]["roomAssignmentsValidated"]


def _uniform_group_bounds(offers):
    """Group max is uniform across every offer in a tier; group min is NOT for
    Fondations since the 4e opens at 4, not the 3 shared by 3e/Seconde (mission
    4e/Philosophie §5.1, a documented exception, not a drift). Returns the
    aggregate (lowest min, highest max) across the tier — a true statement,
    never a claim that every level shares the same floor. Per-level figures
    are read via FOUNDATIONS_LEVEL_LABELS / group_min_open on each offer."""
    maxes = {offer["group_max"] for offer in offers}
    assert len(maxes) == 1, maxes
    mins = {offer["group_min_open"] for offer in offers}
    return min(mins), maxes.pop()


FOUNDATIONS_GROUP_MIN, FOUNDATIONS_GROUP_MAX = _uniform_group_bounds(PRE_RENTREE_FOUNDATIONS)
PREMIUM_GROUP_MIN, PREMIUM_GROUP_MAX = _uniform_group_bounds(PRE_RENTREE_PACKS)
_FOUNDATIONS_LEVEL_LABELS = {'QUATRIEME': '4e', 'TROISIEME': '3e', 'SECONDE': 'Seconde'}


def foundations_effectifs_par_niveau() -> str:
    """Per-level Fondations effectif line — never a single generic range
    (mission §6.3: "Fondations : 3 à 6" became false once the 4e opened at 4)."""
    parts = []
    for offer in PRE_RENTREE_FOUNDATIONS:
        label = _FOUNDATIONS_LEVEL_LABELS.get(offer["level"], offer["level"])
        parts.append(f'Entrée en {label} : {offer["group_min_open"]} à {offer["group_max"]} élèves')
    return " · ".join(parts)
_BLOCK_TIMES = {b["id"]: (b["startTime"], b["endTime"]) for b in CAMPAIGN["blocks"]}
# Modèle fenêtres + week-end (v2) : le planning n'est plus "2 semaines lun-ven" mais 3
# fenêtres à dates explicites (une d'entre elles couvrant le week-end). SCHEDULE regroupe
# les créneaux par fenêtre (slots, non datés) ; SCHEDULE_DAYS les expanse par date réelle.
SCHEDULE = []
SCHEDULE_DAYS = []
for _win in CAMPAIGN["schedule"]:
    for _s in _win["slots"]:
        _st, _et = _BLOCK_TIMES[_s["block"]]
        SCHEDULE.append({
            **_s,
            "windowId": _win["windowId"],
            "windowLabel": _win["windowLabel"],
            "startTime": _st,
            "endTime": _et,
        })
        for _day in _win["days"]:
            SCHEDULE_DAYS.append({
                **_s,
                "date": _day,
                "windowId": _win["windowId"],
                "windowLabel": _win["windowLabel"],
                "startTime": _st,
                "endTime": _et,
            })

# Mention de STATUT collectif autorisée sur les supports commerciaux (décision direction R4,
# 2026-07-23 — voir publication-decisions.owner.json → decisions.teacherStatusStatement).
# Distincte de l'anonymat nominatif (noms interdits en public) : elle ne nomme personne.
ENSEIGNANT_STATUT_COMMERCIAL = "enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice"
# Variante prudente conservée pour les surfaces non commerciales (hors périmètre R4) :
ENSEIGNANT_STATUT_PUBLIE = "enseignants expérimentés, en exercice dans le système français"
INTERNAL_REVIEW_NOTICE = "DOCUMENT DE REVUE — NON CONTRACTUEL"


def format_tnd(amount):
    """Format an integer TND amount without duplicating pricing data."""
    return f"{amount:,}".replace(",", "&#8239;")


def premium_pack_rows():
    """Build the premium tariff rows exclusively from canonical pricing."""
    return [
        {
            "subjects": pack["subjects_count"],
            "hours": pack["total_hours"],
            "price": pack["price_per_student"],
            "hourly": pack["price_per_student_hour"],
            "deposit": pack["payment"]["deposit"],
            "balance": pack["payment"]["solde"],
        }
        for pack in PRE_RENTREE_PACKS
    ]

# ─── Shared CSS ───────────────────────────────────────────────────────────────

COMMON_CSS = """
@font-face {
    font-family: 'Nexus Inter';
    src: url('__INTER_FONT_URI__') format('woff2');
    font-weight: 100 900;
    font-style: normal;
}
@font-face {
    font-family: 'Nexus Inter';
    src: url('__INTER_FONT_URI__') format('woff2');
    font-weight: 100 900;
    font-style: italic;
}
@page {
    size: A4 portrait;
    margin: 18mm 20mm 18mm 20mm;
    @bottom-center {
        content: none;
    }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Nexus Inter';
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
    content: "";
    position: absolute;
    left: 1px;
    top: 0.28em;
    width: 6px;
    height: 3px;
    color: #C9A227;
    border-left: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
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
""".replace("__INTER_FONT_URI__", INTER_FONT_URI)


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
            Fondations : {FOUNDATIONS_GROUP_MIN} à {FOUNDATIONS_GROUP_MAX} élèves · Premium : {PREMIUM_GROUP_MIN} à {PREMIUM_GROUP_MAX} élèves · 10&nbsp;h par matière · À partir de {format_tnd(STARTING_PRICE)}&nbsp;TND<br>
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
    html = HTML(
        string=html_content,
        base_url="nexus-public-pdf:",
        url_fetcher=fetch_public_pdf_asset,
    )
    doc = html.render()
    doc.metadata.title = title
    doc.metadata.authors = ["Nexus Réussite"]
    doc.metadata.description = "Stages de pré-rentrée 2026"
    doc.write_pdf(
        str(OUT_DIR / filename),
        pdf_identifier=hashlib.sha256(f"pre-rentree-2026:{filename}".encode()).digest(),
    )
    size = os.path.getsize(OUT_DIR / filename)
    print(f"  {filename}: {size // 1024} Ko")
    return filename


def make_planning_body():
    """Generate HTML body for the planning PDF."""
    header_title = "Planning et informations pratiques"

    level_map = {'QUATRIEME': '4e', 'TROISIEME': '3e', 'SECONDE': 'Seconde', 'PREMIERE': 'Première', 'TERMINALE': 'Terminale'}
    def subject_label(subject_key, level_key):
        base = {
            'MATHEMATIQUES': 'Mathématiques',
            'FRANCAIS': 'Français',
            'PHYSIQUE_CHIMIE': 'Physique-Chimie',
            'SVT': 'SVT',
            'MATHS_EXPERTES': 'Mathématiques expertes',
            'PHILOSOPHIE': 'Philosophie',
        }
        if subject_key in base:
            return base[subject_key]
        if subject_key == 'NSI':
            return 'NSI'
        return subject_key

    subject_map = None  # use subject_label() instead

    def format_day(date_str):
        from datetime import date as _date
        months = ('janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
                  'septembre', 'octobre', 'novembre', 'décembre')
        weekdays = ('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche')
        parsed = _date.fromisoformat(date_str)
        return f"{weekdays[parsed.weekday()]} {parsed.day} {months[parsed.month - 1]}"

    body = make_cover("Planning et informations pratiques")

    # Page 1: Repères généraux
    body += make_header(header_title)
    body += "<h2>Repères généraux</h2>"
    block_times_str = " · ".join(
        f"{b} : {_BLOCK_TIMES[b][0]}–{_BLOCK_TIMES[b][1]}" for b in ('A', 'B', 'C', 'D')
    )
    body += f"""<table>
    <tbody>
        <tr><td style="width:25%; font-weight:700; color:#071A3A">Dates</td><td>Du lundi 17 au vendredi 28 août 2026, y compris le week-end du 22-23 août (SVT/Physique-Chimie Première)</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Lieu</td><td>Centre Nexus Réussite, Mutuelleville, Tunis</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Public</td><td>Élèves entrant en 4e, 3e, Seconde, Première ou Terminale (rentrée 2026-2027)</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Format</td><td>5 séances de 2 h par matière · 10 h par matière · matières proposées selon le niveau</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Effectif</td><td>Fondations ({foundations_effectifs_par_niveau()}) · Premium (Première et Terminale) : {PREMIUM_GROUP_MIN} à {PREMIUM_GROUP_MAX} élèves, maximum {PREMIUM_GROUP_MAX}</td></tr>
        <tr><td style="font-weight:700; color:#071A3A">Blocs horaires</td><td>{block_times_str}</td></tr>
    </tbody></table>"""

    # Vue par niveau
    for level_key, level_label in [('QUATRIEME', '4e'), ('TROISIEME', '3e'), ('SECONDE', 'Seconde'), ('PREMIERE', 'Première'), ('TERMINALE', 'Terminale')]:
        slots = [s for s in SCHEDULE if s['level'] == level_key]
        slots.sort(key=lambda s: (s['windowId'], ['A', 'B', 'C', 'D'].index(s['block'])))

        body += f"<h2>Planning — Entrée en {level_label}</h2>"
        room_heading = "<th>Salle</th>" if ROOM_ASSIGNMENTS_PUBLIC else ""
        body += f"""<table>
        <thead><tr>
            <th>Matière</th><th>Fenêtre</th><th>Créneau</th>{room_heading}
        </tr></thead><tbody>"""

        for s in slots:
            sn = subject_label(s['subject'], level_key)
            room_cell = (
                f"<td>{s['room'].replace('salle-', 'Salle ')}</td>"
                if ROOM_ASSIGNMENTS_PUBLIC else ""
            )
            body += (
                f"<tr><td>{sn}</td><td>{s['windowLabel']}</td>"
                f"<td>{s['startTime']}–{s['endTime']} (bloc {s['block']})</td>{room_cell}</tr>"
            )

        body += "</tbody></table>"

    # Vue par fenêtre. Les numéros de salle ne sont rendus que lorsque le gate
    # opérationnel autorise explicitement leur publication.
    body += '<div class="page-break"></div>'
    body += make_header(header_title)
    body += "<h2>Vue par fenêtre</h2>"

    seen_windows = []
    for s in SCHEDULE:
        if s['windowId'] not in seen_windows:
            seen_windows.append(s['windowId'])

    for window_id in seen_windows:
        window_slots = [s for s in SCHEDULE if s['windowId'] == window_id]
        window_label = window_slots[0]['windowLabel']
        body += f"<h3>{window_label}</h3>"
        window_slots.sort(key=lambda s: ['A', 'B', 'C', 'D'].index(s['block']))

        rooms = sorted({s["room"] for s in window_slots})
        room_headings = "".join(
            f"<th>{room.replace('salle-', 'Salle ')}</th>" for room in rooms
        ) if ROOM_ASSIGNMENTS_PUBLIC else "<th>Groupes proposés</th>"
        body += f"""<table>
        <thead><tr><th>Bloc</th><th>Horaire</th>{room_headings}</tr></thead><tbody>"""

        blocks_in_window = sorted(set(s['block'] for s in window_slots), key=lambda b: ['A', 'B', 'C', 'D'].index(b))

        for block in blocks_in_window:
            def cell_content(slots_list):
                if not slots_list:
                    return "—"
                parts = []
                for s in slots_list:
                    ln = level_map[s['level']]
                    sn = subject_label(s['subject'], s['level'])
                    parts.append(f"{ln} — {sn}")
                return "<br>".join(parts)

            start, end = _BLOCK_TIMES[block]
            if ROOM_ASSIGNMENTS_PUBLIC:
                group_cells = "".join(
                    f"<td>{cell_content([s for s in window_slots if s['block'] == block and s['room'] == room])}</td>"
                    for room in rooms
                )
            else:
                group_cells = f"<td>{cell_content([s for s in window_slots if s['block'] == block])}</td>"
            body += (
                f"<tr><td style='font-weight:700'>Bloc {block}</td>"
                f"<td>{start}–{end}</td>{group_cells}</tr>"
            )

        body += "</tbody></table>"

    # Vue par jour
    body += '<div class="page-break"></div>'
    body += make_header(header_title)
    body += "<h2>Vue par jour</h2>"

    seen_dates = []
    for s in SCHEDULE_DAYS:
        if s['date'] not in seen_dates:
            seen_dates.append(s['date'])
    seen_dates.sort()

    for date_str in seen_dates:
        day_slots = [s for s in SCHEDULE_DAYS if s['date'] == date_str]
        day_slots.sort(key=lambda s: ['A', 'B', 'C', 'D'].index(s['block']))
        body += f"<h3>{format_day(date_str)}</h3>"
        room_heading = "<th>Salle</th>" if ROOM_ASSIGNMENTS_PUBLIC else ""
        body += f"""<table>
        <thead><tr><th>Horaire</th>{room_heading}<th>Niveau</th><th>Matière</th></tr></thead><tbody>"""
        for s in day_slots:
            ln = level_map[s['level']]
            sn = subject_label(s['subject'], s['level'])
            room_cell = (
                f"<td>{s['room'].replace('salle-', 'Salle ')}</td>"
                if ROOM_ASSIGNMENTS_PUBLIC else ""
            )
            body += (
                f"<tr><td>{s['startTime']}–{s['endTime']}</td>{room_cell}"
                f"<td>{ln}</td><td>{sn}</td></tr>"
            )
        body += "</tbody></table>"

    # Organisation pédagogique
    body += "<h2>Organisation pédagogique</h2>"
    body += (f"<p style='font-size:9.5pt; margin-bottom:12px;'>{ENSEIGNANT_STATUT_PUBLIE.capitalize()}. "
             "Les affectations définitives sont confirmées directement aux familles ; "
             "aucun nom d'enseignant n'est publié.</p>")

    # Matériel
    body += "<h2>Matériel à apporter</h2>"
    body += """<table>
    <thead><tr><th>Matière</th><th>Matériel</th></tr></thead>
    <tbody>
        <tr><td>Mathématiques</td><td>Cahier, trousse complète, calculatrice</td></tr>
        <tr><td>Mathématiques expertes</td><td>Cahier, trousse complète, calculatrice</td></tr>
        <tr><td>Français</td><td>Cahier, trousse complète</td></tr>
        <tr><td>NSI</td><td><strong>Ordinateur portable personnel</strong> (deux postes de secours disponibles — prévenir Nexus avant le stage si nécessaire)</td></tr>
        <tr><td>Physique-Chimie</td><td>Cahier, trousse complète, calculatrice — accompagnement théorique et méthodologique ; pas de séance de laboratoire</td></tr>
        <tr><td>SVT</td><td>Cahier, trousse complète, calculatrice scientifique simple recommandée (non obligatoire sauf consigne de l'enseignant)</td></tr>
    </tbody></table>
    <p style="font-size:9.5pt; margin-bottom:12px;"><strong>Les supports de travail sont fournis par Nexus</strong> (fiches, exercices, sujets).</p>"""

    # Ouverture des groupes
    body += "<h2>Ouverture des groupes</h2>"
    body += """<ol style="font-size:9.5pt; padding-left:18px; margin-bottom:12px; line-height:1.6;">
        <li>Fondations : ouverture à partir de <strong>3 élèves</strong>, <strong>6 élèves maximum</strong>.</li>
        <li>Premium : ouverture à partir de <strong>3 élèves</strong>, <strong>5 élèves maximum</strong>.</li>
        <li>L'ouverture du groupe, le créneau et l'affectation pédagogique sont confirmés directement aux familles.</li>
        <li>Tant que les conditions de paiement, reçu, annulation et remboursement ne sont pas validées, le parcours reste une <strong>demande d'information sans paiement</strong>.</li>
    </ol>"""

    # Déroulé type
    body += "<h2>Déroulé type d'un module (la méthode Nexus)</h2>"
    body += """<ol style="font-size:9.5pt; padding-left:18px; margin-bottom:12px; line-height:1.6;">
        <li><strong>Travail guidé en groupe réduit</strong> — reprise des notions avec consignes et aides différenciées.</li>
        <li><strong>Entraînement et correction</strong> — chaque séance alterne méthode, exercices progressifs et correction explicite.</li>
        <li><strong>Repères de travail</strong> — les supports et corrections aident l'élève à poursuivre son travail à la rentrée.</li>
    </ol>"""

    # Contact
    body += "<h2>Demander les informations et vérifier les disponibilités</h2>"
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

    body += '<p style="font-size:9.5pt; margin-bottom:14px; font-style:italic; color:#555;">Des tarifs publics, nets, en dinars, pour comparer clairement les parcours proposés.</p>'

    body += "<h2>Grille tarifaire</h2>"
    body += """<table>
    <thead><tr>
        <th>Pack</th><th>Volume</th><th style="text-align:right">Prix total</th><th style="text-align:right">Soit par heure</th><th style="text-align:right">Acompte (30 %)</th><th style="text-align:right">Solde</th>
    </tr></thead>
    <tbody>"""
    for row in premium_pack_rows():
        body += (
            f'<tr><td><strong>{row["subjects"]} matière'
            f'{"s" if row["subjects"] > 1 else ""}</strong></td>'
            f'<td>{row["hours"]} h</td>'
            f'<td style="text-align:right; font-weight:700; color:#071A3A">{format_tnd(row["price"])} TND</td>'
            f'<td style="text-align:right">{format_tnd(row["hourly"])} TND/h</td>'
            f'<td style="text-align:right">{format_tnd(row["deposit"])} TND</td>'
            f'<td style="text-align:right">{format_tnd(row["balance"])} TND</td></tr>'
        )
    body += """</tbody></table>
    <p style="font-size:7.5pt; color:#666; font-style:italic; margin-bottom:14px;">Tarifs Premium par élève, pour les matières approuvées du niveau. Non cumulables avec la Carte Nexus et les remises automatiques.</p>"""

    body += "<h2>Ce que le tarif comprend</h2>"
    body += f"""<ul class="check-list" style="margin-bottom:14px;">
        <li>5 séances de 2 h par matière avec des <strong>{ENSEIGNANT_STATUT_COMMERCIAL}</strong></li>
        <li>Premium : groupe de <strong>{PREMIUM_GROUP_MIN} à {PREMIUM_GROUP_MAX} élèves, maximum {PREMIUM_GROUP_MAX}</strong></li>
        <li><strong>Tous les supports fournis</strong> : fiches de méthode, exercices corrigés, sujets d'entraînement</li>
        <li>Un <strong>livrable par séance</strong> que l'élève conserve</li>
    </ul>"""

    body += "<h2>Modalités de paiement</h2>"
    body += """<ol style="font-size:9.5pt; padding-left:18px; margin-bottom:14px; line-height:1.6;">
        <li>Le site propose uniquement une <strong>demande d'information sans paiement</strong>.</li>
        <li>Les montants d'acompte et de solde ci-dessus sont issus de la grille tarifaire canonique.</li>
        <li>Les conditions applicables sont communiquées à la famille avant toute confirmation contractuelle.</li>
    </ol>"""

    body += '<div style="break-inside:avoid;">'
    body += "<h2>Avant toute confirmation</h2>"
    body += """<p style="font-size:9.5pt; line-height:1.6; margin-bottom:14px;">
        L'ouverture du groupe, le créneau, l'affectation pédagogique et les conditions contractuelles
        doivent être confirmés. En attendant, aucune demande d'information ne bloque une place et aucun paiement
        n'est demandé en ligne.
    </p></div>"""

    body += "<h2>Ce que structure le tarif</h2>"
    body += '<p style="font-size:9.5pt; line-height:1.6; margin-bottom:14px;">Le tarif correspond à un parcours structuré de cinq séances, en groupe réduit, avec programmes, exercices, corrections et supports préparés pour le stage.</p>'

    body += f"""<p style="font-size:9pt; margin-top:14px; line-height:1.7; border-top:1px solid #E0E0E0; padding-top:8px;">
        <strong>Demander les informations et vérifier les disponibilités</strong><br>
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
        <p style="color:#071A3A; font-size:10.5pt; font-weight:600;">Stages de pré-rentrée 2026</p>
        <p style="color:#8F1D1D; font-size:9pt; font-weight:800; margin-top:5px;">{INTERNAL_REVIEW_NOTICE}</p>
    </div>
    <hr style="border:none; border-top:2px solid #333; margin:12px 0;">
    <p style="font-size:10.5pt; line-height:1.7; margin-bottom:20px;"><strong>Madame, Monsieur,</strong><br><br>
    Merci de votre confiance. Ce dossier de revue présente le stage de pré-rentrée Nexus Réussite, du 17 au 28 août 2026 à Mutuelleville. Vous y trouverez le programme détaillé de chaque matière proposée, le planning des séances et la grille tarifaire. Toute inscription reste désactivée tant que les validations pédagogiques, opérationnelles, contractuelles et de publication ne sont pas réunies.</p>
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
    body += '<span class="checkbox"></span> 3e &nbsp;&nbsp; '
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
    body += '<span class="checkbox"></span> NSI (Première/Terminale) &nbsp;&nbsp; '
    body += '<span class="checkbox"></span> SVT (Première/Terminale)</p>'

    body += '<p style="font-size:10pt; margin:6px 0 4px 0; font-weight:700; color:#071A3A;">Pack</p>'
    body += '<p style="font-size:10pt;">'
    for pack in PRE_RENTREE_PACKS:
        plural = "s" if pack["subjects_count"] > 1 else ""
        body += (
            f'<span class="checkbox"></span> {pack["subjects_count"]} matière{plural} '
            f'({format_tnd(pack["price_per_student"])} TND) &nbsp;&nbsp; '
        )
    body += '</p>'

    # Page 3 - Repères tarifaires + Informations pratiques (merged)
    body += '<div class="page-break"></div>'
    body += make_header("Dossier d'accueil famille")
    body += "<h2>Repères tarifaires</h2>"
    body += '<table class="form-table"><tbody>'
    for label in ["Pack envisagé", "Tarif public", "Acompte indicatif dans la grille (30 %)"]:
        body += f'<tr><td style="width:50%; font-weight:600; color:#071A3A; padding:6px;">{label}</td><td style="border-bottom:1px solid #333; height:8mm; padding:6px; text-align:right;"><span style="color:#999; font-size:8pt;">TND</span></td></tr>'
    body += '</tbody></table>'

    body += '<div style="background:#F5F6F8; border:1px solid #DDD; padding:8px 12px; margin:10px 0; font-size:9pt; line-height:1.5;">'
    body += '<strong>Document de revue</strong> : aucune demande d\'information ne bloque une place et aucun paiement ne doit être collecté avant validation des conditions de paiement, de reçu, d\'annulation et de remboursement.'
    body += '</div>'

    body += "<h2>Informations pratiques (à conserver par la famille)</h2>"
    body += """<table class="form-table">
    <tbody>
        <tr><td style="width:25%; font-weight:700; color:#071A3A; padding:6px;">Lieu</td><td style="padding:6px;">Centre Nexus Réussite, Mutuelleville, Tunis</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Dates</td><td style="padding:6px;">Du 17 au 28 août 2026, y compris le week-end du 22-23 août (SVT et Physique-Chimie Première uniquement)</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Arrivée</td><td style="padding:6px;">10 minutes avant le début du créneau</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Matériel</td><td style="padding:6px;">Cahier et trousse pour toutes les matières ; calculatrice pour Mathématiques et Physique-Chimie ; <strong>ordinateur portable pour NSI</strong> (nous prévenir si besoin d'un poste de secours)</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Supports</td><td style="padding:6px;">Toutes les fiches et exercices sont fournis par Nexus</td></tr>
        <tr><td style="font-weight:700; color:#071A3A; padding:6px;">Absence</td><td style="padding:6px;">Prévenir au +216 99 19 28 29 ; les supports de la séance manquée sont remis à l'élève</td></tr>
    </tbody></table>"""
    body += '<p style="font-size:10pt; margin-top:14px; line-height:1.7;"><strong>Contact pendant le stage</strong> : +216 99 19 28 29 (téléphone et WhatsApp) · contact@nexusreussite.academy</p>'

    # Page 5 - Demande d'information
    body += '<div class="page-break"></div>'
    body += make_header("Dossier d'accueil famille")
    body += "<h2>Demander les informations du stage</h2>"
    body += '<p style="font-size:10pt; line-height:1.8;">Indiquez uniquement le niveau d’entrée et la matière recherchée. L’équipe peut alors transmettre le programme, les horaires et la grille tarifaire disponibles.</p>'
    body += '<p style="font-size:10pt; line-height:1.8;"><strong>Aucun paiement n’est demandé et aucune place n’est bloquée par cette demande d’information.</strong></p>'
    body += '<div style="margin-top:22px; padding:16px; border:1px solid #C9A227; background:#FBFAF5;">'
    body += '<p style="font-size:11pt; margin:0 0 8px 0;"><strong>WhatsApp :</strong> +216 99 19 28 29</p>'
    body += '<p style="font-size:11pt; margin:0;"><strong>Email :</strong> contact@nexusreussite.academy</p>'
    body += '</div>'

    body += f'<p style="font-size:7.5pt; color:#999; margin-top:30px; border-top:1px solid #E0E0E0; padding-top:6px;">Nexus Réussite — marque exploitée par STE M&amp;M ACADEMY SUARL · Siège : Immeuble VENUS, Appt C13, Centre Urbain Nord, 1082 Tunis.</p>'

    return body


def make_flyer_body():
    """One-page review flyer derived from canonical campaign and pricing data."""
    foundation_by_level = {
        item["level"]: item
        for item in PRE_RENTREE_FOUNDATIONS
    }
    premium_prices = " · ".join(
        f'{pack["subjects_count"]} mat. : {format_tnd(pack["price_per_student"])} TND'
        for pack in PRE_RENTREE_PACKS
    )
    subjects_by_level = {
        level["id"]: [
            subject["label"]
            for subject in CAMPAIGN["subjects"]
            if level["id"] in subject["levels"]
        ]
        for level in CAMPAIGN["levels"]
    }

    body = f"""
    <div style="text-align:center; margin-bottom:14px;">
        <img src="{LOGO_SLOGAN}" alt="Nexus Réussite" style="width:52mm; margin-bottom:8px;"><br>
        <h1 style="color:#071A3A; font-size:20pt; margin-bottom:4px;">Stages de pré-rentrée 2026</h1>
        <p style="font-size:11pt; font-weight:700;">17–28 août · Mutuelleville, Tunis</p>
    </div>
    <div class="intro"><strong>5 séances de 2 h par matière.</strong> Des priorités, prérequis et méthodes
    sélectionnés pour préparer la rentrée, avec objectifs annoncés, entraînement et correction explicite.</div>
    <h2>Niveaux et matières</h2>
    <table><tbody>
        <tr><td><strong>Entrée en 4e</strong></td><td>{", ".join(subjects_by_level["QUATRIEME"])}</td></tr>
        <tr><td><strong>Entrée en 3e</strong></td><td>{", ".join(subjects_by_level["TROISIEME"])}</td></tr>
        <tr><td><strong>Entrée en Seconde</strong></td><td>{", ".join(subjects_by_level["SECONDE"])}</td></tr>
        <tr><td><strong>Entrée en Première</strong></td><td>{", ".join(subjects_by_level["PREMIERE"])}</td></tr>
        <tr><td><strong>Entrée en Terminale</strong></td><td>{", ".join(subjects_by_level["TERMINALE"])}</td></tr>
    </tbody></table>
    <h2>Effectifs et tarifs</h2>
    <p style="font-size:9.5pt; line-height:1.7;">
        <strong>Fondations</strong> ({foundations_effectifs_par_niveau()}) ·
        4e : {format_tnd(foundation_by_level["QUATRIEME"]["price_per_student"])} TND / matière ·
        3e : {format_tnd(foundation_by_level["TROISIEME"]["price_per_student"])} TND / matière ·
        Seconde : {format_tnd(foundation_by_level["SECONDE"]["price_per_student"])} TND / matière.<br>
        <strong>Premium :</strong> {PREMIUM_GROUP_MIN} à {PREMIUM_GROUP_MAX} élèves, maximum {PREMIUM_GROUP_MAX} · {premium_prices}.
    </p>
    <h2>Demander les informations et vérifier les disponibilités</h2>
    <p style="font-size:9.5pt; line-height:1.7;">Indiquez le niveau et la matière sur WhatsApp.
    Aucun paiement n'est demandé et aucune place n'est bloquée à ce stade.</p>
    <p style="font-size:11pt; color:#071A3A; font-weight:800; margin-top:10px;">
        <a href="tel:+21699192829">+216 99 19 28 29</a> ·
        <a href="mailto:contact@nexusreussite.academy">contact@nexusreussite.academy</a> ·
        <a href="https://nexusreussite.academy/stages/pre-rentree-2026">Voir le programme</a>
    </p>
    """
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
@page { margin: 9mm 13mm 10mm 13mm; }
body { font-size: 8.5pt; line-height: 1.32; }
h2 { font-size: 11pt; margin-bottom: 5px; }
table { margin-bottom: 7px; }
thead th { padding: 3px 4px; font-size: 7.5pt; }
tbody td { padding: 3px 4px; font-size: 8pt; }
.check-list li { font-size: 8.5pt; margin-bottom: 2px; }
.page-footer { bottom: -5mm; }
"""


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Production des PDF ===\n")

    # 0-3. Les 4 dossiers complets parents (un par niveau : 3e, Seconde, Première,
    # Terminale) sont générés par le module dédié generate_level_dossiers.py, seule
    # source de la mise en page des programmes détaillés — voir son docstring pour
    # le détail. Ce module ne contient plus de catalogue de programmes : toutes les
    # matières (y compris SVT, désormais un chapitre de son dossier de niveau plutôt
    # qu'un PDF séparé) sont dérivées de content/pre-rentree-2026/modules.json.
    import generate_level_dossiers
    generate_level_dossiers.configure_reproducible_pdf_environment()
    generate_level_dossiers.generate_all_level_dossiers()

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

    # 8. Flyer essentiel
    body = make_flyer_body()
    html = wrap_html(body, "Nexus Réussite — Flyer essentiel — Pré-rentrée 2026")
    generate_pdf(html, "NexusReussite_PreRentree2026_FlyerEssentiel.pdf",
                 "Nexus Réussite — Flyer essentiel — Pré-rentrée 2026")

    print("\n✓ Production terminée")

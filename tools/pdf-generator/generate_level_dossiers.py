#!/usr/bin/env python3
"""Generate the 4 canonical parent dossiers (one per entry level) for the
pré-rentrée 2026 campaign — Phase 2-5 of the parent-dossier redesign mission.

Each dossier consolidates, for a single level: the full planning, every
subject's detailed programme (vertical session cards, not a dense table),
subject-combination guidance, practical information and a gated CTA. SVT is
folded in as an ordinary subject chapter (Première/Terminale) instead of a
separate standalone PDF.

Every piece of content is derived from pre_rentree_data.PreRentreeData — no
subject, session, price or date is hardcoded here. REVIEW vs PUBLIC mode is
determined entirely by LevelDossierData.is_public (itself derived from real
publicationStatus values and gap detection), never by a local flag.
"""

from __future__ import annotations

import os
from pathlib import Path

from weasyprint import HTML

from dossier_design import DESIGN_CSS
from itinerary import MAX_STUDENT_IDLE_MINUTES, assign_itinerary
from pre_rentree_data import (
    CONTACT_EMAIL,
    CONTACT_PHONE_DISPLAY,
    CONTACT_PHONE_HREF,
    CONTACT_SITE,
    CONTACT_SITE_URL,
    LEVEL_ORDER,
    SUBJECT_ACCENTS,
    SUBJECT_LABELS,
    SUBJECT_MARKERS,
    LevelDossierData,
    PreRentreeData,
    format_tnd,
)

TOOL_DIR = Path(__file__).parent
REPO_ROOT = TOOL_DIR.parent.parent
OUT_DIR = TOOL_DIR / "output"
OUT_DIR.mkdir(exist_ok=True)
LOGO = str((REPO_ROOT / "public" / "images" / "logo_slogan_nexus_x3.png").resolve())

_BLOCK_ORDER = ("A", "B", "C", "D")
# 2026-07-20T00:00:00Z. FontTools uses SOURCE_DATE_EPOCH when it writes
# subsetted font metadata. Without this fixed value, byte-identical HTML
# produces a different public PDF checksum at every invocation.
PUBLIC_PDF_SOURCE_DATE_EPOCH = "1784505600"


def configure_reproducible_pdf_environment() -> None:
    os.environ["SOURCE_DATE_EPOCH"] = PUBLIC_PDF_SOURCE_DATE_EPOCH


def _subject_label(subject_id: str) -> str:
    return SUBJECT_LABELS.get(subject_id, subject_id)


def _accent(subject_id: str) -> str:
    return SUBJECT_ACCENTS.get(subject_id, "#BFA06A")


def _marker(subject_id: str) -> str:
    return SUBJECT_MARKERS.get(subject_id, subject_id[:2])


def _header(level_label: str) -> str:
    return f"""
    <div class="page-header">
        <div class="brand">
            <img src="{LOGO}" alt="Nexus Réussite">
            <span class="header-title">Dossier complet parents — Stage de pré-rentrée</span>
        </div>
        <span class="header-level">Entrée en {level_label}</span>
    </div>
    """


def _status_badge(is_public: bool) -> str:
    if is_public:
        return '<span class="status-badge public">PROGRAMME VALIDÉ</span>'
    return '<span class="status-badge review">PROGRAMME EN COURS DE VALIDATION PÉDAGOGIQUE</span>'


# ── Page 1 — cover ──────────────────────────────────────────────────────────

def cover_page(dossier: LevelDossierData, data: PreRentreeData) -> str:
    watermark = '<div class="review-watermark">DOCUMENT DE REVUE</div>' if not dossier.is_public else ""
    return f"""
    <div class="dossier-cover">
        {watermark}
        <img class="logo" src="{LOGO}" alt="Nexus Réussite">
        <div class="eyebrow">Stages de pré-rentrée 2026</div>
        <h1>Dossier complet parents</h1>
        <div class="cover-level">Entrée en {dossier.level_label} — année scolaire 2026-2027</div>
        <div class="cover-meta">
            Du 17 au 28 août 2026 · Centre Nexus Réussite, Mutuelleville, Tunis<br>
            Priorités, prérequis et méthodes sélectionnés pour préparer la rentrée
        </div>
        {_status_badge(dossier.is_public)}
    </div>
    """


# ── Page 2 — en un coup d'œil ────────────────────────────────────────────────

def snapshot_page(dossier: LevelDossierData, data: PreRentreeData) -> str:
    tier = data.tier_for_level(dossier.level)
    if tier == "foundations":
        group_min, group_max = data.foundations_group_min, data.foundations_group_max
        offers = [o for o in data.foundations if o["level"] == dossier.level]
        price_line = " · ".join(
            f'{o["subjects_count"]} matière : {format_tnd(o["price_per_student"])} TND' for o in offers
        )
    else:
        group_min, group_max = data.premium_group_min, data.premium_group_max
        price_line = " · ".join(
            f'{o["subjects_count"]} mat. : {format_tnd(o["price_per_student"])} TND' for o in data.premium_packs
        )

    subjects_line = ", ".join(_subject_label(s) for s in dossier.subjects)
    sessions_total = len(dossier.subjects) * 5

    body = _header(dossier.level_label)
    body += '<h2 class="section-title">En un coup d\'œil</h2>'
    body += '<div class="snapshot-grid">'
    cards = [
        ("Public concerné", f"Élèves entrant en {dossier.level_label} (rentrée 2026-2027)"),
        ("Matières proposées", subjects_line),
        ("Volume", f"5 séances de 2 h par matière · {sessions_total} séances au total sur le niveau"),
        ("Groupe", f"{group_min} à {group_max} élèves, maximum {group_max}"),
        ("Lieu", "Centre Nexus Réussite, Mutuelleville, Tunis"),
        ("Période", "17–28 août 2026, dont le week-end du 22-23 août pour certaines matières"),
        ("Mode", "Demande d'information sans paiement ; aucune place n'est bloquée à ce stade"),
        ("Tarifs indicatifs", price_line),
    ]
    for label, value in cards:
        body += f'<div class="snapshot-card"><div class="label">{label}</div><div class="value">{value}</div></div>'
    body += "</div>"

    body += '<p class="lede">Ce dossier réunit, pour ce seul niveau, le planning complet, le programme détaillé ' \
            'de chaque matière proposée et les informations pratiques. Il remplace les documents séparés par ' \
            'matière : un seul document à consulter.</p>'
    return body


# ── Page 3 — planning + combinaisons ────────────────────────────────────────

def planning_page(dossier: LevelDossierData, data: PreRentreeData) -> str:
    body = '<div class="page-break-before"></div>' + _header(dossier.level_label)
    body += '<h2 class="section-title">Planning du niveau</h2>'

    by_subject = {}
    for slot in dossier.slots:
        by_subject.setdefault(slot.subject, []).append(slot)

    for subject_id in dossier.subjects:
        slots = by_subject.get(subject_id, [])
        accent = _accent(subject_id)
        windows_desc = "; ".join(
            f'{s.window_label} · {s.start_time}–{s.end_time} (bloc {s.block})'
            + (
                f' · {s.room.replace("salle-", "Salle ")}'
                if data.room_assignments_public else ""
            )
            for s in slots
        )
        body += (
            f'<div class="subject-plan-card" style="--accent:{accent}">'
            f'<div class="marker">{_marker(subject_id)}</div>'
            f'<div class="details"><strong>{_subject_label(subject_id)}</strong> — 5 séances de 2 h '
            f'(10 h au total)<br>{windows_desc}</div></div>'
        )

    # "Peut-on combiner ces matières ?" — statut réel par paire (jamais réduit à un
    # booléen "incompatible" : deux matières peuvent ne pas se chevaucher tout en
    # imposant une attente de plusieurs heures, voir SCHEDULE-UX-AUDIT.md). Uses
    # assign_itinerary (not compute_itinerary directly) so that subjects with two
    # alternative cohorts (Première SVT, Terminale NSI/SVT) are evaluated on the
    # single best cohort a family would actually be assigned — never both cohorts
    # merged into one impossible itinerary.
    body += '<h3 class="subsection-title">Peut-on combiner ces matières ?</h3>'
    dated_sessions = data.dated_slots_for_level(dossier.level)
    simultaneous_pairs = []
    long_idle_pairs = []
    compact_pairs = []
    subjects = list(dossier.subjects)
    for idx_a in range(len(subjects)):
        for idx_b in range(idx_a + 1, len(subjects)):
            pair = (subjects[idx_a], subjects[idx_b])
            # Mathématiques expertes n'est jamais un choix autonome : le profil
            # Terminale doit aussi retenir Mathématiques. Une paire qui omet la
            # spécialité Mathématiques n'est donc pas un parcours public normal.
            if "MATHS_EXPERTES" in pair and "MATHEMATIQUES" not in pair:
                continue
            report = assign_itinerary(dossier.level, pair, dated_sessions).itinerary
            if report.status == "SIMULTANEOUS":
                simultaneous_pairs.append(pair)
            elif report.status == "LONG_IDLE":
                long_idle_pairs.append((pair, report.max_idle_minutes))
            elif report.status == "COMPACT":
                compact_pairs.append((pair, report.max_idle_minutes))

    if simultaneous_pairs or long_idle_pairs:
        parts = ['<div class="combo-note" style="border-color:#8F1D1D;">']
        if simultaneous_pairs:
            parts.append('<strong>Créneaux simultanés (à ne jamais combiner) :</strong><ul style="margin:6px 0 10px 16px; font-size:9pt; line-height:1.6;">')
            for a, b in simultaneous_pairs:
                parts.append(f"<li>{_subject_label(a)} et {_subject_label(b)} : même créneau, un élève ne peut suivre qu'une seule des deux.</li>")
            parts.append("</ul>")
        if long_idle_pairs:
            parts.append(f'<strong>Attente supérieure à {MAX_STUDENT_IDLE_MINUTES} minutes le même jour :</strong><ul style="margin:6px 0 10px 16px; font-size:9pt; line-height:1.6;">')
            for (a, b), idle_minutes in long_idle_pairs:
                parts.append(f"<li>{_subject_label(a)} et {_subject_label(b)} : {idle_minutes} minutes d'attente entre les deux séances.</li>")
            parts.append("</ul>")
        if compact_pairs:
            compact_desc = ", ".join(f"{_subject_label(a)} + {_subject_label(b)}" for (a, b), _ in compact_pairs)
            parts.append(f"<span style='color:#1E5F4B; font-weight:600;'>Combinaisons compactes (≤ {MAX_STUDENT_IDLE_MINUTES} min) : {compact_desc}.</span>")
        parts.append("</div>")
        body += "".join(parts)
    elif compact_pairs:
        body += (
            f'<div class="combo-note ok">Toutes les combinaisons de deux matières proposées pour ce niveau sont '
            f"compactes : aucune attente supérieure à {MAX_STUDENT_IDLE_MINUTES} minutes le même jour.</div>"
        )
    else:
        body += (
            '<div class="combo-note ok">Pour ce niveau, les matières proposées ne partagent jamais la même journée : '
            "aucune attente n'est générée par leur combinaison.</div>"
        )

    if dossier.level == "TERMINALE":
        body += (
            '<p style="font-size:9pt; color:#5A6B82; margin-top:6px;">'
            "Mathématiques expertes est proposée uniquement aux élèves qui suivent aussi la spécialité "
            "Mathématiques ; le parcours est calculé avec ces deux matières.</p>"
        )

    if data.tier_for_level(dossier.level) == "premium":
        max_subjects = max(o["subjects_count"] for o in data.premium_packs)
        body += (
            f'<p style="font-size:9pt; color:#5A6B82; margin-top:6px;">Le pack Premium permet de choisir '
            f"jusqu'à {max_subjects} matières parmi les {len(dossier.subjects)} proposées pour ce niveau.</p>"
        )
    return body


# ── Page 4 — organisation ───────────────────────────────────────────────────

def organisation_page(dossier: LevelDossierData) -> str:
    body = '<div class="page-break-before"></div>' + _header(dossier.level_label)
    body += '<h2 class="section-title">Comment le stage est organisé</h2>'
    body += """
    <p style="font-size:9.5pt; line-height:1.7; margin-bottom:10px;">
    Chaque matière suit le même cadre sur ses cinq séances : un objectif annoncé en début de séance, un travail
    guidé en groupe réduit avec des consignes différenciées selon le profil de l'élève, un entraînement progressif,
    puis une correction explicite. Un livrable concret (fiche méthode, formulaire, grille de synthèse…) est remis
    à l'élève à chaque séance.
    </p>
    <ul class="check-list">
        <li>Groupe réduit, encadré par un enseignant expérimenté du système français</li>
        <li>Supports fournis par Nexus (fiches, exercices, sujets d'entraînement)</li>
        <li>Correction explicite à chaque séance, pas seulement un corrigé distribué</li>
        <li>Adaptation au profil déclaré de l'élève, dans le cadre du groupe</li>
    </ul>
    <p style="font-size:9pt; color:#5A6B82; line-height:1.6;">
    Ce stage sélectionne des priorités, prérequis et méthodes pour préparer la rentrée : il ne prétend pas couvrir
    un programme annuel en dix heures, et ne garantit ni résultat ni note. Les éléments non explicitement inclus
    dans l'offre choisie (suivi individuel régulier, accompagnement annuel, bilan diagnostique...) ne sont pas
    présumés compris dans ce stage.
    </p>
    """
    return body


# ── Subject chapters ─────────────────────────────────────────────────────────

def _session_card(session, accent: str) -> str:
    method_row = (
        f'<div class="session-row"><span class="k">Méthode</span><span class="v">{session.method}</span></div>'
        if session.method else ""
    )
    return f"""
    <div class="session-card" style="--accent:{accent}">
        <div class="session-head">
            <span class="session-number" style="color:{accent}">{session.number}</span>
            <span class="session-title">{session.title}</span>
        </div>
        <div class="session-row"><span class="k">Objectif</span><span class="v">{session.objective}</span></div>
        <div class="session-row"><span class="k">Notions clés</span><span class="v">{", ".join(session.topics)}</span></div>
        {method_row}
        <div class="session-row"><span class="k">Livrable</span><span class="v">{session.deliverable}</span></div>
    </div>
    """


def subject_chapter(dossier: LevelDossierData, subject_id: str, data: PreRentreeData) -> str:
    module = dossier.modules_by_subject[subject_id]
    accent = _accent(subject_id)
    unvalidated = not module.is_validated

    body = '<div class="subject-chapter">' + _header(dossier.level_label)
    body += (
        f'<div class="subject-chapter-title">'
        f'<div class="marker" style="background:{accent}">{_marker(subject_id)}</div>'
        f'<h2 class="section-title" style="border-color:{accent}">{_subject_label(subject_id)}</h2>'
        f"</div>"
    )
    if unvalidated:
        body += (
            '<div class="combo-note" style="border-color:#8F1D1D; color:#8F1D1D;">'
            "<strong>Programme en cours de validation pédagogique</strong> — ce chapitre présente une proposition "
            "de contenu, non encore validée par la direction pédagogique.</div>"
        )

    body += '<h3 class="subsection-title">Pourquoi ce module ?</h3>'
    body += f'<p style="font-size:9.5pt; line-height:1.6; margin-bottom:6px;">{module.subtitle}</p>'
    body += f'<p style="font-size:9pt; color:#5A6B82; line-height:1.6; margin-bottom:12px;"><strong>Prérequis mobilisés :</strong> {module.prerequisites}</p>'

    body += '<h3 class="subsection-title">Ce que votre enfant va consolider</h3>'
    topics_overview = "".join(f"<li>{s.title}</li>" for s in module.sessions)
    body += f'<ul class="check-list" style="margin-bottom:12px;">{topics_overview}</ul>'

    body += '<h3 class="subsection-title">Le programme des cinq séances</h3>'
    for session in module.sessions:
        body += _session_card(session, accent)

    body += '<h3 class="subsection-title">Repères méthodologiques</h3>'
    body += f'<p style="font-size:9.5pt; line-height:1.6; margin-bottom:10px;">{module.differentiation}</p>'

    body += '<h3 class="subsection-title">À l\'issue du module</h3>'
    body += f'<p style="font-size:9.5pt; line-height:1.6;">{module.quick_assessment}</p>'

    equipment = data.materials_for_subject(subject_id, module)
    body += f'<p style="font-size:8.5pt; color:#5A6B82; margin-top:10px;"><strong>Matériel :</strong> {equipment}</p>'

    body += "</div>"
    return body


# ── Last page — practical info + CTA ────────────────────────────────────────

def practical_info_page(dossier: LevelDossierData, data: PreRentreeData) -> str:
    body = '<div class="page-break-before"></div>' + _header(dossier.level_label)
    body += '<h2 class="section-title">Informations pratiques</h2>'
    body += f"""
    <table class="practical"><tbody>
        <tr><td>Lieu</td><td>Centre Nexus Réussite, Mutuelleville, Tunis</td></tr>
        <tr><td>Dates</td><td>Du 17 au 28 août 2026, y compris le week-end du 22-23 août pour les matières concernées</td></tr>
        <tr><td>Arrivée</td><td>10 minutes avant le début du créneau</td></tr>
        <tr><td>Supports</td><td>Toutes les fiches et exercices sont fournis par Nexus</td></tr>
        <tr><td>Absence</td><td>Prévenir au {CONTACT_PHONE_DISPLAY} ; les supports de la séance manquée sont remis à l'élève</td></tr>
    </tbody></table>
    """
    body += '<h3 class="subsection-title">Matériel par matière</h3>'
    body += '<table class="practical"><tbody>'
    for subject_id in dossier.subjects:
        module = dossier.modules_by_subject.get(subject_id)
        body += f"<tr><td>{_subject_label(subject_id)}</td><td>{data.materials_for_subject(subject_id, module)}</td></tr>"
    body += "</tbody></table>"

    body += '<h3 class="subsection-title">Ouverture des groupes</h3>'
    tier = data.tier_for_level(dossier.level)
    gmin, gmax = (data.foundations_group_min, data.foundations_group_max) if tier == "foundations" \
        else (data.premium_group_min, data.premium_group_max)
    body += (
        f'<p style="font-size:9.5pt; line-height:1.6; margin-bottom:12px;">Ouverture à partir de '
        f"<strong>{gmin} élèves</strong>, <strong>{gmax} élèves maximum</strong>. L'ouverture, le créneau, la salle "
        "et l'affectation pédagogique sont confirmés directement aux familles lors de l'ouverture effective du groupe.</p>"
    )

    body += f"""
    <div class="cta-block">
        <div class="cta-title">Demander les informations et vérifier les disponibilités</div>
        <div class="cta-line">Indiquez la classe de rentrée et la ou les matières recherchées.
        L'équipe vérifie la compatibilité et transmet le programme, les horaires et la grille tarifaire.</div>
        <div class="cta-line" style="margin-top:8px;">
            <a href="tel:{CONTACT_PHONE_HREF}">{CONTACT_PHONE_DISPLAY}</a> (téléphone et WhatsApp) ·
            <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a> ·
            <a href="{CONTACT_SITE_URL}">{CONTACT_SITE}</a>
        </div>
        <div class="cta-line" style="margin-top:6px; font-size:8.5pt; opacity:0.85;">
            Aucun paiement n'est demandé et aucune place n'est bloquée par cette demande d'information.
        </div>
    </div>
    """
    body += (
        '<p style="font-size:7.5pt; color:#5A6B82; margin-top:14px;">Nexus Réussite — marque exploitée par '
        "STE M&amp;M ACADEMY SUARL. Conditions générales : "
        '<a href="https://nexusreussite.academy/conditions-generales" style="color:#5A6B82;">'
        "nexusreussite.academy/conditions-generales</a></p>"
    )
    return body


# ── Assembly ─────────────────────────────────────────────────────────────────

def build_dossier_html(dossier: LevelDossierData, data: PreRentreeData) -> str:
    body = cover_page(dossier, data)
    body += '<div class="page-break-before"></div>' + snapshot_page(dossier, data)
    body += planning_page(dossier, data)
    body += organisation_page(dossier)
    for subject_id in dossier.subjects:
        body += subject_chapter(dossier, subject_id, data)
    body += practical_info_page(dossier, data)

    extra_css = ".page-break-before { page-break-before: always; }"
    title = f"Nexus Réussite — Dossier complet parents — Entrée en {dossier.level_label} — Pré-rentrée 2026"
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<meta name="author" content="Nexus Réussite">
<meta name="description" content="Dossier complet parents — Stage de pré-rentrée 2026 — Entrée en {dossier.level_label}">
<style>
{DESIGN_CSS}
{extra_css}
</style>
</head>
<body>
{body}
</body>
</html>"""


def generate_dossier_pdf(dossier: LevelDossierData, data: PreRentreeData) -> str:
    # Historic public filenames use "Premiere"/"3e" without the accent; keep them stable.
    filename_level = {
        "3e": "3e", "Seconde": "Seconde", "Première": "Premiere", "Terminale": "Terminale",
    }[dossier.level_label]
    filename = f"NexusReussite_PreRentree2026_Programme_{filename_level}.pdf"

    html_content = build_dossier_html(dossier, data)
    document = HTML(string=html_content, base_url=str(OUT_DIR))
    doc = document.render()
    doc.metadata.title = f"Nexus Réussite — Dossier complet parents — Entrée en {dossier.level_label} — Pré-rentrée 2026"
    doc.metadata.authors = ["Nexus Réussite"]
    doc.metadata.description = f"Dossier complet parents — Stage de pré-rentrée 2026 — Entrée en {dossier.level_label}"
    doc.metadata.keywords = ["pré-rentrée 2026", "Nexus Réussite", dossier.level_label]
    doc.write_pdf(str(OUT_DIR / filename))
    size = os.path.getsize(OUT_DIR / filename)
    print(f"  {filename}: {size // 1024} Ko ({len(doc.pages)} pages, {'PUBLIC' if dossier.is_public else 'REVIEW'})")
    return filename


def generate_all_level_dossiers(data: PreRentreeData = None) -> list:
    if data is None:
        data = PreRentreeData()
    filenames = []
    for level in LEVEL_ORDER:
        dossier = data.level_dossier(level)
        if dossier.gaps:
            gap_desc = ", ".join(f"{g.level}/{g.subject_id}" for g in dossier.gaps)
            raise RuntimeError(
                f"Gap detected for level {level}: subject(s) {gap_desc} have no matching pedagogical "
                "module in modules.json. Refusing to generate a dossier with invented content."
            )
        filenames.append(generate_dossier_pdf(dossier, data))
    return filenames


if __name__ == "__main__":
    configure_reproducible_pdf_environment()
    print("=== Production des 4 dossiers complets parents ===\n")
    generate_all_level_dossiers()
    print("\n✓ Production terminée")

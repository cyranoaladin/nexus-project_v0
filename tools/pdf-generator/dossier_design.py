"""Design system for the pré-rentrée 2026 parent-dossier PDFs (Phase 3).

Institutional palette (navy / ivory / gold), Fraunces for titles and DM Sans
for body text — both embedded from local repo assets (app/fonts/*.woff2, the
same variable fonts already used on the live site), no network font loading.
Per-subject accent colours (pre_rentree_data.SUBJECT_ACCENTS) are used only as
small markers/underlines on subject chapters, never as full-page backgrounds,
so the institutional charter stays dominant.
"""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_FONT_DIR = REPO_ROOT / "app" / "fonts"

NAVY = "#071A3A"
NAVY_SECONDARY = "#0E2547"
IVORY = "#F7F4ED"
PAPER = "#FBFAF5"
GOLD = "#BFA06A"
GOLD_DEEP = "#7A6535"
GREEN_VALIDATION = "#1E5F4B"
TEXT_SECONDARY = "#5A6B82"
RED_ALERT = "#8F1D1D"


def _font_face(family: str, filename: str) -> str:
    path = (_FONT_DIR / filename).resolve()
    return f"""
@font-face {{
    font-family: '{family}';
    src: url('file://{path}') format('woff2');
    font-weight: 100 900;
    font-style: normal;
}}
"""


DESIGN_CSS = f"""
{_font_face('Fraunces', 'Fraunces-Variable.woff2')}
{_font_face('DM Sans', 'DMSans-Variable.woff2')}

@page {{
    size: A4 portrait;
    margin: 16mm 18mm 18mm 18mm;
    @bottom-center {{
        content: "Page " counter(page) " / " counter(pages);
        font-family: 'DM Sans', sans-serif;
        font-size: 7.5pt;
        color: {TEXT_SECONDARY};
    }}
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
    font-family: 'DM Sans', sans-serif;
    color: #1A2333;
    font-size: 10.5pt;
    line-height: 1.45;
    background: {PAPER};
}}
a {{ color: {NAVY}; text-decoration: none; }}
p, li {{ orphans: 3; widows: 3; }}
h1, h2, h3 {{ font-family: 'Fraunces', serif; break-after: avoid; }}

/* ── Cover ─────────────────────────────────────────────────────────── */
.dossier-cover {{
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    background: {IVORY};
}}
.dossier-cover img.logo {{ width: 55mm; margin-bottom: 26px; }}
.dossier-cover .eyebrow {{
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-size: 9pt;
    color: {GOLD_DEEP};
    font-weight: 700;
    margin-bottom: 10px;
}}
.dossier-cover h1 {{
    color: {NAVY};
    font-size: 28pt;
    font-weight: 600;
    margin-bottom: 10px;
}}
.dossier-cover .cover-level {{
    color: {NAVY_SECONDARY};
    font-size: 15pt;
    font-weight: 600;
    margin-bottom: 6px;
}}
.dossier-cover .cover-meta {{
    color: {TEXT_SECONDARY};
    font-size: 10.5pt;
    margin-top: 18px;
    line-height: 1.7;
}}
.status-badge {{
    display: inline-block;
    margin-top: 22px;
    padding: 7px 16px;
    border-radius: 999px;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: .4px;
}}
.status-badge.public {{ background: rgba(30,95,75,0.12); color: {GREEN_VALIDATION}; }}
.status-badge.review {{ background: rgba(143,29,29,0.10); color: {RED_ALERT}; }}
.review-watermark {{
    position: fixed;
    top: 45%;
    left: 0;
    width: 100%;
    text-align: center;
    transform: rotate(-28deg);
    font-size: 54pt;
    font-weight: 800;
    color: rgba(143, 29, 29, 0.10);
    letter-spacing: 6px;
    z-index: 1;
}}

/* ── Running header/footer for interior pages ─────────────────────── */
.page-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(7,26,58,0.12);
    padding-bottom: 6px;
    margin-bottom: 16px;
}}
.page-header .brand {{ display: flex; align-items: center; gap: 8px; }}
.page-header img {{ width: 10mm; }}
.page-header .header-title {{ color: {NAVY}; font-size: 8.5pt; font-weight: 700; }}
.page-header .header-level {{ color: {TEXT_SECONDARY}; font-size: 8pt; }}

/* ── Section titles ────────────────────────────────────────────────── */
h2.section-title {{
    color: {NAVY};
    font-size: 17pt;
    font-weight: 600;
    margin: 4px 0 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid {GOLD};
}}
h3.subsection-title {{
    color: {NAVY};
    font-size: 12pt;
    font-weight: 600;
    margin: 14px 0 6px;
}}
p.lede {{
    background: {IVORY};
    border-left: 3px solid {GOLD};
    padding: 10px 14px;
    margin-bottom: 14px;
    font-size: 9.5pt;
    line-height: 1.6;
    break-inside: avoid;
}}

/* ── Snapshot cards ("en un coup d'œil") ───────────────────────────── */
.snapshot-grid {{
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
}}
.snapshot-card {{
    flex: 1 1 45%;
    background: white;
    border: 1px solid rgba(7,26,58,0.10);
    border-radius: 6px;
    padding: 10px 12px;
    break-inside: avoid;
}}
.snapshot-card .label {{
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: .6px;
    color: {TEXT_SECONDARY};
    font-weight: 700;
    margin-bottom: 3px;
}}
.snapshot-card .value {{ font-size: 10pt; color: {NAVY}; font-weight: 600; line-height: 1.4; }}

/* ── Per-subject planning card (Page 3) ────────────────────────────── */
.subject-plan-card {{
    display: flex;
    gap: 10px;
    background: white;
    border: 1px solid rgba(7,26,58,0.10);
    border-left: 4px solid var(--accent, {GOLD});
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 8px;
    break-inside: avoid;
}}
.subject-plan-card .marker {{
    flex: 0 0 auto;
    width: 9mm;
    height: 9mm;
    border-radius: 4px;
    background: var(--accent, {GOLD});
    color: white;
    font-size: 8pt;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
}}
.subject-plan-card .details {{ font-size: 9pt; line-height: 1.5; }}
.subject-plan-card .details strong {{ color: {NAVY}; }}

/* ── Combination guidance ─────────────────────────────────────────── */
.combo-note {{
    background: {IVORY};
    border: 1px solid {GOLD};
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 9pt;
    line-height: 1.6;
    margin: 10px 0 14px;
    break-inside: avoid;
}}
.combo-note.ok {{ border-color: {GREEN_VALIDATION}; }}

/* ── Subject chapter ───────────────────────────────────────────────── */
.subject-chapter {{ page-break-before: always; }}
.subject-chapter-title {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}}
.subject-chapter-title .marker {{
    width: 11mm; height: 11mm; border-radius: 6px;
    background: var(--accent, {GOLD}); color: white;
    font-size: 9pt; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
}}
.subject-chapter-title h2 {{ border: none; margin: 0; padding: 0; }}

/* ── Vertical session cards (replaces the old dense 4-column table) ─── */
.session-card {{
    background: white;
    border: 1px solid rgba(7,26,58,0.10);
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 10px;
    break-inside: avoid;
}}
.session-card .session-head {{
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
}}
.session-card .session-number {{
    font-family: 'Fraunces', serif;
    font-size: 13pt;
    font-weight: 600;
    color: var(--accent, {NAVY});
}}
.session-card .session-title {{
    font-size: 11pt;
    font-weight: 700;
    color: {NAVY};
}}
.session-card .session-row {{
    display: flex;
    gap: 6px;
    font-size: 9pt;
    line-height: 1.5;
    margin-bottom: 3px;
}}
.session-card .session-row .k {{
    flex: 0 0 22mm;
    color: {TEXT_SECONDARY};
    font-weight: 600;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: .3px;
    padding-top: 1px;
}}
.session-card .session-row .v {{ flex: 1; }}

/* ── Practical info tables & CTA ───────────────────────────────────── */
table.practical {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; }}
table.practical td {{ padding: 5px 6px; font-size: 9pt; border-bottom: 1px solid rgba(7,26,58,0.08); vertical-align: top; }}
table.practical td:first-child {{ width: 28%; font-weight: 700; color: {NAVY}; }}

.cta-block {{
    background: {NAVY};
    color: white;
    border-radius: 8px;
    padding: 16px 18px;
    margin-top: 16px;
    break-inside: avoid;
}}
.cta-block a {{ color: {GOLD}; font-weight: 700; }}
.cta-block .cta-title {{ font-family: 'Fraunces', serif; font-size: 13pt; margin-bottom: 6px; }}
.cta-block .cta-line {{ font-size: 9.5pt; line-height: 1.6; }}

.dossier-footer {{
    position: fixed;
    bottom: -2mm;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 7pt;
    color: {TEXT_SECONDARY};
    padding-top: 4px;
    border-top: 1px solid rgba(7,26,58,0.10);
}}

.check-list {{ list-style: none; padding: 0; margin-bottom: 10px; }}
.check-list li {{
    padding-left: 14px;
    position: relative;
    margin-bottom: 4px;
    font-size: 9.5pt;
}}
.check-list li::before {{
    content: "";
    position: absolute;
    left: 1px;
    top: 0.28em;
    width: 6px;
    height: 3px;
    color: {GOLD_DEEP};
    border-left: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
}}
"""

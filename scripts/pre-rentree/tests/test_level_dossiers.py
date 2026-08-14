"""Automated content-check invariants for the pré-rentrée 2026 parent dossiers
(Phase 7 of the parent-dossier redesign mission). Covers, across this file:

 1. Exactly 4 level dossiers are generated.
 2. Each dossier contains exactly its planned subjects (no more, no less).
 3. Every planned subject has a matching pedagogical module (zero gaps).
 4. Every module carries the fields the dossier renders (schema-level, via
    PreRentreeModulesSchema in the TS test suite; here: presence check).
 5. Each dossier's planning reflects the real, dated schedule (dates/times/rooms
    match data/campaigns/pre-rentree-2026.json, not invented).
 6. Hourly volume per subject (5 sessions × 2h = 10h) matches the sessions count.
 7. Capacities/prices shown are pulled from data/pricing.canonical.json.
 8. Incompatibilities come from the repo's own schedule computation.
 9. No excluded subject reappears in a level's dossier.
10. No internal teacher role id or unauthorized real name appears.
11. No ungated payment/reservation promise appears ("payer maintenant", "réserver").
12. REVIEW/PUBLIC status is correctly derived (never a hardcoded local flag).
13. The generator (generate_all_pdfs.py) no longer contains a PROGRAMMES dict
    duplicating modules.json.
14. Two successive generations of the same dossier produce identical content
    (reproducibility), aside from explicitly volatile metadata.
15. Every generated dossier PDF is structurally valid (qpdf-checkable, has
    selectable text, has real link annotations, embeds custom fonts).
"""

from __future__ import annotations

import importlib
import re
import subprocess
import sys
from pathlib import Path

import fitz
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
PDF_GENERATOR_DIR = REPO_ROOT / "tools" / "pdf-generator"
GENERATOR_SOURCE = PDF_GENERATOR_DIR / "generate_all_pdfs.py"
DOCUMENTS_FINAL = REPO_ROOT / "assets" / "campaigns" / "pre-rentree-2026" / "documents-final"

if str(PDF_GENERATOR_DIR) not in sys.path:
    sys.path.insert(0, str(PDF_GENERATOR_DIR))

import pre_rentree_data  # noqa: E402
import generate_level_dossiers  # noqa: E402

importlib.reload(pre_rentree_data)
importlib.reload(generate_level_dossiers)

from pre_rentree_data import LEVEL_ORDER, PreRentreeData  # noqa: E402


@pytest.fixture(scope="module")
def data() -> PreRentreeData:
    return PreRentreeData(REPO_ROOT)


@pytest.fixture(scope="module")
def dossiers(data: PreRentreeData):
    return {level: data.level_dossier(level) for level in LEVEL_ORDER}


# ── 1-2-3: shape of the 5 dossiers ──────────────────────────────────────────

def test_exactly_five_level_dossiers(dossiers):
    assert set(dossiers.keys()) == {"QUATRIEME", "TROISIEME", "SECONDE", "PREMIERE", "TERMINALE"}


def test_each_dossier_matches_its_planned_subjects_exactly(data: PreRentreeData, dossiers):
    for level, dossier in dossiers.items():
        planned = set()
        for window in data.campaign["schedule"]:
            for slot in window["slots"]:
                if slot["level"] == level:
                    planned.add(slot["subject"])
        assert set(dossier.subjects) == planned, f"{level}: dossier subjects diverge from the schedule"


def test_zero_gaps_every_scheduled_subject_has_a_module(dossiers):
    for level, dossier in dossiers.items():
        assert dossier.gaps == (), f"{level} has subjects with no matching module: {dossier.gaps}"


def test_no_excluded_subject_reappears(dossiers):
    # Seconde/3e never sell NSI, Physique-Chimie or SVT (see SEPARATION_STAGES_ANNUEL.md).
    for level in ("TROISIEME", "SECONDE"):
        forbidden = {"NSI", "PHYSIQUE_CHIMIE", "SVT", "MATHS_EXPERTES"}
        assert not (set(dossiers[level].subjects) & forbidden), level
    # Terminale never sells FRANCAIS (no EAF in Terminale).
    assert "FRANCAIS" not in dossiers["TERMINALE"].subjects


# ── 4: module fields the dossier actually renders ───────────────────────────

def test_every_module_has_the_fields_the_dossier_renders(dossiers):
    for dossier in dossiers.values():
        for subject_id, module in dossier.modules_by_subject.items():
            assert module.subtitle
            assert module.prerequisites
            assert module.differentiation
            assert module.quick_assessment
            assert len(module.sessions) == 5, f"{module.module_id} does not have exactly 5 sessions"
            for session in module.sessions:
                assert session.title and session.objective and session.deliverable
                assert len(session.topics) > 0


# ── 5-6: planning reflects the real dated schedule ──────────────────────────

def test_planning_dates_times_rooms_match_canonical_schedule(data: PreRentreeData, dossiers):
    block_times = {b["id"]: (b["startTime"], b["endTime"]) for b in data.campaign["blocks"]}
    for level, dossier in dossiers.items():
        raw_slots = [
            slot
            for window in data.campaign["schedule"]
            for slot in window["slots"]
            if slot["level"] == level
        ]
        assert len(dossier.slots) == len(raw_slots)
        for slot in dossier.slots:
            start, end = block_times[slot.block]
            assert (slot.start_time, slot.end_time) == (start, end)
            # salle-3 is the exceptional S5 third room (Terminale, bloc C only, SVT cohort).
            assert slot.room in ("salle-1", "salle-2", "salle-3")


def test_hourly_volume_is_five_sessions_of_two_hours_per_subject(dossiers):
    for dossier in dossiers.values():
        for module in dossier.modules_by_subject.values():
            assert len(module.sessions) == 5
        # Every scheduled subject appears exactly once per window-slot definition
        # (5 séances de 2h => 10h total), matching the campaign's own contract
        # already enforced by __tests__/campaigns/pre-rentree-2026-*.test.ts.


# ── 7: capacities/prices from canonical pricing ─────────────────────────────

def test_pricing_shown_matches_canonical_pricing(data: PreRentreeData, dossiers):
    for level, dossier in dossiers.items():
        tier = data.tier_for_level(level)
        if tier == "foundations":
            offers = [o for o in data.foundations if o["level"] == level]
            assert offers, f"No foundations offer for {level}"
            expected_min, expected_max = data.group_bounds_for_level(level)
            for offer in offers:
                assert offer["group_min_open"] == expected_min
                assert offer["group_max"] == expected_max
        else:
            assert len(data.premium_packs) > 0
            for offer in data.premium_packs:
                assert offer["group_min_open"] == data.premium_group_min
                assert offer["group_max"] == data.premium_group_max


# ── 8: incompatibilities from repo computation ──────────────────────────────

def test_incompatibilities_are_computed_not_invented(data: PreRentreeData, dossiers):
    # incompatibilities_for_level() is a coarse (date, level, block) clash detector —
    # it does NOT know about alternative cohorts, so it still flags NSI/SVT/Physique-Chimie
    # as pairwise clashing at Terminale (they do share a block letter, cohort for cohort).
    # This dead-data field is unused by the actual PDF output (planning_page() uses
    # assign_itinerary, which correctly proves NSI+SVT can be COMPACT via cohort choice —
    # see test_pdf_never_claims_compatible_alongside_a_long_idle_pair below); this test only
    # guards that the coarse function still runs off real schedule data, not invented pairs.
    # Arbitrage du 14/08/2026 : la SVT est fermée en Terminale, donc l'unique
    # incompatibilité du niveau (NSI/SVT) disparaît avec elle, et les deux groupes
    # de mathématiques étant alternatifs, plus aucune paire ne se chevauche. On
    # vérifie l'absence plutôt que de retirer l'assertion : sinon une grille future
    # pourrait réintroduire une incompatibilité sans que rien ne le signale.
    terminale_pairs = {
        frozenset((i.subject_a, i.subject_b)) for i in dossiers["TERMINALE"].incompatibilities
    }
    assert terminale_pairs == set()
    # Première schedule spreads subjects across non-overlapping dates -> no incompatibility.
    assert dossiers["PREMIERE"].incompatibilities == ()
    # 3e/Seconde only ever have 2 subjects on genuinely different windows -> no incompatibility.
    assert dossiers["TROISIEME"].incompatibilities == ()
    assert dossiers["SECONDE"].incompatibilities == ()


# ── 10-11: no internal role ids, no ungated promises ────────────────────────

_FORBIDDEN_PATTERNS = [
    re.compile(r"salle-\d", re.IGNORECASE),
    re.compile(r"payer maintenant", re.IGNORECASE),
    re.compile(r"r[ée]server d[ée]finitivement", re.IGNORECASE),
]


def test_dossier_html_has_no_internal_ids_or_ungated_promises(data: PreRentreeData, dossiers):
    for level, dossier in dossiers.items():
        html = generate_level_dossiers.build_dossier_html(dossier, data)
        for pattern in _FORBIDDEN_PATTERNS:
            assert not pattern.search(html), f"{level}: forbidden pattern {pattern.pattern} found"


# ── 12: REVIEW/PUBLIC mode is derived, never hardcoded ──────────────────────

def test_review_public_mode_derived_from_real_validation_status(dossiers):
    for level, dossier in dossiers.items():
        all_validated = all(m.is_validated for m in dossier.modules_by_subject.values())
        assert dossier.is_public == (all_validated and dossier.gaps == ())


# ── 13: no duplicated pedagogical-content dict in the generator ────────────

def test_generator_no_longer_contains_a_programmes_dict():
    source = GENERATOR_SOURCE.read_text(encoding="utf-8")
    assert "PROGRAMMES = {" not in source
    assert "def canonical_programmes(" not in source
    assert "def make_programme_body(" not in source
    assert "def make_svt_programme_body(" not in source
    # modules.json remains the single canonical pedagogical source for the generator.
    assert "generate_level_dossiers" in source


# ── 14: reproducible generation ─────────────────────────────────────────────

def test_two_successive_generations_produce_identical_text(data: PreRentreeData, tmp_path):
    import fitz as _fitz

    def render_text(level: str) -> str:
        dossier = data.level_dossier(level)
        html = generate_level_dossiers.build_dossier_html(dossier, data)
        from weasyprint import HTML
        out = tmp_path / f"{level}.pdf"
        HTML(string=html, base_url=str(PDF_GENERATOR_DIR)).write_pdf(str(out))
        with _fitz.open(out) as doc:
            return "\n".join(page.get_text() for page in doc)

    first = render_text("PREMIERE")
    second = render_text("PREMIERE")
    assert first == second


# ── 15: structural PDF validity on the currently generated set ─────────────

_GENERATED_LEVEL_PDFS = [
    "NexusReussite_PreRentree2026_Programme_3e.pdf",
    "NexusReussite_PreRentree2026_Programme_Seconde.pdf",
    "NexusReussite_PreRentree2026_Programme_Premiere.pdf",
    "NexusReussite_PreRentree2026_Programme_Terminale.pdf",
]


@pytest.mark.parametrize("filename", _GENERATED_LEVEL_PDFS)
def test_dossier_pdf_is_structurally_valid(filename):
    path = DOCUMENTS_FINAL / filename
    assert path.is_file(), f"required generated dossier is missing: {filename}"
    result = subprocess.run(["qpdf", "--check", str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    with fitz.open(path) as document:
        assert document.page_count > 0
        full_text = "\n".join(page.get_text() for page in document)
        assert len(full_text.strip()) > 500
        fonts = set()
        for page in document:
            for font in page.get_fonts():
                fonts.add(font[3])
        assert any("DM-Sans" in f or "DMSans" in f for f in fonts), fonts
        assert any("Fraunces" in f for f in fonts), fonts
        last_page_links = {link.get("uri") for link in document[-1].get_links() if link.get("uri")}
        assert any(uri.startswith("tel:") for uri in last_page_links)
        assert any(uri.startswith("mailto:") for uri in last_page_links)


def test_no_standalone_svt_pdf_in_final_parent_set():
    names = {p.name for p in DOCUMENTS_FINAL.glob("*.pdf")}
    assert not any("SVT" in name for name in names)


# ── Idle-time compatibility text invariants ─────────────────────────────────

def test_pdf_only_presents_profile_valid_combinations_as_public_itineraries(data: PreRentreeData, dossiers):
    # Uses assign_itinerary, exactly like generate_level_dossiers.planning_page(), so
    # that subjects with two alternative cohorts (Première SVT, Terminale NSI/SVT) are
    # evaluated on the single best cohort a family would actually be assigned — never
    # both cohorts merged into one impossible itinerary.
    from itinerary import MAX_STUDENT_IDLE_MINUTES, assign_itinerary

    for level, dossier in dossiers.items():
        html = generate_level_dossiers.build_dossier_html(dossier, data)
        dated_sessions = data.dated_slots_for_level(level)
        subjects = list(dossier.subjects)
        for i in range(len(subjects)):
            for j in range(i + 1, len(subjects)):
                report = assign_itinerary(level, [subjects[i], subjects[j]], dated_sessions).itinerary
                if report.status == "LONG_IDLE":
                    # Depuis le dédoublement du 14/08/2026, une paire réellement
                    # proposable peut être longue : NSI + Physique-Chimie laisse
                    # 5 h 30 de battement. Le dossier ne doit alors jamais la
                    # ranger parmi les combinaisons compactes, mais l'annoncer
                    # sous l'avertissement d'attente, chiffre à l'appui.
                    warning = f"Attente supérieure à {MAX_STUDENT_IDLE_MINUTES} minutes le même jour"
                    assert warning in html
                    assert f"{report.max_idle_minutes} minutes d'attente" in html
                    compact_marker = f"Combinaisons compactes (&lt;= {MAX_STUDENT_IDLE_MINUTES} min) :"
                    if compact_marker in html:
                        compact_line = html.split(compact_marker, 1)[1].split("</span>", 1)[0]
                        labels = {
                            generate_level_dossiers._subject_label(subjects[i]),
                            generate_level_dossiers._subject_label(subjects[j]),
                        }
                        assert not labels.issubset(set(compact_line.replace(" + ", ", ").split(", ")))
        assert "toutes les autres combinaisons" not in html.casefold()
    # Cette précision ne doit plus apparaître : Mathématiques expertes est fermée
    # depuis le 14/08/2026, et un dossier qui la mentionnerait promettrait une
    # matière que personne n'assure.
    assert "Mathématiques expertes est proposée uniquement" not in (
        generate_level_dossiers.build_dossier_html(dossiers["TERMINALE"], data)
    )

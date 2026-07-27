"""Reproduces and verifies the idle-time behaviour of the S5 schedule (3 rooms
+ week-end, end date kept at 28 août), computed directly from
data/campaigns/pre-rentree-2026.json — mirrors
__tests__/campaigns/pre-rentree-2026-student-idle-time.test.ts so drift between
the TS and Python engines is caught by CI on both sides. Superseded the
original S0 baseline (see docs/campaigns/pre-rentree-2026/SCHEDULE-UX-AUDIT.md)
after the schedule was restructured by the UX-optimization (PR #77) and S5
three-rooms missions.

Some subjects now have two alternative cohorts (Première SVT, Terminale NSI,
Terminale SVT — see cohort_id in pre_rentree_data.ScheduledSlot). Any
combination touching one of those subjects MUST go through assign_itinerary
(which picks, per subject, the single best cohort) rather than
compute_itinerary directly on the raw schedule: compute_itinerary alone would
incorrectly merge both cohorts' sessions into one itinerary, which no real
student ever attends.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
PDF_GENERATOR_DIR = REPO_ROOT / "tools" / "pdf-generator"
if str(PDF_GENERATOR_DIR) not in sys.path:
    sys.path.insert(0, str(PDF_GENERATOR_DIR))

from itinerary import (  # noqa: E402
    MAX_STUDENT_IDLE_MINUTES,
    assign_itinerary,
    compute_itinerary,
    enumerate_selections,
)
from pre_rentree_data import PreRentreeData  # noqa: E402


@pytest.fixture(scope="module")
def data() -> PreRentreeData:
    return PreRentreeData(REPO_ROOT)


@pytest.fixture(scope="module")
def all_sessions(data: PreRentreeData):
    sessions = []
    for level in ("TROISIEME", "SECONDE", "PREMIERE", "TERMINALE"):
        sessions.extend(data.dated_slots_for_level(level))
    return sessions


def test_block_to_block_gaps():
    times = {"A": ("09:00", "11:00"), "B": ("11:15", "13:15"), "C": ("14:15", "16:15"), "D": ("16:30", "18:30")}

    def to_min(t):
        h, m = t.split(":")
        return int(h) * 60 + int(m)

    def gap(a, b):
        return to_min(times[b][0]) - to_min(times[a][1])

    assert gap("A", "B") == 15
    assert gap("B", "C") == 60
    assert gap("C", "D") == 15
    assert gap("A", "C") == 195
    assert gap("B", "D") == 195
    assert gap("A", "D") == 330


def test_troisieme_maths_francais_conforme(all_sessions):
    # Improved by the UX optimization (PR #77): was LONG_IDLE 195min in the S0 baseline.
    report = assign_itinerary("TROISIEME", ["MATHEMATIQUES", "FRANCAIS"], all_sessions).itinerary
    assert report.status == "COMPACT"
    assert report.max_idle_minutes == 15


def test_seconde_francais_maths_conforme(all_sessions):
    report = assign_itinerary("SECONDE", ["FRANCAIS", "MATHEMATIQUES"], all_sessions).itinerary
    assert report.status == "COMPACT"
    assert report.max_idle_minutes == 15


@pytest.mark.parametrize(
    ("subjects", "expected_status", "expected_idle"),
    [
        # Français a été relogé en fenêtre semaine week-end (22-26 août) : plus aucune
        # journée commune avec Mathématiques/NSI (fenêtre 1, 17-21 août).
        (["FRANCAIS", "MATHEMATIQUES"], "NO_SHARED_DAY", None),
        (["MATHEMATIQUES", "NSI"], "COMPACT", 60),
        (["FRANCAIS", "NSI"], "NO_SHARED_DAY", None),
        (["FRANCAIS", "MATHEMATIQUES", "NSI"], "COMPACT", 60),
    ],
)
def test_premiere_fenetre1(all_sessions, subjects, expected_status, expected_idle):
    report = assign_itinerary("PREMIERE", subjects, all_sessions).itinerary
    assert report.status == expected_status
    if expected_idle is not None:
        assert report.max_idle_minutes == expected_idle


def test_premiere_svt_pc_no_shared_day(all_sessions):
    # SVT (fenêtre 1, cohortes a/d) et Physique-Chimie (fenêtre semaine week-end)
    # ne partagent plus jamais de date depuis la restructuration S5.
    report = assign_itinerary("PREMIERE", ["SVT", "PHYSIQUE_CHIMIE"], all_sessions).itinerary
    assert report.status == "NO_SHARED_DAY"


def test_premiere_maths_svt_conforme_via_cohort(all_sessions):
    assignment = assign_itinerary("PREMIERE", ["MATHEMATIQUES", "SVT"], all_sessions)
    assert assignment.itinerary.status == "COMPACT"
    assert assignment.itinerary.max_idle_minutes == 15


def test_premiere_nsi_svt_conforme_via_cohort(all_sessions):
    assignment = assign_itinerary("PREMIERE", ["NSI", "SVT"], all_sessions)
    assert assignment.itinerary.status == "COMPACT"
    assert assignment.itinerary.max_idle_minutes == 15


def test_premiere_francais_pc_conforme(all_sessions):
    report = assign_itinerary("PREMIERE", ["FRANCAIS", "PHYSIQUE_CHIMIE"], all_sessions).itinerary
    assert report.status == "COMPACT"
    assert report.max_idle_minutes == 15


@pytest.mark.parametrize(
    ("subjects", "expected_status", "expected_idle"),
    [
        (["MATHEMATIQUES", "MATHS_EXPERTES"], "COMPACT", 15),
        (["MATHEMATIQUES", "NSI"], "COMPACT", 60),
        (["MATHEMATIQUES", "SVT"], "COMPACT", 60),
        (["MATHEMATIQUES", "PHYSIQUE_CHIMIE"], "COMPACT", 60),
        (["MATHS_EXPERTES", "NSI"], "LONG_IDLE", 195),
        (["MATHS_EXPERTES", "SVT"], "LONG_IDLE", 195),
        (["MATHS_EXPERTES", "PHYSIQUE_CHIMIE"], "LONG_IDLE", 195),
        (["NSI", "SVT"], "COMPACT", 15),
        (["NSI", "PHYSIQUE_CHIMIE"], "COMPACT", 15),
        (["SVT", "PHYSIQUE_CHIMIE"], "COMPACT", 15),
    ],
)
def test_terminale_fenetre_24_28(all_sessions, subjects, expected_status, expected_idle):
    report = assign_itinerary("TERMINALE", subjects, all_sessions).itinerary
    assert report.status == expected_status
    if expected_idle is not None:
        assert report.max_idle_minutes == expected_idle


def test_terminale_nsi_pc_svt_unavoidable_simultaneous(all_sessions):
    # Pigeonhole: Physique-Chimie is single-cohort at bloc C. To avoid it, both NSI
    # and SVT would have to use bloc D — but then they collide with each other.
    # Documented, accepted residual limit of S5 (3 salles), not a bug.
    assignment = assign_itinerary("TERMINALE", ["NSI", "PHYSIQUE_CHIMIE", "SVT"], all_sessions)
    assert assignment.itinerary.status == "SIMULTANEOUS"
    assert assignment.itinerary.first_conflict is not None
    assert assignment.itinerary.first_conflict.reason == "SIMULTANEOUS"


def test_terminale_maths_expertes_nsi_triple_compact(all_sessions):
    assignment = assign_itinerary("TERMINALE", ["MATHEMATIQUES", "MATHS_EXPERTES", "NSI"], all_sessions)
    assert assignment.itinerary.status == "COMPACT"
    assert assignment.itinerary.max_idle_minutes == 60


def test_cohort_never_combines_both_alternatives_into_one_itinerary(all_sessions):
    assignment = assign_itinerary("TERMINALE", ["NSI", "SVT"], all_sessions)
    assert len(assignment.sessions_by_subject["NSI"]) == 5
    assert len(assignment.sessions_by_subject["SVT"]) == 5


def test_assign_itinerary_is_deterministic_for_multi_cohort_selection(all_sessions):
    first = assign_itinerary("TERMINALE", ["NSI", "SVT"], all_sessions)
    second = assign_itinerary("TERMINALE", ["NSI", "SVT"], all_sessions)
    assert first.cohort_by_subject == second.cohort_by_subject
    assert first.itinerary == second.itinerary


def test_single_cohort_subject_has_no_cohort_choice(all_sessions):
    assignment = assign_itinerary("TERMINALE", ["MATHEMATIQUES", "PHYSIQUE_CHIMIE"], all_sessions)
    assert assignment.cohort_by_subject["MATHEMATIQUES"] is None
    assert assignment.cohort_by_subject["PHYSIQUE_CHIMIE"] is None


def test_assign_itinerary_raises_on_missing_subject(all_sessions):
    with pytest.raises(ValueError, match="Missing campaign schedule"):
        assign_itinerary("TERMINALE", ["SVT", "GEOGRAPHIE_INEXISTANTE"], all_sessions)


def test_extra_session_filling_gap_turns_long_idle_into_compact(all_sessions):
    pair = assign_itinerary("TERMINALE", ["MATHS_EXPERTES", "NSI"], all_sessions).itinerary
    assert pair.status == "LONG_IDLE"
    triple = assign_itinerary("TERMINALE", ["MATHEMATIQUES", "MATHS_EXPERTES", "NSI"], all_sessions).itinerary
    assert triple.status == "COMPACT"


def test_never_reports_simultaneous_as_compact(all_sessions):
    assignment = assign_itinerary("TERMINALE", ["NSI", "PHYSIQUE_CHIMIE", "SVT"], all_sessions)
    assert assignment.itinerary.status == "SIMULTANEOUS"
    assert assignment.itinerary.first_conflict is not None
    assert assignment.itinerary.first_conflict.reason == "SIMULTANEOUS"


def test_no_shared_day_for_never_coinciding_subjects(all_sessions):
    report = compute_itinerary("TROISIEME", ["MATHEMATIQUES"], all_sessions)
    assert report.status == "NO_SHARED_DAY"


def test_enumerate_selections_no_duplicates_and_cap():
    selections = enumerate_selections(["A", "B", "C", "D"], 4)
    assert len(selections) == 15
    assert len({",".join(s) for s in selections}) == 15
    capped = enumerate_selections(["A", "B", "C"], 2)
    assert all(len(s) <= 2 for s in capped)


def test_max_idle_constant():
    assert MAX_STUDENT_IDLE_MINUTES == 60


def test_deterministic_assignment_single_cohort(all_sessions):
    first = compute_itinerary("TERMINALE", ["MATHEMATIQUES", "MATHS_EXPERTES"], all_sessions)
    second = compute_itinerary("TERMINALE", ["MATHEMATIQUES", "MATHS_EXPERTES"], all_sessions)
    assert first == second


def test_ten_hours_per_followed_subject(data: PreRentreeData):
    for level in ("TROISIEME", "SECONDE", "PREMIERE", "TERMINALE"):
        for subject_id in data.subjects_for_level(level):
            module = data.module_for(level, subject_id)
            assert len(module.sessions) == 5, f"{level}/{subject_id} does not have 5 sessions"
            # 5 sessions x 2h block = 10h; verified against the actual block durations,
            # not assumed, since every block in this campaign is exactly 2h (09:00-11:00 etc).
            block_times = {b["id"]: (b["startTime"], b["endTime"]) for b in data.campaign["blocks"]}
            for start, end in block_times.values():
                sh, sm = map(int, start.split(":"))
                eh, em = map(int, end.split(":"))
                assert (eh * 60 + em) - (sh * 60 + sm) == 120


def test_baseline_schedule_has_no_room_or_teacher_conflict(data: PreRentreeData):
    by_room_block = {}
    by_teacher_block = {}
    for window in data.campaign["schedule"]:
        for slot in window["slots"]:
            room_key = (window["windowId"], slot["block"], slot["room"])
            teacher_key = (window["windowId"], slot["block"], slot["teacherRole"])
            assert room_key not in by_room_block, f"room conflict at {room_key}"
            assert teacher_key not in by_teacher_block, f"teacher conflict at {teacher_key}"
            by_room_block[room_key] = slot
            by_teacher_block[teacher_key] = slot

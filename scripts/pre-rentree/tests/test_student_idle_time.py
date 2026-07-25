"""Reproduces and verifies the idle-time baseline from
docs/campaigns/pre-rentree-2026/SCHEDULE-UX-AUDIT.md, computed directly from
data/campaigns/pre-rentree-2026.json — mirrors
__tests__/campaigns/pre-rentree-2026-student-idle-time.test.ts so drift between
the TS and Python engines is caught by CI on both sides.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
PDF_GENERATOR_DIR = REPO_ROOT / "tools" / "pdf-generator"
if str(PDF_GENERATOR_DIR) not in sys.path:
    sys.path.insert(0, str(PDF_GENERATOR_DIR))

from itinerary import MAX_STUDENT_IDLE_MINUTES, compute_itinerary, enumerate_selections  # noqa: E402
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


def test_troisieme_maths_francais_non_conforme(all_sessions):
    report = compute_itinerary("TROISIEME", ["MATHEMATIQUES", "FRANCAIS"], all_sessions)
    assert report.status == "LONG_IDLE"
    assert report.max_idle_minutes == 195


def test_seconde_francais_maths_conforme(all_sessions):
    report = compute_itinerary("SECONDE", ["FRANCAIS", "MATHEMATIQUES"], all_sessions)
    assert report.status == "COMPACT"
    assert report.max_idle_minutes == 15


@pytest.mark.parametrize(
    ("subjects", "expected_status", "expected_idle"),
    [
        (["FRANCAIS", "MATHEMATIQUES"], "COMPACT", 60),
        (["MATHEMATIQUES", "NSI"], "COMPACT", 15),
        (["FRANCAIS", "NSI"], "LONG_IDLE", 195),
        (["FRANCAIS", "MATHEMATIQUES", "NSI"], "COMPACT", 60),
    ],
)
def test_premiere_fenetre1(all_sessions, subjects, expected_status, expected_idle):
    report = compute_itinerary("PREMIERE", subjects, all_sessions)
    assert report.status == expected_status
    assert report.max_idle_minutes == expected_idle


def test_premiere_fenetre2_svt_pc(all_sessions):
    report = compute_itinerary("PREMIERE", ["SVT", "PHYSIQUE_CHIMIE"], all_sessions)
    assert report.status == "COMPACT"
    assert report.max_idle_minutes == 15


@pytest.mark.parametrize(
    ("subjects", "expected_status", "expected_idle"),
    [
        (["MATHEMATIQUES", "MATHS_EXPERTES"], "COMPACT", 15),
        (["MATHEMATIQUES", "NSI"], "LONG_IDLE", 195),
        (["MATHEMATIQUES", "SVT"], "LONG_IDLE", 195),
        (["MATHEMATIQUES", "PHYSIQUE_CHIMIE"], "LONG_IDLE", 330),
        (["MATHS_EXPERTES", "NSI"], "COMPACT", 60),
        (["MATHS_EXPERTES", "SVT"], "COMPACT", 60),
        (["MATHS_EXPERTES", "PHYSIQUE_CHIMIE"], "LONG_IDLE", 195),
        (["NSI", "SVT"], "SIMULTANEOUS", None),
        (["NSI", "PHYSIQUE_CHIMIE"], "COMPACT", 15),
        (["SVT", "PHYSIQUE_CHIMIE"], "COMPACT", 15),
    ],
)
def test_terminale_fenetre_24_28(all_sessions, subjects, expected_status, expected_idle):
    report = compute_itinerary("TERMINALE", subjects, all_sessions)
    assert report.status == expected_status
    if expected_idle is not None:
        assert report.max_idle_minutes == expected_idle


def test_bcd_compact_bd_alone_not(all_sessions):
    bcd = compute_itinerary("PREMIERE", ["FRANCAIS", "MATHEMATIQUES", "NSI"], all_sessions)
    assert bcd.status == "COMPACT"
    bd = compute_itinerary("PREMIERE", ["FRANCAIS", "NSI"], all_sessions)
    assert bd.status == "LONG_IDLE"


def test_never_reports_simultaneous_as_compact(all_sessions):
    report = compute_itinerary("TERMINALE", ["NSI", "SVT"], all_sessions)
    assert report.status == "SIMULTANEOUS"
    assert report.first_conflict is not None
    assert report.first_conflict.reason == "SIMULTANEOUS"


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


def test_deterministic_assignment(all_sessions):
    first = compute_itinerary("TERMINALE", ["MATHEMATIQUES", "NSI"], all_sessions)
    second = compute_itinerary("TERMINALE", ["MATHEMATIQUES", "NSI"], all_sessions)
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

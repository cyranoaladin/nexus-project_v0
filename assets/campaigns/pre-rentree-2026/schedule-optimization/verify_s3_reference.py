#!/usr/bin/env python3
"""Independently verifies the idle-time claims of the S3 reference scenario
given in the schedule-UX-optimization mission brief (section 11) — never
trusts it as ground truth, per the mission's own instruction ("SEED de
recherche, jamais vérité non vérifiée"). Encodes the exact block/room table
given for each of its 3 windows and recomputes every claimed itinerary via
the same itinerary.compute_itinerary() engine used everywhere else, plus
checks for room/teacher conflicts and tallies teacher-hours per window.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
PDF_GENERATOR_DIR = REPO_ROOT / "tools" / "pdf-generator"
if str(PDF_GENERATOR_DIR) not in sys.path:
    sys.path.insert(0, str(PDF_GENERATOR_DIR))

from itinerary import compute_itinerary  # noqa: E402
from pre_rentree_data import ScheduledSlot  # noqa: E402

TIMES = {"A": ("09:00", "11:00"), "B": ("11:15", "13:15"), "C": ("14:15", "16:15"), "D": ("16:30", "18:30")}

# Verbatim transcription of the mission's S3 reference tables (section 11).
# teacherRole is inferred from the existing canonical roles for the base
# subject (an "alternative cohort" of a subject is taught by the same
# teacher role, at a different block, not a second teacher — consistent with
# the mission's own later teacher-hour tally, e.g. "rôle Maths/NSI : 4 blocs
# = 8h" in fenêtre 3, which only adds up if NSI cohorts 1 and 2 share the
# TEACHER_A_MATHS_NSI role).
WINDOW_1 = {
    "date": "2026-08-17",
    "entries": [
        # Première Français is deliberately NOT here: the S3 reference scenario
        # relocates it to fenêtre 2 (see WINDOW_2 below, cohortes 1/2) — confirmed
        # from the mission's own fenêtre-1 table, which lists only 6 entries with
        # both salle-2/A and salle-2/D left "libre". Encoding it here (as the
        # unmodified baseline schedule does) was an error in an earlier draft of
        # this verification script, not a property of the mission's scenario.
        ("TROISIEME", "MATHEMATIQUES", "A", "salle-1", "TEACHER_A_MATHS_NSI"),
        ("PREMIERE", "MATHEMATIQUES", "B", "salle-1", "TEACHER_A_MATHS_NSI"),
        ("TROISIEME", "FRANCAIS", "B", "salle-2", "TEACHER_C_FRANCAIS"),
        ("PREMIERE", "NSI", "C", "salle-1", "TEACHER_A_MATHS_NSI"),
        ("SECONDE", "FRANCAIS", "C", "salle-2", "TEACHER_C_FRANCAIS"),
        ("SECONDE", "MATHEMATIQUES", "D", "salle-1", "TEACHER_A_MATHS_NSI"),
    ],
}
WINDOW_2 = {
    "date": "2026-08-22",
    "entries": [
        ("PREMIERE", "FRANCAIS", "A", "salle-2", "TEACHER_C_FRANCAIS"),  # cohorte 1
        ("PREMIERE", "PHYSIQUE_CHIMIE", "B", "salle-2", "TEACHER_D_PHYSIQUE_CHIMIE"),
        ("PREMIERE", "SVT", "C", "salle-2", "TEACHER_E_SVT"),
        ("PREMIERE", "FRANCAIS", "D", "salle-2", "TEACHER_C_FRANCAIS"),  # cohorte 2
    ],
}
WINDOW_3 = {
    "date": "2026-08-27",
    "entries": [
        ("TERMINALE", "NSI", "A", "salle-1", "TEACHER_A_MATHS_NSI"),  # cohorte 1
        ("TERMINALE", "PHYSIQUE_CHIMIE", "A", "salle-2", "TEACHER_D_PHYSIQUE_CHIMIE"),  # cohorte 1
        ("TERMINALE", "MATHEMATIQUES", "B", "salle-1", "TEACHER_A_MATHS_NSI"),
        ("TERMINALE", "PHYSIQUE_CHIMIE", "B", "salle-2", "TEACHER_D_PHYSIQUE_CHIMIE"),  # cohorte 2
        ("TERMINALE", "MATHS_EXPERTES", "C", "salle-1", "TEACHER_A_MATHS_NSI"),
        ("TERMINALE", "SVT", "C", "salle-2", "TEACHER_E_SVT"),  # cohorte 1
        ("TERMINALE", "NSI", "D", "salle-1", "TEACHER_A_MATHS_NSI"),  # cohorte 2
        ("TERMINALE", "SVT", "D", "salle-2", "TEACHER_E_SVT"),  # cohorte 2
    ],
}



def sessions_for(window: dict) -> list[ScheduledSlot]:
    result = []
    for level, subject, block, room, role in window["entries"]:
        start, end = TIMES[block]
        result.append(
            ScheduledSlot(level=level, subject=subject, block=block, room=room, window_id="w",
                          window_label="w", start_time=start, end_time=end, date=window["date"])
        )
    return result


def check_conflicts(window: dict) -> list[str]:
    problems = []
    by_room_block = defaultdict(list)
    by_teacher_block = defaultdict(list)
    for level, subject, block, room, role in window["entries"]:
        by_room_block[(block, room)].append((level, subject))
        by_teacher_block[(block, role)].append((level, subject))
    for key, entries in by_room_block.items():
        if len(entries) > 1:
            problems.append(f"ROOM CONFLICT at {key}: {entries}")
    for key, entries in by_teacher_block.items():
        if len(entries) > 1:
            problems.append(f"TEACHER CONFLICT at {key}: {entries}")
    return problems


def teacher_hours(window: dict) -> dict[str, int]:
    hours = defaultdict(int)
    for level, subject, block, room, role in window["entries"]:
        hours[role] += 2
    return dict(hours)


def main():
    report = {"windows": {}, "claimedPairChecks": []}

    for name, window in [("fenetre-1-S3", WINDOW_1), ("fenetre-2-S3", WINDOW_2), ("fenetre-3-S3", WINDOW_3)]:
        conflicts = check_conflicts(window)
        hours = teacher_hours(window)
        report["windows"][name] = {"conflicts": conflicts, "teacherHours": hours}

    # Première fenêtre 1: Maths + NSI (mission: "B + C, attente 60 min").
    sessions1 = sessions_for(WINDOW_1)
    premiere_maths_nsi = compute_itinerary("PREMIERE", ["MATHEMATIQUES", "NSI"], sessions1)
    report["claimedPairChecks"].append({
        "label": "Première fenêtre 1 — Maths(B) + NSI(C)",
        "computedStatus": premiere_maths_nsi.status,
        "computedMaxIdleMinutes": premiere_maths_nsi.max_idle_minutes,
        "satisfiesSixtyMinuteRule": premiere_maths_nsi.status in ("COMPACT", "NO_SHARED_DAY"),
    })
    # Première Français now lives in a different window (different real dates)
    # than Maths/NSI — rule 5: no shared date, so no idle time is generated at
    # all between them, whichever the family combines. Pick a single Français
    # cohort explicitly (cohorte 1, block A) — WINDOW_2 has two cohorts of the
    # same subject on the same representative date, and a naive subject-name
    # filter would wrongly include both, comparing a cohort against itself.
    sessions2 = [s for s in sessions_for(WINDOW_2) if not (s.subject == "FRANCAIS" and s.block == "D")]
    premiere_francais_vs_maths = compute_itinerary(
        "PREMIERE", ["FRANCAIS", "MATHEMATIQUES"], sessions1 + sessions2,
    )
    report["claimedPairChecks"].append({
        "label": "Première fenêtre 1+2 — Français (fenêtre 2) + Mathématiques (fenêtre 1): different dates",
        "computedStatus": premiere_francais_vs_maths.status,
        "computedMaxIdleMinutes": premiere_francais_vs_maths.max_idle_minutes,
        "satisfiesSixtyMinuteRule": premiere_francais_vs_maths.status in ("COMPACT", "NO_SHARED_DAY"),
    })

    # Terminale window 3 has 2 cohorts for NSI (A, D), PC (A cohorte1, B cohorte2)
    # and SVT (C, D) — a student picks ONE cohort per subject; the itinerary
    # engine must be run per explicit cohort choice, not on the raw session list
    # (which would wrongly treat both cohorts as "the same subject twice").
    sessions3 = sessions_for(WINDOW_3)

    def pick(subject, block):
        return [s for s in sessions3 if s.subject == subject and s.block == block]

    # Build a per-cohort-choice session list generically — a student picks ONE
    # cohort per subject, exactly matching the block the mission's "Affectations
    # attendues" table specifies for that combination (section 11).
    def itinerary_for_terminale(subject_block_pairs):
        chosen = []
        for subject, block in subject_block_pairs:
            chosen.extend([s for s in sessions3 if s.subject == subject and s.block == block])
        return compute_itinerary("TERMINALE", [s.subject for s in chosen], chosen)

    # Verbatim from the mission's "Affectations attendues" table for fenêtre 3 (S3):
    # cohort choice per combination is taken exactly as stated there, not assumed.
    checks = [
        ("Maths + NSI: NSI(A, cohorte 1) + Maths(B)", [("MATHEMATIQUES", "B"), ("NSI", "A")]),
        ("Maths + PC: PC(A, cohorte 1) + Maths(B)", [("MATHEMATIQUES", "B"), ("PHYSIQUE_CHIMIE", "A")]),
        ("Maths + SVT: Maths(B) + SVT(C, cohorte 1)", [("MATHEMATIQUES", "B"), ("SVT", "C")]),
        ("NSI + PC: NSI(A, cohorte 1) + PC(B, cohorte 2)", [("NSI", "A"), ("PHYSIQUE_CHIMIE", "B")]),
        ("PC + SVT: PC(B, cohorte 2) + SVT(C, cohorte 1)", [("PHYSIQUE_CHIMIE", "B"), ("SVT", "C")]),
        ("NSI + SVT: SVT(C, cohorte 1) + NSI(D, cohorte 2)", [("SVT", "C"), ("NSI", "D")]),
        ("Maths + Maths expertes: Maths(B) + MathsExpertes(C)", [("MATHEMATIQUES", "B"), ("MATHS_EXPERTES", "C")]),
        ("Maths + Maths expertes + NSI: Maths(B) + MathsExpertes(C) + NSI(D, cohorte 2)",
         [("MATHEMATIQUES", "B"), ("MATHS_EXPERTES", "C"), ("NSI", "D")]),
        ("Maths + Maths expertes + PC: PC(A, cohorte 1) + Maths(B) + MathsExpertes(C)",
         [("PHYSIQUE_CHIMIE", "A"), ("MATHEMATIQUES", "B"), ("MATHS_EXPERTES", "C")]),
        ("Maths + Maths expertes + SVT: Maths(B) + MathsExpertes(C) + SVT(D, cohorte 2)",
         [("MATHEMATIQUES", "B"), ("MATHS_EXPERTES", "C"), ("SVT", "D")]),
    ]

    for label, pairs in checks:
        report_result = itinerary_for_terminale(pairs)
        report["claimedPairChecks"].append({
            "label": label,
            "computedStatus": report_result.status,
            "computedMaxIdleMinutes": report_result.max_idle_minutes,
            "satisfiesSixtyMinuteRule": report_result.status in ("COMPACT", "NO_SHARED_DAY"),
        })

    out_path = Path(__file__).parent / "scenario-s3-verification.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

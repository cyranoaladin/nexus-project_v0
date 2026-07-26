#!/usr/bin/env python3
"""Deterministic, re-executable export of the S5 (3 salles + week-end) canonical
schedule to the artefacts required by SCHEDULE-OPTIMIZATION-REPORT.md §S5 and
the S5 mission brief §M: scenario-s5.json, scenario-s5-verification.json,
selection-matrix-s5.csv, student-itineraries-s5.csv, teacher-load-s5.csv,
room-occupancy-s5.csv, cohort-assignment-s5.csv.

Reads only from the live canonical sources (data/campaigns/pre-rentree-2026.json
via PreRentreeData) — never hand-typed, so it can be re-run after any further
schedule change to detect drift.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
PDF_GENERATOR_DIR = REPO_ROOT / "tools" / "pdf-generator"
if str(PDF_GENERATOR_DIR) not in sys.path:
    sys.path.insert(0, str(PDF_GENERATOR_DIR))

from itinerary import assign_itinerary, enumerate_selections, MAX_STUDENT_IDLE_MINUTES  # noqa: E402
from pre_rentree_data import PreRentreeData  # noqa: E402

OUT_DIR = Path(__file__).parent
LEVELS = ("TROISIEME", "SECONDE", "PREMIERE", "TERMINALE")


def main() -> None:
    data = PreRentreeData(REPO_ROOT)
    all_sessions = [s for level in LEVELS for s in data.dated_slots_for_level(level)]

    # ── selection-matrix-s5.csv : every non-empty subject subset up to 4 (the
    # Premium pack ceiling), per level, scored via assign_itinerary. ──────────
    with (OUT_DIR / "selection-matrix-s5.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["level", "subjects", "status", "maxIdleMinutes", "totalIdleMinutes", "daysPresent"])
        for level in LEVELS:
            subjects = data.subjects_for_level(level)
            for selection in enumerate_selections(subjects, 4):
                result = assign_itinerary(level, list(selection), all_sessions).itinerary
                writer.writerow([
                    level, "+".join(selection), result.status,
                    result.max_idle_minutes, result.total_idle_minutes, result.days_present,
                ])

    # ── student-itineraries-s5.csv : every pair, the level of detail a family
    # actually needs when choosing 2 subjects together. ───────────────────────
    with (OUT_DIR / "student-itineraries-s5.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["level", "subjectA", "subjectB", "status", "maxIdleMinutes"])
        for level in LEVELS:
            subjects = list(data.subjects_for_level(level))
            for i in range(len(subjects)):
                for j in range(i + 1, len(subjects)):
                    result = assign_itinerary(level, [subjects[i], subjects[j]], all_sessions).itinerary
                    writer.writerow([level, subjects[i], subjects[j], result.status, result.max_idle_minutes])

    # ── teacher-load-s5.csv : hours per teacher role per window, from the raw
    # (non-dated) slot grid. ───────────────────────────────────────────────────
    with (OUT_DIR / "teacher-load-s5.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["windowId", "teacherRole", "blocksUsed", "hours"])
        for window in data.campaign["schedule"]:
            by_role: dict[str, int] = {}
            for slot in window["slots"]:
                by_role[slot["teacherRole"]] = by_role.get(slot["teacherRole"], 0) + 1
            for role, blocks_used in sorted(by_role.items()):
                writer.writerow([window["windowId"], role, blocks_used, blocks_used * 2])

    # ── room-occupancy-s5.csv : one row per (window, block, room) slot. ───────
    with (OUT_DIR / "room-occupancy-s5.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["windowId", "block", "room", "level", "subject", "cohortId"])
        for window in data.campaign["schedule"]:
            for slot in sorted(window["slots"], key=lambda s: (s["block"], s["room"])):
                writer.writerow([
                    window["windowId"], slot["block"], slot["room"], slot["level"], slot["subject"],
                    slot.get("cohortId", ""),
                ])

    # ── cohort-assignment-s5.csv : the 3 duplicated subjects, both cohorts,
    # side by side. ─────────────────────────────────────────────────────────
    with (OUT_DIR / "cohort-assignment-s5.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["level", "subject", "cohortId", "isPrimary", "block", "room", "teacherRole"])
        for window in data.campaign["schedule"]:
            for slot in window["slots"]:
                if slot.get("cohortId"):
                    writer.writerow([
                        slot["level"], slot["subject"], slot["cohortId"], slot.get("isPrimary", True),
                        slot["block"], slot["room"], slot["teacherRole"],
                    ])

    # ── scenario-s5.json : structural summary of the implemented scenario. ────
    room_set = sorted({slot["room"] for window in data.campaign["schedule"] for slot in window["slots"]})
    cohort_subjects = sorted({
        (slot["level"], slot["subject"])
        for window in data.campaign["schedule"] for slot in window["slots"] if slot.get("cohortId")
    })
    scenario = {
        "scenarioId": "S5",
        "label": "3 salles + week-end, fin maintenue au 28 août",
        "endDate": "2026-08-28",
        "rooms": room_set,
        "extraRoom": "salle-3",
        "extraRoomBlocks": sorted({
            slot["block"] for window in data.campaign["schedule"] for slot in window["slots"]
            if slot["room"] == "salle-3"
        }),
        "additionalCohorts": [{"level": lvl, "subject": subj} for lvl, subj in cohort_subjects],
        "totalCohorts": sum(1 for w in data.campaign["schedule"] for _ in w["slots"]),
        "totalSessions": sum(1 for w in data.campaign["schedule"] for _ in w["slots"] for _ in w["days"]),
        "maxStudentIdleMinutes": MAX_STUDENT_IDLE_MINUTES,
        "newTeachers": 0,
        "supersedes": "S3 (fin au 31 août, +4 cohortes, +40h) — repli historique, non appliqué",
    }
    (OUT_DIR / "scenario-s5.json").write_text(json.dumps(scenario, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ── scenario-s5-verification.json : re-derived compliance proof against the
    # live canonical grid (not the solver's synthetic single-date search — the
    # real, dated schedule). ───────────────────────────────────────────────────
    required_combos_by_level = {
        "TERMINALE": [
            ("MATHEMATIQUES", "NSI"), ("MATHEMATIQUES", "PHYSIQUE_CHIMIE"), ("MATHEMATIQUES", "SVT"),
            ("NSI", "PHYSIQUE_CHIMIE"), ("NSI", "SVT"), ("PHYSIQUE_CHIMIE", "SVT"),
            ("MATHEMATIQUES", "MATHS_EXPERTES"),
            ("MATHEMATIQUES", "MATHS_EXPERTES", "NSI"), ("MATHEMATIQUES", "MATHS_EXPERTES", "PHYSIQUE_CHIMIE"),
            ("MATHEMATIQUES", "MATHS_EXPERTES", "SVT"), ("MATHEMATIQUES", "PHYSIQUE_CHIMIE", "SVT"),
            ("MATHEMATIQUES", "NSI", "PHYSIQUE_CHIMIE"), ("MATHEMATIQUES", "NSI", "SVT"),
        ],
    }
    verification = {"level": "TERMINALE", "maxStudentIdleMinutes": MAX_STUDENT_IDLE_MINUTES, "combos": []}
    all_compliant = True
    for combo in required_combos_by_level["TERMINALE"]:
        result = assign_itinerary("TERMINALE", list(combo), all_sessions).itinerary
        compliant = result.status != "SIMULTANEOUS" and result.max_idle_minutes <= MAX_STUDENT_IDLE_MINUTES
        all_compliant = all_compliant and compliant
        verification["combos"].append({
            "combo": list(combo), "status": result.status,
            "maxIdleMinutes": result.max_idle_minutes, "compliant": compliant,
        })
    verification["allCompliant"] = all_compliant
    verification["roomConflicts"] = []
    verification["teacherConflicts"] = []
    by_room_block: dict[tuple, dict] = {}
    by_teacher_block: dict[tuple, dict] = {}
    for window in data.campaign["schedule"]:
        for slot in window["slots"]:
            room_key = (window["windowId"], slot["block"], slot["room"])
            teacher_key = (window["windowId"], slot["block"], slot["teacherRole"])
            if room_key in by_room_block:
                verification["roomConflicts"].append(list(room_key))
            by_room_block[room_key] = slot
            if teacher_key in by_teacher_block:
                verification["teacherConflicts"].append(list(teacher_key))
            by_teacher_block[teacher_key] = slot
    verification["zeroRoomConflicts"] = len(verification["roomConflicts"]) == 0
    verification["zeroTeacherConflicts"] = len(verification["teacherConflicts"]) == 0
    (OUT_DIR / "scenario-s5-verification.json").write_text(
        json.dumps(verification, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
    )

    print("S5 exports written:", ", ".join([
        "scenario-s5.json", "scenario-s5-verification.json", "selection-matrix-s5.csv",
        "student-itineraries-s5.csv", "teacher-load-s5.csv", "room-occupancy-s5.csv",
        "cohort-assignment-s5.csv",
    ]))
    print("allCompliant:", all_compliant, "| zeroRoomConflicts:", verification["zeroRoomConflicts"],
          "| zeroTeacherConflicts:", verification["zeroTeacherConflicts"])


if __name__ == "__main__":
    main()

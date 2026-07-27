#!/usr/bin/env python3
"""S0/S1 exhaustive schedule solver for the pré-rentrée 2026 idle-time
optimization mission (docs/campaigns/pre-rentree-2026/SCHEDULE-OPTIMIZATION-REPORT.md).

S0: reports the CURRENT (baseline) schedule's violations, unchanged.
S1: for each window, exhaustively enumerates every assignment of its
(level, subject, teacherRole) entries to the window's (block, room) slots
that respects teacher non-overlap (a teacherRole cannot be in two rooms in
the same block) — same dates, same subjects, one cohort per subject, same
rooms/roles as today, per the S1 scenario definition — and finds the
assignment(s) minimizing, in this lexicographic order:
  1. number of same-level SIMULTANEOUS subject pairs (two subjects of the
     same level landing in the same block — physically impossible to combine)
  2. number of same-level LONG_IDLE subject pairs (> MAX_STUDENT_IDLE_MINUTES)
  3. sum of idle minutes over all same-level pairs (tie-break)

The search space per window is small enough (low hundreds to tens of
thousands of candidate assignments) for brute-force exhaustive search to be
both correct and fast — no external solver dependency is introduced, per the
mission's "no heavy new runtime dependency" instruction.
"""

from __future__ import annotations

import itertools
import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
PDF_GENERATOR_DIR = REPO_ROOT / "tools" / "pdf-generator"
if str(PDF_GENERATOR_DIR) not in sys.path:
    sys.path.insert(0, str(PDF_GENERATOR_DIR))

from itinerary import MAX_STUDENT_IDLE_MINUTES, compute_itinerary  # noqa: E402
from pre_rentree_data import ScheduledSlot  # noqa: E402

BLOCKS = ("A", "B", "C", "D")
ROOMS = ("salle-1", "salle-2")


@dataclass(frozen=True)
class Entry:
    level: str
    subject: str
    teacher_role: str


def load_campaign():
    return json.loads((REPO_ROOT / "data" / "campaigns" / "pre-rentree-2026.json").read_text(encoding="utf-8"))


def window_entries(campaign: dict, window_id: str) -> list[Entry]:
    for window in campaign["schedule"]:
        if window["windowId"] == window_id:
            return [Entry(s["level"], s["subject"], s["teacherRole"]) for s in window["slots"]]
    raise ValueError(f"Unknown window {window_id}")


def block_times(campaign: dict) -> dict[str, tuple[str, str]]:
    return {b["id"]: (b["startTime"], b["endTime"]) for b in campaign["blocks"]}


def all_slots() -> list[tuple[str, str]]:
    return [(block, room) for block in BLOCKS for room in ROOMS]


def levels_in(entries: list[Entry]) -> list[str]:
    seen: list[str] = []
    for e in entries:
        if e.level not in seen:
            seen.append(e.level)
    return seen


def build_sessions(entries: list[Entry], assignment: dict[Entry, tuple[str, str]], times: dict[str, tuple[str, str]]) -> list[ScheduledSlot]:
    date = "2026-08-17"  # any single representative day of the window; the
    # window's days are all structurally identical (same weekly slot repeats).
    sessions = []
    for entry in entries:
        block, room = assignment[entry]
        start, end = times[block]
        sessions.append(
            ScheduledSlot(
                level=entry.level, subject=entry.subject, block=block, room=room,
                window_id="w", window_label="w", start_time=start, end_time=end, date=date,
            )
        )
    return sessions


def score_assignment(entries: list[Entry], assignment: dict[Entry, tuple[str, str]], times: dict[str, tuple[str, str]]):
    sessions = build_sessions(entries, assignment, times)
    simultaneous_count = 0
    long_idle_count = 0
    total_idle = 0
    details = []
    for level in levels_in(entries):
        level_subjects = sorted({e.subject for e in entries if e.level == level})
        for i in range(len(level_subjects)):
            for j in range(i + 1, len(level_subjects)):
                pair = (level_subjects[i], level_subjects[j])
                report = compute_itinerary(level, pair, sessions)
                if report.status == "SIMULTANEOUS":
                    simultaneous_count += 1
                elif report.status == "LONG_IDLE":
                    long_idle_count += 1
                    total_idle += report.max_idle_minutes
                details.append((level, pair, report.status, report.max_idle_minutes))
    return (simultaneous_count, long_idle_count, total_idle), details


def solve_window(campaign: dict, window_id: str, teacher_disjoint: bool = True):
    entries = window_entries(campaign, window_id)
    times = block_times(campaign)
    by_teacher: dict[str, list[Entry]] = defaultdict(list)
    for e in entries:
        by_teacher[e.teacher_role].append(e)

    slots = all_slots()
    best_score = None
    best_assignment = None
    best_details = None
    candidates_checked = 0

    # Enumerate, per teacher, an injective mapping of their entries to distinct
    # BLOCKS (any room) — a teacher cannot be in two rooms at once. Then, for a
    # fixed set of (block) choices per teacher, enumerate the room assignment
    # for entries sharing the same block (at most 2 per block, since only 2
    # rooms exist) — this factorization keeps the search space small without
    # looping over the full slot-permutation space naively.
    teacher_roles = list(by_teacher.keys())

    def block_choices_for(role_entries: list[Entry]):
        return itertools.permutations(BLOCKS, len(role_entries))

    for block_choice_combo in itertools.product(*(block_choices_for(by_teacher[r]) for r in teacher_roles)):
        block_for_entry: dict[Entry, str] = {}
        block_usage: dict[str, list[Entry]] = defaultdict(list)
        for role, blocks_for_role in zip(teacher_roles, block_choice_combo):
            for entry, block in zip(by_teacher[role], blocks_for_role):
                block_for_entry[entry] = block
                block_usage[block].append(entry)

        if any(len(entries_in_block) > len(ROOMS) for entries_in_block in block_usage.values()):
            continue  # more than 2 entries want the same block: no room left

        room_choices_per_block = []
        blocks_with_entries = [b for b in BLOCKS if block_usage[b]]
        for block in blocks_with_entries:
            n = len(block_usage[block])
            room_choices_per_block.append(list(itertools.permutations(ROOMS, n)))

        for room_combo in itertools.product(*room_choices_per_block):
            assignment: dict[Entry, tuple[str, str]] = {}
            for block, rooms_for_block in zip(blocks_with_entries, room_combo):
                for entry, room in zip(block_usage[block], rooms_for_block):
                    assignment[entry] = (block_for_entry[entry], room)

            candidates_checked += 1
            score, details = score_assignment(entries, assignment, times)
            if best_score is None or score < best_score:
                best_score = score
                best_assignment = dict(assignment)
                best_details = details

    return {
        "window": window_id,
        "entries": len(entries),
        "candidatesChecked": candidates_checked,
        "bestScore": {
            "simultaneousPairs": best_score[0],
            "longIdlePairs": best_score[1],
            "totalIdleMinutes": best_score[2],
        },
        "bestAssignment": [
            {"level": e.level, "subject": e.subject, "teacherRole": e.teacher_role, "block": assignment[0], "room": assignment[1]}
            for e, assignment in best_assignment.items()
        ],
        "bestDetails": [
            {"level": level, "subjectA": pair[0], "subjectB": pair[1], "status": status, "maxIdleMinutes": idle}
            for level, pair, status, idle in best_details
        ],
    }


def baseline_score(campaign: dict, window_id: str):
    entries = window_entries(campaign, window_id)
    times = block_times(campaign)
    baseline_assignment = {}
    for window in campaign["schedule"]:
        if window["windowId"] != window_id:
            continue
        for slot in window["slots"]:
            e = Entry(slot["level"], slot["subject"], slot["teacherRole"])
            baseline_assignment[e] = (slot["block"], slot["room"])
    score, details = score_assignment(entries, baseline_assignment, times)
    return {
        "window": window_id,
        "score": {"simultaneousPairs": score[0], "longIdlePairs": score[1], "totalIdleMinutes": score[2]},
        "details": [
            {"level": level, "subjectA": pair[0], "subjectB": pair[1], "status": status, "maxIdleMinutes": idle}
            for level, pair, status, idle in details
        ],
    }


def main():
    campaign = load_campaign()
    windows = ["fenetre-1", "weekend-debut-fenetre-2", "fenetre-2"]

    result = {"maxStudentIdleMinutes": MAX_STUDENT_IDLE_MINUTES, "s0_baseline": {}, "s1_optimum": {}}
    for window_id in windows:
        result["s0_baseline"][window_id] = baseline_score(campaign, window_id)
        result["s1_optimum"][window_id] = solve_window(campaign, window_id)

    out_path = Path(__file__).parent / "s0-s1-solver-output.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

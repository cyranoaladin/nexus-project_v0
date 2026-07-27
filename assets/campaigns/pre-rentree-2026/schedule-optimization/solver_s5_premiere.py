#!/usr/bin/env python3
"""Proves the minimum number of additional Première SVT cohorts needed in
fenêtre 1 (17-21 août, no third room used here — the owner's salle-3 decision
is scoped to Terminale block C, 24-28 août only) once SVT is folded into the
same window as 3e/Seconde/Première Mathématiques+Français+NSI (the S5
candidate's structural change vs. the old S3 scenario, which kept SVT in a
separate week-end window).
"""

from __future__ import annotations

import itertools
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
BLOCKS = ("A", "B", "C", "D")
ROOMS = ("salle-1", "salle-2")

BASE_ENTRIES = [
    ("TROISIEME", "MATHEMATIQUES", "TEACHER_A_MATHS_NSI"),
    ("TROISIEME", "FRANCAIS", "TEACHER_C_FRANCAIS"),
    ("SECONDE", "MATHEMATIQUES", "TEACHER_A_MATHS_NSI"),
    ("SECONDE", "FRANCAIS", "TEACHER_C_FRANCAIS"),
    ("PREMIERE", "MATHEMATIQUES", "TEACHER_A_MATHS_NSI"),
    ("PREMIERE", "NSI", "TEACHER_A_MATHS_NSI"),
    ("PREMIERE", "SVT", "TEACHER_E_SVT"),
]

REQUIRED_COMBOS = [
    ("TROISIEME", ("MATHEMATIQUES", "FRANCAIS")),
    ("SECONDE", ("MATHEMATIQUES", "FRANCAIS")),
    ("PREMIERE", ("MATHEMATIQUES", "NSI")),
    ("PREMIERE", ("MATHEMATIQUES", "SVT")),
    ("PREMIERE", ("NSI", "SVT")),
    ("PREMIERE", ("MATHEMATIQUES", "NSI", "SVT")),
]


def build_entries(duplicate_svt: bool):
    entries = list(BASE_ENTRIES)
    if duplicate_svt:
        entries.append(("PREMIERE", "SVT", "TEACHER_E_SVT"))
    return [(*e, i) for i, e in enumerate(entries)]


def enumerate_assignments(entries):
    by_teacher = defaultdict(list)
    for entry in entries:
        by_teacher[entry[2]].append(entry)
    teacher_roles = list(by_teacher.keys())
    block_choices = [list(itertools.permutations(BLOCKS, len(by_teacher[r]))) for r in teacher_roles]

    for block_combo in itertools.product(*block_choices):
        block_for_entry = {}
        block_usage = defaultdict(list)
        for role, blocks_for_role in zip(teacher_roles, block_combo):
            for entry, block in zip(by_teacher[role], blocks_for_role):
                block_for_entry[entry] = block
                block_usage[block].append(entry)
        if any(len(v) > len(ROOMS) for v in block_usage.values()):
            continue
        blocks_with_entries = list(block_usage.keys())
        room_choices = [list(itertools.permutations(ROOMS, len(block_usage[b]))) for b in blocks_with_entries]
        for room_combo in itertools.product(*room_choices):
            assignment = {}
            for block, rooms_for_block in zip(blocks_with_entries, room_combo):
                for entry, room in zip(block_usage[block], rooms_for_block):
                    assignment[entry] = (block_for_entry[entry], room)
            yield assignment


def sessions_from_assignment(entries, assignment):
    date = "2026-08-17"
    result = {}
    for entry in entries:
        level, subject, role, idx = entry
        block, room = assignment[entry]
        start, end = TIMES[block]
        result.setdefault((level, subject), []).append(
            ScheduledSlot(level=level, subject=subject, block=block, room=room,
                          window_id="w", window_label="w", start_time=start, end_time=end, date=date)
        )
    return result


def score_assignment(entries, assignment):
    sessions_by_key = sessions_from_assignment(entries, assignment)
    simultaneous_count = 0
    long_idle_count = 0
    total_idle = 0
    for level, combo in REQUIRED_COMBOS:
        options = [sessions_by_key[(level, s)] for s in combo]
        best = None
        for pick in itertools.product(*options):
            report = compute_itinerary(level, list(combo), list(pick))
            score = (0 if report.status != "SIMULTANEOUS" else 1, 0 if report.status != "LONG_IDLE" else 1, report.max_idle_minutes)
            if best is None or score < best:
                best = score
        if best[0]:
            simultaneous_count += 1
        if best[1]:
            long_idle_count += 1
            total_idle += best[2]
    return simultaneous_count, long_idle_count, total_idle


def solve(duplicate_svt: bool):
    entries = build_entries(duplicate_svt)
    best = None
    checked = 0
    for assignment in enumerate_assignments(entries):
        checked += 1
        score = score_assignment(entries, assignment)
        if best is None or score < best:
            best = score
    return {"duplicateSvt": duplicate_svt, "candidatesChecked": checked, "bestScore": best, "compliant": best[0] == 0 and best[1] == 0}


def main():
    results = [solve(False), solve(True)]
    out_path = Path(__file__).parent / "scenario-s5-premiere-solver-output.json"
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

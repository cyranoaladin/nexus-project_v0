#!/usr/bin/env python3
"""S5 solver: proves the minimum number of additional Terminale cohorts needed
(among NSI, Physique-Chimie, SVT — the only subjects with slack on their
teacher role; Mathématiques/Maths expertes share TEACHER_A_MATHS_NSI, already
at 3-4 blocks/day) to make every "parcours normal" combination compact
(<=60 min, never simultaneous), given the owner's new resources: a third room
(salle-3, block C only, 24-28 août) and no change to the 28 août end date.

For each candidate cohort-duplication subset (0 to 3 subjects duplicated), it
exhaustively searches every teacher-conflict-free (block, room) assignment —
now with salle-3 as an extra room option on block C — and scores it by
picking, for every required combination, the BEST available cohort choice
(mirroring what the real itinerary-assignment engine would do): a student is
never forced into a bad cohort if a compact one exists.
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
BASE_ROOMS = ("salle-1", "salle-2")
EXTRA_ROOM = "salle-3"
EXTRA_ROOM_BLOCKS = ("C",)  # owner decision: salle-3 only on block C unless proven indispensable

BASE_ENTRIES = [
    ("MATHEMATIQUES", "TEACHER_A_MATHS_NSI"),
    ("MATHS_EXPERTES", "TEACHER_A_MATHS_NSI"),
    ("NSI", "TEACHER_A_MATHS_NSI"),
    ("PHYSIQUE_CHIMIE", "TEACHER_D_PHYSIQUE_CHIMIE"),
    ("SVT", "TEACHER_E_SVT"),
]
DUPLICABLE = ("NSI", "PHYSIQUE_CHIMIE", "SVT")  # Maths/MathsExpertes share an already-loaded teacher role

# The 13 "parcours normaux" the mission requires compact (see SCHEDULE-UX-AUDIT.md
# and section G of the S5 brief) — includes the 3 Maths complémentaires
# combinations, which reuse the same MATHEMATIQUES schedule slot as the
# spécialité track (only the module content differs, a separate pedagogical
# concern already routed to REQUIRES_PEDAGOGICAL_REVIEW in configurator.ts).
REQUIRED_COMBOS = [
    ("MATHEMATIQUES", "NSI"),
    ("MATHEMATIQUES", "PHYSIQUE_CHIMIE"),
    ("MATHEMATIQUES", "SVT"),
    ("NSI", "PHYSIQUE_CHIMIE"),
    ("NSI", "SVT"),
    ("PHYSIQUE_CHIMIE", "SVT"),
    ("MATHEMATIQUES", "MATHS_EXPERTES"),
    ("MATHEMATIQUES", "MATHS_EXPERTES", "NSI"),
    ("MATHEMATIQUES", "MATHS_EXPERTES", "PHYSIQUE_CHIMIE"),
    ("MATHEMATIQUES", "MATHS_EXPERTES", "SVT"),
    ("MATHEMATIQUES", "PHYSIQUE_CHIMIE", "SVT"),
    ("MATHEMATIQUES", "NSI", "PHYSIQUE_CHIMIE"),
    ("MATHEMATIQUES", "NSI", "SVT"),
]


def build_entries(duplicated: tuple[str, ...]):
    """Returns a list of (subject, teacherRole, cohortIndex) — cohortIndex 0 for
    every subject's primary cohort, 1 for a subject's duplicate if requested."""
    entries = []
    for subject, role in BASE_ENTRIES:
        entries.append((subject, role, 0))
        if subject in duplicated:
            entries.append((subject, role, 1))
    return entries


def enumerate_assignments(entries):
    """Yields every (entry -> (block, room)) mapping respecting: (a) a teacher
    role occupies at most one room per block: (b) at most 2 entries per block
    use the base rooms, plus 1 more allowed on block C via salle-3."""
    by_teacher = defaultdict(list)
    for entry in entries:
        by_teacher[entry[1]].append(entry)

    teacher_roles = list(by_teacher.keys())
    block_choices_per_teacher = [
        list(itertools.permutations(BLOCKS, len(by_teacher[role]))) for role in teacher_roles
    ]

    for block_combo in itertools.product(*block_choices_per_teacher):
        block_for_entry = {}
        block_usage = defaultdict(list)
        for role, blocks_for_role in zip(teacher_roles, block_combo):
            for entry, block in zip(by_teacher[role], blocks_for_role):
                block_for_entry[entry] = block
                block_usage[block].append(entry)

        capacity_ok = True
        for block, entries_in_block in block_usage.items():
            max_capacity = len(BASE_ROOMS) + (1 if block in EXTRA_ROOM_BLOCKS else 0)
            if len(entries_in_block) > max_capacity:
                capacity_ok = False
                break
        if not capacity_ok:
            continue

        room_options_per_block = {}
        for block, entries_in_block in block_usage.items():
            available_rooms = list(BASE_ROOMS) + ([EXTRA_ROOM] if block in EXTRA_ROOM_BLOCKS else [])
            room_options_per_block[block] = list(itertools.permutations(available_rooms, len(entries_in_block)))

        blocks_with_entries = list(block_usage.keys())
        for room_combo in itertools.product(*(room_options_per_block[b] for b in blocks_with_entries)):
            assignment = {}
            extra_room_uses = 0
            for block, rooms_for_block in zip(blocks_with_entries, room_combo):
                for entry, room in zip(block_usage[block], rooms_for_block):
                    assignment[entry] = (block_for_entry[entry], room)
                    if room == EXTRA_ROOM:
                        extra_room_uses += 1
            yield assignment, extra_room_uses


def sessions_from_assignment(entries, assignment) -> dict:
    """Returns {(subject, cohortIndex): ScheduledSlot} for a fixed representative date."""
    date = "2026-08-24"
    result = {}
    for entry in entries:
        subject, role, cohort_idx = entry
        block, room = assignment[entry]
        start, end = TIMES[block]
        result[(subject, cohort_idx)] = ScheduledSlot(
            level="TERMINALE", subject=subject, block=block, room=room,
            window_id="w", window_label="w", start_time=start, end_time=end, date=date,
        )
    return result


def score_assignment(entries, assignment):
    sessions_by_key = sessions_from_assignment(entries, assignment)
    cohorts_by_subject = defaultdict(list)
    for (subject, cohort_idx) in sessions_by_key:
        cohorts_by_subject[subject].append(cohort_idx)

    simultaneous_count = 0
    long_idle_count = 0
    total_idle = 0
    combo_results = []

    for combo in REQUIRED_COMBOS:
        # Try every combination of cohort choices for the subjects in this combo,
        # keep the best (mirrors the real assignment engine picking the best cohort).
        choices_per_subject = [cohorts_by_subject[s] for s in combo]
        best = None
        for cohort_pick in itertools.product(*choices_per_subject):
            chosen_sessions = [sessions_by_key[(s, c)] for s, c in zip(combo, cohort_pick)]
            report = compute_itinerary("TERMINALE", list(combo), chosen_sessions)
            score = (0 if report.status != "SIMULTANEOUS" else 1, 0 if report.status != "LONG_IDLE" else 1, report.max_idle_minutes)
            if best is None or score < best[0]:
                best = (score, report.status, report.max_idle_minutes)
        combo_results.append({"combo": combo, "status": best[1], "maxIdleMinutes": best[2]})
        if best[1] == "SIMULTANEOUS":
            simultaneous_count += 1
        elif best[1] == "LONG_IDLE":
            long_idle_count += 1
            total_idle += best[2]

    return (simultaneous_count, long_idle_count, total_idle), combo_results


def solve_for_duplicated_subset(duplicated: tuple[str, ...]):
    entries = build_entries(duplicated)
    best_score = None
    best_assignment = None
    best_combo_results = None
    best_extra_room_uses = None
    candidates = 0
    for assignment, extra_room_uses in enumerate_assignments(entries):
        candidates += 1
        score, combo_results = score_assignment(entries, assignment)
        ranked = (*score, extra_room_uses)
        if best_score is None or ranked < best_score:
            best_score = ranked
            best_assignment = dict(assignment)
            best_combo_results = combo_results
            best_extra_room_uses = extra_room_uses
    return {
        "duplicatedSubjects": list(duplicated),
        "candidatesChecked": candidates,
        "bestScore": {
            "simultaneousCombos": best_score[0],
            "longIdleCombos": best_score[1],
            "totalIdleMinutes": best_score[2],
            "salle3BlocksUsed": best_extra_room_uses,
        },
        "isFullyCompliant": best_score[0] == 0 and best_score[1] == 0,
        "assignment": [
            {"subject": e[0], "cohort": e[2], "teacherRole": e[1], "block": a[0], "room": a[1]}
            for e, a in best_assignment.items()
        ],
        "comboResults": best_combo_results,
    }


def main():
    report = {"searchedSubsetsBySize": {}}
    found_minimum = None
    for k in range(0, len(DUPLICABLE) + 1):
        subsets_at_k = list(itertools.combinations(DUPLICABLE, k))
        results_at_k = []
        for subset in subsets_at_k:
            result = solve_for_duplicated_subset(subset)
            results_at_k.append(result)
        report["searchedSubsetsBySize"][k] = results_at_k
        if found_minimum is None and any(r["isFullyCompliant"] for r in results_at_k):
            found_minimum = k
            report["provenMinimumAdditionalCohorts"] = k
            report["compliantSubsetsAtMinimum"] = [
                r["duplicatedSubjects"] for r in results_at_k if r["isFullyCompliant"]
            ]

    out_path = Path(__file__).parent / "scenario-s5-solver-output.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "provenMinimumAdditionalCohorts": report.get("provenMinimumAdditionalCohorts"),
        "compliantSubsetsAtMinimum": report.get("compliantSubsetsAtMinimum"),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

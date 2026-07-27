"""Deterministic student-itinerary / idle-time engine — Python mirror of
lib/campaigns/pre-rentree-2026/itinerary.ts. Same algorithm, same status set,
same MAX_STUDENT_IDLE_MINUTES = 60. Kept in sync manually (no shared runtime
between the TS site and this Python PDF pipeline); __tests__/campaigns/
pre-rentree-2026-student-idle-time.test.ts and scripts/pre-rentree/tests/
test_student_idle_time.py assert on the identical baseline numbers to catch
drift between the two.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional, Sequence

from pre_rentree_data import ScheduledSlot

MAX_STUDENT_IDLE_MINUTES = 60

ItineraryStatus = Literal[
    "NO_SHARED_DAY",
    "COMPACT",
    "LONG_IDLE",
    "SIMULTANEOUS",
    "REQUIRES_ALTERNATIVE_COHORT",
    "REQUIRES_MANUAL_REVIEW",
]


def _to_minutes(time: str) -> int:
    h, m = time.split(":")
    return int(h) * 60 + int(m)


@dataclass(frozen=True)
class DayItinerary:
    date: str
    sessions: tuple
    idle_gaps_minutes: tuple
    max_idle_minutes: int
    simultaneous: bool


@dataclass(frozen=True)
class FirstConflict:
    date: str
    subject_a: str
    subject_b: str
    reason: str
    idle_minutes: Optional[int] = None


@dataclass(frozen=True)
class ItineraryReport:
    level: str
    subjects: tuple
    status: ItineraryStatus
    days_present: int
    max_idle_minutes: int
    total_idle_minutes: int
    days: tuple
    first_conflict: Optional[FirstConflict]


def compute_itinerary(level: str, subjects: Sequence[str], all_sessions: Sequence[ScheduledSlot]) -> ItineraryReport:
    """Direct port of computeItinerary() in itinerary.ts — see its docstring for
    the full rule rationale. A subject not in `subjects` never contributes idle
    time, even if scheduled on the same date/block as a selected subject."""
    subjects = tuple(subjects)
    relevant = [s for s in all_sessions if s.level == level and s.subject in subjects]

    by_date: dict[str, list[ScheduledSlot]] = {}
    for session in relevant:
        by_date.setdefault(session.date, []).append(session)

    days: list[DayItinerary] = []
    first_conflict: Optional[FirstConflict] = None
    overall_max_idle = 0
    total_idle = 0
    any_simultaneous = False
    any_long_idle = False
    any_shared_day = False

    for date in sorted(by_date.keys()):
        day_sessions = sorted(by_date[date], key=lambda s: _to_minutes(s.start_time))
        gaps: list[int] = []
        day_simultaneous = False
        day_max_idle = 0

        if len(day_sessions) >= 2:
            any_shared_day = True

        for i in range(len(day_sessions) - 1):
            current = day_sessions[i]
            nxt = day_sessions[i + 1]
            gap = _to_minutes(nxt.start_time) - _to_minutes(current.end_time)
            if gap < 0:
                day_simultaneous = True
                any_simultaneous = True
                if first_conflict is None:
                    first_conflict = FirstConflict(date, current.subject, nxt.subject, "SIMULTANEOUS")
                continue
            gaps.append(gap)
            total_idle += gap
            day_max_idle = max(day_max_idle, gap)
            if gap > MAX_STUDENT_IDLE_MINUTES:
                any_long_idle = True
                if first_conflict is None:
                    first_conflict = FirstConflict(date, current.subject, nxt.subject, "LONG_IDLE", gap)

        overall_max_idle = max(overall_max_idle, day_max_idle)
        days.append(DayItinerary(date, tuple(day_sessions), tuple(gaps), day_max_idle, day_simultaneous))

    if any_simultaneous:
        status: ItineraryStatus = "SIMULTANEOUS"
    elif any_long_idle:
        status = "LONG_IDLE"
    elif any_shared_day:
        status = "COMPACT"
    else:
        status = "NO_SHARED_DAY"

    return ItineraryReport(
        level=level,
        subjects=subjects,
        status=status,
        days_present=len(by_date),
        max_idle_minutes=overall_max_idle,
        total_idle_minutes=total_idle,
        days=tuple(days),
        first_conflict=first_conflict,
    )


@dataclass(frozen=True)
class AssignmentResult:
    level: str
    subjects: tuple
    cohort_by_subject: dict  # subject -> chosen cohort_id (None when single/primary cohort)
    sessions_by_subject: dict  # subject -> tuple[ScheduledSlot, ...] (always the 5 sessions of the chosen cohort)
    itinerary: ItineraryReport


def _cohort_groups(subject: str, sessions: Sequence[ScheduledSlot]) -> list[dict]:
    by_subject = [s for s in sessions if s.subject == subject]
    groups: dict[Optional[str], list[ScheduledSlot]] = {}
    for session in by_subject:
        groups.setdefault(session.cohort_id, []).append(session)
    return [
        {
            "cohort_id": cohort_id,
            "is_primary": sess[0].is_primary if sess[0].is_primary is not None else True,
            "sessions": sess,
        }
        for cohort_id, sess in groups.items()
    ]


def assign_itinerary(level: str, subjects: Sequence[str], all_sessions: Sequence[ScheduledSlot]) -> AssignmentResult:
    """Python mirror of assignItinerary() in itinerary.ts — picks, for every
    selected subject that has more than one cohort, the single cohort that
    minimizes (in order) simultaneity, long idle time, total idle time, then
    prefers primary cohorts. Never combines two cohorts of the same subject
    into one itinerary: the caller always gets exactly 5 sessions per subject.
    """
    subjects = tuple(subjects)
    level_sessions = [s for s in all_sessions if s.level == level]
    options_per_subject = [_cohort_groups(subject, level_sessions) for subject in subjects]

    for i, options in enumerate(options_per_subject):
        if not options:
            raise ValueError(f"Missing campaign schedule for {level}/{subjects[i]}")

    def rank(report: ItineraryReport, penalty: int) -> tuple:
        return (
            1 if report.status == "SIMULTANEOUS" else 0,
            1 if report.status == "LONG_IDLE" else 0,
            report.max_idle_minutes,
            penalty,
        )

    best_report: Optional[ItineraryReport] = None
    best_choice: Optional[list[dict]] = None
    best_rank: Optional[tuple] = None

    total_combinations = 1
    for options in options_per_subject:
        total_combinations *= len(options)

    for combo in range(total_combinations):
        remainder = combo
        choice = []
        for options in options_per_subject:
            idx = remainder % len(options)
            remainder //= len(options)
            choice.append(options[idx])
        chosen_sessions = [s for c in choice for s in c["sessions"]]
        report = compute_itinerary(level, subjects, chosen_sessions)
        penalty = sum(1 for c in choice if not c["is_primary"])
        candidate_rank = rank(report, penalty)
        if best_rank is None or candidate_rank < best_rank:
            best_report, best_choice, best_rank = report, choice, candidate_rank

    cohort_by_subject = {}
    sessions_by_subject = {}
    for subject, chosen in zip(subjects, best_choice):
        cohort_by_subject[subject] = chosen["cohort_id"]
        sessions_by_subject[subject] = tuple(chosen["sessions"])

    return AssignmentResult(
        level=level,
        subjects=subjects,
        cohort_by_subject=cohort_by_subject,
        sessions_by_subject=sessions_by_subject,
        itinerary=best_report,
    )


def enumerate_selections(subjects: Sequence[str], max_size: int) -> list[tuple]:
    """All non-empty subsets of `subjects` up to `max_size`, smallest first."""
    subjects = tuple(subjects)
    n = len(subjects)
    results = []
    for mask in range(1, 1 << n):
        selection = tuple(subjects[bit] for bit in range(n) if mask & (1 << bit))
        if len(selection) <= max_size:
            results.append(selection)
    return sorted(results, key=lambda s: (len(s), ",".join(s)))


STATUS_LABELS = {
    "NO_SHARED_DAY": "Aucune journée commune : ces matières ne se croisent jamais le même jour.",
    "COMPACT": "Parcours compact : aucune attente supérieure à 60 minutes.",
    "LONG_IDLE": "Cette combinaison impose une attente supérieure à 60 minutes le même jour.",
    "SIMULTANEOUS": "Ces matières ont un créneau simultané : elles ne peuvent pas être suivies ensemble.",
    "REQUIRES_ALTERNATIVE_COHORT": "Une autre cohorte permettrait de rendre ce parcours compact — à confirmer.",
    "REQUIRES_MANUAL_REVIEW": "Cette combinaison nécessite une revue manuelle du planning.",
}

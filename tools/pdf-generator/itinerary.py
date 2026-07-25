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

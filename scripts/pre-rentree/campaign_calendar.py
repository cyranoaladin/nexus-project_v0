"""Relative campaign-calendar helpers.

Public dates are calculated only when the owner supplies an authorized launch
date. Review artifacts otherwise retain J1, J2, … labels without inventing a
publication date.
"""

from __future__ import annotations

from datetime import date, timedelta


def resolve_publication_date(
    launch_date: str | None,
    day_offset: int,
) -> dict[str, str | None]:
    if not isinstance(day_offset, int) or isinstance(day_offset, bool) or day_offset < 0:
        raise ValueError("day_offset must be a non-negative integer")

    publication_day = f"J{day_offset + 1}"
    if launch_date is None:
        return {
            "publicationDay": publication_day,
            "publicationDate": None,
        }
    if not launch_date:
        raise ValueError("launch_date must be an ISO date or None")

    try:
        parsed_launch_date = date.fromisoformat(launch_date)
    except ValueError as error:
        raise ValueError("launch_date must use YYYY-MM-DD") from error

    return {
        "publicationDay": publication_day,
        "publicationDate": (parsed_launch_date + timedelta(days=day_offset)).isoformat(),
    }

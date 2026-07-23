import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "pre-rentree"))

from campaign_calendar import resolve_publication_date  # noqa: E402


def test_publication_dates_are_derived_from_the_authorized_launch_date():
    assert resolve_publication_date("2026-07-27", 0) == {
        "publicationDay": "J1",
        "publicationDate": "2026-07-27",
    }
    assert resolve_publication_date("2026-07-27", 6) == {
        "publicationDay": "J7",
        "publicationDate": "2026-08-02",
    }


def test_review_calendar_stays_relative_without_owner_authorization():
    assert resolve_publication_date(None, 3) == {
        "publicationDay": "J4",
        "publicationDate": None,
    }


@pytest.mark.parametrize("launch_date, day_offset", [
    ("20-07-2026", 0),
    ("2026-07-20", -1),
    ("", 0),
])
def test_invalid_launch_configuration_fails_closed(launch_date: str, day_offset: int):
    with pytest.raises(ValueError):
        resolve_publication_date(launch_date, day_offset)

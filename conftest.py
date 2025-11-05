"""Project-level pytest configuration.

This file now delegates to the canonical fixtures declared in
`tests/conftest.py` so that the FastAPI application, database session,
and supporting utilities are sourced from the maintained test harness
under `apps/api`.
"""

from tests.conftest import *  # noqa: F401,F403

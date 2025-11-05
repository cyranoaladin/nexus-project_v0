from __future__ import annotations

import argparse
import logging
from typing import Iterable
from uuid import UUID

from app.db.session import SessionLocal
from app.services.reports import generate_reports_for_students

logger = logging.getLogger(__name__)


def run_once(
    *,
    student_ids: Iterable[UUID] | None = None,
    period: str | None = None,
    regenerate: bool = False,
) -> dict[UUID, dict[str, object]]:
    session = SessionLocal()
    try:
        results = generate_reports_for_students(
            session,
            period=period,
            student_ids=student_ids,
            regenerate=regenerate,
        )
        session.commit()
        return results
    except Exception:  # pragma: no cover - surfaced by caller/test
        session.rollback()
        raise
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate parent reports for students")
    parser.add_argument(
        "--student-id",
        action="append",
        help="Limit generation to the provided student UUID (can be repeated)",
    )
    parser.add_argument("--period", help="Override reporting period, defaults to current month")
    parser.add_argument("--regenerate", action="store_true", help="Force regeneration even if cached")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    student_ids = None
    if args.student_id:
        try:
            student_ids = [UUID(value) for value in args.student_id]
        except ValueError as exc:  # pragma: no cover - arg parsing feedback
            parser.error(f"Invalid UUID supplied: {exc}")

    results = run_once(student_ids=student_ids, period=args.period, regenerate=args.regenerate)
    logger.info("Generated %s parent reports", len(results))


if __name__ == "__main__":
    main()

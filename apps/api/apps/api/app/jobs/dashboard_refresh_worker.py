from __future__ import annotations

import argparse
import logging
import time
from datetime import datetime

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.report import Event
from app.services.dashboard import DASHBOARD_SUMMARY_REFRESH_EVENT
from app.services.dashboard_refresh import refresh_dashboard_summary
from app.utils.audit import record_event

_COMPLETED_KIND = "DASHBOARD_SUMMARY_REFRESH_COMPLETED"

logger = logging.getLogger(__name__)


def _last_checkpoint(session) -> datetime | None:
    stmt = select(func.max(Event.created_at)).where(Event.kind == _COMPLETED_KIND)
    return session.execute(stmt).scalar_one_or_none()


def _collect_requests(session, since: datetime | None):
    stmt = select(Event).where(Event.kind == DASHBOARD_SUMMARY_REFRESH_EVENT).order_by(Event.created_at.asc())
    if since:
        stmt = stmt.where(Event.created_at > since)
    return session.scalars(stmt).all()


def process_pending() -> int:
    session = SessionLocal()
    try:
        since = _last_checkpoint(session)
        requests = _collect_requests(session, since)
        if not requests:
            session.rollback()
            return 0

        refresh_dashboard_summary()

        processed_students = {event.student_id for event in requests if event.student_id}
        for student_id in processed_students:
            record_event(
                session,
                student_id=student_id,
                kind=_COMPLETED_KIND,
                payload={"processed_count": len(requests)},
            )

        session.commit()
        return len(requests)
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Dashboard summary refresh worker")
    parser.add_argument("--interval", type=int, default=30, help="Polling interval in seconds")
    parser.add_argument("--once", action="store_true", help="Run a single refresh cycle and exit")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.once:
        processed = process_pending()
        logger.info("Processed %s refresh requests", processed)
        return

    interval = max(5, args.interval)
    logger.info("Starting dashboard refresh worker (interval=%ss)", interval)
    try:
        while True:
            processed = process_pending()
            if processed:
                logger.info("Processed %s refresh requests", processed)
            time.sleep(interval)
    except KeyboardInterrupt:  # pragma: no cover - manual stop
        logger.info("Worker interrupted, exiting")


if __name__ == "__main__":
    main()

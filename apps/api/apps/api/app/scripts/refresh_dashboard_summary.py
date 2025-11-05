from __future__ import annotations

import argparse
import logging

from app.services.dashboard_refresh import refresh_dashboard_summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Trigger the dashboard materialized view refresh once.",
    )
    parser.add_argument(
        "--concurrently",
        action="store_true",
        help="Allow concurrent refresh when using PostgreSQL >= 15.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger(__name__).info("Refreshing dashboard summary (concurrently=%s)", args.concurrently)

    refresh_dashboard_summary(concurrently=args.concurrently)


if __name__ == "__main__":
    main()
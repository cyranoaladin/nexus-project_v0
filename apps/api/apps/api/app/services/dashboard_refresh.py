"""Helpers to refresh the dashboard summary materialized view."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.session import engine as default_engine

_VIEW_FQN = "nexus_app.mv_dashboard_summary"


def refresh_dashboard_summary(*, concurrently: bool = False, bind: Optional[Engine] = None) -> None:
    """Refresh the dashboard summary materialized view.

    The refresh runs outside an explicit transaction by default, matching
    PostgreSQL requirements for materialized views. Pass ``concurrently=True``
    when the view has a unique index and you want to avoid blocking readers.
    """

    target_engine = bind or default_engine
    statement = "REFRESH MATERIALIZED VIEW"
    if concurrently:
        statement += " CONCURRENTLY"
    statement += f" {_VIEW_FQN}"

    with target_engine.connect() as connection:
        if concurrently:
            connection.execute(text(statement))
            connection.commit()
        else:
            autocommit_connection = connection.execution_options(isolation_level="AUTOCOMMIT")
            autocommit_connection.execute(text(statement))


if __name__ == "__main__":  # pragma: no cover - manual execution helper
    refresh_dashboard_summary()

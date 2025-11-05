"""Add dashboard_student_id to students

Revision ID: 003_add_dashboard_student_id
Revises: 002_dashboard_core
Create Date: 2025-11-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "003_add_dashboard_student_id"
down_revision = "002_dashboard_core"
branch_labels = None
depends_on = None

SCHEMA = "nexus_app"


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column("dashboard_student_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema=SCHEMA,
    )
    op.create_unique_constraint(
        "uq_students_dashboard_student_id",
        "students",
        ["dashboard_student_id"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_students_dashboard_student_id",
        "students",
        schema=SCHEMA,
        type_="unique",
    )
    op.drop_column("students", "dashboard_student_id", schema=SCHEMA)

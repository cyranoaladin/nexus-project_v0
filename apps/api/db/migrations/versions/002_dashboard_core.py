"""Dashboard core schema additions

Revision ID: 002_dashboard_core
Revises: 001_init_core
Create Date: 2025-11-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "002_dashboard_core"
down_revision = "001_init_core"
branch_labels = None
depends_on = None

SCHEMA = "nexus_app"


def upgrade() -> None:
    bind = op.get_bind()

    student_track = postgresql.ENUM("Premiere", "Terminale", name="student_track", schema=SCHEMA)
    student_profile = postgresql.ENUM("Scolarise", "CandidatLibre", name="student_profile", schema=SCHEMA)
    session_kind = postgresql.ENUM("Visio", "Présentiel", "Stage", name="session_kind", schema=SCHEMA)
    session_status = postgresql.ENUM("Proposé", "Confirmé", "Annulé", name="session_status", schema=SCHEMA)
    task_status = postgresql.ENUM("Todo", "Done", "Skipped", name="task_status", schema=SCHEMA)
    task_source = postgresql.ENUM("Agent", "Coach", "System", name="task_source", schema=SCHEMA)
    evaluation_status = postgresql.ENUM("Proposé", "Soumis", "Corrigé", name="evaluation_status", schema=SCHEMA)
    epreuve_source = postgresql.ENUM("Réglement", "Agent", name="epreuve_source", schema=SCHEMA)

    for enum_type in (
        student_track,
        student_profile,
        session_kind,
        session_status,
        task_status,
        task_source,
        evaluation_status,
        epreuve_source,
    ):
        enum_type.create(bind, checkfirst=True)

    op.add_column(
        "students",
        sa.Column(
            "track",
            postgresql.ENUM("Premiere", "Terminale", name="student_track", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Terminale",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "students",
        sa.Column(
            "profile",
            postgresql.ENUM("Scolarise", "CandidatLibre", name="student_profile", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Scolarise",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "students",
        sa.Column(
            "specialities",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "students",
        sa.Column(
            "options",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "students",
        sa.Column(
            "llv",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "students",
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.add_column(
        "students",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )

    op.add_column(
        "sessions",
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "fk_sessions_student",
        "sessions",
        "students",
        ["student_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
    )
    op.add_column(
        "sessions",
        sa.Column(
            "kind",
            postgresql.ENUM("Visio", "Présentiel", "Stage", name="session_kind", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Visio",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "sessions",
        sa.Column(
            "status",
            postgresql.ENUM("Proposé", "Confirmé", "Annulé", name="session_status", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Proposé",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "sessions",
        sa.Column("slot_start", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.add_column(
        "sessions",
        sa.Column("slot_end", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )

    op.execute(
        f"""
        UPDATE {SCHEMA}.sessions
        SET
            kind = CASE
                WHEN LOWER(type) = 'présentiel' THEN 'Présentiel'
                WHEN LOWER(type) = 'presentiel' THEN 'Présentiel'
                WHEN LOWER(type) = 'stage' THEN 'Stage'
                ELSE 'Visio'
            END::"{SCHEMA}".session_kind,
            status = 'Proposé'::"{SCHEMA}".session_status,
            slot_start = COALESCE(starts_at, slot_start),
            slot_end = COALESCE(
                CASE
                    WHEN starts_at IS NOT NULL AND duration IS NOT NULL THEN starts_at + (duration || ' minutes')::interval
                    WHEN starts_at IS NOT NULL THEN starts_at + interval '60 minutes'
                    ELSE slot_start + interval '60 minutes'
                END,
                slot_start + interval '60 minutes'
            )
        """
    )

    op.add_column(
        "reports",
        sa.Column("summary_md", sa.String(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "reports",
        sa.Column("kpis_json", sa.JSON(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "reports",
        sa.Column("generated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )

    op.add_column(
        "events",
        sa.Column("occurred_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )

    op.add_column(
        "resources",
        sa.Column("title", sa.String(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "resources",
        sa.Column("uri", sa.String(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "resources",
        sa.Column("visibility", sa.String(), nullable=False, server_default="private"),
        schema=SCHEMA,
    )
    op.add_column(
        "resources",
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.alter_column("resources", "blob_url", nullable=True, schema=SCHEMA)
    op.execute(
        f"ALTER TABLE {SCHEMA}.resources ALTER COLUMN tags TYPE text[] USING CASE WHEN tags IS NULL THEN '{{}}'::text[] ELSE string_to_array(tags, ',') END"
    )
    op.execute(f"ALTER TABLE {SCHEMA}.resources ALTER COLUMN tags SET DEFAULT '{{}}'::text[]")
    op.execute(f"ALTER TABLE {SCHEMA}.resources ALTER COLUMN tags SET NOT NULL")

    op.add_column(
        "entitlements",
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "fk_entitlements_student",
        "entitlements",
        "students",
        ["student_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
    )
    op.add_column(
        "entitlements",
        sa.Column("tier", sa.String(), nullable=False, server_default="Free"),
        schema=SCHEMA,
    )
    op.add_column(
        "entitlements",
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "entitlements",
        sa.Column("granted_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )

    op.create_table(
        "progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("chapter_code", sa.String(), nullable=False),
        sa.Column("competence_code", sa.String(), nullable=True),
        sa.Column("score", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "fk_progress_student",
        "progress",
        "students",
        ["student_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
    )

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(length=300), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "status",
            postgresql.ENUM("Todo", "Done", "Skipped", name="task_status", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Todo",
        ),
        sa.Column(
            "source",
            postgresql.ENUM("Agent", "Coach", "System", name="task_source", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Agent",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "fk_tasks_student",
        "tasks",
        "students",
        ["student_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
    )

    op.create_table(
        "evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("generator", sa.String(), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM("Proposé", "Soumis", "Corrigé", name="evaluation_status", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Proposé",
        ),
        sa.Column("score_20", sa.Float(), nullable=True),
        sa.Column("feedback_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "fk_evaluations_student",
        "evaluations",
        "students",
        ["student_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
    )

    op.create_table(
        "epreuves_plan",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("format", sa.String(), nullable=False),
        sa.Column(
            "source",
            postgresql.ENUM("Réglement", "Agent", name="epreuve_source", schema=SCHEMA, create_type=False),
            nullable=False,
            server_default="Agent",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "fk_epreuves_plan_student",
        "epreuves_plan",
        "students",
        ["student_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
    )

    op.create_index("ix_progress_student_subject_updated", "progress", ["student_id", "subject", "updated_at"], schema=SCHEMA)
    op.create_index("ix_tasks_student_status_due", "tasks", ["student_id", "status", "due_at"], schema=SCHEMA)
    op.create_index("ix_sessions_student_status_start", "sessions", ["student_id", "status", "slot_start"], schema=SCHEMA)
    op.create_index("ix_evaluations_student_status_created", "evaluations", ["student_id", "status", "created_at"], schema=SCHEMA)
    op.create_index("ix_epreuves_plan_student_code", "epreuves_plan", ["student_id", "code"], schema=SCHEMA)
    op.create_index("ix_events_student_occurred_at", "events", ["student_id", "occurred_at"], schema=SCHEMA)

    op.execute(
        f"""
        CREATE INDEX idx_tasks_student_todo_due
        ON {SCHEMA}.tasks (student_id, due_at)
        WHERE status = 'Todo'::"{SCHEMA}".task_status
        """
    )

    op.execute(
        f"""
        CREATE MATERIALIZED VIEW {SCHEMA}.mv_dashboard_summary AS
        SELECT
            s.id AS student_id,
            COALESCE(AVG(p.score), 0)::double precision AS progress_overall,
            (
                SELECT e.score_20
                FROM {SCHEMA}.evaluations e
                WHERE e.student_id = s.id AND e.score_20 IS NOT NULL
                ORDER BY e.created_at DESC
                LIMIT 1
            ) AS last_eval_score,
            (
                SELECT MIN(sess.slot_start)
                FROM {SCHEMA}.sessions sess
                WHERE sess.student_id = s.id AND sess.status = 'Confirmé'::"{SCHEMA}".session_status
            ) AS next_session_at,
            (
                SELECT COUNT(*)
                FROM {SCHEMA}.tasks t
                WHERE t.student_id = s.id AND t.status = 'Todo'::"{SCHEMA}".task_status
            ) AS tasks_open_count
        FROM {SCHEMA}.students s
        LEFT JOIN {SCHEMA}.progress p ON p.student_id = s.id
        GROUP BY s.id
        """
    )


def downgrade() -> None:
    op.execute(f"DROP MATERIALIZED VIEW IF EXISTS {SCHEMA}.mv_dashboard_summary")

    op.execute(f"DROP INDEX IF EXISTS {SCHEMA}.idx_tasks_student_todo_due")
    op.drop_index("ix_events_student_occurred_at", table_name="events", schema=SCHEMA)
    op.drop_index("ix_epreuves_plan_student_code", table_name="epreuves_plan", schema=SCHEMA)
    op.drop_index("ix_evaluations_student_status_created", table_name="evaluations", schema=SCHEMA)
    op.drop_index("ix_sessions_student_status_start", table_name="sessions", schema=SCHEMA)
    op.drop_index("ix_tasks_student_status_due", table_name="tasks", schema=SCHEMA)
    op.drop_index("ix_progress_student_subject_updated", table_name="progress", schema=SCHEMA)

    op.drop_table("epreuves_plan", schema=SCHEMA)
    op.drop_table("evaluations", schema=SCHEMA)
    op.drop_table("tasks", schema=SCHEMA)
    op.drop_table("progress", schema=SCHEMA)

    op.drop_constraint("fk_entitlements_student", "entitlements", schema=SCHEMA, type_="foreignkey")
    op.drop_column("entitlements", "granted_at", schema=SCHEMA)
    op.drop_column("entitlements", "expires_at", schema=SCHEMA)
    op.drop_column("entitlements", "tier", schema=SCHEMA)
    op.drop_column("entitlements", "student_id", schema=SCHEMA)

    op.execute(f"ALTER TABLE {SCHEMA}.resources ALTER COLUMN tags DROP NOT NULL")
    op.execute(f"ALTER TABLE {SCHEMA}.resources ALTER COLUMN tags TYPE text USING array_to_string(tags, ',')")
    op.execute(f"ALTER TABLE {SCHEMA}.resources ALTER COLUMN tags SET DEFAULT NULL")
    op.alter_column("resources", "blob_url", nullable=False, schema=SCHEMA)
    op.drop_column("resources", "created_at", schema=SCHEMA)
    op.drop_column("resources", "visibility", schema=SCHEMA)
    op.drop_column("resources", "uri", schema=SCHEMA)
    op.drop_column("resources", "title", schema=SCHEMA)

    op.drop_column("events", "occurred_at", schema=SCHEMA)

    op.drop_column("reports", "generated_at", schema=SCHEMA)
    op.drop_column("reports", "kpis_json", schema=SCHEMA)
    op.drop_column("reports", "summary_md", schema=SCHEMA)

    op.execute(f"UPDATE {SCHEMA}.sessions SET slot_start = NULL, slot_end = NULL")
    op.drop_column("sessions", "slot_end", schema=SCHEMA)
    op.drop_column("sessions", "slot_start", schema=SCHEMA)
    op.drop_column("sessions", "status", schema=SCHEMA)
    op.drop_column("sessions", "kind", schema=SCHEMA)
    op.drop_constraint("fk_sessions_student", "sessions", schema=SCHEMA, type_="foreignkey")
    op.drop_column("sessions", "student_id", schema=SCHEMA)

    op.drop_column("students", "updated_at", schema=SCHEMA)
    op.drop_column("students", "created_at", schema=SCHEMA)
    op.drop_column("students", "llv", schema=SCHEMA)
    op.drop_column("students", "options", schema=SCHEMA)
    op.drop_column("students", "specialities", schema=SCHEMA)
    op.drop_column("students", "profile", schema=SCHEMA)
    op.drop_column("students", "track", schema=SCHEMA)

    for enum_name in (
        "epreuve_source",
        "evaluation_status",
        "task_source",
        "task_status",
        "session_status",
        "session_kind",
        "student_profile",
        "student_track",
    ):
        op.execute(f"DROP TYPE IF EXISTS {SCHEMA}.{enum_name}")

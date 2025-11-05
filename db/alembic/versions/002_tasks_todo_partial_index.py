"""add partial index on tasks (Todo only)"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '002_tasks_todo_partial_index'
down_revision = '001_init_core'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute('SET search_path TO nexus_app, public;')
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'idx_tasks_student_todo_due' AND n.nspname = 'nexus_app'
            ) THEN
                CREATE INDEX idx_tasks_student_todo_due
                ON tasks (student_id, due_at)
                WHERE status = 'Todo';
            END IF;
        END $$;
    """)

def downgrade() -> None:
    op.execute('SET search_path TO nexus_app, public;')
    op.execute('DROP INDEX IF EXISTS idx_tasks_student_todo_due;')

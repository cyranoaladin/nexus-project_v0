from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_init_core'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('locale', sa.String(), server_default='fr-FR'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'))
    )

    op.create_table('students',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), unique=True),
        sa.Column('statut', sa.String(), nullable=False),
        sa.Column('niveau', sa.String(), nullable=False),
        sa.Column('etablissement', sa.String()),
        sa.Column('lva', sa.String()),
        sa.Column('lvb', sa.String())
    )

    op.create_table('specialities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('code', sa.String(), unique=True),
        sa.Column('label', sa.String())
    )
    op.create_table('student_specialities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('speciality_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('specialities.id')),
        sa.Column('year', sa.String()),
        sa.Column('level', sa.String())
    )
    op.create_table('options',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('code', sa.String(), unique=True),
        sa.Column('label', sa.String())
    )
    op.create_table('student_options',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('option_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('options.id')),
        sa.Column('year', sa.String())
    )

    op.create_table('exams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('type', sa.String()),
        sa.Column('coef', sa.Integer()),
        sa.Column('nature', sa.String()),
        sa.Column('date', sa.DateTime(), nullable=True),
        sa.Column('visible_for_individuel', sa.Boolean(), server_default=sa.text('true'))
    )
    op.create_table('student_exams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('exam_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('exams.id')),
        sa.Column('status', sa.String(), server_default='planned'),
        sa.Column('score', sa.Integer(), nullable=True)
    )

    op.create_table('competences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('domaine', sa.String()),
        sa.Column('subdomain', sa.String()),
        sa.Column('label', sa.String())
    )
    op.create_table('student_competences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('competence_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('competences.id')),
        sa.Column('level', sa.Integer()),
        sa.Column('evidence', sa.JSON(), server_default=sa.text("'{}'::json"))
    )
    op.create_table('resources',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('type', sa.String()),
        sa.Column('tags', sa.String()),
        sa.Column('blob_url', sa.String()),
        sa.Column('meta', sa.JSON(), server_default=sa.text("'{}'::json"))
    )
    op.create_table('plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('items', sa.JSON(), server_default=sa.text("'{}'::json"))
    )

    op.create_table('sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('type', sa.String()),
        sa.Column('coach_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('starts_at', sa.DateTime()),
        sa.Column('duration', sa.Integer()),
        sa.Column('capacity', sa.Integer(), server_default='1'),
        sa.Column('price_cents', sa.Integer(), server_default='0')
    )
    op.create_table('bookings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sessions.id')),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('status', sa.String(), server_default='booked')
    )

    op.create_table('reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('period', sa.String()),
        sa.Column('payload', sa.JSON(), server_default=sa.text("'{}'::json"))
    )
    op.create_table('events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id')),
        sa.Column('kind', sa.String()),
        sa.Column('payload', sa.JSON(), server_default=sa.text("'{}'::json")),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'))
    )

    op.create_table('entitlements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('plan', sa.String()),
        sa.Column('quotas', sa.JSON(), server_default=sa.text("'{}'::json")),
        sa.Column('renew_at', sa.DateTime(), nullable=True)
    )

    op.create_table('documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('source', sa.String()),
        sa.Column('path', sa.String()),
        sa.Column('version', sa.String(), server_default='v1'),
        sa.Column('meta', sa.JSON(), server_default=sa.text("'{}'::json"))
    )

    op.execute("""
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT,
  embedding VECTOR(1536),
  meta JSONB
);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_l2_ops);
""")

    op.create_table('chunks_meta',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True)),
        sa.Column('content', sa.String()),
        sa.Column('meta', sa.JSON(), server_default=sa.text("'{}'::json"))
    )

def downgrade() -> None:
    op.drop_table('chunks_meta')
    op.execute("DROP INDEX IF EXISTS idx_chunks_embedding;")
    op.execute("DROP TABLE IF EXISTS chunks;")
    op.drop_table('documents')
    op.drop_table('entitlements')
    op.drop_table('events')
    op.drop_table('reports')
    op.drop_table('bookings')
    op.drop_table('sessions')
    op.drop_table('plans')
    op.drop_table('resources')
    op.drop_table('student_competences')
    op.drop_table('competences')
    op.drop_table('student_exams')
    op.drop_table('exams')
    op.drop_table('student_options')
    op.drop_table('options')
    op.drop_table('student_specialities')
    op.drop_table('specialities')
    op.drop_table('students')
    op.drop_table('users')

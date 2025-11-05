from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Alembic's autogenerate picks up models via metadata reflection during
# migrations. We deliberately avoid importing models here to prevent
# circular import issues at application start-up.

__all__ = ["Base"]

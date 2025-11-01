import os
from pydantic import BaseModel

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg://nexus:nexus@localhost:5432/nexus")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret")
    COOKIE_SECRET: str = os.getenv("COOKIE_SECRET", "dev-cookie")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "admin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "password")
    VECTOR_BACKEND: str = os.getenv("VECTOR_BACKEND", "pgvector")
    ENV: str = os.getenv("ENV", "dev")

settings = Settings()

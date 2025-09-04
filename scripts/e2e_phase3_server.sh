#!/usr/bin/env bash
set -euo pipefail

# Env for E2E validation of ARIA Phase 3
export E2E=1
export NEXT_PUBLIC_E2E=1
export TEST_PDF_FAKE=1
export TEST_EMBEDDINGS_FAKE=1

# Local DB (forwarded by compose to 5433)
export DATABASE_URL='postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public'

# Minimal auth secret for dev
export NEXTAUTH_SECRET='e2e-test-secret-0123456789abcdef0123456789abcd'

# MinIO local access
export STORAGE_PROVIDER='minio'
export MINIO_ENDPOINT='localhost'
export MINIO_PORT='9000'
export MINIO_USE_SSL='false'
export MINIO_ACCESS_KEY='minioadmin'
export MINIO_SECRET_KEY='minioadmin'
export MINIO_BUCKET='nexus-docs'
export MINIO_PUBLIC_ENDPOINT='http://localhost:9000'

exec npm run dev -- --port 3001

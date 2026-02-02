# Database Strategy - Nexus Réussite

**Last Updated**: 2026-02-01
**Status**: ✅ **PostgreSQL Only** (SQLite support removed)

---

## 🎯 Strategy Overview

Nexus Réussite uses **PostgreSQL exclusively** across all environments:

| Environment | Database | Connection | Managed By |
|-------------|----------|------------|------------|
| **Development** | PostgreSQL 15 | localhost:5434 | Docker Compose |
| **CI (GitHub Actions)** | PostgreSQL 15 | localhost:5432 | Service Container |
| **Staging** | PostgreSQL 15 | Managed Service | Cloud Provider |
| **Production** | PostgreSQL 15+ | Managed Service | Cloud Provider |

---

## 🚫 Why Not SQLite?

**Decision**: SQLite removed in commit `e8c5cb42`

**Reasons**:
1. **Production Requirements**
   - SaaS needs robust transactions (payments, bookings)
   - Concurrent writes (multiple users, webhooks)
   - Complex queries (JOINs, subqueries, window functions)

2. **Feature Parity**
   - PostgreSQL has JSON operators, full-text search, advanced indexes
   - SQLite lacks many constraints (CHECK, partial indexes differ)
   - Type system differences (TEXT vs VARCHAR, REAL vs DECIMAL)

3. **Development Consistency**
   - What you test is what you deploy
   - No surprises between dev and prod
   - Migrations work identically

4. **Simplicity**
   - One schema to maintain (`prisma/schema.prisma`)
   - No dual-schema drift
   - Clear documentation

---

## 🗄️ Schema File

**Single Source of Truth**: `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

**Location**: `/prisma/schema.prisma`
**Models**: 30+ (User, Student, Session, Payment, etc.)
**Migrations**: `/prisma/migrations/`

---

## 🔧 Setup Guide

### 1. Install Dependencies

```bash
npm ci
```

### 2. Start PostgreSQL (Docker)

```bash
# Start database service
npm run docker:up

# Or manually:
docker-compose up -d postgres-db

# Verify it's running
docker ps | grep nexus-postgres-db
```

**Connection String** (dev):
```
postgresql://postgres:postgres@localhost:5434/nexus_dev?schema=public
```

### 3. Setup Environment Variables

```bash
# Copy example
cp .env.example .env

# Edit .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/nexus_dev?schema=public"
```

**Important Variables**:
- `DATABASE_URL` - Full PostgreSQL connection string
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `POSTGRES_DB` - Database name (default: nexus_dev)

### 4. Generate Prisma Client

```bash
npm run db:generate
```

This generates TypeScript types in `node_modules/@prisma/client`.

### 5. Run Migrations

```bash
# Development: Apply + create if needed
npm run db:migrate

# Production: Apply only
npm run db:migrate:deploy
```

### 6. Seed Database (Optional)

```bash
npm run db:seed
```

Populates DB with:
- Demo users (admin, coach, student, parent)
- Sample courses
- Test badges

---

## 📜 npm Scripts Reference

| Command | Description | Usage |
|---------|-------------|-------|
| `db:generate` | Generate Prisma Client | After schema changes |
| `db:migrate` | Create & apply migration | Dev: schema changes |
| `db:migrate:deploy` | Apply migrations only | Prod: deployment |
| `db:push` | Sync schema (no migration) | Prototyping only |
| `db:reset` | Drop + migrate + seed | Reset to clean state |
| `db:seed` | Populate with demo data | After db:reset |
| `db:studio` | Open Prisma Studio GUI | Visual DB explorer |

### Workflow Examples

#### New Feature Development

```bash
# 1. Modify prisma/schema.prisma
# 2. Create migration
npm run db:migrate

# 3. Name migration (e.g., "add_session_reminders")
# 4. Prisma generates migration SQL

# 5. Generate updated client
npm run db:generate

# 6. Use new models in code
```

#### Reset Database (Dev)

```bash
# Warning: This deletes ALL data
npm run db:reset

# Equivalent to:
# prisma migrate reset --force
# (drops DB, applies all migrations, runs seed)
```

#### Production Deployment

```bash
# On deploy script or CI/CD
npm run db:migrate:deploy

# Then build
npm run build
```

---

## 🔄 Migration Workflow

### Development

1. **Modify Schema**
   ```bash
   # Edit prisma/schema.prisma
   # Add/modify models, fields, relations
   ```

2. **Create Migration**
   ```bash
   npm run db:migrate
   # Prisma prompts for migration name
   # Example: "add_session_booking_table"
   ```

3. **Review Generated SQL**
   ```sql
   -- File: prisma/migrations/20260201120000_add_session_booking_table/migration.sql
   CREATE TABLE "session_bookings" (
     "id" TEXT PRIMARY KEY,
     "studentId" TEXT NOT NULL,
     -- ...
   );
   ```

4. **Test Migration**
   ```bash
   # Migration already applied in step 2
   # Test with integration tests
   npm run test:integration
   ```

### Production

1. **Merge to Main**
   - PR with migration files included
   - CI validates migration applies cleanly

2. **Deploy**
   ```bash
   # In production environment
   DATABASE_URL="postgresql://..." npm run db:migrate:deploy
   ```

3. **Verify**
   ```bash
   # Check migrations table
   SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
   ```

---

## 🐳 Docker Compose Configuration

**File**: `docker-compose.yml`

```yaml
services:
  postgres-db:
    image: postgres:15-alpine
    container_name: nexus-postgres-db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - nexus-postgres-data:/var/lib/postgresql/data
    networks:
      - nexus-network
    ports:
      - "5434:5432"  # Host:5434 → Container:5432
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Why Port 5434?**
- Avoids conflict with local PostgreSQL on default port 5432
- Documented convention for this project
- Change in `.env` if needed

---

## 🧪 Testing Strategy

### Integration Tests

Integration tests use **PostgreSQL** (same as prod):

**Setup**: `jest.setup.integration.js`
```javascript
// Mock Prisma for fast tests
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    // ... other models mocked
  }
}))
```

**Running Tests**:
```bash
# With mocked Prisma (fast)
npm run test:integration

# With real PostgreSQL (slow, comprehensive)
DATABASE_URL="postgresql://..." npm run test:integration
```

### CI Pipeline

**GitHub Actions**: `.github/workflows/tests.yml`

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nexus_test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s

steps:
  - run: npx prisma migrate deploy
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexus_test
```

**Benefits**:
- Tests run against real PostgreSQL
- Catches migration issues early
- Validates schema compatibility

---

## 🔍 Troubleshooting

### Connection Refused

**Error**:
```
Error: P1001: Can't reach database server at `localhost:5434`
```

**Solutions**:
1. Check Docker is running
   ```bash
   docker ps | grep postgres
   ```

2. Start database
   ```bash
   npm run docker:up
   ```

3. Verify connection string
   ```bash
   echo $DATABASE_URL
   # Should be: postgresql://postgres:postgres@localhost:5434/nexus_dev
   ```

### Migration Failed

**Error**:
```
Error: P3009: migrate found failed migrations
```

**Solutions**:
1. Check migration status
   ```bash
   npx prisma migrate status
   ```

2. Resolve failed migration
   ```bash
   # Option A: Mark as applied (if already in DB)
   npx prisma migrate resolve --applied <migration_name>

   # Option B: Rollback and reapply
   npx prisma migrate resolve --rolled-back <migration_name>
   npx prisma migrate deploy
   ```

3. Dev: Reset if safe
   ```bash
   npm run db:reset
   ```

### Schema Out of Sync

**Error**:
```
Error: Prisma schema and database are out of sync
```

**Solutions**:
1. Generate client
   ```bash
   npm run db:generate
   ```

2. Apply pending migrations
   ```bash
   npm run db:migrate:deploy
   ```

3. Dev: Push schema directly (prototyping)
   ```bash
   npm run db:push
   ```

### Port Already in Use

**Error**:
```
Error: Bind for 0.0.0.0:5434 failed: port is already allocated
```

**Solutions**:
1. Change port in `.env` and `docker-compose.yml`
   ```yaml
   ports:
     - "5435:5432"  # Use 5435 instead
   ```

2. Or stop conflicting service
   ```bash
   lsof -ti:5434 | xargs kill -9
   ```

---

## 📊 Database Maintenance

### Backup (Production)

```bash
# Backup to file
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore

```bash
# From SQL file
psql $DATABASE_URL < backup_20260201.sql

# From compressed
gunzip -c backup_20260201.sql.gz | psql $DATABASE_URL
```

### Vacuum (Performance)

```sql
-- Reclaim storage and update statistics
VACUUM ANALYZE;

-- Full vacuum (locks tables, use off-peak)
VACUUM FULL;
```

### Monitor Size

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('nexus_dev'));

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔐 Security Best Practices

### Environment Variables

**DO**:
- ✅ Use strong passwords in production
- ✅ Store secrets in secrets manager (not .env in prod)
- ✅ Use SSL/TLS connections (`?sslmode=require`)
- ✅ Rotate credentials regularly

**DON'T**:
- ❌ Commit `.env` files
- ❌ Use default passwords in prod (`postgres:postgres`)
- ❌ Expose database port to internet
- ❌ Use root user for application

### Connection String (Production)

```bash
# Development
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/nexus_dev"

# Production (with SSL)
DATABASE_URL="postgresql://user:pass@db.example.com:5432/nexus_prod?sslmode=require&connect_timeout=10"
```

### Prisma Client

```typescript
// lib/prisma.ts - Already configured
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // No 'query' logging to avoid PII/secrets exposure
})
```

---

## 📚 Additional Resources

- [Prisma Migrations Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose for Postgres](https://hub.docker.com/_/postgres)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

---

## 🔄 Migration from SQLite (Historical)

**Note**: SQLite support was removed in commit `e8c5cb42`.

If you have old SQLite data to migrate:

1. **Export SQLite data**
   ```bash
   sqlite3 prisma/dev.db .dump > sqlite_dump.sql
   ```

2. **Convert to PostgreSQL**
   ```bash
   # Use converter tool or manual SQL rewrite
   # Handle type differences (INTEGER → SERIAL, etc.)
   ```

3. **Import to PostgreSQL**
   ```bash
   psql $DATABASE_URL < postgres_dump.sql
   ```

4. **Verify**
   ```bash
   npm run db:studio
   # Check all tables and data
   ```

**Better Approach**: Use Prisma seed script to recreate data programmatically.

---

## ✅ Checklist

Before deploying to production:

- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] SSL enabled (`?sslmode=require`)
- [ ] Strong password (not default)
- [ ] Migrations applied (`npm run db:migrate:deploy`)
- [ ] Database backed up
- [ ] Monitoring configured (slow queries, connection pool)
- [ ] Prisma Client generated (`npm run db:generate`)
- [ ] Environment variables validated
- [ ] Connection pool limits configured
- [ ] Healthcheck endpoint working (`/api/health`)

---

**Last Updated**: 2026-02-01
**Maintainer**: Équipe Nexus Réussite

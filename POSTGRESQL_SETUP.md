# PostgreSQL — Configuration

**Dernière mise à jour :** 21 février 2026

Le projet utilise **PostgreSQL 15+** comme provider Prisma (avec pgvector pour les embeddings).

## Configuration

- **Provider** : `postgresql` dans `prisma/schema.prisma`
- **Extensions** : pgvector (`vector` type pour embeddings RAG)
- **Schéma** : 38 modèles, 20 enums, 16 migrations

## Environnements

| Environnement | DB | Port | URL |
|---------------|-----|------|-----|
| **Dev local** | `nexus_dev` | 5435 (Docker) | `postgresql://nexus_user:...@localhost:5435/nexus_dev` |
| **Tests DB** | `nexus_test` | 5435 (Docker) / 5432 (CI) | `postgresql://...@localhost:5435/nexus_test` |
| **Tests E2E** | `nexus_e2e` | 5432 (CI) | `postgresql://postgres:postgres@localhost:5432/nexus_e2e` |
| **Production** | `nexus_prod` | 5432 (Docker) | Configuré via `DATABASE_URL` |

## Commandes

```bash
npx prisma generate          # Génère le client Prisma
npx prisma db push           # Applique le schéma (dev)
npx prisma migrate deploy    # Applique les migrations (CI/prod)
npx prisma db seed           # Seed (9 users de démo)
npx prisma studio            # GUI pour la DB

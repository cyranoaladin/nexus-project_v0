# Guide d’installation (Développement)

**Dernière mise à jour :** 21 février 2026

## 1) Prérequis

- Node.js 20.x + npm
- PostgreSQL 15+ (local ou Docker)
- (Optionnel) Docker pour l'environnement complet (Ollama, ChromaDB, etc.)

## 2) Variables d’environnement

Copiez l’exemple local puis adaptez :
```bash
cp env.local.example .env.local
```

Variables requises :
- `DATABASE_URL` — PostgreSQL connection string (ex: `postgresql://user:pass@localhost:5432/nexus_dev`)
- `NEXTAUTH_SECRET` — Secret JWT (32+ chars)
- `NEXTAUTH_URL` — `http://localhost:3000`

## 3) Base de données (PostgreSQL)

```bash
npm install
npx prisma generate        # Génère le client Prisma
npx prisma db push          # Applique le schéma à la DB
npx prisma db seed          # Optionnel : crée 9 users de démo (admin, coachs, parent, élèves)
```

## 4) Lancer l’app

```bash
npm run dev
```

## 5) Accès rapides

- Home : `http://localhost:3000`
- Bilan gratuit : `http://localhost:3000/bilan-gratuit`
- Connexion : `http://localhost:3000/auth/signin`
- Prisma Studio : `npx prisma studio` (GUI pour la DB)

## 6) Tests

```bash
npm test                    # Unit + API (parallel, pas de DB requise)
npm run test:db-integration # DB intégration (serial, PostgreSQL requis)
npm run test:e2e            # Playwright E2E (build + seed DB E2E requis)
```

## Notes utiles

- Le provider Prisma est **PostgreSQL** (avec pgvector pour les embeddings).
- En dev, si aucune config SMTP n’est fournie, l’app tente un SMTP local (port 1025).
- Docker Compose prod : `docker-compose.prod.yml` (app, DB, Ollama, ChromaDB, ingestor).

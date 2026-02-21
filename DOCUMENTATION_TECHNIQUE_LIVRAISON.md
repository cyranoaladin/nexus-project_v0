# Documentation Technique de Livraison — Nexus Réussite

**Version :** 3.0
**Dernière mise à jour :** 21 février 2026
**Statut :** Actuel (conforme au code)

---

## 1.1 Périmètre du Livrable (Scope Exclusion)
Ce livrable concerne exclusivement le **Nexus Digital Campus** (LMS, Gestion, IA ARIA).  
Il n'inclut pas le code source du moteur de correction vectorielle **Korrigo**, qui est un produit tiers interconnecté.

## 1.2 Architecture cible (réellement implémentée)
```
Utilisateurs
   │
   ▼
Next.js 15 (App Router, standalone)
   ├─ UI (pages publiques + dashboards)
   ├─ API Routes (auth, sessions, paiements, aria…)
   ├─ NextAuth v5 (Auth.js, JWT)
   └─ Prisma Client
        │
        ▼
PostgreSQL 15+ (pgvector)

Services externes
   ├─ Ollama (ARIA — LLaMA 3.2, Qwen 2.5)
   ├─ ChromaDB (RAG embeddings)
   ├─ SMTP (emails)
   ├─ Jitsi (visio)
   └─ ClicToPay (paiements, skeleton 501)
```

## 2.1 Variables d’environnement (source de vérité)
Voir `env.example` et `env.local.example`.

Variables clés :
- **Core** : `NODE_ENV`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **DB** : `DATABASE_URL` (PostgreSQL)
- **SMTP** : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- **Ollama** : `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OLLAMA_URL`
- **RAG** : `RAG_INGESTOR_URL`, `RAG_SEARCH_TIMEOUT`
- **Jitsi** : `NEXT_PUBLIC_JITSI_SERVER_URL`

## 3.1 Build & démarrage
La build inclut une copie des assets publics (`scripts/copy-public-assets.js`).

```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start
```

### Notes importantes
- Le mode `standalone` est activé (`next.config.mjs`).
- `NEXTAUTH_SECRET` est **obligatoire en production**.

## 4.1 Base de données
- **Provider : PostgreSQL 15+** avec pgvector.
- Schéma : `prisma/schema.prisma` (~1286 lignes, 38 modèles, 20 enums, 16 migrations).
- Production : Docker Compose (`docker-compose.prod.yml`).

## 5.1 Paiements (réel)
- **Virement bancaire** : déclaration parent → paiement PENDING → validation staff → activation abonnement + crédits + facture.
- **ClicToPay** (Banque Zitouna) : skeleton API (501), en cours d'intégration.

## 6.1 IA ARIA (réel)
- Appels Ollama (LLaMA 3.2 / Qwen 2.5) via OpenAI SDK (`lib/aria.ts`).
- RAG : ChromaDB + pgvector (embeddings nomic-embed-text).
- Historique conversations + feedback utilisateur sauvegardés en DB.

## 7.1 Tests
Voir `README_TESTS.md` et `DOCUMENTATION_TESTS_E2E.md`.

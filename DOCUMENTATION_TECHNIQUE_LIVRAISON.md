# Documentation Technique de Livraison — Nexus Réussite

**Version :** 2.0
**Dernière mise à jour :** 21 janvier 2026
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
Next.js 14 (App Router)
   ├─ UI (pages publiques + dashboards)
   ├─ API Routes (auth, sessions, paiements, aria…)
   ├─ NextAuth (JWT)
   └─ Prisma Client
        │
        ▼
SQLite (DATABASE_URL=file:...)

Services externes
   ├─ OpenAI (ARIA)
   ├─ SMTP (emails)
   ├─ Jitsi (visio)
   └─ Konnect/Wise (paiements, partiellement simulés)
```

## 2.1 Variables d’environnement (source de vérité)
Voir `env.example` et `env.local.example`.

Variables clés :
- **Core** : `NODE_ENV`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **DB** : `DATABASE_URL` (SQLite par défaut)
- **SMTP** : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- **OpenAI** : `OPENAI_API_KEY`, `OPENAI_MODEL`
- **Jitsi** : `NEXT_PUBLIC_JITSI_SERVER_URL`
- **Konnect** : `KONNECT_API_KEY`, `KONNECT_WALLET_ID`, `KONNECT_BASE_URL`, `KONNECT_WEBHOOK_SECRET`
- **Wise** : `NEXT_PUBLIC_WISE_*`

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
- **Provider actuel : SQLite**.
- Si vous souhaitez PostgreSQL en production, il faut **modifier `prisma/schema.prisma`**, régénérer les migrations, et adapter les scripts Docker.

## 5.1 Paiements (réel)
- **Konnect** : flux simulé (URL de démo) + webhook prévu.
- **Wise** : création d’un paiement `PENDING`, validation manuelle par l’assistante.

## 6.1 IA ARIA (réel)
- Appels OpenAI via `lib/aria.ts`.
- Recherche **textuelle** dans `PedagogicalContent` (pas de pgvector).
- Historique conversations + feedback utilisateur sauvegardés en DB.

## 7.1 Tests
Voir `README_TESTS.md` et `DOCUMENTATION_TESTS_E2E.md`.

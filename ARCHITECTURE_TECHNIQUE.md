# Documentation Technique d’Architecture — Nexus Réussite

**Version :** 3.0
**Dernière mise à jour :** 21 février 2026

---

## 1) Vue d’ensemble
Application **Next.js 15 (App Router, standalone)** full‑stack avec API routes intégrées, authentification NextAuth v5 (Auth.js), Prisma/PostgreSQL + pgvector, et une UI riche (Tailwind CSS v4 + Framer Motion + Radix UI). Le projet est monorepo‑simple (tout dans la racine), avec une séparation claire entre UI, logique métier et base de données.

## 2) Structure de répertoires (actuel)
```
app/                    # Pages + API routes (App Router)
  api/                  # Backend (Next.js Route Handlers)
  dashboard/            # Espaces par rôle (admin, assistante, parent, coach, élève)
components/             # UI, layout, sections
lib/                    # Auth, prisma, logique métier (credits, sessions, aria, emails)
prisma/                 # Schéma, migrations, seed
public/                 # Assets statiques
scripts/                # Build / déploiement / vérifications
__tests__/, e2e/         # Tests unitaires/intégration/E2E
```

## 3) Base de données (Prisma)
- **Provider : PostgreSQL 15+** avec pgvector (via `DATABASE_URL`)
- Schéma complet : `prisma/schema.prisma` (~1286 lignes, 38 modèles, 20 enums)
- Migrations : `prisma/migrations/` (16 migrations)

### Modèles clés
- **Users & profils** : `User`, `ParentProfile`, `StudentProfile`, `CoachProfile`, `Student`
- **Abonnements & crédits** : `Subscription`, `CreditTransaction`
- **Sessions** : `SessionBooking`, `CoachAvailability`, `SessionNotification`, `SessionReminder`
- **IA** : `AriaConversation`, `AriaMessage`, `PedagogicalContent`
- **Paiements** : `Payment`
- **Messagerie** : `Message`
- **Gamification** : `Badge`, `StudentBadge`, `StudentReport`
- **Demande d’abonnement** : `SubscriptionRequest`

## 4) Authentification & rôles
- **NextAuth v5** (Auth.js) — Credentials + JWT strategy (pas d'adapter DB)
- Rôles : `ADMIN`, `ASSISTANTE`, `COACH`, `PARENT`, `ELEVE`
- **Middleware** : `middleware.ts` (Edge Runtime compatible) protège `/dashboard/*` et redirige selon le rôle.

## 5) Logique métier (résumé)
- **Bilan gratuit** : création automatique parent + élève + profils + entité `Student`.
- **Crédits** : allocation mensuelle, utilisation, remboursement et expiration (`lib/credits.ts`).
- **Sessions** : disponibilité coach, réservation, notifications et rappels (`lib/session-booking.ts`, `/api/sessions/*`).
- **Paiements** : Virement bancaire (déclaration parent → validation staff) + ClicToPay (skeleton 501).
- **ARIA** : chat + feedback, historique en DB, RAG via **ChromaDB** + **pgvector** (embeddings nomic-embed-text).

## 6) UI & charte graphique (implémentation)
- Couleurs et styles : Tailwind v4 + tokens CSS (`app/globals.css`, `tailwind.config.ts`).
- Typo : Inter + Poppins (via `next/font/google`).
- Animations : Framer Motion (notamment page d’accueil).

## 7) Points d'attention techniques (actuel)
- **PostgreSQL** est le provider Prisma en production et en dev.
- **Jitsi** : l'UI utilise `meet.jit.si` en dur côté client, tandis que l'API vidéo utilise `NEXT_PUBLIC_JITSI_SERVER_URL` si défini.
- **RAG** : ChromaDB + pgvector pour la recherche sémantique sur les contenus pédagogiques.

## 8) Tests

| Type | Suites | Tests | Config |
|------|--------|-------|--------|
| Unit + API | 206 | 2 593 | `jest.config.js` |
| DB Intégration | 7 | 68 | `jest.config.db.js` |
| E2E (Chromium) | 19 | 207 | `playwright.config.ts` |

CI : 7 jobs parallèles (lint, typecheck, unit, integration, e2e, security, build).

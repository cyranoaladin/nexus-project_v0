# Documentation Technique d’Architecture — Nexus Réussite

**Version :** 2.0
**Dernière mise à jour :** 21 janvier 2026

---

## 1) Vue d’ensemble
Application **Next.js 14 (App Router)** full‑stack avec API routes intégrées, authentification NextAuth, Prisma/SQLite, et une UI riche (Tailwind + Framer Motion + Radix UI). Le projet est monorepo‑simple (tout dans la racine), avec une séparation claire entre UI, logique métier et base de données.

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
- **Provider actuel : SQLite** (via `DATABASE_URL`)
- Schéma complet : `prisma/schema.prisma`
- Migrations existantes : `prisma/migrations/*` (SQLite)

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
- **NextAuth** (Credentials + Prisma Adapter, JWT)
- Rôles : `ADMIN`, `ASSISTANTE`, `COACH`, `PARENT`, `ELEVE`
- **Middleware** : `middleware.ts` protège `/dashboard/*` et redirige selon le rôle.

## 5) Logique métier (résumé)
- **Bilan gratuit** : création automatique parent + élève + profils + entité `Student`.
- **Crédits** : allocation mensuelle, utilisation, remboursement et expiration (`lib/credits.ts`).
- **Sessions** : disponibilité coach, réservation, notifications et rappels (`lib/session-booking.ts`, `/api/sessions/*`).
- **Paiements** : Konnect (simulé) + Wise (virement manuel) + validation assistante.
- **ARIA** : chat + feedback, historique en DB, RAG **textuel** (pas de vecteurs en prod).

## 6) UI & charte graphique (implémentation)
- Couleurs et styles : Tailwind v4 + tokens CSS (`app/globals.css`, `tailwind.config.ts`).
- Typo : Inter + Poppins (via `next/font/google`).
- Animations : Framer Motion (notamment page d’accueil).

## 7) Points d’attention techniques (actuel)
- **PostgreSQL** : des fichiers Docker/Docs existent, mais **le provider Prisma est SQLite**. Pour basculer, modifier `schema.prisma` et régénérer les migrations.
- **Jitsi** : l’UI utilise `meet.jit.si` en dur côté client, tandis que l’API vidéo utilise `NEXT_PUBLIC_JITSI_SERVER_URL` si défini.
- **RAG** : recherche textuelle simple, pas de vector search.

## 8) Écosystème & Roadmap
### Korrigo (produit externe)
**Korrigo** est un produit SaaS distinct (correction vectorielle) édité par Nexus Réussite.  
Ce dépôt **ne contient pas** le moteur Korrigo. Korrigo sera ultérieurement interconnecté via API pour **remonter les notes et résultats** dans le dashboard Élève du Nexus Digital Campus.

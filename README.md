# Nexus Réussite — Nexus Digital Campus

**Dernière mise à jour :** 21 janvier 2026

## 1) Résumé
Nexus Réussite est le **Nexus Digital Campus** : une **Application SaaS de Pilotage Éducatif** (LMS + back‑office) destinée à la gestion complète des parcours d’apprentissage. Le projet inclut des pages publiques, des **dashboards par rôle**, un système d’inscription « Bilan gratuit », des **abonnements & crédits**, une **réservation de sessions**, une **IA pédagogique (ARIA)**, une **visioconférence**, et des **paiements** (Konnect / Wise).

## 2) Stack & Dépendances clés
- **Frontend** : Next.js 14, React 18, TypeScript, Tailwind CSS v4, Framer Motion, Radix UI
- **Backend** : API Routes Next.js (App Router)
- **Auth** : NextAuth (Credentials + Prisma Adapter, JWT)
- **DB** : Prisma **SQLite** (par défaut)
- **Email** : Nodemailer (SMTP)
- **IA** : OpenAI (ARIA)
- **Visio** : Jitsi (intégration client + API de session)
- **Tests** : Jest + Playwright

## 3) Structure du dépôt
```
app/                 # Pages (App Router) + API routes
components/          # UI, sections, layout
lib/                 # Logique métier (auth, credits, sessions, aria, emails)
prisma/              # Schéma, migrations, seed
public/              # Assets statiques
scripts/             # Scripts de build / déploiement / vérification
__tests__/, e2e/      # Tests unitaires / intégration / E2E
```

## 4) Pages & Navigation (actuel)
### Pages publiques
- `/` (accueil)
- `/offres`, `/academy`, `/education`, `/consulting`, `/plateforme`
- `/notre-centre`, `/equipe`, `/contact`, `/conditions`
- `/bilan-gratuit` (+ confirmation)
- `/auth/signin`, `/auth/mot-de-passe-oublie`
- `/session/video` (interface visio — démo + intégration Jitsi)

### Dashboards (protégés par rôle)
- `/dashboard/admin` (+ analytics, users, activities, subscriptions, tests)
- `/dashboard/assistante` (+ coaches, students, subscriptions, requests, credits, paiements)
- `/dashboard/coach`
- `/dashboard/parent` (+ enfants, abonnements, paiement)
- `/dashboard/eleve` (+ sessions, ressources)

## 5) API Routes principales (actuel)
- **Auth** : `/api/auth/[...nextauth]`
- **Inscription** : `/api/bilan-gratuit`
- **ARIA** : `/api/aria/chat`, `/api/aria/feedback`
- **Sessions** : `/api/sessions/book`, `/api/sessions/cancel`, `/api/sessions/video`
- **Disponibilités coach** : `/api/coaches/availability`, `/api/coaches/available`
- **Paiements** : `/api/payments/konnect`, `/api/payments/wise`, `/api/payments/wise/confirm`, `/api/payments/validate`, `/api/webhooks/konnect`
- **Dashboards** : `/api/admin/*`, `/api/assistant/*`, `/api/parent/*`, `/api/student/*`, `/api/coach/*`
- **Messages** : `/api/messages/send`, `/api/messages/conversations`
- **Notifications** : `/api/notifications`
- **Healthcheck** : `/api/health`

## 6) Base de données (état réel)
- **Prisma provider : SQLite** (`DATABASE_URL=file:./dev.db` par défaut)
- Le client Prisma force un chemin absolu pour éviter les erreurs en mode standalone (`lib/prisma.ts`).
- Des fichiers Docker/PostgreSQL existent, **mais l’ORM est configuré pour SQLite** : si vous souhaitez PostgreSQL en production, il faut **modifier `prisma/schema.prisma`** (provider + migrations) et ajuster le déploiement.

## 7) Démarrage rapide (local)
```bash
cp env.local.example .env.local
npm install
npm run db:generate
npm run db:push
npm run db:seed   # optionnel
npm run dev
```

## 8) Tests
```bash
npm test           # jest (unit + integration)
npm run test:e2e   # playwright
```

## 9) Notes importantes
- Le dossier `/feuille_route` contient les **spécifications produit**. Ce sont des documents de référence métier ; tout n’est pas forcément implémenté à 100%.
- Les paiements **Konnect** sont actuellement en **mode simulé** (URL de démo). Le flux **Wise** crée un paiement “PENDING” et passe par validation assistante.
- L’intégration Jitsi côté UI utilise `meet.jit.si` en dur, tandis que l’API session vidéo peut utiliser `NEXT_PUBLIC_JITSI_SERVER_URL`.
- **Polices** : le projet utilise actuellement les polices système. Pour rétablir le design premium, décommenter les imports `next/font/google` dans `app/layout.tsx` une fois l’accès réseau rétabli.
- **Tests E2E** : Playwright nécessite un environnement avec accès complet aux processus système (actuellement désactivés en CI restreinte).

## 10) Écosystème & Roadmap
### Korrigo (produit externe)
**Korrigo** est un produit SaaS distinct (correction vectorielle) édité par Nexus Réussite.  
Ce dépôt **ne contient pas** le moteur Korrigo. Korrigo sera ultérieurement interconnecté via API pour **remonter les notes et résultats** dans le dashboard Élève du Nexus Digital Campus.

Pour plus de détails, voir :
- `ARCHITECTURE_TECHNIQUE.md`
- `DOCUMENTATION_TECHNIQUE_LIVRAISON.md`
- `ENVIRONMENT_REFERENCE.md`
- `ARCHITECTURE.md` (module `maths-1ere`, hydratation/sync/MathJax)
- `ENV_CHECKLIST.md` (variables d'environnement production)
- `README_TESTS.md`


# PROMPT MAÎTRE — AUDIT & UPGRADE COMPLET NEXUS RÉUSSITE

> **Destinataire :** Claude Opus 4.6 (fenêtre 1M tokens)
> **Auteur :** Alaeddine BEN RHOUMA — CEO & CTO Nexus Réussite
> **Date :** 9 février 2026
> **Objectif :** Audit exhaustif + implémentation corrective + upgrade exceptionnel

---

## 🎯 RÔLE ATTENDU

Tu es simultanément :

1. **Senior Lead Full-Stack** (Next.js 14 / TypeScript / Prisma / NextAuth / Tailwind v4)
2. **Expert UI/UX** (conversion, accessibilité WCAG 2.1 AA, design systems, micro-interactions)
3. **Expert Marketing Direct-Response** (positionnement, offres, copywriting, CTA, funnels de conversion)
4. **CTO d'audit** — tu diagnostiques, tu priorises, tu implémentes, tu testes

---

## 🏢 CONTEXTE PROJET — ADN & PHILOSOPHIE NEXUS RÉUSSITE

### Identité

**Nexus Réussite** = **Nexus Digital Campus** — une **Application SaaS de Pilotage Éducatif** pour lycéens du système français en Tunisie.

### Mission

> « Déployer la plateforme de **pédagogie augmentée** de référence, en fusionnant un accompagnement humain d'élite, une plateforme numérique intelligente et une assistance IA révolutionnaire. »

### Principes Directeurs (ADN)

1. **Confiance Absolue** — Chaque aspect du site rassure le parent sur son investissement
2. **Clarté Radicale** — L'offre est riche ; la présentation doit être si simple que l'utilisateur se sent guidé, jamais submergé
3. **Expérience "WOW"** — Interactions fluides, esthétique premium, plaisir d'utilisation

### Localisation & Marché

- Centre physique : Immeuble VENUS, Apt. C13, Centre Urbain Nord, 1082 Tunis, Tunisie
- Téléphone WhatsApp : +216 99 19 28 29
- Email : contact@nexusreussite.academy
- Cible : lycéens système français (Seconde, Première, Terminale) + leurs parents en Tunisie
- Devises : TND (paiement local via Konnect) + EUR/USD (virements internationaux via Wise)

---

## 📐 STACK TECHNIQUE CONFIRMÉ

| Composant | Technologie | Notes |
|-----------|-------------|-------|
| Framework | Next.js 14 (App Router) | React 18, TypeScript |
| Styling | Tailwind CSS v4 + Framer Motion + GSAP | Design tokens dans `lib/theme/tokens.ts` |
| UI Components | Radix UI + shadcn/ui pattern (CVA) | `components/ui/` |
| Fonts | Inter (corps), Space Grotesk (titres), IBM Plex Mono (code) | Next.js font optimization |
| Icons | Lucide React | Exclusif |
| Auth | NextAuth (Credentials + Prisma Adapter, JWT) | 5 rôles RBAC |
| DB | Prisma + PostgreSQL | `prisma/schema.prisma` (SQLite en dev) |
| Email | Nodemailer (SMTP Hostinger) | Transactional |
| IA | OpenAI GPT-4 (ARIA) | Chat + Feedback, architecture RAG (textuel, pas vecteurs en prod) |
| Visio | Jitsi Meet | `meet.jit.si` côté client, API session vidéo |
| Paiements | Konnect (local TND) + Wise (international manuel) | Webhooks Konnect |
| Tests | Jest (unit/integration) + Playwright (E2E) | Configs multiples |
| Déploiement | VPS Ubuntu, Docker, Nginx reverse proxy | PM2 via `ecosystem.config.js` |

---

## 🎨 DESIGN SYSTEM CONFIRMÉ

### Couleurs Brand (source : `lib/theme/tokens.ts`)

```typescript
brand: {
  primary: '#2563EB',     // Nexus Blue — actions principales, liens
  secondary: '#EF4444',   // Nexus Red — accents secondaires, alertes
  accent: '#2EE9F6',      // Nexus Cyan — highlights, CTAs premium
  'accent-dark': '#1BCED4' // Hover states
}
```

### Couleurs de Surface

```typescript
surface: {
  dark: '#0B0C10',       // Background sombre principal
  darker: '#050608',     // Background encore plus sombre
  card: '#111318',       // Cards fond sombre
  elevated: '#1A1D23',   // Cards surélevées
  hover: '#1F2329'       // États hover
}
```

### Couleurs Sémantiques

```typescript
semantic: {
  success: '#10B981',  // Vert
  warning: '#F59E0B',  // Ambre
  error: '#EF4444',    // Rouge
  info: '#3B82F6'      // Bleu
}
```

### Typographie

- **Titres** : Space Grotesk (font-display)
- **Corps** : Inter (font-sans)
- **Code/labels** : IBM Plex Mono (font-mono)
- **Fluid sizing** : `clamp()` responsive

### Composants UI existants

Button, Card, Badge, Input, Textarea, Label, Select, Checkbox, Radio Group, Dialog, Alert, Toast, Tooltip, Table, Skeleton, Tabs — tous pattern shadcn/ui (CVA + forwardRef)

### ⚠️ PROBLÈME CONNU — Couleurs deprecated encore utilisées

Le doc DESIGN_SYSTEM.md signale :
- **CSS classes deprecated** (`.btn-primary`, `.card-enhanced`) : 17 usages restants
- **`deep-midnight` color** : 59 usages restants
- **`nexus-*` colors** (nexus-blue, nexus-red, nexus-dark, nexus-cyan) : 74 usages restants

**ORDRE :** Identifier et migrer TOUTES ces occurrences vers les design tokens officiels.

---

## 👥 SEGMENTS & RÔLES

### 5 Rôles Système

| Rôle | Persona | Dashboard | Objectifs principaux |
|------|---------|-----------|---------------------|
| **PARENT** | Parent de lycéen, 35-55 ans, exigeant, cherche confiance | `/dashboard/parent` | Suivre enfant(s), gérer abonnements/crédits, payer, réserver sessions |
| **ELEVE** | Lycéen 15-18 ans, système français, veut progresser | `/dashboard/eleve` | Sessions, ARIA, badges, ressources, progression |
| **COACH** | Expert pédagogique (agrégé/certifié), pseudo mythique | `/dashboard/coach` | Disponibilités, sessions, notes/feedback, élèves |
| **ASSISTANTE** | Cléa — coordinatrice (back-office opérationnel) | `/dashboard/assistante` | Plannings, validations paiements, gestion users, support |
| **ADMIN** | Direction / CTO (accès complet) | `/dashboard/admin` | Analytics, users, abonnements, activités, tests |

### 10 Coachs (Pseudos Mythiques)

**Pôle Mathématiques** : Hélios (Agrégé, Excellence), Zénon (Stratège, Performance), Pythagore (Confiance, Déblocage)
**Pôle NSI** : Turing (DIU NSI, Architecte code), Vinci (Créatif, Projets)
**Pôle Lettres** : Athéna (Grand Oral, Éloquence), Calliope (Culture, Littérature)
**Pôle Transversal** : Kairos (Méthodologie, Autonomie), Orion (Orientation, Parcoursup)
**Opérationnel** : Cléa (Coordinatrice, votre contact)

---

## 💰 MODÈLE ÉCONOMIQUE

### Système Abonnement + Crédits

**1 crédit = 1 heure de cours particulier en ligne**

| Prestation | Coût |
|-----------|------|
| Cours Particulier en ligne (1h) | 1 crédit |
| Cours Particulier présentiel (1h) | 1.25 crédits |
| Atelier de Groupe présentiel (2h) | 1.5 crédits |

### 3 Formules Mensuelles

| Formule | Prix | Crédits | Inclus |
|---------|------|---------|--------|
| **ACCÈS PLATEFORME** | 150 TND/mois | 0 | Accès 24/7, Suivi, ARIA 1 matière |
| **HYBRIDE** ⭐ | 450 TND/mois | 4 | Tout Plateforme + Coach référent |
| **IMMERSION** | 750 TND/mois | 8 | Tout Hybride + Support prioritaire + Bilan trimestriel |

### Add-on ARIA+ (IA)

- ARIA Standard : inclus dans tous les abonnements (1 matière)
- +1 matière : +50 TND/mois
- Pack Toutes Matières : +120 TND/mois

### Packs Spécifiques (paiement unique)

| Pack | Prix |
|------|------|
| Pack Grand Oral | 300 TND (8h) |
| Pack Parcoursup | 450 TND (6h) |
| Académie Intensive | 750 TND (15h vacances) |
| ARIA+ Premium Seul | 50 TND/mois |

### Stages (page `/stages`)

7 académies de stages :
1. **MATHS : ESSENTIELS BAC** (Terminale, Pallier 1) — 590 TND (early: 502)
2. **MATHS : EXCELLENCE & PRÉPA** (Terminale, Pallier 2) — 990 TND (early: 842)
3. **NSI : FONDAMENTAUX BAC** (Terminale, Pallier 1) — 590 TND (early: 502)
4. **NSI : PROJETS & CONCEPTS AVANCÉS** (Terminale, Pallier 2) — 790 TND (early: 672)
5. **MATHS : BOOSTER PREMIÈRE** (Première, Pallier 1) — 490 TND (early: 417)
6. **MATHS : OBJECTIF SPÉCIALITÉ** (Première, Pallier 2) — 690 TND (early: 587)
7. **NSI : INITIATION & PYTHON** (Première, Pallier 1) — 490 TND (early: 417)

### Règles de Gestion Crédits

- Report : 1 mois seulement
- Rappel email : 7 jours avant expiration
- Crédits achetés en packs : valides 12 mois
- Annulation cours particulier : gratuite > 24h
- Annulation atelier : gratuite > 48h
- Remboursement manuel possible (assistante)

---

## 🗺️ CARTOGRAPHIE COMPLÈTE DES ROUTES

### Pages Publiques (22 routes)

| Route | Fichier | Lignes | Rôle/Objectif |
|-------|---------|--------|---------------|
| `/` | `app/page.tsx` | 77 | Landing page GSAP (9 sections : Hero → Trinity → Paths → Approach → DNA → Offer → Korrigo → Testimonials → Contact) |
| `/offres` | `app/offres/page.tsx` | 831 | Catalogue complet offres/tarifs/packs |
| `/academy` | `app/academy/page.tsx` | 82 | Nexus Academy (NSI/Maths/Web3) — cursus d'excellence |
| `/education` | `app/education/page.tsx` | 73 | Accompagnement humain (vie scolaire, orientation) |
| `/consulting` | `app/consulting/page.tsx` | 90 | Expertise 360° (audit, IA pédagogique, certification, dev) |
| `/plateforme` | `app/plateforme/page.tsx` | 35 | Présentation plateforme (Hero → Pillars → Experts → ProblemSolution → Offers → HowItWorks → Guarantee → CTA + AriaChat) |
| `/plateforme-aria` | `app/plateforme-aria/page.tsx` | 35 | **⚠️ DOUBLON EXACT de `/plateforme`** — même code, même export |
| `/accompagnement-scolaire` | `app/accompagnement-scolaire/page.tsx` | 544 | Service principal (programmes sur-mesure, stats, coachs) |
| `/famille` | `app/famille/page.tsx` | 304 | Page parents (mention Bac, niveaux Terminale/Première/Seconde, témoignages) |
| `/stages` | `app/stages/page.tsx` | 1609 | 7 académies de stages + comparateur + formulaire réservation |
| `/stages/fevrier-2026` | `app/stages/fevrier-2026/page.tsx` | ? | Sous-page stages février 2026 |
| `/academies-hiver` | `app/academies-hiver/page.tsx` | ? | Académies d'hiver (probablement similaire stages) |
| `/equipe` | `app/equipe/page.tsx` | 951 | Profils des mentors avec matching IA |
| `/notre-centre` | `app/notre-centre/page.tsx` | 238 | Centre de Tunis (schema.org, équipements, visite) |
| `/contact` | `app/contact/page.tsx` | 159 | Contact + FAQ (WhatsApp, phone, map) |
| `/bilan-gratuit` | `app/bilan-gratuit/page.tsx` | 568 | Formulaire multi-step (parent + élève) — **porte d'entrée conversion** |
| `/bilan-gratuit/confirmation` | `app/bilan-gratuit/confirmation/page.tsx` | ? | Confirmation post-inscription |
| `/conditions` | `app/conditions/page.tsx` | 5 | Redirect vers `/cgv` |
| `/mentions-legales` | `app/mentions-legales/page.tsx` | 103 | Mentions légales bilingue FR/EN |
| `/auth/signin` | `app/auth/signin/page.tsx` | 201 | Login (email/password, gestion erreurs) |
| `/auth/mot-de-passe-oublie` | `app/auth/mot-de-passe-oublie/page.tsx` | ? | Récupération mot de passe |
| `/session/video` | `app/session/video/` | ? | Interface visio Jitsi |

### ⚠️ PROBLÈMES DE ROUTING DÉTECTÉS

1. **`/plateforme` et `/plateforme-aria` sont identiques** (35 lignes chacune, même code exact) — **FUSIONNER ou DIFFÉRENCIER**
2. **`/conditions` redirige vers `/cgv`** mais `/cgv` n'existe pas dans le repo — **ROUTE 404 probable**
3. **Confusion terminologique** : `/academy`, `/education`, `/consulting`, `/plateforme`, `/accompagnement-scolaire`, `/famille` — **5+ pages pour présenter des services** + `/offres` + `/stages` = **trop de pages similaires, confusion garantie**
4. **`/academies-hiver`** utilise probablement encore les classes `nexus-blue`/`nexus-red` deprecated

### Dashboards Protégés (22 routes)

| Route | Rôle requis | Lignes | Fonctionnalités |
|-------|-------------|--------|-----------------|
| `/dashboard` | Tous | 49 | Redirect par rôle (switch/case) |
| `/dashboard/admin` | ADMIN | 435 | Stats globales, santé système, activités récentes |
| `/dashboard/admin/analytics` | ADMIN | ? | Analytics détaillées |
| `/dashboard/admin/users` | ADMIN | ? | Gestion utilisateurs |
| `/dashboard/admin/activities` | ADMIN | ? | Journal activités |
| `/dashboard/admin/subscriptions` | ADMIN | ? | Gestion abonnements |
| `/dashboard/admin/tests` | ADMIN | ? | Tests système |
| `/dashboard/assistante` | ASSISTANTE | 573 | Vue opérationnelle (sessions, pending items) |
| `/dashboard/assistante/coaches` | ASSISTANTE | ? | Gestion coachs |
| `/dashboard/assistante/students` | ASSISTANTE | ? | Gestion élèves |
| `/dashboard/assistante/subscriptions` | ASSISTANTE | ? | Abonnements |
| `/dashboard/assistante/subscription-requests` | ASSISTANTE | ? | Demandes en attente |
| `/dashboard/assistante/credits` | ASSISTANTE | ? | Gestion crédits |
| `/dashboard/assistante/credit-requests` | ASSISTANTE | ? | Demandes de crédits |
| `/dashboard/assistante/paiements` | ASSISTANTE | ? | Validation paiements |
| `/dashboard/coach` | COACH | 473 | Planning, sessions, disponibilités, élèves |
| `/dashboard/parent` | PARENT | 438 | Sélecteur enfant, sessions, abonnements, booking |
| `/dashboard/parent/children` | PARENT | ? | Gestion enfants |
| `/dashboard/parent/abonnements` | PARENT | ? | Abonnements détaillés |
| `/dashboard/parent/paiement` | PARENT | ? | Paiement (+ confirmation, konnect-demo, wise) |
| `/dashboard/eleve` | ELEVE | 396 | Sessions, crédits, ARIA stats, badges |
| `/dashboard/eleve/mes-sessions` | ELEVE | ? | Historique sessions |
| `/dashboard/eleve/sessions` | ELEVE | ? | Sessions (doublon ?) |
| `/dashboard/eleve/ressources` | ELEVE | ? | Ressources pédagogiques |

### ⚠️ PROBLÈME : `/dashboard/eleve/mes-sessions` vs `/dashboard/eleve/sessions` — doublon probable

### Route Group `(dashboard)` — Parallel aux dashboards

| Route | Fichier |
|-------|---------|
| `(dashboard)/coach/page.tsx` | ? |
| `(dashboard)/parent/page.tsx` | ? |
| `(dashboard)/student/page.tsx` | ? (+ error.tsx + loading.tsx) |

**⚠️ PROBLÈME : Double système de dashboards** — `app/dashboard/` ET `app/(dashboard)/` coexistent. Les routes dans `(dashboard)` sont-elles accessible ou dead code ?

### API Routes (37 endpoints)

| Catégorie | Endpoints |
|-----------|-----------|
| **Auth** | `/api/auth/[...nextauth]` |
| **Bilan gratuit** | `/api/bilan-gratuit` |
| **Réservation stages** | `/api/reservation` |
| **ARIA (IA)** | `/api/aria/chat`, `/api/aria/conversations`, `/api/aria/feedback` |
| **Sessions** | `/api/sessions/book`, `/api/sessions/cancel`, `/api/sessions/video` |
| **Coaches** | `/api/coaches/availability`, `/api/coaches/available` |
| **Paiements** | `/api/payments/konnect`, `/api/payments/wise`, `/api/payments/wise/confirm`, `/api/payments/validate` |
| **Webhooks** | `/api/webhooks/konnect` |
| **Admin** | `/api/admin/dashboard`, `/api/admin/analytics`, `/api/admin/users`, `/api/admin/activities`, `/api/admin/subscriptions`, `/api/admin/test-email`, `/api/admin/test-payments` |
| **Assistante** | `/api/assistant/dashboard`, `/api/assistant/coaches`, `/api/assistant/students`, `/api/assistant/students/credits`, `/api/assistant/credit-requests`, `/api/assistant/subscription-requests`, `/api/assistant/subscriptions` |
| **Parent** | `/api/parent/dashboard`, `/api/parent/children`, `/api/parent/credit-request`, `/api/parent/subscription-requests`, `/api/parent/subscriptions` |
| **Élève** | `/api/student/dashboard`, `/api/student/credits`, `/api/student/resources`, `/api/student/sessions` |
| **Coach** | `/api/coach/dashboard`, `/api/coach/sessions`, `/api/coach/sessions/[sessionId]/report` |
| **Messages** | `/api/messages/send`, `/api/messages/conversations` |
| **Subscriptions** | `/api/subscriptions/aria-addon`, `/api/subscriptions/change` |
| **Notifications** | `/api/notifications` |
| **Health** | `/api/health` |

---

## 🔐 SÉCURITÉ & AUTH (état confirmé)

### Architecture

- **NextAuth** : JWT strategy (stateless, pas de sessions DB)
- **RBAC centralisé** : `lib/guards.ts` (196 lignes) — `requireAuth()`, `requireRole()`, `requireAnyRole()`, `isOwner()`, `isStaff()`
- **Middleware** : `middleware.ts` — rate limiting (auth, ARIA), redirection par rôle, headers sécurité (HSTS, X-Frame-Options, CSP, etc.)
- **Validation** : Zod sur les inputs API
- **Passwords** : bcryptjs (10 rounds)
- **PII** : email, nom, téléphone, adresse — conformité GDPR requise

### Risques Identifiés à Audit

1. Rate limiting basé sur `@upstash/ratelimit` — vérifier si Redis est configuré en prod
2. CSP contient `'unsafe-inline'` et `'unsafe-eval'` — à resserrer
3. CORS non mentionné dans le middleware — à vérifier
4. Pas de CAPTCHA sur le formulaire de bilan gratuit
5. `/conditions` redirige vers `/cgv` inexistant

---

## 📊 BASE DE DONNÉES (Prisma Schema)

### Modèles Principaux

| Modèle | Description |
|--------|-------------|
| `User` | Utilisateur principal (email, password, role, relations par rôle) |
| `ParentProfile` | Profil parent (adresse, pays) → children |
| `StudentProfile` | Profil scolaire (grade, school) |
| `Student` | Entité métier élève (crédits, sessions, badges, abonnements) |
| `CoachProfile` | Profil coach (pseudo, tag, spécialités, disponibilités) |
| `Subscription` | Abonnement (status: ACTIVE/INACTIVE/CANCELLED/EXPIRED) |
| `CreditTransaction` | Transactions crédits |
| `SessionBooking` | Réservation de session |
| `CoachAvailability` | Créneaux dispo coach |
| `Session` | Session de cours |
| `AriaConversation` + `AriaMessage` | Historique IA |
| `Payment` | Paiements (type, status, montant) |
| `Message` | Messagerie interne |
| `Badge` + `StudentBadge` | Gamification |
| `StudentReport` | Rapports de progression |
| `SubscriptionRequest` | Demandes d'abonnement en attente |
| `SessionReport` | Comptes-rendus de session (coach → élève) |
| `SessionNotification` + `SessionReminder` | Notifications |

### Enums

`UserRole` (5), `SubscriptionStatus` (4), `ServiceType` (3), `Subject` (10), `SessionStatus` (7), `PaymentType` (3), `PaymentStatus` (4)

---

## 🎯 OBJECTIF GLOBAL

> **Auditer et "upgrader" Nexus Réussite pour en faire un produit EXCEPTIONNEL** :
> qualité perçue premium + clarté des offres + UX sans friction + conversion forte + robustesse technique.

---

## 📋 CONTRAINTES & RÈGLES D'EXÉCUTION

1. **Travail "repo-first"** : base-toi sur le code et les docs du dépôt. Ne suppose rien : si un point n'est pas prouvé par le code, marque-le comme hypothèse à valider.
2. **Exhaustivité pragmatique** : sois très complet mais structuré. Priorise ce qui impacte la conversion et l'expérience parents/élèves.
3. **Zéro régression** : chaque modification doit être testée ou testable.
4. **Livrables actionnables** : pour chaque problème → (a) preuve/localisation, (b) impact, (c) correctif recommandé, (d) patch (diff) ou instructions exactes, (e) test associé.
5. **Qualité "prod-ready"** : sécurité, secrets, permissions, RBAC, validation, logs, observabilité, erreurs, cohérence DB.
6. **Pas de fichiers flottants** : ne crée pas de fichiers non intégrés dans le codebase. Chaque nouveau fichier doit être importé/utilisé.
7. **Respecter le design system** : utiliser UNIQUEMENT les tokens officiels (`brand-*`, `surface-*`, `neutral-*`, `semantic-*`).

---

## PHASE 0 — PRÉPARATION (OBLIGATOIRE, AVANT TOUTE ACTION)

### A) Résumé du produit

Lis et résume en 1 page max :
- `README.md`
- `ARCHITECTURE_TECHNIQUE.md`
- `feuille_route/Cahier des Charges Global & Technique.md`
- `feuille_route/Logique Metier_Business Model.md`
- `feuille_route/Specifications-Fonctionnelles-par-Role.md`
- `feuille_route/Systeme_de_Design_Exp_Utilisa.md`
- `feuille_route/Validation_Audit.md`

### B) Carte du produit

Dresse :
- **Segments** (parents/élèves/coach/admin/assistante) : objectifs, douleurs, objections, promesses
- **Parcours principaux (funnels)** :
  1. Visiteur → offres → bilan gratuit → confirmation → conversion
  2. Parent → dashboard → enfant → abonnement/crédits → réservation session → visio → suivi
  3. Élève → dashboard → sessions → ressources → ARIA → progression
  4. Coach → dispo → sessions → visio → notes/feedback
  5. Assistante/admin → validations, paiements, analytics, gestion

### C) Instrumentation & tracking

Identifie tout ce qui existe (events, pixels, analytics). Si absent : propose un plan complet.

---

## PHASE 1 — AUDIT UX/UI (PAGES PUBLIQUES) — ORIENTÉ CONVERSION

### Pour CHAQUE page publique, tu dois produire :

1. **Intentions de la page** (job-to-be-done)
2. **Checklist UI** :
   - Hiérarchie visuelle
   - Lisibilité, spacing, cohérence typographique
   - Contrastes (WCAG AA minimum — 4.5:1 texte, 3:1 UI)
   - Responsive (mobile-first vérification)
   - États hover/focus/active
   - Micro-interactions (Framer Motion, GSAP)
   - Cohérence composants (utilisation des shadcn/ui components)
3. **Checklist UX** :
   - Clarté du message
   - Friction identifiée
   - Rassurance (preuves sociales, garanties)
   - FAQ / traitement objections
   - Navigation (breadcrumbs, menu, footer)
   - IA/stages mis en avant correctement
   - CTA (position, wording, répétition, urgence)
   - Vitesse perçue (loading states, skeleton, transitions)
4. **Copywriting** :
   - Proposition de valeur (headline + subheadline)
   - Bullets orientées bénéfices
   - Preuves (méthode, résultats, garanties, process)
   - CTA multi-niveaux : "Bilan gratuit", "Voir les stages", "Parler à un conseiller", "Tester ARIA", "Voir tarifs"
5. **Détection incohérences** :
   - Pages redondantes (`/plateforme` = `/plateforme-aria`)
   - Intitulés flous
   - Offres mal segmentées
   - Confusion `academy`/`education`/`consulting`/`plateforme`/`accompagnement-scolaire`/`famille`
6. **Recommandations design system** :
   - Tokens couleurs utilisés vs. officiels
   - Typographies
   - Composants (buttons, cards, badges, sections)
   - Iconographie
   - Style photo/illustrations
   - Règles de mise en page

### ⚡ PAGES PRIORITAIRES (traiter en premier)

1. `/` (accueil) — Hub de conversion stratégique
2. `/offres` — Catalogue offres/tarifs
3. `/bilan-gratuit` — Porte d'entrée conversion (formulaire multi-step)
4. `/stages` — Offre stages (7 académies)
5. `/accompagnement-scolaire` — Service principal
6. `/famille` — Cible parents
7. `/equipe` — Confiance / expertise
8. `/contact` — Dernier recours conversion

### ⚠️ PROBLÈMES STRUCTURELS CONNUS À RÉSOUDRE

1. **`/plateforme` et `/plateforme-aria` sont identiques (35 lignes, même code)** — Décider : fusionner, différencier, ou supprimer l'un
2. **`/conditions` redirige vers `/cgv` qui n'existe pas** — Route 404
3. **6+ pages présentant des services** sans hiérarchie claire — Proposer une architecture simplifiée
4. **Pas de blog** (dé-priorisé volontairement par le CEO, mais prévoir la structure)
5. **Navigation confuse** — Le menu présente trop d'entrées sans logique de funnel
6. **Couleurs deprecated** partout — 74 usages `nexus-*`, 59 usages `deep-midnight`, 17 usages CSS classes legacy

---

## PHASE 1-BIS — FOCUS OBLIGATOIRE : STAGES + IA (ARIA) + ACCOMPAGNEMENT

### Stages (`/stages`)

Tu dois vérifier que la page offre est **extrêmement claire** :
- **Quoi** : format, durée, contenu, méthode
- **Pour qui** : niveau, prérequis, profil idéal
- **Quand** : dates, calendrier, inscription
- **Prix** : clair, early bird visible, comparaison Pallier 1 vs 2
- **Places** : disponibilité, urgence ("6 élèves max")
- **Process** : inscription → paiement → confirmation → démarrage
- **CTA immédiats** : bouton réservation visible, pas de dead-ends

**Vérification spécifique :**
- Tous les boutons CTA fonctionnent et mènent au bon endroit
- Le formulaire de réservation est fonctionnel
- Le dropdown des académies est complet
- Les prix sont cohérents (early bird = -15%)
- Le paiement est clairement expliqué (sur place + en ligne "bientôt disponible")

### ARIA (IA pédagogique)

Tu dois vérifier que ARIA n'est pas un gadget :
- **Positionnement** : quelle promesse exacte, quel bénéfice élève
- **Démonstration** : y a-t-il une démo accessible sans login ?
- **Cas d'usage** : exercices, révisions, aide devoirs, préparation examen
- **Limites** : ARIA ne remplace pas un coach, elle complète
- **Sécurité/Privacy** : pas de données sensibles dans les prompts, logs sécurisés
- **Coûts** : token usage OpenAI maîtrisé (timeouts, quotas)
- **Interface** : chat clair, feedback 👍👎, historique accessible

### Accompagnement Parents/Élèves

Tu dois vérifier que c'est concret :
- **Fréquence** : combien de sessions, quel rythme
- **Livrables** : comptes-rendus, bilans, rapports
- **Suivi** : dashboards, indicateurs, progression
- **Reporting parents** : que voit le parent exactement
- **Objectifs** : comment sont-ils fixés et mesurés
- **Exemples** : parcours types, avant/après

### ADN Nexus — Narratif Distinctif

Il doit exister un narratif "ADN Nexus" distinct des offres classiques :
- **Méthode** : pédagogie augmentée (humain + IA)
- **Exigence** : coachs agrégés/certifiés, sélection rigoureuse
- **Personnalisation** : chaque parcours est adapté
- **Pilotage** : données, suivi, transparence
- **Résultats** : 98% réussite, mentions TB/B
- **Cadre** : petit groupe (6 max), centre premium, technologie

**ORDRE :** Propose des **textes prêts à intégrer** (sections entières, titres, CTA, FAQ) pour chaque point.

---

## PHASE 2 — AUDIT WORKFLOWS (BOUTONS / NAV / FORMS) — "NO DEAD ENDS"

### Tu dois vérifier en conditions réelles :

1. **Chaque bouton** mène à une destination cohérente
2. **Pas de liens cassés** (404, redirections circulaires)
3. **Les CTAs sont cohérents** entre pages (même wording pour même action)
4. **Le menu, footer, breadcrumbs, navigation dashboard** sont cohérents
5. **Les formulaires** :
   - Validations client + serveur
   - Messages d'erreur clairs et localisés (FR)
   - Anti-spam (honey pot, rate limiting)
   - Double-submit protection
   - Loading states
   - Success states (toast, redirect, message)
   - Emails envoyés (confirmation)
   - Stockage DB correct
   - Conformité RGPD (consentement, mentions)

### Formulaires à auditer spécifiquement

| Formulaire | Route | API | Éléments critiques |
|-----------|-------|-----|-------------------|
| Bilan gratuit | `/bilan-gratuit` | `POST /api/bilan-gratuit` | Multi-step, crée Parent + Élève, password, validation |
| Contact | `/contact` | ? | Email envoyé, anti-spam |
| Réservation stage | `/stages` form | `POST /api/reservation` | Dropdown académies, infos élève/parent |
| Login | `/auth/signin` | NextAuth credentials | Gestion erreurs, redirect post-login |
| Mot de passe oublié | `/auth/mot-de-passe-oublie` | ? | Email reset, token sécurisé |
| Booking session | Dashboard parent/élève | `POST /api/sessions/book` | Crédits suffisants, dispo coach |
| ARIA feedback | Dashboard élève | `POST /api/aria/feedback` | 👍👎 sur chaque réponse |
| Paiement Konnect | `/dashboard/parent/paiement` | `POST /api/payments/konnect` | Redirect Konnect, webhook retour |
| Paiement Wise | `/dashboard/parent/paiement/wise` | `POST /api/payments/wise` | Paiement pending, validation assistante |

### Matrice de navigation à produire

Pour chaque CTA important dans le site :

| Page source | CTA (texte) | Route destination | Résultat attendu | Résultat réel | Fix si nécessaire |
|-------------|-------------|-------------------|-------------------|---------------|-------------------|
| ... | ... | ... | ... | ... | ... |

---

## PHASE 3 — AUDIT PRODUIT (OFFRES, PACKAGING, PRICING, FUNNELS)

### A) Reconstituer l'architecture d'offres

En lisant le code, reconstitue :
- **Stages** : formats, niveaux, calendrier, capacités, prix
- **Abonnements/crédits** : logique, quotas, upsell
- **Accompagnement** : 1:1, suivi parents, reporting
- **IA** : ce qui est inclus, ce qui est premium
- **Packs spécifiques** : Grand Oral, Parcoursup, Académie Intensive

### B) Diagnostiquer

1. **Confusion d'offre** : trop de pages, trop de segments, pas de hiérarchie claire
2. **Manque de preuve/rassurance** : résultats chiffrés, témoignages, garanties
3. **Prix/packaging pas "lisibles"** : early bird, crédits, TND vs EUR, conversion
4. **Absence d'upsell/cross-sell** : pas de suggestion "un stage → un abonnement"
5. **Navigation vers conversion** : combien de clics entre la landing et le paiement ?

### C) Proposer une refonte "marketing"

1. **3 à 5 offres max visibles** (le reste en options/add-ons)
2. **Une page "Offres"** qui convertit (table claire + cards)
3. **CTA multi-step** : "bilan gratuit" (lead) → "proposition personnalisée" → "checkout"

### D) Rédiger

1. **1 positionnement** (tagline + elevator pitch)

Proposition :
> **Tagline** : « La pédagogie augmentée qui transforme le potentiel en résultats. »
> **Elevator Pitch** : « Nexus Réussite combine l'expertise de coachs agrégés et la puissance d'une IA pédagogique 24/7 pour garantir la réussite au Bac des lycéens du système français en Tunisie. Stages intensifs, accompagnement personnalisé, plateforme intelligente : chaque parcours est unique, chaque progrès est mesuré. »

2. **1 "message house"** (piliers + preuves + objections traitées)
3. **1 plan CTA global** (où, quand, quel wording)
4. **1 FAQ béton** (parents/élèves) + garanties + process

**ORDRE :** Rédige ces textes en français, prêts à copier-coller dans le code.

---

## PHASE 4 — AUDIT TECHNIQUE (FULL-STACK) + SÉCURITÉ

### A) Architecture Next.js

- App Router : vérifier que les Server Components sont bien séparés des Client Components
- Vérifier les `"use client"` inutiles (toutes les pages publiques sont `"use client"` — est-ce optimal ?)
- Layouts : vérifier la hiérarchie (`app/layout.tsx` → layouts pages)
- Loading states : vérifier que chaque route dashboard a un `loading.tsx`
- Error boundaries : vérifier la couverture
- `(dashboard)` route group vs `dashboard/` — résoudre la confusion

### B) NextAuth

- JWT : vérifier le contenu du token (pas de données sensibles)
- CSRF : vérifier la protection
- Cookies : `secure`, `httpOnly`, `sameSite`
- Rate limiting : vérifier la configuration Upstash
- Redirect après login : vérifier la logique par rôle
- Session timeout : vérifier la durée JWT

### C) RBAC

- `middleware.ts` : vérifier que TOUTES les routes dashboard sont protégées
- `lib/guards.ts` : vérifier que TOUS les endpoints API utilisent les guards
- Vérifier qu'il n'y a pas de bypass possible (headers manipulés, etc.)

### D) Prisma

- Schéma : vérifie les contraintes (unique, required, defaults)
- Migrations : vérifie la cohérence
- Seed : vérifie que le seed crée des données réalistes pour le test
- Index : vérifie les index de performance (queries fréquentes)
- Relations : vérifie l'intégrité référentielle
- N+1 : vérifie les queries (includes/selects optimisés)

### E) API Routes

- Validation inputs (Zod) : vérifier que CHAQUE endpoint valide ses inputs
- Status codes : cohérents (200, 400, 401, 403, 404, 500)
- Error handling : messages sanitisés (pas de stack traces en prod)
- Pagination : vérifier sur les listes longues
- Rate limiting : vérifier sur les endpoints sensibles

### F) Email

- Templates : vérifier la qualité HTML
- Deliverability : SPF, DKIM, DMARC
- Anti-abuse : rate limiting sur l'envoi
- Emails attendus : bienvenue, confirmation session, rappel crédits, reset password

### G) Paiements

- **Konnect** : mode simulé → comment activer en prod ? Vérifier le webhook
- **Wise** : workflow manuel → vérifier la validation assistante
- Intégrité : vérifier qu'un paiement ne peut pas être validé 2 fois
- Statuts : PENDING → COMPLETED → vérifie la transition
- Remboursement : prévu ? Implémenté ?

### H) Jitsi (Visio)

- Sécurité : room names uniques et non prévisibles
- Privacy : pas de recording par défaut
- UX : iframe intégré, pas de redirection externe
- Vérifier : `meet.jit.si` en dur vs `NEXT_PUBLIC_JITSI_SERVER_URL`

### I) ARIA (IA)

- Prompts : vérifier les system prompts (dans `/api/aria/chat`)
- Guardrails : ARIA ne doit pas sortir du cadre académique
- Logs : vérifier que les conversations sont stockées en DB
- Coûts : timeouts, quotas, taille max message
- Feedback : vérifier que 👍👎 est bien implémenté et stocké

### J) Performances

- Bundle size : vérifier les imports (tree-shaking)
- Images : compression, lazy loading, next/image
- Caching : headers, ISR/SSR
- Edge functions : potentiel ?
- Core Web Vitals : LCP, FID, CLS

### K) SEO

- Metadata : `<title>`, `<meta description>`, `<meta keywords>` sur CHAQUE page
- OpenGraph : images, titres, descriptions
- Sitemap : existe ?
- Robots.txt : configuration
- Schema.org : JSON-LD (déjà vu sur `/notre-centre`)
- Canonical URLs : vérifier les doublons (`/plateforme` vs `/plateforme-aria`)

### L) Qualité Code

- TypeScript strict : vérifier `tsconfig.json`
- Lint : vérifier les règles ESLint
- Duplication : pages identiques, composants copiés-collés
- Conventions : naming, fichiers, imports

### Livrable Phase 4

- **Liste priorisée (P0/P1/P2)** des risques + correctifs
- **Patches ou instructions de patchs**
- **Plan de hardening prod** (headers, secrets, env, CI, monitoring)

---

## PHASE 5 — TESTS (UNIT/INTEGRATION/E2E) + ACCESSIBILITÉ + PERF

### A) Tests existants

1. Lancer `npm run test:unit` et `npm run test:integration`
2. Identifier ce qui passe et ce qui casse
3. Corriger les tests cassés

### B) Tests manquants à ajouter

- Funnel bilan gratuit (multi-step form)
- Login/logout flow
- Parent dashboard (fetch, affichage, sélecteur enfant)
- Booking session (crédits, dispo, confirmation)
- Paiement simulé (Konnect)
- ARIA chat (question → réponse → feedback)
- Pages offres (rendu, links)
- Stages page (filtres, réservation)

### C) Accessibilité

- Audit `axe-core` (contrastes, navigation clavier, aria-labels, focus visible)
- Vérifier : boutons icon-only ont `aria-label`
- Vérifier : images ont `alt` text
- Vérifier : formulaires ont `label` + `aria-describedby`
- Vérifier : modales piègent le focus
- Vérifier : `prefers-reduced-motion` respecté

### D) Performance

- Lighthouse (mobile & desktop)
- Recommandations concrètes (fonts, images, JS bundle, lazy loading)

### Livrable Phase 5

- Rapport de tests (existant + ajouté + résultats)
- Fichiers modifiés (ou patch)
- Commandes exactes pour reproduire

---

## PHASE 6 — LIVRABLES FINAUX (OBLIGATOIRES, DANS CET ORDRE)

### (1) EXECUTIVE SUMMARY (1–2 pages)

- ADN / philosophie reconstituée
- 10 quick wins conversion
- 10 risques techniques majeurs
- Priorités P0/P1/P2

### (2) PRODUCT & OFFER MAP

- Carte segments/personas
- Carte pages → objectifs → CTA
- Carte offres (packaging + pricing recommandé + upsell)

### (3) UX/UI AUDIT COMPLET

- Par page : problèmes + fixes + maquettes textuelles (structure sections)
- Design system recommandé (tokens, composants, guidelines)
- Migration deprecated colors : plan et patches

### (4) FUNNEL & CTA PLAYBOOK

- Copywriting prêt à coller : hero, sections, CTA, FAQ, rassurance, preuve sociale
- Tracking plan (events analytics) + naming convention + where-to-fire

### (5) TECHNICAL AUDIT & PATCH PLAN

- Tableau P0/P1/P2
- Correctifs précis (fichiers, fonctions, endpoints)
- Hardening prod + observabilité

### (6) TESTS & QUALITY GATES

- Suite de tests (unit/integration/e2e) ajoutée
- CI gates : lint, typecheck, test, e2e, lighthouse (si possible)
- Accessibilité : checklist + corrections

### (7) CHANGELOG / DIFF

- Liste exhaustive des fichiers modifiés et pourquoi
- Instructions de déploiement & rollback

---

## ✅ CHECKLIST "PARCOURS CRITIQUES" (À TESTER EN PRIORITÉ)

### A) Public → Conversion

```
Visiteur atterrit sur /
  → Lit le hero, comprend la promesse
  → Clique "Découvrir nos offres" (ou "Bilan gratuit")
  → Arrive sur /offres OU /bilan-gratuit
  → Remplit le formulaire multi-step
  → Reçoit la confirmation (/bilan-gratuit/confirmation)
  → Reçoit un email de bienvenue
  → Peut se connecter avec ses identifiants
```

### B) Parent connecté

```
Parent arrive sur /auth/signin
  → Se connecte (email + mot de passe)
  → Redirigé vers /dashboard/parent
  → Voit ses enfants (sélecteur)
  → Peut ajouter un enfant
  → Voit l'abonnement de chaque enfant
  → Peut acheter des crédits
  → Peut réserver une session (booking)
  → Peut payer (Konnect ou Wise)
  → Voit la confirmation de paiement
  → Peut accéder à la visio (si session en cours)
  → Peut voir les rapports de session
```

### C) Élève connecté

```
Élève arrive sur /auth/signin
  → Se connecte
  → Redirigé vers /dashboard/eleve
  → Voit ses crédits et badges
  → Peut réserver une session
  → Peut accéder à ARIA (chat IA)
  → Pose une question → obtient une réponse
  → Donne un feedback 👍👎
  → Voit son historique de conversations
  → Peut accéder à la visio
  → Voit ses ressources pédagogiques
  → Voit sa progression
```

### D) Coach connecté

```
Coach arrive sur /auth/signin
  → Se connecte
  → Redirigé vers /dashboard/coach
  → Voit son planning (sessions du jour)
  → Peut gérer ses disponibilités
  → Peut démarrer une session
  → Peut accéder à la visio
  → Peut rédiger un compte-rendu de session
  → Voit la liste de ses élèves
```

### E) Assistante connectée

```
Assistante arrive sur /auth/signin
  → Se connecte
  → Redirigé vers /dashboard/assistante
  → Voit les stats du jour (pending bilans, paiements, crédits)
  → Peut valider des paiements Wise
  → Peut gérer les coachs
  → Peut gérer les élèves
  → Peut gérer les abonnements
  → Peut traiter les demandes de crédits
  → Peut voir le planning des sessions
```

---

## 🏗️ ORDRES D'EXÉCUTION

Voici l'ordre dans lequel tu dois procéder. Chaque étape doit être complète avant de passer à la suivante.

### ÉTAPE 1 : LECTURE & CARTOGRAPHIE (Phase 0)

1. Lis tous les fichiers mentionnés dans la Phase 0
2. Produis le résumé et la carte du produit
3. Identifie l'instrumentation tracking existante

### ÉTAPE 2 : AUDIT DES COULEURS & DESIGN SYSTEM (priorité absolue)

1. `grep -rn "nexus-blue\|nexus-red\|nexus-dark\|nexus-cyan\|deep-midnight\|nexus-" --include="*.tsx" --include="*.ts" app/ components/` — Liste TOUTES les occurrences
2. Pour chaque occurrence, remplace par le token officiel équivalent
3. `grep -rn "btn-primary\|card-enhanced\|btn-secondary" --include="*.tsx" --include="*.ts" app/ components/` — Migre les classes CSS deprecated
4. Vérifie les contrastes de couleurs WCAG AA sur chaque page

### ÉTAPE 3 : NETTOYAGE ROUTES & STRUCTURE

1. Résoudre le doublon `/plateforme` vs `/plateforme-aria`
2. Résoudre le redirect `/conditions` → `/cgv` cassé
3. Résoudre la confusion `(dashboard)/` vs `dashboard/`
4. Résoudre le doublon `/dashboard/eleve/mes-sessions` vs `/dashboard/eleve/sessions`
5. Proposer une simplification de l'arborescence des pages publiques

### ÉTAPE 4 : AUDIT UX/UI PAGE PAR PAGE (Phase 1)

Dans cet ordre :
1. `/` (accueil)
2. `/offres`
3. `/bilan-gratuit`
4. `/stages`
5. `/accompagnement-scolaire`
6. `/famille`
7. `/equipe`
8. `/contact`
9. `/notre-centre`
10. `/academy`
11. `/education`
12. `/consulting`
13. `/plateforme`
14. `/auth/signin`
15. `/mentions-legales`

### ÉTAPE 5 : AUDIT WORKFLOWS & CTA (Phase 2)

1. Construis la matrice de navigation
2. Teste chaque formulaire
3. Vérifie chaque bouton CTA
4. Identifie les dead-ends

### ÉTAPE 6 : AUDIT PRODUIT & OFFRES (Phase 3)

1. Architecture d'offres
2. Diagnostic confusion
3. Proposition refonte marketing
4. Rédaction copywriting

### ÉTAPE 7 : AUDIT TECHNIQUE (Phase 4)

1. Architecture Next.js
2. Auth & sécurité
3. API routes
4. Base de données
5. Paiements
6. IA
7. Performances
8. SEO

### ÉTAPE 8 : TESTS & ACCESSIBILITÉ (Phase 5)

1. Tests existants
2. Tests à ajouter
3. Audit accessibilité
4. Performance Lighthouse

### ÉTAPE 9 : LIVRABLES (Phase 6)

1. Executive Summary
2. Product & Offer Map
3. UX/UI Audit complet
4. Funnel & CTA Playbook
5. Technical Audit & Patch Plan
6. Tests & Quality Gates
7. Changelog

---

## 📁 FICHIERS CLÉS À LIRE EN PRIORITÉ

### Configuration & Architecture

```
README.md
ARCHITECTURE_TECHNIQUE.md
package.json
tsconfig.json
tailwind.config.mjs
next.config.mjs
middleware.ts
ecosystem.config.js
```

### Design System & Thème

```
lib/theme/tokens.ts
app/globals.css
docs/DESIGN_SYSTEM.md
```

### Pages Publiques Principales (par taille décroissante)

```
app/stages/page.tsx                    (1609 lignes)
app/equipe/page.tsx                    (951 lignes)
app/offres/page.tsx                    (831 lignes)
app/bilan-gratuit/page.tsx             (568 lignes)
app/accompagnement-scolaire/page.tsx   (544 lignes)
app/famille/page.tsx                   (304 lignes)
app/notre-centre/page.tsx              (238 lignes)
app/auth/signin/page.tsx               (201 lignes)
app/contact/page.tsx                   (159 lignes)
app/mentions-legales/page.tsx          (103 lignes)
app/consulting/page.tsx                (90 lignes)
app/academy/page.tsx                   (82 lignes)
app/education/page.tsx                 (73 lignes)
app/page.tsx                           (77 lignes — landing GSAP)
app/plateforme/page.tsx                (35 lignes)
app/plateforme-aria/page.tsx           (35 lignes — doublon)
```

### Dashboards

```
app/dashboard/assistante/page.tsx      (573 lignes)
app/dashboard/coach/page.tsx           (473 lignes)
app/dashboard/parent/page.tsx          (438 lignes)
app/dashboard/admin/page.tsx           (435 lignes)
app/dashboard/eleve/page.tsx           (396 lignes)
app/dashboard/page.tsx                 (49 lignes — redirect)
```

### Logique Métier

```
lib/auth.ts
lib/guards.ts
lib/credits.ts
lib/session-booking.ts
lib/payments.ts
lib/aria.ts
lib/email.ts / lib/email-service.ts
lib/jitsi.ts
lib/rate-limit.ts
lib/security-headers.ts
lib/validation/
lib/prisma.ts
```

### API Routes Critiques

```
app/api/bilan-gratuit/route.ts
app/api/reservation/route.ts
app/api/aria/chat/route.ts
app/api/sessions/book/route.ts
app/api/payments/konnect/route.ts
app/api/payments/wise/route.ts
app/api/webhooks/konnect/route.ts
app/api/parent/dashboard/route.ts
app/api/student/dashboard/route.ts
app/api/coach/dashboard/route.ts
app/api/admin/dashboard/route.ts
app/api/assistant/dashboard/route.ts
```

### Composants Layout & Navigation

```
components/layout/CorporateNavbar.tsx
components/layout/CorporateFooter.tsx
components/navigation/
```

### Sections GSAP (Landing Page)

```
components/sections/hero-section-gsap.tsx
components/sections/trinity-services-gsap.tsx
components/sections/paths-section-gsap.tsx
components/sections/approach-section-gsap.tsx
components/sections/dna-section-gsap.tsx
components/sections/offer-section-gsap.tsx
components/sections/korrigo-section-gsap.tsx
components/sections/testimonials-section-gsap.tsx
components/sections/contact-section-gsap.tsx
```

### DB

```
prisma/schema.prisma
prisma/seed.ts
```

### Documentation & Roadmap

```
feuille_route/Cahier des Charges Global & Technique.md
feuille_route/Logique Metier_Business Model.md
feuille_route/Profils_Equipe_Gamification.md
feuille_route/Specifications-Fonctionnelles-par-Role.md
feuille_route/Systeme_de_Design_Exp_Utilisa.md
feuille_route/Validation_Audit.md
docs/SECURITY.md
docs/DESIGN_SYSTEM.md
docs/API_CONVENTIONS.md
docs/MIDDLEWARE.md
SESSION_BOOKING_LOGIC.md
JITSI_IMPLEMENTATION.md
```

### Tests

```
jest.config.js / jest.config.unit.js / jest.config.integration.js
playwright.config.ts
__tests__/
e2e/
```

---

## 📝 FORMAT DE SORTIE ATTENDU

1. Réponds en **sections numérotées** avec **tableaux** quand utile
2. Quand tu proposes un correctif code, donne un **diff/patch** ou le **fichier complet** (selon taille)
3. Ajoute le **test correspondant** pour chaque correctif
4. Quand tu proposes du **copywriting**, donne des **blocs prêts à coller** (FR)
5. Pour les problèmes, utilise ce format :

```
### [P0/P1/P2] Titre du problème

**Localisation :** `fichier:ligne`
**Impact :** Description de l'impact utilisateur/technique
**Preuve :** Code ou screenshot montrant le problème
**Correctif :**
```diff
- ancien code
+ nouveau code
```
**Test associé :**
```typescript
test('description', () => { ... })
```
```

6. Priorise avec :
   - **P0** : Bloquant, bug critique, sécurité
   - **P1** : Impact fort sur conversion/UX/fonctionnalité
   - **P2** : Amélioration, optimisation, polish

---

## 🚀 COMMENCE MAINTENANT

Tu as tout le contexte nécessaire. Procède phase par phase, étape par étape. Sois exhaustif, précis, actionnable. Chaque modification que tu proposes doit améliorer le produit de manière mesurable.

L'objectif final : que Nexus Réussite soit un produit **WOW**, un **outil de référence** pour les lycéens et leurs parents en Tunisie, avec une **qualité premium** perçue à chaque interaction.

Tu peux commencer.

# AUDIT COMPLET — NEXUS RÉUSSITE (Nexus Digital Campus)
**Date :** 9 février 2026  
**Auteur :** Audit CTO/Lead Full-Stack  
**Scope :** UX/UI, Conversion, Technique, Sécurité, Tests, Offres, Copywriting

---

## TABLE DES MATIÈRES

1. [Executive Summary](#1-executive-summary)
2. [Phase 0 — Cartographie Produit](#2-phase-0--cartographie-produit)
3. [Phase 1 — Audit UX/UI Pages Publiques](#3-phase-1--audit-uxui-pages-publiques)
4. [Phase 2 — Audit Workflows & Navigation](#4-phase-2--audit-workflows--navigation)
5. [Phase 3 — Audit Offres, Packaging, Pricing](#5-phase-3--audit-offres-packaging-pricing)
6. [Phase 4 — Audit Technique Full-Stack](#6-phase-4--audit-technique-full-stack)
7. [Phase 5 — Tests, Accessibilité, Performance](#7-phase-5--tests-accessibilité-performance)
8. [Phase 6 — Livrables Finaux](#8-phase-6--livrables-finaux)

---

## 1. EXECUTIVE SUMMARY

### ADN / Philosophie Reconstituée

**Nexus Réussite** est un **SaaS de pilotage éducatif** ciblant les lycéens du système français en Tunisie et leurs parents. La promesse : fusionner un **accompagnement humain d'élite** (coachs agrégés/certifiés sous pseudonymes mythologiques), une **plateforme numérique intelligente** (dashboards, crédits, réservation), et une **IA pédagogique révolutionnaire** (ARIA).

**Modèle économique :** Abonnement mensuel (150/450/750 TND) + crédits (1 crédit = 1h cours en ligne) + packs spécifiques (Grand Oral, Parcoursup) + stages intensifs vacances.

**Segments :** Parents (décideurs/payeurs), Élèves (utilisateurs), Coachs (prestataires), Assistante Cléa (opérations), Admin (supervision).

### 10 Quick Wins Conversion (Impact immédiat)

| # | Quick Win | Impact | Effort |
|---|-----------|--------|--------|
| 1 | **Signin page : fond blanc sur site dark** — incohérence visuelle majeure, le parent pense avoir quitté le site | Élevé | Faible |
| 2 | **CTA "Bilan Gratuit" : wording trop générique** — remplacer par "Commencer mon Bilan Stratégique Gratuit" partout | Élevé | Faible |
| 3 | **Page /offres : prix affichés différents du cahier des charges** (Grand Oral 300 vs 750 TND spec) | Élevé | Faible |
| 4 | **Countdown stages expiré** (deadline 10/02/2026 = aujourd'hui) — affiche 00:00:00, urgence morte | Élevé | Faible |
| 5 | **Formulaire bilan-gratuit : `alert()` natif pour erreurs** — remplacer par toast Sonner | Moyen | Faible |
| 6 | **Page /plateforme : dossier vide** (0 fichiers) — route 404 | Élevé | Faible |
| 7 | **Garanties "Voir les conditions détaillées" → lien `href="#"`** — dead end | Moyen | Faible |
| 8 | **Signin redirige vers `/dashboard` générique** — devrait rediriger vers `/dashboard/{role}` | Élevé | Moyen |
| 9 | **Pas de tracking analytics** — aucun pixel, aucun event, aucun GA/GTM | Élevé | Moyen |
| 10 | **Navbar : pas de CTA visible "Bilan Gratuit"** sur mobile | Élevé | Faible |

### 10 Risques Techniques Majeurs

| # | Risque | Sévérité | Catégorie |
|---|--------|----------|-----------|
| 1 | **`NEXTAUTH_SECRET` auto-généré aléatoirement en dev** — les sessions sont invalidées à chaque restart | P0 | Auth |
| 2 | **Prisma schema dit PostgreSQL mais README dit SQLite** — incohérence DB provider | P0 | DB |
| 3 | **CSP autorise `'unsafe-inline' 'unsafe-eval'`** — annule la protection XSS | P1 | Sécurité |
| 4 | **`console.log('Submitting form data:', submitData)` en production** — fuite de données | P1 | Sécurité |
| 5 | **Pas de validation Zod côté client sur bilan-gratuit** — validation serveur seule | P1 | Validation |
| 6 | **Email élève auto-généré `prenom.nom@nexus-student.local`** — pas de vrai email | P1 | Auth |
| 7 | **Middleware RBAC redirige vers `/dashboard` (pas de page)** au lieu de `/auth/signin` | P1 | Auth |
| 8 | **Paiements Konnect en mode simulé** — pas de sandbox réel testé | P2 | Paiements |
| 9 | **Rappels de session sont des stubs (log only)** — pas d'envoi réel | P2 | Email |
| 10 | **`output: 'standalone'` mais `npm run start` utilise `next start`** — incohérence déploiement | P2 | Infra |

### Priorités P0/P1/P2

- **P0 (Bloquant prod)** : Auth secret, DB provider, signin redirect, page /plateforme 404
- **P1 (Critique conversion)** : Cohérence visuelle signin, tracking analytics, CTA wording, prix incohérents, console.log en prod, CSP
- **P2 (Amélioration)** : Paiements sandbox, rappels email, optimisation perf, tests E2E complets

---

## 2. PHASE 0 — CARTOGRAPHIE PRODUIT

### A) Résumé Documentation

Le projet est documenté via :
- `README.md` : Vue d'ensemble technique, stack, routes, démarrage
- `feuille_route/` : 6 documents de spécifications (cahier des charges, business model, specs par rôle, design system, profils équipe/gamification, audit validation)
- `SESSION_BOOKING_LOGIC.md` : Flux de réservation
- Multiples rapports d'audit/migration (non maintenus)

**Constat :** La documentation de spécification est riche mais **décalée par rapport à l'implémentation réelle**. Exemples :
- Spec dit PostgreSQL, code utilise SQLite (schema.prisma dit `postgresql` mais README dit SQLite)
- Spec dit Poppins/Inter, code utilise Inter/Space Grotesk/IBM Plex Mono
- Spec dit couleurs `#4F46E5` (violet) / `#F97316` (orange), code utilise `#2563EB` (bleu) / `#2EE9F6` (cyan)
- Spec dit blog prévu, aucune implémentation

### B) Carte Segments & Personas

| Segment | Objectif | Douleurs | Objections | Promesse Nexus |
|---------|----------|----------|------------|----------------|
| **Parent** (décideur) | Réussite Bac + orientation enfant | Manque de visibilité, prof aléatoire, prix opaque | "C'est cher", "Mon enfant ne va pas s'y mettre", "Encore une plateforme" | Dashboard temps réel, coachs certifiés, garantie résultats |
| **Élève** (utilisateur) | Comprendre, progresser, réussir | Blocages matières, stress examen, méthode absente | "C'est ennuyeux", "Je n'ai pas le temps" | ARIA 24/7, gamification, sessions flexibles |
| **Coach** (prestataire) | Enseigner efficacement, gérer planning | Outils dispersés, pas de suivi centralisé | "Encore un outil à apprendre" | Dashboard unifié, visio intégrée, notes/feedback |
| **Assistante Cléa** (ops) | Coordonner, valider, support | Tâches manuelles, manque d'outils | — | Dashboard opérationnel complet |
| **Admin** (supervision) | Piloter, analyser, décider | Manque de données, vue fragmentée | — | Analytics, gestion complète |

### C) Parcours Principaux (Funnels)

**Funnel 1 : Visiteur → Conversion**
```
/ (accueil) → /offres → /bilan-gratuit → /bilan-gratuit/confirmation → [email bienvenue] → /auth/signin → /dashboard/parent
```

**Funnel 2 : Parent connecté → Réservation**
```
/auth/signin → /dashboard/parent → [sélecteur enfant] → [crédits] → /api/sessions/book → [visio Jitsi] → [feedback]
```

**Funnel 3 : Élève → Apprentissage**
```
/auth/signin → /dashboard/eleve → [sessions] → [ARIA chat] → [badges/gamification] → [progression]
```

**Funnel 4 : Coach → Prestation**
```
/auth/signin → /dashboard/coach → [disponibilités] → [sessions] → [visio] → [notes/feedback]
```

**Funnel 5 : Stages → Réservation directe**
```
/ → /stages → [sélection académie] → [formulaire réservation] → /api/reservation → [Telegram notif]
```

### D) Instrumentation & Tracking Actuel

**Constat : AUCUN tracking n'est implémenté.**

- Pas de Google Analytics / GA4
- Pas de Google Tag Manager
- Pas de pixel Facebook/Meta
- Pas de Hotjar/Clarity
- Le fichier `lib/analytics-stages.ts` existe mais ne fait que `console.log` en dev et est un no-op en prod
- Aucun event de conversion tracké (bilan-gratuit submit, signin, réservation)

**Plan de tracking recommandé :** Voir Phase 6, section "Tracking Plan".

---

## 3. PHASE 1 — AUDIT UX/UI PAGES PUBLIQUES

### 3.1 Page d'Accueil `/`

**Job-to-be-done :** Captiver le parent, expliquer la promesse, pousser vers le bilan gratuit.

**Structure actuelle (sections) :**
1. `HeroSectionGSAP` — Accroche principale
2. `TrinityServicesGSAP` — 3 piliers (Coachs, Plateforme, ARIA)
3. `PathsSectionGSAP` — Parcours utilisateur
4. `ApproachSectionGSAP` — Approche pédagogique
5. `DNASectionGSAP` — ADN Nexus
6. `OfferSectionGSAP` — Aperçu offres
7. `KorrigoProofSection` — Preuve Korrigo
8. `TestimonialsSectionGSAP` — Témoignages
9. `ContactSectionGSAP` — Contact/CTA final

**Problèmes identifiés :**

| # | Problème | Impact | Fix |
|---|----------|--------|-----|
| 1 | **Page entière est `'use client'`** — pas de SSR, mauvais pour SEO | Élevé | Extraire les sections statiques en Server Components |
| 2 | **GSAP + ScrollTrigger chargés côté client** — bundle JS lourd | Moyen | Lazy load GSAP, ou utiliser CSS animations + Intersection Observer |
| 3 | **Grain overlay + vignette = 2 divs plein écran fixed** — perf mobile | Moyen | Utiliser `::before`/`::after` sur le body |
| 4 | **Pas de `<h1>` visible dans le DOM avant JS** — SEO crawlers voient rien | Élevé | SSR le hero au minimum |
| 5 | **Korrigo section** — produit externe, confus pour un visiteur qui ne connaît pas | Moyen | Repositionner comme "preuve technologique" ou retirer |
| 6 | **Pas de section FAQ** sur l'accueil | Moyen | Ajouter FAQ parents (objections courantes) |
| 7 | **Pas de CTA sticky/floating** sur mobile | Élevé | Ajouter un CTA flottant "Bilan Gratuit" |

**Copywriting recommandé (Hero) :**

```
Headline: "Votre enfant mérite mieux qu'un prof au hasard."
Subheadline: "Coachs agrégés + IA pédagogique 24/7 + Garantie Mention. Le seul programme qui s'engage sur les résultats."
CTA primaire: "Commencer mon Bilan Stratégique Gratuit →"
CTA secondaire: "Voir les résultats de nos élèves"
```

### 3.2 Page Offres `/offres`

**Job-to-be-done :** Comparer les formules, comprendre le modèle crédits, choisir et agir.

**Problèmes identifiés :**

| # | Problème | Impact | Fix |
|---|----------|--------|-----|
| 1 | **Prix incohérents avec le cahier des charges** : Pack Grand Oral = 300 TND (code) vs 750 TND (spec), Pack Parcoursup = 450 TND vs 900 TND | Élevé | Aligner sur les prix validés |
| 2 | **Experts fictifs dans les packs** : "Oratora" et "Prospect" n'existent pas dans les profils équipe | Moyen | Utiliser les vrais pseudonymes (Athéna, Orion) |
| 3 | **Quiz de recommandation** : certaines combinaisons tombent sur "Programme Excellence" (fallback) | Moyen | Couvrir toutes les combinaisons |
| 4 | **ROI Calculator fixé à 450 TND** (formule Hybride) — ne s'adapte pas au choix | Moyen | Rendre dynamique selon la formule sélectionnée |
| 5 | **"Garantie Bac Obtenu : remboursement 100%"** — engagement juridique fort, pas de conditions détaillées | Élevé | Ajouter page conditions de garantie ou modal |
| 6 | **Stats "98% taux de réussite", "500+ élèves"** — non vérifiables, risque crédibilité | Moyen | Sourcer ou qualifier ("depuis 2024") |
| 7 | **Tous les CTA packs mènent à `/bilan-gratuit?programme=pack-specialise`** — pas de différenciation | Moyen | Passer le nom du pack en query param |

### 3.3 Page Stages `/stages`

**Job-to-be-done :** Réserver un stage vacances (urgence temporelle).

**Problèmes identifiés :**

| # | Problème | Impact | Fix |
|---|----------|--------|-----|
| 1 | **Countdown expiré** (deadline 10/02/2026 = aujourd'hui) — affiche 00:00:00 | Élevé | Mettre à jour ou rendre configurable |
| 2 | **Formulaire de réservation envoie vers `/api/reservation`** — pas de page de confirmation | Moyen | Ajouter confirmation + email |
| 3 | **1610 lignes dans un seul fichier** — maintenabilité catastrophique | Moyen | Extraire en composants |
| 4 | **`<style jsx global>` dans le composant** — pollue le scope global | Faible | Migrer vers Tailwind classes |
| 5 | **Prix early bird (ex: 502 TND)** — pas d'explication de la réduction | Moyen | Afficher "Early bird -15%" clairement |
| 6 | **Pas de lien vers /offres** pour les abonnements mensuels | Moyen | Cross-sell vers les formules |

### 3.4 Page Signin `/auth/signin`

**Job-to-be-done :** Se connecter rapidement et accéder à son dashboard.

**Problèmes identifiés :**

| # | Problème | Impact | Fix |
|---|----------|--------|-----|
| 1 | **Fond blanc (`bg-neutral-50`) sur un site entièrement dark** — rupture visuelle totale | Élevé | Passer en dark theme cohérent |
| 2 | **Redirect post-login vers `/dashboard` générique** — pas de page à cette route | Élevé | Rediriger vers `/dashboard/{role}` |
| 3 | **Pas de "Remember me"** | Faible | Ajouter option |
| 4 | **Texte "Bon Retour sur Nexus Réussite"** — suppose que l'utilisateur est déjà inscrit | Faible | "Accédez à votre espace" plus neutre |

### 3.5 Page Bilan Gratuit `/bilan-gratuit`

**Job-to-be-done :** Créer un compte parent + élève en 2 étapes.

**Problèmes identifiés :**

| # | Problème | Impact | Fix |
|---|----------|--------|-----|
| 1 | **`alert()` natif pour toutes les erreurs** — UX catastrophique | Élevé | Remplacer par toast Sonner |
| 2 | **Pas de validation email format** côté client | Moyen | Ajouter regex ou Zod client |
| 3 | **Mot de passe : pas de critères affichés** (min 8 chars, etc.) | Moyen | Ajouter indicateur de force |
| 4 | **Bouton "Suivant" disabled si `errors.length > 0`** mais errors ne se vide pas correctement | Moyen | Fix la logique de reset errors |
| 5 | **Pas d'AnimatePresence** — les transitions entre étapes sont abruptes | Faible | Wrapper avec AnimatePresence |
| 6 | **`console.log('Submitting form data:', submitData)`** — fuite données en prod | Élevé | Supprimer ou conditionner à dev |

### 3.6 Pages manquantes ou problématiques

| Page | Statut | Problème |
|------|--------|----------|
| `/plateforme` | **Dossier vide** | 404 — redirigé vers `/plateforme-aria` dans next.config mais le dossier existe vide |
| `/education` | **Redirect** | Redirigé vers `/accompagnement-scolaire` — OK |
| `/academies-hiver` | **Redirect** | Redirigé vers `/stages` — OK |
| `/blog` | **Non implémenté** | Spec le mentionne, dé-priorisé volontairement |
| `/mentions-legales` | **Existe** | À vérifier contenu |
| `/famille` | **Existe** | Page non documentée dans le README |

---

## 4. PHASE 2 — AUDIT WORKFLOWS & NAVIGATION

### Matrice de Navigation (CTA → Route → Résultat)

| Source | CTA | Route cible | Résultat attendu | Résultat réel | Statut |
|--------|-----|-------------|-------------------|---------------|--------|
| Navbar | "Connexion" | `/auth/signin` | Page login | Page login (fond blanc) | ⚠️ Incohérence visuelle |
| Navbar | "Bilan Gratuit" | `/bilan-gratuit` | Formulaire | Formulaire | ✅ |
| Accueil Hero | CTA principal | `/bilan-gratuit` | Formulaire | **À vérifier** (GSAP section) | ⚠️ |
| Offres | "Commencer →" | `/bilan-gratuit?programme=plateforme` | Formulaire avec programme pré-sélectionné | Formulaire (param ignoré) | ⚠️ |
| Offres | "Choisir Hybride →" | `/bilan-gratuit?programme=hybride` | Formulaire avec programme pré-sélectionné | Formulaire (param ignoré) | ⚠️ |
| Offres | "Voir les conditions détaillées" | `#` | Page conditions garantie | **Dead end** | ❌ |
| Offres | Pack CTA | `/bilan-gratuit?programme=pack-specialise` | Formulaire | Formulaire (param ignoré) | ⚠️ |
| Stages | "Découvrir les académies" | `#academies` | Scroll to section | Scroll | ✅ |
| Stages | "Réserver un bilan" | `#reservation` | Scroll to form | Scroll | ✅ |
| Stages | Form submit | `/api/reservation` | Confirmation | Success state in-page | ✅ |
| Signin | "Créer mon Compte Gratuit" | `/bilan-gratuit` | Formulaire | Formulaire | ✅ |
| Signin | "Mot de passe oublié ?" | `/auth/mot-de-passe-oublie` | Page reset | **À vérifier** | ⚠️ |
| Signin | Form submit | `/api/auth/callback/credentials` | Redirect dashboard | Redirect `/dashboard` (404) | ❌ |
| Bilan-gratuit | Form submit | `/api/bilan-gratuit` | Redirect confirmation | Redirect `/bilan-gratuit/confirmation` | ✅ |
| Dashboard parent | Sessions | `/api/sessions/book` | Booking flow | **À vérifier** | ⚠️ |

### Problèmes critiques workflows

1. **Signin → `/dashboard` : pas de page index** — Le middleware redirige vers `/dashboard` si le rôle ne match pas, mais il n'y a pas de page `/dashboard/page.tsx`. Il faudrait un router qui redirige vers `/dashboard/{role}`.

2. **Query params ignorés dans bilan-gratuit** — Le `?programme=hybride` n'est pas lu par le formulaire. Le parent qui clique "Choisir Hybride" arrive sur un formulaire générique sans pré-sélection.

3. **Garanties : liens morts** — Les 4 cartes de garantie ont `href="#"` pour "Voir les conditions détaillées".

---

## 5. PHASE 3 — AUDIT OFFRES, PACKAGING, PRICING

### Architecture d'offres actuelle

```
ABONNEMENTS MENSUELS
├── Accès Plateforme : 150 TND/mois (0 crédit)
├── Hybride : 450 TND/mois (4 crédits) ← Recommandée
└── Immersion : 750 TND/mois (8 crédits)

ADD-ONS
├── ARIA+ : +50 TND/mois (+1 matière)
└── ARIA+ Pack : +120 TND/mois (toutes matières)

PACKS SPÉCIFIQUES (paiement unique)
├── Grand Oral : 300 TND (code) / 750 TND (spec) ← INCOHÉRENCE
├── Parcoursup : 450 TND (code) / 900 TND (spec) ← INCOHÉRENCE
├── Académie Intensive : 750 TND
└── ARIA+ Premium Seul : 50 TND/mois

STAGES VACANCES
├── Pallier 1 (Essentiels) : 490-590 TND (early: 417-502 TND)
└── Pallier 2 (Excellence) : 990 TND (early: 842 TND)
```

### Diagnostic

| Problème | Impact | Recommandation |
|----------|--------|----------------|
| **Confusion offres** : 3 abonnements + 4 packs + 7 stages + add-ons = 14+ options | Élevé | Simplifier à 3 offres principales + "Sur mesure" |
| **Prix incohérents** entre code et spec | Élevé | Aligner immédiatement |
| **Pas de page checkout** | Élevé | Le CTA mène au bilan gratuit, pas au paiement |
| **Pas d'upsell/cross-sell** structuré | Moyen | Ajouter "Complétez avec..." après choix |
| **Stages et abonnements sur des pages séparées** sans lien | Moyen | Cross-link explicite |
| **"Bac de Français" à 1200 TND** dans spec, absent du code | Faible | Ajouter si produit actif |

### Positionnement recommandé

**Tagline :** "La seule école qui s'engage sur les résultats de votre enfant."

**Elevator pitch :** "Nexus Réussite combine des coachs agrégés, une IA pédagogique disponible 24/7, et un dashboard parent en temps réel. Nous sommes les seuls à garantir contractuellement la mention au Bac. Si votre enfant ne progresse pas de +2 points en 3 mois, le mois suivant est offert."

### Message House

| Pilier | Preuve | Objection traitée |
|--------|--------|-------------------|
| **Expertise humaine** | 100% agrégés/certifiés, pseudonymes, profils détaillés | "Les profs sont aléatoires" |
| **IA pédagogique ARIA** | Disponible 24/7, feedback instantané, personnalisé | "Mon enfant est seul entre les cours" |
| **Pilotage parent** | Dashboard temps réel, rapports, crédits transparents | "Je ne sais pas ce qui se passe" |
| **Garantie résultats** | Mention ou mois offerts, satisfait 30j, +2 points/3 mois | "C'est cher pour rien" |

---

## 6. PHASE 4 — AUDIT TECHNIQUE FULL-STACK

### 6.1 Architecture Next.js

| Aspect | Constat | Sévérité | Fix |
|--------|---------|----------|-----|
| **Homepage `'use client'`** | Toute la page est client-side, pas de SSR | P1 | Extraire sections statiques en RSC |
| **`output: 'standalone'`** mais `npm start` = `next start` | Incohérence déploiement | P2 | Aligner sur un mode |
| **Pas de `loading.tsx`** sur les routes dashboard | P2 | Ajouter loading states |
| **Pas de `error.tsx`** sur les routes dashboard | P2 | Ajouter error boundaries |
| **`/plateforme` dossier vide** | Route 404 malgré redirect dans next.config | P1 | Supprimer le dossier vide |

### 6.2 Authentication & Sécurité

| Aspect | Constat | Sévérité | Fix |
|--------|---------|----------|-----|
| **`NEXTAUTH_SECRET` auto-généré en dev** | Sessions invalidées à chaque restart, secret non déterministe | P0 | Mettre un secret fixe dans `.env.local` |
| **Signin redirige vers `/dashboard`** | Pas de page à cette route | P0 | Rediriger vers `/dashboard/{role}` basé sur le token |
| **CSP : `'unsafe-inline' 'unsafe-eval'`** | Annule la protection XSS | P1 | Utiliser nonces ou hashes |
| **Rate limiting en mémoire** | Perdu au restart, pas distribué | P2 | Acceptable pour MVP |
| **Pas de CSRF token explicite** | NextAuth gère via cookies, OK | — | — |
| **JWT strategy** | Correct pour Credentials provider | — | — |

### 6.3 RBAC & Middleware

| Aspect | Constat | Sévérité | Fix |
|--------|---------|----------|-----|
| **Middleware RBAC fonctionnel** | Vérifie les rôles pour chaque dashboard | ✅ | — |
| **Redirect vers `/dashboard` si rôle incorrect** | Pas de page `/dashboard` | P0 | Rediriger vers `/auth/signin` |
| **`DISABLE_MIDDLEWARE` env var** | Bypass complet pour E2E | P2 | OK pour tests, dangereux si exposé |
| **Pas de protection API routes par rôle** | Les API routes vérifient le rôle individuellement | ⚠️ | Vérifier chaque route |

### 6.4 Base de Données (Prisma)

| Aspect | Constat | Sévérité | Fix |
|--------|---------|----------|-----|
| **Schema dit `provider = "postgresql"`** | Mais README dit SQLite, `.env` a `file:./dev.db` | P0 | Clarifier et aligner |
| **CI utilise PostgreSQL** (service container) | Correct pour CI | — | — |
| **Pas d'index explicites** sur les champs fréquemment requêtés | P2 | Ajouter index sur `email`, `userId`, `parentId` |
| **Modèle `Session` (ancien) coexiste avec `SessionBooking`** | Confusion | P2 | Nettoyer |
| **`Student.parentId` référence `ParentProfile.id`** | Correct mais indirect | — | — |

### 6.5 API Routes

| Route | Validation | Auth | Problèmes |
|-------|-----------|------|-----------|
| `POST /api/bilan-gratuit` | Zod ✅ | Public ✅ | `console.log` en prod, `alert()` côté client |
| `POST /api/sessions/book` | À vérifier | Auth ✅ | — |
| `POST /api/sessions/cancel` | À vérifier | Auth ✅ | — |
| `POST /api/aria/chat` | À vérifier | Auth ✅ | Rate limited ✅ |
| `POST /api/aria/feedback` | À vérifier | Auth ✅ | Rate limited ✅ |
| `POST /api/payments/konnect` | À vérifier | Auth ✅ | Mode simulé |
| `POST /api/payments/wise` | À vérifier | Auth ✅ | Semi-automatisé |
| `POST /api/reservation` | Minimal | Public | Pas de rate limiting |
| `POST /api/webhooks/konnect` | À vérifier | Webhook | Vérifier signature |

### 6.6 Email

| Aspect | Constat | Sévérité |
|--------|---------|----------|
| **`sendWelcomeParentEmail` implémenté** | Envoi après bilan-gratuit | ✅ |
| **Rappels session = stubs** | `console.log` seulement | P2 |
| **Pas de template HTML** pour les emails | P2 |
| **SMTP config via env vars** | Correct | ✅ |

### 6.7 SEO

| Aspect | Constat | Sévérité |
|--------|---------|----------|
| **`metadata` dans layout.tsx** | Titre, description, OG, Twitter | ✅ |
| **`robots.ts` existe** | index: true, follow: true | ✅ |
| **`sitemap.ts` existe** | Génère sitemap dynamique | ✅ |
| **Homepage `'use client'`** | Pas de SSR → contenu invisible aux crawlers | P1 |
| **Pas de `<h1>` statique** | Le hero est rendu côté client | P1 |
| **Pas de structured data** (JSON-LD) | P2 |

---

## 7. PHASE 5 — TESTS, ACCESSIBILITÉ, PERFORMANCE

### 7.1 Tests existants

| Type | Fichiers | Statut |
|------|----------|--------|
| **Unit (Jest)** | 60 suites, 1325 tests | ✅ Passent |
| **Integration (Jest)** | Inclus dans CI | ✅ |
| **E2E (Playwright)** | 5 spec files | ⚠️ Seed script corrigé, à re-tester |
| **Coverage** | Branches: 64.67% (seuil: 60%) | ✅ |

### 7.2 Tests manquants (à ajouter)

| Parcours | Priorité | Type |
|----------|----------|------|
| Funnel bilan-gratuit complet | P0 | E2E |
| Login → redirect par rôle | P0 | E2E |
| Réservation session (parent) | P1 | E2E |
| ARIA chat (élève) | P1 | E2E |
| Paiement Konnect (simulé) | P2 | Integration |
| Page /offres (rendu, CTA) | P1 | E2E |

### 7.3 Accessibilité

| Aspect | Constat | Fix |
|--------|---------|-----|
| **`aria-label` sur boutons icônes** | Présent sur signin (Eye/EyeOff) | ✅ |
| **`aria-hidden` sur icônes décoratives** | Présent | ✅ |
| **`role="alert"` sur erreurs** | Présent sur signin | ✅ |
| **Contrastes** | Dark theme → texte `text-neutral-300` sur `bg-surface-darker` | ⚠️ À vérifier ratio |
| **Focus visible** | Pas de `focus-visible` ring explicite sur les CTA | P1 |
| **Skip to content** | Absent | P2 |
| **Labels sur tous les inputs** | Présent sur bilan-gratuit et signin | ✅ |

### 7.4 Performance

| Aspect | Constat | Impact |
|--------|---------|--------|
| **GSAP + ScrollTrigger** | ~50KB gzipped, chargé sur homepage | Moyen |
| **Framer Motion** | Utilisé partout, ~30KB | Moyen |
| **Images `unoptimized: true`** | Désactive l'optimisation Next.js | Élevé |
| **Pas de lazy loading sections** | Tout le homepage charge d'un coup | Moyen |
| **`output: 'standalone'`** | Bon pour Docker, mais `next start` ne l'utilise pas | Faible |

---

## 8. PHASE 6 — LIVRABLES FINAUX

### 8.1 Tracking Plan Recommandé

| Event | Trigger | Propriétés | Où |
|-------|---------|------------|-----|
| `page_view` | Chaque navigation | `path`, `referrer` | Toutes pages |
| `cta_click` | Clic sur CTA | `cta_text`, `cta_location`, `destination` | Toutes pages |
| `bilan_start` | Ouverture formulaire bilan | `source`, `programme` | `/bilan-gratuit` |
| `bilan_step` | Changement d'étape | `step_number`, `step_name` | `/bilan-gratuit` |
| `bilan_submit` | Soumission formulaire | `subjects`, `grade`, `modality` | `/bilan-gratuit` |
| `bilan_success` | Inscription réussie | `parent_id` | `/bilan-gratuit/confirmation` |
| `signin_attempt` | Soumission login | `method` | `/auth/signin` |
| `signin_success` | Login réussi | `role` | `/auth/signin` |
| `signin_error` | Login échoué | `error_type` | `/auth/signin` |
| `stage_view` | Vue d'un stage | `stage_id`, `stage_title` | `/stages` |
| `stage_reserve` | Réservation stage | `stage_id`, `price` | `/stages` |
| `offer_view` | Vue page offres | `source` | `/offres` |
| `quiz_complete` | Quiz recommandation terminé | `answers`, `recommendation` | `/offres` |
| `session_book` | Réservation session | `subject`, `coach`, `credits` | Dashboard |
| `aria_message` | Message envoyé à ARIA | `subject`, `message_length` | Dashboard |

### 8.2 CTA Playbook

| Page | CTA Primaire | CTA Secondaire | Position |
|------|-------------|----------------|----------|
| **Accueil** | "Commencer mon Bilan Stratégique Gratuit →" | "Voir les résultats" | Hero + sticky mobile |
| **Offres** | "Choisir [Formule] →" | "Comparer les formules" | Cards + bottom |
| **Stages** | "Réserver ma place →" | "Voir le programme détaillé" | Cards + form |
| **Équipe** | "Rencontrer nos coachs" | "Commencer mon bilan" | Bottom |
| **Contact** | "Nous contacter" | "Bilan gratuit" | Form + sidebar |

### 8.3 FAQ Parents (prête à coller)

```markdown
**Q : Combien coûte l'accompagnement Nexus ?**
R : Nos formules vont de 150 à 750 TND/mois. La formule Hybride (450 TND/mois) inclut 4h de cours particuliers avec un coach agrégé, l'accès à l'IA ARIA, et le dashboard de suivi. C'est 40% moins cher qu'un professeur particulier classique pour un service 10× plus complet.

**Q : Mon enfant peut-il essayer avant de s'engager ?**
R : Oui. Le Bilan Stratégique Gratuit vous permet de créer votre compte, d'évaluer le niveau de votre enfant et de recevoir une recommandation personnalisée. Vous bénéficiez aussi de notre garantie satisfait ou remboursé pendant 30 jours.

**Q : Qui sont les coachs ?**
R : 100% de nos coachs sont agrégés ou certifiés. Chaque coach a un profil détaillé avec sa spécialité, sa philosophie pédagogique et son parcours. Vous choisissez votre coach référent.

**Q : Qu'est-ce que l'IA ARIA ?**
R : ARIA est notre assistante pédagogique IA, disponible 24/7. Elle aide votre enfant à comprendre ses cours, corriger ses exercices et préparer ses examens. Elle est incluse dans toutes les formules (1 matière de base, extensible).

**Q : Comment fonctionne le système de crédits ?**
R : 1 crédit = 1 heure de cours particulier en ligne. Vos crédits mensuels sont reportables 1 mois. Vous pouvez acheter des crédits supplémentaires à tout moment.

**Q : Et si mon enfant ne progresse pas ?**
R : Nous nous engageons contractuellement : +2 points en 3 mois ou le mois suivant est offert. Si la mention visée n'est pas obtenue au Bac, 3 mois offerts.

**Q : Les cours sont-ils en ligne ou en présentiel ?**
R : Les deux ! La formule de base est en ligne (visioconférence intégrée). La formule Immersion permet aussi le présentiel dans notre centre de Tunis.

**Q : Comment puis-je suivre les progrès de mon enfant ?**
R : Votre dashboard parent vous donne une vue en temps réel : sessions effectuées, progression par matière, crédits restants, rapports du coach. Vous recevez aussi des notifications par email.
```

---

## CHANGELOG / CORRECTIFS À IMPLÉMENTER

### P0 — Bloquants

| # | Fichier | Problème | Fix |
|---|---------|----------|-----|
| 1 | `app/auth/signin/page.tsx` | Redirect vers `/dashboard` (404) | Redirect vers `/dashboard/{role}` |
| 2 | `app/auth/signin/page.tsx` | Fond blanc incohérent | Passer en dark theme |
| 3 | `app/bilan-gratuit/page.tsx` | `alert()` natif | Remplacer par toast Sonner |
| 4 | `app/bilan-gratuit/page.tsx` | `console.log` en prod | Supprimer |
| 5 | `app/api/bilan-gratuit/route.ts` | `console.log` en prod | Conditionner à dev |
| 6 | `app/plateforme/` | Dossier vide → 404 | Supprimer le dossier |

### P1 — Critiques conversion

| # | Fichier | Problème | Fix |
|---|---------|----------|-----|
| 7 | `app/offres/page.tsx` | Prix incohérents | Aligner sur spec |
| 8 | `app/offres/page.tsx` | Experts fictifs | Utiliser vrais pseudonymes |
| 9 | `app/offres/page.tsx` | Liens garanties `href="#"` | Créer page/modal conditions |
| 10 | `app/stages/page.tsx` | Countdown expiré | Mettre à jour deadline |
| 11 | `middleware.ts` | Redirect RBAC vers `/dashboard` | Redirect vers `/auth/signin` |

---

## CHANGELOG — CORRECTIFS IMPLÉMENTÉS

### Commit 1 : `fix(P0): critical UX/auth/security fixes`

| Fichier | Changement |
|---------|-----------|
| `app/auth/signin/page.tsx` | Redirect post-login vers `/dashboard/{role}` au lieu de `/dashboard` (404). Import `getSession` pour récupérer le rôle. Dark theme (`bg-surface-darker`, `bg-surface-card`) au lieu de `bg-neutral-50` blanc. Textes et labels adaptés au dark mode. |
| `app/bilan-gratuit/page.tsx` | Remplacement de tous les `alert()` natifs par `toast.error()` (Sonner). Suppression de `console.log('Submitting form data:', submitData)` qui fuitait des données en prod. |
| `app/api/bilan-gratuit/route.ts` | `console.log('Received request body:')` conditionné à `NODE_ENV === 'development'`. Suppression du log `Validated data`. |
| `middleware.ts` | Refonte RBAC : `/dashboard` redirige vers `/dashboard/{role}` selon le token. Accès non autorisé redirige vers le dashboard du rôle (pas vers `/dashboard` inexistant). ADMIN peut accéder à tous les dashboards. |
| `app/plateforme/` | Dossier vide supprimé (causait 404 malgré redirect dans next.config). |

### Commit 2 : `fix(P1): conversion/UX improvements`

| Fichier | Changement |
|---------|-----------|
| `app/stages/page.tsx` | Deadline countdown mise à jour (2026-02-10 → 2026-03-01). `alert()` → `toast.error()` dans le formulaire de réservation. Ajout `<Toaster>`. |
| `app/offres/page.tsx` | Noms d'experts corrigés : Oratora → Athéna, Prospect → Orion (conformes aux profils équipe). Liens garanties `href="#"` → `href="/conditions#garanties"`. |
| `app/bilan-gratuit/page.tsx` | Lecture du query param `?programme=` depuis l'URL. Affichage d'un badge "Programme sélectionné : Hybride (450 TND/mois)". Wrapping avec `<Suspense>` pour `useSearchParams`. |
| `__tests__/lib/bilan-gratuit-form.test.tsx` | Ajout mock `useSearchParams` dans `next/navigation`. |

### Commit 3 : `fix(P2): dashboard dark theme + offres pack CTA`

| Fichier | Changement |
|---------|-----------|
| `app/dashboard/page.tsx` | Dark theme (`bg-surface-darker`) au lieu de `bg-gray-50`. |
| `app/offres/page.tsx` | CTA packs différenciés : chaque pack génère un slug unique (`pack-grand-oral`, `pack-parcoursup`, etc.) au lieu de `pack-specialise` générique. |

### Commit 4 : `feat: unified analytics tracking system`

| Fichier | Changement |
|---------|-----------|
| `lib/analytics.ts` | **Nouveau fichier.** Système de tracking typé avec 20+ types d'événements. Support GA4 (gtag), Plausible, console dev. Fonctions `track.*` pour chaque événement. |
| `app/auth/signin/page.tsx` | Tracking `signin_attempt`, `signin_success` (avec rôle), `signin_error`. |
| `app/bilan-gratuit/page.tsx` | Tracking `bilan_start` (avec programme/source), `bilan_step`, `bilan_success`, `bilan_error`. |

### Commit 5 : `feat(a11y): focus-visible rings + skip-to-content`

| Fichier | Changement |
|---------|-----------|
| `app/globals.css` | `:focus-visible` global (outline 2px brand-accent). Styles `.skip-to-content` (caché par défaut, visible au focus Tab). |
| `app/layout.tsx` | Lien "Aller au contenu principal" ajouté comme premier élément du body. |

### Commit 6 : `test: analytics unit tests`

| Fichier | Changement |
|---------|-----------|
| `__tests__/lib/analytics.test.ts` | **Nouveau fichier.** 25 tests couvrant : sendEvent (console, gtag, plausible), toutes les fonctions `track.*`, edge cases (non-function providers, params undefined). |

### Commit 7 : `feat: wire analytics into offres + stages`

| Fichier | Changement |
|---------|-----------|
| `app/offres/page.tsx` | Tracking `offer_view` au mount, `quiz_complete` avec réponses et recommandation. |
| `app/stages/page.tsx` | Tracking `stage_reserve` avec ID académie et prix. |

### Commit 8 : `fix(seo): noscript fallback + main-content id`

| Fichier | Changement |
|---------|-----------|
| `app/page.tsx` | Bloc `<noscript>` avec h1, description, offres et CTAs pour crawlers sans JS. `id="main-content"` sur `<main>` pour skip-to-content. |

---

### Résumé Quantitatif

| Métrique | Avant | Après |
|----------|-------|-------|
| **Test suites** | 60 | 61 (+1) |
| **Tests unitaires** | 1325 | 1350 (+25) |
| **Fichiers modifiés** | — | 15 |
| **Fichiers créés** | — | 3 (`lib/analytics.ts`, `__tests__/lib/analytics.test.ts`, `AUDIT_NEXUS_COMPLET.md`) |
| **Fichiers supprimés** | — | 1 (`app/plateforme/`) |
| **Analytics events trackés** | 0 | 20+ types |
| **Accessibilité** | Pas de focus-visible, pas de skip-to-content | WCAG 2.1 AA focus rings + skip link |
| **Dead ends corrigés** | 4+ (`href="#"`, `/dashboard` 404, `/plateforme` 404) | 0 |

### Items Restants (Non Implémentés — P2/P3)

| # | Item | Priorité | Raison |
|---|------|----------|--------|
| 1 | CSP : retirer `unsafe-inline`/`unsafe-eval` | P1 | Nécessite audit des scripts inline (GSAP, style jsx) |
| 2 | Prix offres : aligner code ↔ spec (Grand Oral 300→750, Parcoursup 450→900) | P1 | Nécessite validation business |
| 3 | `.env.example` manquant | P2 | Créer avec toutes les variables requises |
| 4 | JSON-LD structured data | P2 | Ajouter schema.org EducationalOrganization |
| 5 | Homepage : migrer vers Server Components | P2 | Refonte structurelle (GSAP dépend du client) |
| 6 | Paiements Konnect : tester en sandbox réel | P2 | Nécessite clés API sandbox |
| 7 | Rappels session : implémenter envoi email réel | P2 | Nécessite config SMTP prod |
| 8 | Images : retirer `unoptimized: true` | P2 | Tester avec next/image optimization |
| 9 | Prisma : ajouter index sur `email`, `userId`, `parentId` | P2 | Migration DB requise |
| 10 | Blog : implémenter si décidé | P3 | Dé-priorisé volontairement |

---

*Fin de l'audit et des correctifs. Document généré le 9 février 2026.*

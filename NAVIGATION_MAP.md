# Nexus Réussite — Carte de Navigation Complète

> Tous les cheminements de navigation, de la page d'accueil vers chaque page, dashboard, ressource et service.
> **Dernière mise à jour** : 23 février 2026

---

## Table des Matières

1. [Vue Globale](#1-vue-globale)
2. [Page d'Accueil — Points de Sortie](#2-page-daccueil--points-de-sortie)
3. [Navbar & Footer — Liens Permanents](#3-navbar--footer--liens-permanents)
4. [Pages Publiques — Interconnexions](#4-pages-publiques--interconnexions)
5. [Flux d'Authentification](#5-flux-dauthentification)
6. [Dashboards par Rôle](#6-dashboards-par-rôle)
7. [Pages Spécialisées (hors dashboards)](#7-pages-spécialisées-hors-dashboards)
8. [API Routes (81 endpoints)](#8-api-routes-81-endpoints)
9. [Redirections Automatiques](#9-redirections-automatiques)
10. [Matrice d'Accès & Permissions](#10-matrice-daccès--permissions)
11. [Feature Gating (Entitlements)](#11-feature-gating-entitlements)
12. [Graphe Complet](#12-graphe-complet)

---

## 1. Vue Globale

**74 pages** · **81 API routes** · **5 rôles** · **38 modèles Prisma** · **20 enums**

```
                         ┌──────────────┐
                         │  ACCUEIL (/) │
                         └──────┬───────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                     │
           ▼                    ▼                     ▼
  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐
  │PAGES PUBLIQUES │  │    AUTH      │  │ PAGES MARKETING  │
  │ (22 pages)     │  │ (4 pages)   │  │ (8 pages)        │
  │ /offres        │  │ /signin     │  │ /accompagnement  │
  │ /bilan-gratuit │  │ /activate   │  │ /plateforme-aria │
  │ /stages/*      │  │ /mot-de-..  │  │ /equipe          │
  │ /contact       │  │ /reset-pwd  │  │ /notre-centre    │
  │ /programme/*   │  └──────┬──────┘  │ /famille         │
  │ /bilan-p2-math │         │         │ /academy         │
  └────────────────┘         │         │ /consulting      │
                             │         │ /maths-1ere      │
                      ┌──────▼──────┐  └──────────────────┘
                      │ MIDDLEWARE  │
                      │ Auth Check  │
                      └──────┬──────┘
                             │
          ┌──────────┬───────┼───────┬──────────┐
          ▼          ▼       ▼       ▼          ▼
      ┌───────┐ ┌────────┐ ┌─────┐ ┌──────┐ ┌──────┐
      │ ADMIN │ │ASSIST. │ │COACH│ │PARENT│ │ELEVE │
      │8 pages│ │9 pages │ │4 pg │ │7 pg  │ │4 pg  │
      └───────┘ └────────┘ └─────┘ └──────┘ └──────┘
```

---

## 2. Page d'Accueil — Points de Sortie

La homepage (`/`) contient 9 sections GSAP animées avec les CTAs suivants :

```
┌─────────────────────────────────────────────────────────┐
│  PAGE D'ACCUEIL (/)                                      │
│                                                          │
│  [NAVBAR] ── voir section 3                              │
│                                                          │
│  Section 1: HERO                                         │
│    [Bilan gratuit] ──────────────▶ /bilan-gratuit        │
│    [Voir nos offres] ────────────▶ /offres               │
│                                                          │
│  Section 3: PATHS (3 cartes)                             │
│    "Lycée français" ─────────────▶ /offres               │
│    "Candidat libre" ─────────────▶ /bilan-gratuit        │
│    "Parcoursup" ─────────────────▶ /contact              │
│                                                          │
│  Section 6: OFFERS                                       │
│    Onglets Plateforme/Hybride/Immersion ▶ /offres        │
│                                                          │
│  Section 7: TESTIMONIALS                                 │
│    Carte CTA finale ─────────────▶ /bilan-gratuit        │
│                                                          │
│  Section 9: CONTACT                                      │
│    Formulaire intégré ───────────▶ POST /api/contact     │
│                                                          │
│  [FOOTER] ── voir section 3                              │
└─────────────────────────────────────────────────────────┘
```

| Section | CTA | Destination |
|---------|-----|-------------|
| Hero | "Bilan gratuit" | `/bilan-gratuit` |
| Hero | "Voir nos offres" | `/offres` |
| Paths | "Voir les formules" | `/offres` |
| Paths | "Démarrer un bilan" | `/bilan-gratuit` |
| Paths | "Parler à un expert" | `/contact` |
| Offers | Onglets formules | `/offres` |
| Testimonials | Carte CTA | `/bilan-gratuit` |
| Contact | Formulaire | `POST /api/contact` |

---

## 3. Navbar & Footer — Liens Permanents

### Navbar (toutes pages publiques)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo] ▶ /                                                       │
│                                                                  │
│ Essentiel ▾           Programmes ▾         À propos ▾           │
│ ├─ Accueil ▶ /        ├─ Accompagnement    ├─ Notre Équipe      │
│ ├─ Offres ▶ /offres   │  ▶ /accomp..       │  ▶ /equipe         │
│ ├─ Bilan Gratuit      ├─ Stages            └─ Notre Centre      │
│ │  ▶ /bilan-gratuit   │  ▶ /stages            ▶ /notre-centre   │
│ └─ Contact ▶ /contact └─ Plateforme ARIA                        │
│                          ▶ /plateforme-aria                      │
│                                                                  │
│ Connexion ▾                        [Bilan gratuit] ▶ /bilan-..  │
│ ├─ Se connecter ▶ /auth/signin                                   │
│ └─ S'inscrire ▶ /bilan-gratuit                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Footer (toutes pages publiques)

```
Exploration (9 liens) :
  / · /accompagnement-scolaire · /offres · /stages · /plateforme-aria
  /equipe · /notre-centre · /bilan-gratuit · /contact

Bas de page :
  /mentions-legales · /conditions · /contact
```

---

## 4. Pages Publiques — Interconnexions

```
                         ┌──────────┐
              ┌─────────▶│ /contact │◀──────────────┐
              │          └──────────┘               │
              │               ▲                     │
┌──────┐  ┌───┴────────────┐  │  ┌─────────┐  ┌────┴──────────────┐
│  /   │─▶│ /bilan-gratuit │  │  │ /offres │  │/accompagnement-   │
│      │  │ ├─ /confirmation│  │  │ 3 plans │  │  scolaire         │
│      │─▶│ └─ /assessment  │  │  │ 3 packs │  └───────────────────┘
└──┬───┘  └────────────────┘  │  │ 2 addons│
   │               ▲          │  └─────────┘
   │               │          │       ▲
   │  ┌────────────┴───┐     │       │
   │  │ /stages         │     │  ┌────┴───────────┐
   │  │ └─ /fevrier-26  │     │  │/plateforme-aria│
   │  │    ├─ /diagnostic│     │  └────────────────┘
   │  │    └─ /bilan/[id]│     │
   │  └────────────────┘     │
   │                          │
   ├──▶ /equipe · /notre-centre · /famille · /academy · /consulting
   │
   ├──▶ /programme/maths-1ere (22 composants interactifs, store Zustand)
   │    /programme/maths-terminale
   │
   ├──▶ /bilan-pallier2-maths (quiz diagnostique multi-matières)
   │    ├─ /confirmation
   │    ├─ /dashboard (admin)
   │    └─ /resultat/[id] (bilans 3 audiences, TrustScore, polling)
   │
   ├──▶ /assessments/[id]/processing · /assessments/[id]/result
   │
   └──▶ /conditions · /mentions-legales
```

### `/bilan-gratuit` — Formulaire Lead Gen

```
Formulaire multi-étapes (parent + enfant + objectifs)
  ├── Soumission ▶ POST /api/bilan-gratuit ▶ /bilan-gratuit/confirmation
  └── /bilan-gratuit/assessment (évaluation en ligne)
Lien "Pas encore de compte ?" ▶ /auth/signin
```

### `/offres` — Tarifs

```
3 Formules : Plateforme (150 TND) · Hybride (450 TND) ⭐ · Immersion (750 TND)
3 Packs : Grand Oral (300) · Parcoursup (450) · Académie (750)
2 Add-ons ARIA : +1 matière (50/mois) · Toutes matières (120/mois)
Tarif horaire : 60 TND (individuel) · 40 TND (groupe)
CTAs ▶ /bilan-gratuit
```

### `/stages` — Stages Intensifs

```
/stages ──redirect──▶ /stages/fevrier-2026
  ├── Réservation ▶ POST /api/reservation
  ├── /stages/fevrier-2026/diagnostic (QCM 50 questions)
  │   └── Soumission ▶ POST /api/stages/submit-diagnostic
  ├── /stages/fevrier-2026/bilan/[reservationId] (résultats)
  └── /stages/dashboard-excellence (tableau de bord stage)
```

### `/bilan-pallier2-maths` — Quiz Diagnostique Multi-Matières

```
/bilan-pallier2-maths (formulaire 57K lignes, 4 définitions)
  ├── POST /api/bilan-pallier2-maths (scoring V2 + TrustScore + LLM bilans)
  ├── /confirmation
  ├── /dashboard (admin — suivi des diagnostics)
  └── /resultat/[id] (3 onglets: élève, parents, nexus)
      ├── Signed tokens (HMAC-SHA256) pour accès par audience
      ├── Auto-polling 10s pendant génération LLM
      └── POST /api/bilan-pallier2-maths/retry (relance LLM)
```

### `/programme/maths-1ere` — Programme Interactif

```
/programme/maths-1ere (22 composants interactifs)
  ├── ExerciseEngine (moteur d'exercices)
  ├── PythonIDE (éditeur Python intégré)
  ├── InteractiveGraph / InteractiveMafs (graphiques)
  ├── SkillTree (arbre de compétences)
  ├── DiagnosticPrerequis (prérequis)
  ├── MathJaxProvider + MathInput (rendu LaTeX)
  └── Store Zustand (83K data.ts, 23K store.ts)

/programme/maths-terminale (même architecture, données terminale)
```

---

## 5. Flux d'Authentification

```
┌─────────────────────────────────────────────────────────────┐
│  VISITEUR (non connecté)                                     │
│                                                              │
│  /auth/signin ◀── Navbar · Middleware redirect · Liens       │
│    │                                                         │
│    ├── Succès ──▶ /dashboard/{role}                          │
│    │   ADMIN ──────▶ /dashboard/admin                        │
│    │   ASSISTANTE ─▶ /dashboard/assistante                   │
│    │   COACH ──────▶ /dashboard/coach                        │
│    │   PARENT ─────▶ /dashboard/parent                       │
│    │   ELEVE ──────▶ /dashboard/eleve                        │
│    │                                                         │
│    ├── Erreur ──▶ "Email ou mot de passe incorrect"          │
│    │                                                         │
│    └── "Mot de passe oublié ?" ──▶ /auth/mot-de-passe-oublie│
│         └── email ▶ POST /api/auth/reset-password            │
│         └── /auth/reset-password?token=xxx                   │
│              └── Succès ──▶ /auth/signin                     │
│                                                              │
│  ACTIVATION ÉLÈVE                                            │
│  /auth/activate?token=xxx ◀── Email d'activation             │
│    ├── Token OK ──▶ Formulaire mdp ──▶ /auth/signin          │
│    └── Token KO ──▶ "Retour connexion" ──▶ /auth/signin     │
│                                                              │
│  DÉJÀ CONNECTÉ                                               │
│  /auth/* ──middleware──▶ /dashboard/{role}                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Dashboards par Rôle

### ADMIN — Sidebar (7 liens) + 1 hors sidebar

```
/dashboard/admin
├── Dashboard ──────── /dashboard/admin (KPIs, santé système, stats globales)
├── Utilisateurs ───── /dashboard/admin/users (CRUD: créer, modifier, supprimer)
├── Analytics ──────── /dashboard/admin/analytics (métriques plateforme)
├── Abonnements ────── /dashboard/admin/subscriptions (gestion abonnements)
├── Activités ──────── /dashboard/admin/activities (journal d'activités)
├── Tests Système ──── /dashboard/admin/tests (vérification infra)
├── Documents ──────── /dashboard/admin/documents (upload coffre-fort → élève/parent)
│
├── (hors sidebar) :
│   ├── Facturation ── /dashboard/admin/facturation (factures, séquences)
│   ├── Directeur ──── /admin/directeur (KPIs directeur, distribution, alertes)
│   └── Stages Admin ─ /admin/stages/fevrier-2026 (réservations, CSV export)
│
└── Actions API :
    ├── POST /api/admin/recompute-ssn (recalcul SSN batch)
    ├── POST /api/admin/test-email (test SMTP)
    └── GET /api/admin/directeur/stats (KPIs directeur)
```

### ASSISTANTE — Sidebar (6 liens) + 3 hors sidebar

```
/dashboard/assistante
├── Dashboard ──────── /dashboard/assistante (KPIs, actions rapides)
├── Étudiants ──────── /dashboard/assistante/students (liste, activation)
├── Coaches ────────── /dashboard/assistante/coaches (profils, matières)
├── Abonnements ────── /dashboard/assistante/subscriptions (gestion)
├── Demandes Crédits ─ /dashboard/assistante/credit-requests (validation)
├── Paiements ──────── /dashboard/assistante/paiements (validation virements)
│
└── (hors sidebar) :
    ├── Dem. Abonnement /dashboard/assistante/subscription-requests
    ├── Crédits ─────── /dashboard/assistante/credits
    └── Documents ───── /dashboard/assistante/docs
```

### COACH — Sidebar (4 liens)

```
/dashboard/coach
├── Dashboard ──────── /dashboard/coach (sessions à venir, stats)
├── Mes Sessions ───── /dashboard/coach/sessions (liste, rapports)
├── Mes Étudiants ──── /dashboard/coach/students (profils élèves)
└── Disponibilités ─── /dashboard/coach/availability (créneaux)
│
└── Actions :
    └── Rapport de session ▶ POST /api/coach/sessions/[id]/report
```

### PARENT — Sidebar (5 liens) + Dialogs + sous-pages

```
/dashboard/parent
├── Dashboard ──────── /dashboard/parent (enfants, crédits, factures)
├── Mes Enfants ────── /dashboard/parent/children (profils, progression)
├── Abonnements ────── /dashboard/parent/abonnements (formules actives)
├── Paiements ──────── /dashboard/parent/paiement (déclaration virement)
│   └── /dashboard/parent/paiement/confirmation
├── Ressources ─────── /dashboard/parent/ressources (coffre-fort documents)
│
└── Modales (depuis dashboard) :
    ├── AddChildDialog ────────── Ajouter un enfant
    ├── CreditPurchaseDialog ──── Acheter crédits
    ├── SubscriptionChangeDialog─ Changer formule
    ├── AriaAddonDialog ───────── Ajouter ARIA add-on
    └── InvoiceDetailsDialog ──── Détails facture
```

### ELEVE — Sidebar (4 liens)

```
/dashboard/eleve
├── Dashboard ──────── /dashboard/eleve (crédits, badges, ARIA stats, Nexus Index)
├── Mes Sessions ───── /dashboard/eleve/mes-sessions (historique)
├── Réserver Session ─ /dashboard/eleve/sessions (booking coach)
├── Ressources ─────── /dashboard/eleve/ressources (documents coffre-fort)
│
└── Fonctionnalités (depuis dashboard) :
    ├── ARIA Chat ─────── POST /api/aria/chat (🔑 entitlement aria_maths/aria_nsi)
    ├── ARIA Feedback ─── POST /api/aria/feedback
    ├── Nexus Index ───── GET /api/student/nexus-index
    ├── Badges ────────── Gamification intégrée (GET /api/students/[id]/badges)
    ├── Trajectoire ───── /dashboard/trajectoire
    └── Vidéo Session ─── /session/video (Jitsi Meet intégré)
```

### Pages Communes (tous rôles connectés)

```
/dashboard ────────────── Redirect vers /dashboard/{role}
/dashboard/trajectoire ── Trajectoire de progression
/session/video ────────── Visioconférence Jitsi Meet
/access-required ──────── Page refus d'accès (entitlement manquant)
Bouton Déconnexion ────── Sidebar footer ──▶ /auth/signin
```

---

## 7. Pages Spécialisées (hors dashboards)

### Évaluations (Assessment Engine)

```
/assessments/[id]/processing ── Page d'attente pendant scoring
/assessments/[id]/result ────── Résultats: SSN, radar domaines, heatmap skills
  ├── SSNCard (score normalisé + percentile)
  ├── ResultRadar (Recharts radar par domaine)
  ├── SkillHeatmap (grille couleur par compétence)
  └── SimulationPanel (simulation what-if, pas de DB)
```

### Programmes Interactifs

```
/programme/maths-1ere ──── Programme Maths 1ère (22 composants, store Zustand)
/programme/maths-terminale  Programme Maths Terminale
/maths-1ere ───────────── Page legacy (redirect possible)
```

### Autres

```
/studio ────── Page studio (contenu éditorial)
/test ─────── Page de test (développement)
```

---

## 8. API Routes (81 endpoints)

### Authentification (2)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | Handlers NextAuth v5 |
| POST | `/api/auth/reset-password` | Reset password (demande + exécution) |

### Admin (12)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/admin/dashboard` | KPIs admin |
| GET | `/api/admin/analytics` | Métriques plateforme |
| GET | `/api/admin/activities` | Journal d'activités |
| GET/POST/PATCH/DELETE | `/api/admin/users` | CRUD utilisateurs |
| GET | `/api/admin/users/search` | Recherche utilisateurs (ELEVE/PARENT) |
| GET/POST | `/api/admin/subscriptions` | Gestion abonnements |
| GET/POST | `/api/admin/invoices` | Liste/création factures |
| GET/PATCH | `/api/admin/invoices/[id]` | Détail/modification facture |
| POST | `/api/admin/invoices/[id]/send` | Envoi facture par email |
| GET/POST | `/api/admin/documents` | Upload documents coffre-fort |
| POST | `/api/admin/recompute-ssn` | Recalcul SSN batch (ADMIN only) |
| POST | `/api/admin/test-email` | Test envoi SMTP |
| GET | `/api/admin/directeur/stats` | KPIs directeur |

### Assistante (8)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/assistant/dashboard` | KPIs assistante |
| GET | `/api/assistant/students` | Liste étudiants |
| POST | `/api/assistant/activate-student` | Activation compte élève |
| GET | `/api/assistant/coaches` | Liste coaches |
| GET/PATCH | `/api/assistant/coaches/[id]` | Détail/modification coach |
| GET/POST | `/api/assistant/subscriptions` | Gestion abonnements |
| GET/POST | `/api/assistant/subscription-requests` | Demandes changement abo |
| GET/POST | `/api/assistant/credit-requests` | Demandes crédits |

### Parent (5)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/parent/dashboard` | KPIs parent |
| GET/POST | `/api/parent/children` | Enfants (liste + ajout) |
| POST | `/api/parent/credit-request` | Demande achat crédits |
| GET | `/api/parent/subscriptions` | Abonnements actifs |
| POST | `/api/parent/subscription-requests` | Demande changement formule |

### Élève (8)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/student/dashboard` | KPIs élève |
| POST | `/api/student/activate` | Activation compte (token) |
| GET | `/api/student/sessions` | Sessions élève |
| GET | `/api/student/credits` | Solde crédits |
| GET | `/api/student/documents` | Documents coffre-fort |
| GET | `/api/student/nexus-index` | Nexus Index (score composite) |
| GET | `/api/student/resources` | Ressources pédagogiques |
| GET | `/api/student/trajectory` | Trajectoire de progression |

### Coach (3)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/coach/dashboard` | KPIs coach |
| GET | `/api/coach/sessions` | Sessions coach |
| POST | `/api/coach/sessions/[id]/report` | Rapport de session |

### ARIA — IA Pédagogique (3)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/aria/chat` | Chat IA (🔑 entitlement-gated) |
| GET | `/api/aria/conversations` | Historique conversations |
| POST | `/api/aria/feedback` | Feedback réponse IA |

### Assessments — Évaluations (6)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/assessments/submit` | Soumission évaluation |
| GET | `/api/assessments/[id]/result` | Résultats (SSN, domaines, skills) |
| GET | `/api/assessments/[id]/status` | Statut pipeline |
| GET | `/api/assessments/[id]/export` | Export PDF (react-pdf) |
| POST | `/api/assessments/predict` | Prédiction SSN (Ridge regression) |
| POST | `/api/assessments/test` | Test assessment engine |

### Sessions (3)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/sessions/book` | Réservation session (🔑 credits_use) |
| POST | `/api/sessions/cancel` | Annulation session (+ refund) |
| POST | `/api/sessions/video` | Génération lien Jitsi Meet |

### Coaches (2)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/coaches/availability` | Disponibilités coach |
| GET | `/api/coaches/available` | Coaches disponibles |

### Paiements (5)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/payments/bank-transfer/confirm` | Déclaration virement |
| GET | `/api/payments/check-pending` | Anti-double paiement |
| GET | `/api/payments/pending` | Paiements en attente (staff) |
| POST | `/api/payments/validate` | Validation/rejet paiement |
| POST | `/api/payments/clictopay/init` | Init ClicToPay (501 skeleton) |

### Facturation (3)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/invoices/[id]/pdf` | Téléchargement PDF facture |
| GET | `/api/invoices/[id]/receipt/pdf` | Téléchargement reçu PDF |
| GET | `/api/documents/[id]` | Téléchargement document coffre-fort |

### Abonnements (2)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/subscriptions/change` | Changement formule |
| POST | `/api/subscriptions/aria-addon` | Ajout add-on ARIA |

### Diagnostics & Bilans (5)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/diagnostics/definitions` | Définitions diagnostiques (4 matières) |
| POST | `/api/bilan-gratuit` | Inscription bilan gratuit |
| POST | `/api/bilan-pallier2-maths` | Soumission quiz diagnostique |
| POST | `/api/bilan-pallier2-maths/retry` | Relance génération LLM |
| POST | `/api/stages/submit-diagnostic` | Soumission QCM stage |

### Transversales (10)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Healthcheck |
| POST | `/api/contact` | Formulaire contact |
| POST/GET | `/api/reservation` | Réservation stage |
| GET | `/api/reservation/verify` | Vérification réservation |
| GET | `/api/notifications` | Notifications utilisateur |
| POST | `/api/notify/email` | Envoi email (CSRF + rate limit) |
| POST | `/api/messages/send` | Envoi message interne |
| GET | `/api/messages/conversations` | Conversations |
| GET | `/api/me/next-step` | Prochaine étape recommandée |
| POST | `/api/analytics/event` | Tracking événement analytics |
| GET | `/api/students/[studentId]/badges` | Badges gamification |
| POST | `/api/programme/maths-1ere/progress` | Progression programme 1ère |
| POST | `/api/programme/maths-terminale/progress` | Progression programme Tle |

---

## 9. Redirections Automatiques

| Source | Destination | Type | Raison |
|--------|-------------|------|--------|
| `/inscription` | `/bilan-gratuit` | 307 | Legacy URL |
| `/questionnaire` | `/bilan-gratuit` | 307 | Legacy URL |
| `/tarifs` | `/offres` | 307 | Legacy URL |
| `/academies-hiver` | `/stages` | 301 | Renommage |
| `/plateforme` | `/plateforme-aria` | 301 | Renommage |
| `/education` | `/accompagnement-scolaire` | 301 | Renommage |
| `/stages` | `/stages/fevrier-2026` | redirect | Page index |
| `/dashboard` | `/dashboard/{role}` | redirect | Dispatch par rôle |
| `/dashboard/*` (non auth) | `/auth/signin` | middleware | Session requise |
| `/auth/*` (déjà auth) | `/dashboard/{role}` | middleware | Déjà connecté |

---

## 10. Matrice d'Accès & Permissions

```
Page / Route                │ Public │ ADMIN │ ASSIS │ COACH │ PAR │ ELE
────────────────────────────┼────────┼───────┼───────┼───────┼─────┼─────
/                           │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/offres                     │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/bilan-gratuit              │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/bilan-pallier2-maths       │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/stages/*                   │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/contact                    │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/programme/*                │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/conditions                 │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/assessments/[id]/*         │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
────────────────────────────┼────────┼───────┼───────┼───────┼─────┼─────
/auth/signin                │   ✅   │  ↩️   │  ↩️   │  ↩️   │ ↩️  │ ↩️
/auth/activate              │   ✅   │  ↩️   │  ↩️   │  ↩️   │ ↩️  │ ↩️
/auth/reset-password        │   ✅   │  ↩️   │  ↩️   │  ↩️   │ ↩️  │ ↩️
────────────────────────────┼────────┼───────┼───────┼───────┼─────┼─────
/dashboard/admin/*          │   🔒   │  ✅   │  ❌   │  ❌   │ ❌  │ ❌
/admin/directeur            │   🔒   │  ✅   │  ❌   │  ❌   │ ❌  │ ❌
/admin/stages/*             │   🔒   │  ✅   │  ❌   │  ❌   │ ❌  │ ❌
/dashboard/assistante/*     │   🔒   │  ❌   │  ✅   │  ❌   │ ❌  │ ❌
/dashboard/coach/*          │   🔒   │  ❌   │  ❌   │  ✅   │ ❌  │ ❌
/dashboard/parent/*         │   🔒   │  ❌   │  ❌   │  ❌   │ ✅  │ ❌
/dashboard/eleve/*          │   🔒   │  ❌   │  ❌   │  ❌   │ ❌  │ ✅
/dashboard/trajectoire      │   🔒   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/session/video              │   🔒   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅

✅ = Accès   ❌ = Refusé (redirect /auth/signin)
🔒 = Auth requise   ↩️ = Redirect /dashboard/{role}
```

---

## 11. Feature Gating (Entitlements)

Certaines fonctionnalités nécessitent un **entitlement actif** (lié à l'abonnement) :

| Fonctionnalité | Feature Key | Si refusé | Rôles exemptés |
|----------------|-------------|-----------|----------------|
| Accès Plateforme | `platform_access` | ▶ `/access-required` | ADMIN, ASSISTANTE, COACH |
| ARIA Maths | `aria_maths` | ▶ `/access-required` | ADMIN |
| ARIA NSI | `aria_nsi` | ▶ `/access-required` | ADMIN |
| Sessions Hybrides | `hybrid_sessions` | Bouton désactivé | ADMIN, ASSISTANTE |
| Mode Immersion | `immersion_mode` | Bouton désactivé | ADMIN, ASSISTANTE |
| Utilisation Crédits | `credits_use` | ▶ `/access-required` | ADMIN, ASSISTANTE |
| Feedback IA | `ai_feedback` | Élément masqué | ADMIN |
| Analytiques Avancées | `advanced_analytics` | Élément masqué | ADMIN |
| Support Prioritaire | `priority_support` | Élément masqué | ADMIN |
| Facturation Admin | `admin_facturation` | ▶ `/access-required` | ADMIN |

### Page `/access-required`

```
Affiche : nom fonctionnalité · raison du refus · entitlements manquants
CTAs : [Voir les offres ▶ /offres] · [Contacter Nexus] · [Retour dashboard]
```

---

## 12. Graphe Complet

### Tous les chemins depuis `/` (Accueil)

```
/ (ACCUEIL)
│
├──▶ /bilan-gratuit ──▶ /bilan-gratuit/confirmation
│     │                 /bilan-gratuit/assessment
│     (Hero, Paths, Testimonials, Navbar)
│
├──▶ /offres
│     (Hero, Paths, Offers, Navbar, Footer)
│
├──▶ /contact
│     (Paths, Navbar, Footer)
│
├──▶ /accompagnement-scolaire (Navbar, Footer)
├──▶ /stages ──▶ /stages/fevrier-2026
│                 ├── /diagnostic (QCM 50Q)
│                 └── /bilan/[reservationId]
├──▶ /stages/dashboard-excellence
├──▶ /plateforme-aria (Navbar, Footer)
├──▶ /equipe (Navbar, Footer)
├──▶ /notre-centre (Navbar, Footer)
├──▶ /famille (Footer)
├──▶ /academy (Navbar)
├──▶ /consulting
├──▶ /programme/maths-1ere (22 composants interactifs)
├──▶ /programme/maths-terminale
├──▶ /bilan-pallier2-maths ──▶ /confirmation · /dashboard · /resultat/[id]
├──▶ /assessments/[id]/processing · /assessments/[id]/result
├──▶ /conditions (Footer)
├──▶ /mentions-legales (Footer)
│
├──▶ /auth/signin (Navbar "Connexion")
│     ├──▶ /auth/mot-de-passe-oublie ──▶ /auth/reset-password
│     └──▶ /dashboard/{role} (après login)
│           │
│           ├── ADMIN ──▶ /dashboard/admin
│           │   ├── /users · /analytics · /subscriptions
│           │   ├── /activities · /tests · /documents · /facturation
│           │   └── /admin/directeur · /admin/stages/fevrier-2026
│           │
│           ├── ASSISTANTE ──▶ /dashboard/assistante
│           │   ├── /students · /coaches · /subscriptions
│           │   ├── /credit-requests · /paiements
│           │   └── /subscription-requests · /credits · /docs
│           │
│           ├── COACH ──▶ /dashboard/coach
│           │   └── /sessions · /students · /availability
│           │
│           ├── PARENT ──▶ /dashboard/parent
│           │   ├── /children · /abonnements · /paiement · /ressources
│           │   ├── /paiement/confirmation
│           │   └── Modales: crédits, abo, enfant, ARIA, factures
│           │
│           └── ELEVE ──▶ /dashboard/eleve
│               ├── /mes-sessions · /sessions · /ressources
│               ├── ARIA Chat (🔑) · Nexus Index · Badges
│               ├── /session/video (Jitsi Meet)
│               └── /dashboard/trajectoire
│
└──▶ /auth/activate?token=xxx (Email activation élève)
      └──▶ /auth/signin
```

---

> **Nexus Réussite** — Carte de Navigation Complète
> © 2026 Nexus Réussite. Tous droits réservés.

# Nexus Réussite — Carte de Navigation Complète

> Tous les cheminements de navigation, de la page d'accueil vers chaque page, dashboard, ressource et service.

---

## Table des Matières

1. [Vue Globale](#1-vue-globale)
2. [Page d'Accueil — Points de Sortie](#2-page-daccueil--points-de-sortie)
3. [Navbar & Footer — Liens Permanents](#3-navbar--footer--liens-permanents)
4. [Pages Publiques — Interconnexions](#4-pages-publiques--interconnexions)
5. [Flux d'Authentification](#5-flux-dauthentification)
6. [Dashboards par Rôle](#6-dashboards-par-rôle)
7. [Redirections Automatiques](#7-redirections-automatiques)
8. [Matrice d'Accès & Permissions](#8-matrice-daccès--permissions)
9. [Feature Gating (Entitlements)](#9-feature-gating-entitlements)
10. [Graphe Complet](#10-graphe-complet)

---

## 1. Vue Globale

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
  │                │  │             │  │                  │
  │ /offres        │  │ /signin     │  │ /accompagnement  │
  │ /bilan-gratuit │  │ /activate   │  │ /plateforme-aria │
  │ /stages        │  │ /reset-pwd  │  │ /equipe          │
  │ /contact       │  │             │  │ /notre-centre    │
  │ /programme/*   │  └──────┬──────┘  │ /famille         │
  └────────────────┘         │         │ /academy         │
                             │         │ /consulting      │
                      ┌──────▼──────┐  └──────────────────┘
                      │ MIDDLEWARE  │
                      │ Auth Check  │
                      └──────┬──────┘
                             │
          ┌──────────┬───────┼───────┬──────────┐
          ▼          ▼       ▼       ▼          ▼
      ┌───────┐ ┌────────┐ ┌─────┐ ┌──────┐ ┌──────┐
      │ ADMIN │ │ASSIST. │ │COACH│ │PARENT│ │ELEVE │
      │6 pages│ │6 pages │ │4 pg │ │5 pg  │ │4 pg  │
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
│      │  │ └─ /confirmation│  │  │ 3 plans │  │  scolaire         │
│      │─▶│                │  │  │ 3 packs │  └───────────────────┘
└──┬───┘  └────────────────┘  │  │ 2 addons│
   │               ▲          │  └─────────┘
   │               │          │       ▲
   │  ┌────────────┴───┐     │       │
   │  │ /stages         │     │  ┌────┴───────────┐
   │  │ └─ /fevrier-26  │     │  │/plateforme-aria│
   │  │    └─ /diagnostic│     │  └────────────────┘
   │  └────────────────┘     │
   │                          │
   ├──▶ /equipe · /notre-centre · /famille · /academy · /consulting
   │
   ├──▶ /programme/* (24 sous-pages par matière/niveau)
   │
   └──▶ /conditions · /mentions-legales
```

### `/bilan-gratuit` — Formulaire Lead Gen

```
Formulaire multi-étapes (parent + enfant + objectifs)
  └── Soumission ▶ POST /api/bilan-gratuit ▶ /bilan-gratuit/confirmation
Lien "Pas encore de compte ?" ▶ /auth/signin
```

### `/offres` — Tarifs

```
3 Formules : Plateforme (150 TND) · Hybride (450 TND) ⭐ · Immersion (750 TND)
3 Packs : Grand Oral (300) · Parcoursup (450) · Académie (750)
2 Add-ons ARIA : +1 matière (50/mois) · Toutes matières (120/mois)
CTAs ▶ /bilan-gratuit
```

### `/stages` — Stages Intensifs

```
/stages ──redirect──▶ /stages/fevrier-2026
  ├── Réservation ▶ POST /api/reservation
  └── /stages/fevrier-2026/diagnostic (QCM 50 questions)
      └── Soumission ▶ POST /api/stages/submit-diagnostic
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

### ADMIN — Sidebar (7 liens)

```
/dashboard/admin
├── Dashboard ──────── /dashboard/admin (KPIs, santé système)
├── Utilisateurs ───── /dashboard/admin/users (CRUD)
├── Analytics ──────── /dashboard/admin/analytics
├── Abonnements ────── /dashboard/admin/subscriptions
├── Activités ──────── /dashboard/admin/activities
├── Tests Système ──── /dashboard/admin/tests
├── Documents ──────── /dashboard/admin/documents
└── (hors sidebar) ─── /dashboard/admin/facturation
```

### ASSISTANTE — Sidebar (6 liens)

```
/dashboard/assistante
├── Dashboard ──────── /dashboard/assistante
├── Étudiants ──────── /dashboard/assistante/students
├── Coaches ────────── /dashboard/assistante/coaches
├── Abonnements ────── /dashboard/assistante/subscriptions
├── Demandes Crédits ─ /dashboard/assistante/credit-requests
├── Paiements ──────── /dashboard/assistante/paiements
└── (hors sidebar) ─── /subscription-requests · /credits · /docs
```

### COACH — Sidebar (4 liens)

```
/dashboard/coach
├── Dashboard ──────── /dashboard/coach
├── Mes Sessions ───── /dashboard/coach/sessions
├── Mes Étudiants ──── /dashboard/coach/students
└── Disponibilités ─── /dashboard/coach/availability
```

### PARENT — Sidebar (5 liens) + Dialogs

```
/dashboard/parent
├── Dashboard ──────── /dashboard/parent
├── Mes Enfants ────── /dashboard/parent/children
├── Abonnements ────── /dashboard/parent/abonnements
├── Paiements ──────── /dashboard/parent/paiement
├── Ressources ─────── /dashboard/parent/ressources
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
├── Dashboard ──────── /dashboard/eleve (crédits, badges, ARIA stats)
├── Mes Sessions ───── /dashboard/eleve/mes-sessions
├── Réserver Session ─ /dashboard/eleve/sessions
├── Ressources ─────── /dashboard/eleve/ressources
│
└── Fonctionnalités (depuis dashboard) :
    ├── ARIA Chat ─────── POST /api/aria/chat (🔑 entitlement)
    ├── Nexus Index ───── GET /api/student/nexus-index
    ├── Badges ────────── Gamification intégrée
    └── Trajectoire ───── /dashboard/trajectoire
```

### Pages Communes

```
/dashboard/trajectoire ── Accessible par tous les rôles connectés
/access-required ──────── Page refus d'accès (entitlement manquant)
Bouton Déconnexion ────── Sidebar footer ──▶ /auth/signin
```

---

## 7. Redirections Automatiques

| Source | Destination | Type | Raison |
|--------|-------------|------|--------|
| `/inscription` | `/bilan-gratuit` | 307 | Legacy URL |
| `/questionnaire` | `/bilan-gratuit` | 307 | Legacy URL |
| `/tarifs` | `/offres` | 307 | Legacy URL |
| `/academies-hiver` | `/stages` | 301 | Renommage |
| `/plateforme` | `/plateforme-aria` | 301 | Renommage |
| `/education` | `/accompagnement-scolaire` | 301 | Renommage |
| `/stages` | `/stages/fevrier-2026` | redirect | Page index |
| `/dashboard/*` (non auth) | `/auth/signin` | middleware | Session requise |
| `/auth/*` (déjà auth) | `/dashboard/{role}` | middleware | Déjà connecté |

---

## 8. Matrice d'Accès & Permissions

```
Page / Route                │ Public │ ADMIN │ ASSIS │ COACH │ PAR │ ELE
────────────────────────────┼────────┼───────┼───────┼───────┼─────┼─────
/                           │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/offres                     │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/bilan-gratuit              │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/stages/*                   │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/contact                    │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/programme/*                │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
/conditions                 │   ✅   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅
────────────────────────────┼────────┼───────┼───────┼───────┼─────┼─────
/auth/signin                │   ✅   │  ↩️   │  ↩️   │  ↩️   │ ↩️  │ ↩️
/auth/activate              │   ✅   │  ↩️   │  ↩️   │  ↩️   │ ↩️  │ ↩️
/auth/reset-password        │   ✅   │  ↩️   │  ↩️   │  ↩️   │ ↩️  │ ↩️
────────────────────────────┼────────┼───────┼───────┼───────┼─────┼─────
/dashboard/admin/*          │   🔒   │  ✅   │  ❌   │  ❌   │ ❌  │ ❌
/dashboard/assistante/*     │   🔒   │  ❌   │  ✅   │  ❌   │ ❌  │ ❌
/dashboard/coach/*          │   🔒   │  ❌   │  ❌   │  ✅   │ ❌  │ ❌
/dashboard/parent/*         │   🔒   │  ❌   │  ❌   │  ❌   │ ✅  │ ❌
/dashboard/eleve/*          │   🔒   │  ❌   │  ❌   │  ❌   │ ❌  │ ✅
/dashboard/trajectoire      │   🔒   │  ✅   │  ✅   │  ✅   │ ✅  │ ✅

✅ = Accès   ❌ = Refusé (redirect /auth/signin)
🔒 = Auth requise   ↩️ = Redirect /dashboard/{role}
```

---

## 9. Feature Gating (Entitlements)

Certaines fonctionnalités nécessitent un **entitlement actif** (lié à l'abonnement) :

| Fonctionnalité | Entitlement | Si refusé | Rôles exemptés |
|----------------|-------------|-----------|----------------|
| ARIA Maths | `aria_maths` | ▶ `/access-required` | ADMIN |
| ARIA NSI | `aria_nsi` | ▶ `/access-required` | ADMIN |
| Sessions Hybrides | `hybrid_sessions` | Bouton désactivé | ADMIN, ASSISTANTE |
| Mode Immersion | `immersion_mode` | Bouton désactivé | ADMIN, ASSISTANTE |
| Utilisation Crédits | `credits_use` | ▶ `/access-required` | ADMIN, ASSISTANTE |
| Analytiques Avancées | `advanced_analytics` | Élément masqué | ADMIN |
| Facturation Admin | `admin_facturation` | ▶ `/access-required` | ADMIN |

### Page `/access-required`

```
Affiche : nom fonctionnalité · raison du refus · entitlements manquants
CTAs : [Voir les offres ▶ /offres] · [Contacter Nexus] · [Retour dashboard]
```

---

## 10. Graphe Complet

### Tous les chemins depuis `/` (Accueil)

```
/ (ACCUEIL)
│
├──▶ /bilan-gratuit ──▶ /bilan-gratuit/confirmation
│     (Hero, Paths, Testimonials, Navbar)
│
├──▶ /offres
│     (Hero, Paths, Offers, Navbar, Footer)
│
├──▶ /contact
│     (Paths, Navbar, Footer)
│
├──▶ /accompagnement-scolaire (Navbar, Footer)
├──▶ /stages ──▶ /stages/fevrier-2026 ──▶ /stages/fevrier-2026/diagnostic
├──▶ /plateforme-aria (Navbar, Footer)
├──▶ /equipe (Navbar, Footer)
├──▶ /notre-centre (Navbar, Footer)
├──▶ /famille (Footer)
├──▶ /academy (Navbar)
├──▶ /consulting
├──▶ /programme/* (24 sous-pages)
├──▶ /conditions (Footer)
├──▶ /mentions-legales (Footer)
│
├──▶ /auth/signin (Navbar "Connexion")
│     ├──▶ /auth/mot-de-passe-oublie ──▶ /auth/reset-password
│     └──▶ /dashboard/{role} (après login)
│           │
│           ├── ADMIN ──▶ /dashboard/admin
│           │   ├── /users · /analytics · /subscriptions
│           │   ├── /activities · /tests · /documents
│           │   └── /facturation
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
│           │   └── Modales: crédits, abo, enfant, ARIA, factures
│           │
│           └── ELEVE ──▶ /dashboard/eleve
│               ├── /mes-sessions · /sessions · /ressources
│               ├── ARIA Chat (🔑) · Nexus Index · Badges
│               └── /dashboard/trajectoire
│
└──▶ /auth/activate?token=xxx (Email activation élève)
      └──▶ /auth/signin
```

---

> **Nexus Réussite** — Carte de Navigation Complète
> © 2026 Nexus Réussite. Tous droits réservés.

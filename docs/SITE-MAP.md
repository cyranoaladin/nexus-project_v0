# Site Map — Nexus Reussite

**Date :** 2026-06-20 | **Source :** audit app/ routes + next.config.mjs

## Pages publiques (GARDER)

| Route | Nav | Sitemap | Capture contact |
|-------|-----|---------|-----------------|
| `/` | Logo | 1.0 | form + WA |
| `/offres` | Header+Footer | 0.9 | form + WA |
| `/stages` | Header+Footer | 0.9 | form + WA |
| `/stages/[stageSlug]` | Listing | dynamic | WA |
| `/bilan-gratuit` | CTA | 0.9 | form (tunnel) |
| `/accompagnement-scolaire` | Header+Footer | 0.8 | form + WA |
| `/plateforme-aria` | Header+Footer | 0.7 | form + WA |
| `/equipe` | Footer | 0.7 | WA |
| `/notre-centre` | Header+Footer | 0.6 | form + WA |
| `/contact` | Header+Footer | 0.6 | form + WA |
| `/recommandation` | Header | 0.8 | form + WA |
| `/ressources` | Footer | 0.5 | WA |
| `/famille` | Sections | 0.8 | WA |
| `/mentions-legales` | Footer | 0.3 | - |
| `/conditions-generales` | Footer | 0.3 | - |
| `/politique-confidentialite` | Contact | 0.3 | - |

## SEO niches (GARDER)

| Route | Sitemap |
|-------|---------|
| `/grand-oral` | 0.6 |
| `/reussir-eaf` | 0.6 |
| `/candidat-libre-bac-francais` | 0.6 |
| `/preparation-bac-francais-tunis` | 0.6 |
| `/programme/maths-1ere` | 0.5 |
| `/corrige_dnb_maths_2026` | 0.4 |

## Auth

| Route | Usage |
|-------|-------|
| `/auth/signin` | Connexion |
| `/auth/activate` | Activation email |
| `/auth/mot-de-passe-oublie` | Reset password |
| `/auth/reset-password` | Reset token |
| `/access-required` | Gate entitlement |

## Dashboards

| Role | Routes | Nav complet |
|------|--------|-------------|
| ADMIN | /dashboard/admin + users/analytics/subscriptions/activities/stages/facturation/documents/tests | Oui |
| ASSISTANTE | /dashboard/assistante + students/planning/assignments/coaches/subscriptions/paiements/facturation/devis/stages/docs/credits/credit-requests/subscription-requests | Oui |
| COACH | /dashboard/coach + sessions/students/availability/stages/nsi-pratique-2026/npc/eaf-stage-printemps/maths-premiere-stage-printemps | Oui |
| ELEVE | /dashboard/eleve + nsi-pratique-2026/npc/automatismes/eam/documents/sessions/programme/questionnaires/bilans/stages | Oui |
| PARENT | /dashboard/parent + abonnements/paiement/factures/ressources/stages/npc/children/enfant/[id] | Oui |

## Redirections (301/307)

| Source | Destination | Type |
|--------|-------------|------|
| /academies-hiver | /stages | 301 |
| /plateforme | /plateforme-aria | 301 |
| /education | /accompagnement-scolaire | 301 |
| /inscription | /bilan-gratuit | 307 |
| /questionnaire | /bilan-gratuit | 307 |
| /tarifs | /offres | 307 |
| /mentions-legales.html | /mentions-legales | 301 |
| /confidentialite.html | /politique-confidentialite | 301 |
| /catalogue-*.html | /offres | 301 |
| /nexus_selecteur.html | /recommandation | 301 |
| /conditions | /conditions-generales | redirect() |

## Pages supprimees (2026-06-20)

| Route | Raison |
|-------|--------|
| /stages/dashboard-excellence | Prototype mort, 0 lien |
| /studio | B2B hors coeur, 0 lien interne |
| /academy | B2B Web3, hors coeur tutorat |
| /consulting | B2B IT, hors coeur tutorat |
| /teacher/lamis | Vue enseignant, 0 lien |
| /education | Redirect 301, page jamais rendue |
| /(platform)/outils/livret-stmg | Redirect, 0 lien entrant |
| /dashboard/eleve/mes-sessions | Fusionne avec /sessions |
| /planning_stage_printemps | Stage passe (printemps 2026) |
| /stages/fevrier-2026 | Stage passe (fevrier 2026) |

## Coherence rendu vs registre

| Page | Prix canoniques trouves | line-through | prix barre |
|------|------------------------|-------------|------------|
| /offres | 20/20 | 0 | 0 |
| /stages | 5/8 (3 formats specifiques) | 0 | 0 |
| Groupes 5 max | Present | - | - |
| Plancher stage | >= 420 TND | - | - |

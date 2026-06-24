# Site Map — Nexus Reussite

> Ce document est **supersédé** par `docs/architecture/SITE_MAP.md` (version automatisée de l’inventaire des routes et du graphe).

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
| `/ressources` | Header+Footer | 0.5 | WA |
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
| /corrige_dnb_maths_2026 | /ressources | 301 |
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

## Coherence rendu vs registre (offre par offre)

| Page | Prix canoniques | Detail | line-through | prix barre |
|------|-----------------|--------|-------------|------------|
| /offres | 20/20 | Toutes offres annuelles | 0 | 0 |
| /stages listing | 5/5 | Formats listing (express/solo/renfort/duo/vacances) | 0 | 0 |
| /stages editions | 3/3 | Formats edition-only (duo-plus/sprint-final/sprint-max) dans stage_editions | 0 | 0 |

Invariants verifies par offre (tests commites) :
- monthly_display == round(price_annual / 10) pour les 20 offres
- group_max <= 5 pour toutes offres + stages
- deposit + echeancier == annuel pour les 16 offres avec echeancier
- deposit + solde == prix pour les 8 formats stage
- plancher stage >= 420 TND
- 0 prix barré / badge promotionnel obsolète / discount_pct / "valeur réelle"
- Nexus Select : 540 + 1260 == 1800, 1800/40 == 45
- 14 composites : per_hour == round(price/hours)

## Routes resolues

| Route | Decision | Lien |
|-------|----------|------|
| /admin/directeur | GARDER | Nav admin "Vue Directeur" |
| /session/video | GARDER | email-service.ts (lien video session) |
| credit-requests | LIER | Nav assistante |
| subscription-requests | LIER | Nav assistante |
| eleve/documents | LIER | Nav eleve |
| parent/children | LIER | Nav parent |
| mes-sessions | FUSIONNER | Supprime, garde sessions |

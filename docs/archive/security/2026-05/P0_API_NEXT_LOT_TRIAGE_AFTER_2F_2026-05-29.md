# P0-004 — Triage du prochain lot après Lot 2F

## Contexte
- Lot 2F déployé production : oui, runtime `6237a6be3 fix(security): harden stage reservation access`.
- Inventaire régénéré : 164 routes, 42 P0 statiques.
- Go-live large : NON autorisé.
- Bêta contrôlée : maintenue.

## Triage court après Lot 2F

- Routes inventoriées : 164.
- P0 statiques restants : 42, dont plusieurs déjà traités mais encore bruyants dans l'inventaire statique.
- Candidats principaux :
  - Lot 2F-bis Admin stages : 4 routes dynamiques staff/admin encore P0 statiques.
  - Lot 2G Bilans/reports visibility : routes parent/coach/stage bilans et reports pédagogiques, avec audiences multiples et contenu sensible.

## Candidat A — Lot 2F-bis Admin stages

| Critère | Évaluation |
|---|---|
| Routes | `app/api/admin/stages/[stageId]/route.ts`, `coaches/route.ts`, `sessions/route.ts`, `sessions/[sessionId]/route.ts` |
| Exposition publique | Non. Routes protégées par `requireRole(ADMIN)` ou `requireAnyRole([ADMIN, ASSISTANTE])`. |
| Données sensibles | Métadonnées stages, sessions, coachs, réservations agrégées, bilans agrégés. PII directe limitée dans les projections lues. |
| Mutations | PATCH/DELETE stage, POST/DELETE coach assignment, POST/PATCH/DELETE sessions. |
| Risque IDOR | Principalement mismatch `stageId + sessionId` ou association coach/stage. La route `sessions/[sessionId]` vérifie déjà `id + stageId` via `findFirst`. |
| Tests existants | `__tests__/api/admin.stages.route.test.ts` couvre list/create/update/delete stage, list/create sessions, list/assign/unassign coaches; pas de test dédié `sessions/[sessionId]`, ni matrice complète non-admin. |
| Complexité | Faible à moyenne. Lot petit et maîtrisable, mais moins exposé car staff-only. |
| Priorité | P0-B : mutation opérationnelle staff sensible, à traiter après le risque de fuite pédagogique multi-audience. |

### Candidat Lot 2F-bis — Admin stages

| Route | Méthodes | Rôles attendus | Validation | Relation stageId vérifiée | Tests existants | Risque | Décision |
|---|---|---|---|---|---|---|---|
| `app/api/admin/stages/[stageId]/route.ts` | GET, PATCH, DELETE | ADMIN | `updateStageSchema` pour PATCH | stage chargé par `stageId`; DELETE compte réservations confirmées sur `stageId` | Partiel | Mutation/suppression stage, retour détail riche admin | Inclure Lot 2F-bis |
| `app/api/admin/stages/[stageId]/coaches/route.ts` | GET, POST, DELETE | ADMIN | `assignCoachSchema` | POST vérifie stage et coach; DELETE filtre `stageId + coachId` | Partiel | Ajout/retrait coach hors stage si test manquant | Inclure Lot 2F-bis |
| `app/api/admin/stages/[stageId]/sessions/route.ts` | GET, POST | ADMIN, ASSISTANTE | `createSessionSchema` | POST vérifie stage; coach existe si fourni | Partiel | Création séance mauvais stage / coach incohérent | Inclure Lot 2F-bis |
| `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts` | PATCH, DELETE | ADMIN, ASSISTANTE | `updateSessionSchema` | Oui, `findFirst({ id: sessionId, stageId })` | Aucun test direct identifié | Mismatch session autre stage, mutation/suppression | Inclure Lot 2F-bis |

## Candidat B — Lot 2G Bilans/reports visibility

| Critère | Évaluation |
|---|---|
| Routes | `parent/bilans/[id]/pdf`, `coach/sessions/[sessionId]/report`, routes coach stage reports, `stages/[stageSlug]/bilans`, bilans spécialisés. |
| Exposition publique | Majoritairement authentifiée, mais multi-audience parent/élève/coach/staff. Les bilans publics/tokenisés existent aussi hors noyau 2G. |
| Données sensibles | Bilans pédagogiques, `parentsMarkdown`, `nexusMarkdown`, `contentInterne`, notes coach, rapports de session, PDF parent, identité élève. |
| Mutations | Création/mise à jour de reports et bilans coach; génération/export PDF selon routes. |
| Risque IDOR | Élevé : parent/enfant, coach/élève assigné, session participant, `studentId + reportId`, PDF de bilan. |
| Tests existants | Plusieurs tests existent, mais hétérogènes. Lot 2F couvre `stages/[stageSlug]/bilans`; Lot 2C couvre generated reports NPC. `coach/sessions/[sessionId]/report` a des tests d'accès mais pas de projection minimale/no internal fields. |
| Complexité | Moyenne à élevée. À découper strictement en 3 à 5 routes. |
| Priorité | P0-A : fuite pédagogique sensible multi-audience et PDF/rapports, plus critique que mutations staff-only admin stages. |

### Candidat Lot 2G — Bilans/reports visibility

| Route | Méthodes | Audience | Données sensibles | Ownership attendu | Tests existants | Risque | Décision |
|---|---|---|---|---|---|---|---|
| `app/api/parent/bilans/[id]/pdf/route.ts` | GET | PARENT | PDF parent, nom élève, score, `parentsMarkdown` | Parent possède l'enfant et bilan publié | Pas de test API dédié identifié | PDF d'un autre enfant, erreur 500 avec détails internes | Inclure Lot 2G |
| `app/api/coach/sessions/[sessionId]/report/route.ts` | GET, POST | COACH, participant, staff | Rapport session, notes, student/coach/session inclus larges | Coach de session, parent/élève participant, staff | `coach.sessions.report.route.test.ts` | Projection large via `include`, fuite de relations complètes | Inclure Lot 2G |
| `app/api/stages/[stageSlug]/bilans/route.ts` | GET, POST | ADMIN, ASSISTANTE, COACH | `contentParent`, `contentEleve`, `contentInterne` | Staff ou coach assigné au stage; élève confirmé sur stage | `stages.bilans.idor.test.ts` | Déjà renforcé en Lot 2F, garder comme preuve/régression | Exclure du patch initial, relancer tests |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts` | GET, POST, PATCH | COACH | Rapport stage EAF, résumé élève, recommandations parent | Coach assigné à l'élève | Tests existants | Fuite champs parent/coach si projection incomplète | Inclure si lot reste petit |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts` | GET, POST, PATCH | COACH | Rapport stage maths, parent recommendations, diagnostics | Coach assigné à l'élève | Tests existants surtout régression payload | Fuite interne / coach non assigné à confirmer | Inclure si lot reste petit |
| `app/api/coach/students/[studentId]/generated-reports/**` | GET, POST, download, regenerate | COACH | PDF/report généré IA | Coach assigné + `studentId + reportId` | Lot 2C | Déjà traité par Lot 2C | Exclure comme bruit |

## Comparaison

| Critère | Admin stages | Bilans/reports | Gagnant |
|---|---|---|---|
| Exposition PII/pédagogique | Limitée et staff-only | Forte : parent/élève/coach/staff, PDF, reports | Bilans/reports |
| Routes dynamiques | `stageId`, `sessionId`, `coachId` | `id`, `sessionId`, `studentId`, `reportId`, `stageSlug` | Bilans/reports |
| Risque IDOR | Mutation staff sur mauvais stage/session | Lecture PDF/rapport d'un autre élève, projection interne | Bilans/reports |
| Tests existants | Un fichier partiel, pas `sessions/[sessionId]` | Plusieurs tests, mais projections/no-internal-fields incomplets | Bilans/reports |
| Portée rôles | ADMIN/ASSISTANTE principalement | Parent, élève, coach, staff | Bilans/reports |
| Criticité | Opérationnelle | Pédagogique sensible mineurs + PDF | Bilans/reports |
| Taille du lot | Petit | À découper strictement | Admin stages |

## Décision recommandée

- Prochain lot : `P0-004 Lot 2G — Bilans/reports visibility`.
- Justification :
  - Les routes bilans/reports manipulent des contenus pédagogiques sensibles et parfois des PDF.
  - Elles traversent plusieurs audiences : parent, élève, coach, admin/assistante.
  - Les tests existent mais ne prouvent pas toujours les projections minimales et l'absence de champs internes.
  - `coach/sessions/[sessionId]/report` retourne un rapport avec relations larges (`student`, `coach`, `session`) et mérite un durcissement prioritaire.
  - Admin stages est important mais staff-only et déjà partiellement protégé par RBAC + Zod + vérifications relationnelles.
- Routes incluses :
  - `app/api/parent/bilans/[id]/pdf/route.ts`
  - `app/api/coach/sessions/[sessionId]/report/route.ts`
  - `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts`
  - `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts`
- Routes exclues :
  - `app/api/coach/students/[studentId]/generated-reports/**` : déjà couvert par Lot 2C.
  - `app/api/stages/[stageSlug]/bilans/route.ts` : renforcé/testé par Lot 2F, à relancer en régression seulement.
  - `app/api/admin/stages/[stageId]/**` : à garder pour `Lot 2F-bis — Admin stages`.
  - Routes `app/api/bilans/**` génériques : Lot 1 indique déjà ownership/sanitization, à garder hors premier patch 2G sauf faille confirmée.
- Tests attendus :
  - parent ne télécharge pas le PDF bilan d'un autre enfant;
  - PDF bilan non publié refusé;
  - erreur PDF ne retourne pas `details` internes;
  - participant seul lit un session report, tiers refusé;
  - session report ne retourne pas objets `student`, `coach`, `session` complets ni emails/téléphones;
  - coach non assigné refusé sur reports stage EAF/maths;
  - champs internes (`contentInterne`, `nexusMarkdown`, notes coach internes, payloads LLM) absents hors rôle autorisé.
- Déploiement : séparé après CI verte.

## Go-live
- Go-live large : NON autorisé.
- Bêta contrôlée : maintenue.

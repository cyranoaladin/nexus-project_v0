# P0-004 — Triage résiduel après Lot 2E

## Contexte

- Lots déjà déployés :
  - Lot 1 : ownership initial documents, factures, bilans, sessions, réservations partielles.
  - Lot 2A : payments, webhooks, subscriptions.
  - Lot 2B : admin users, assistante students/coaches/assignments.
  - Lot 2C : NPC reports/submissions/documents/files.
  - Lot 2D : messages/conversations.
  - Lot 2E : assessments submit/test.
- Go-live large : toujours non autorisé.
- Objectif : identifier le prochain micro-lot P0 à partir de l'inventaire API régénéré.

## Inventaire P0 résiduel après Lot 2E

- Nombre total de routes : 164.
- Nombre de routes P0 statiques : 42.
- Nombre de P0 déjà traités mais encore bruyants : 25.
- Nombre de P0 réellement ouverts ou sans preuve suffisante : 17.
- Catégories principales :
  - `stages/reservations` : 10 routes P0 statiques, dont 6 à traiter en priorité.
  - `coach stage reports / bilans` : 8 routes P0 statiques, plusieurs tests existants mais audit P0 non consolidé.
  - `documents/factures/payments/assessments/NPC/assistante` : principalement bruit d'inventaire après lots fermés.

## Synthèse

| Famille | Routes suspectes | Déjà traité | Vrais P0 ouverts | Décision |
|---|---:|---:|---:|---|
| Documents | 5 | 5 | 0 | Bruit d'inventaire, preuves Lot 1/2B/2C. |
| Factures / payments | 6 | 6 | 0 | Bruit d'inventaire, preuves Lot 1/2A. |
| Bilans / reports | 14 | 6 | 8 | À auditer après stages, car moins exposé publiquement pour le noyau déjà testé. |
| Stages / reservations | 10 | 4 | 6 | Prochain micro-lot recommandé. |
| Routes publiques sensibles | 5 | 2 | 3 | À inclure si elles relèvent de stages; sinon micro-lot ultérieur. |

## Matrice détaillée

| Route | Famille | Classification | Preuve | Risque | Action recommandée | Priorité |
|---|---|---|---|---|---|---|
| `app/api/admin/invoices/[id]/route.ts` | Factures | Faux positif d'inventaire | Lot 1; `__tests__/api/admin.invoices.id.route.test.ts` | Mutation finance staff-only non détectée comme role guard par script | Améliorer inventaire ou centraliser helper admin | P1 |
| `app/api/admin/invoices/[id]/send/route.ts` | Factures | Faux positif d'inventaire | Lot 1; `__tests__/api/admin.invoices.send.route.test.ts` | Envoi facture staff-only | Améliorer inventaire | P1 |
| `app/api/invoices/[id]/pdf/route.ts` | Factures | Faux positif d'inventaire | Lot 1; `__tests__/api/invoices.pdf.route.test.ts` | PDF facture d'un autre parent | Conserver tests; futur modèle bénéficiaire explicite | P1 |
| `app/api/invoices/[id]/receipt/pdf/route.ts` | Factures | Faux positif d'inventaire | Lot 1; `__tests__/api/invoices.receipt.pdf.route.test.ts` | PDF reçu d'un autre parent | Conserver tests; futur modèle bénéficiaire explicite | P1 |
| `app/api/payments/clictopay/webhook/route.ts` | Payments | Faux positif d'inventaire | Lot 2A; webhook non product-ready `501`, signature invalide testée | Validation paiement carte abusive | Garder non commercial; implémentation provider réelle séparée | P1/P0 avant carte |
| `app/api/assessments/submit/route.ts` | Assessments | Fermé confirmé | Lot 2E; CI `26628271864`; smoke prod | Endpoint public qui écrit en base | CAPTCHA/rate limit distribué en P1 | P1 |
| `app/api/assistante/assignments/[id]/route.ts` | Assistante | Faux positif d'inventaire | Lot 2B; tests assistante assignments | Affectation abusive | Bruit script sur ownership dynamique | P1 |
| `app/api/assistante/coaches/manage/[id]/route.ts` | Assistante | Faux positif d'inventaire | Lot 2B; tests coaches manage | Mutation profil coach | Bruit script | P1 |
| `app/api/assistante/students/[studentId]/documents/route.ts` | Documents | Faux positif d'inventaire | Lot 2B; `__tests__/api/documents-access.test.ts`; absence `localPath` testée | Documents mineurs | Bruit script | P1 |
| `app/api/assistante/students/[studentId]/route.ts` | Assistante | Faux positif d'inventaire | Lot 2B; tests detail student | PII mineur | Bruit script | P1 |
| `app/api/documents/[id]/route.ts` | Documents | Faux positif d'inventaire | Lot 1; `__tests__/api/documents.id.route.test.ts` | Lecture document tiers | Centraliser `DocumentVisibilityScope` en P1 | P1 |
| `app/api/coach/students/[studentId]/documents/route.ts` | Documents | Faux positif d'inventaire | Lot 1; tests documents coach/student; assignation coach mentionnée | Document élève par coach non assigné | Garder dans bruit, recheck si helper documents évolue | P1 |
| `app/api/npc/files/[...path]/route.ts` | NPC files | Fermé confirmé | Lot 2C; path traversal smoke aucun 200; tests `npc.files`/storage | Path traversal, lecture fichier arbitraire | Bruit script sur guard manuel | P1 |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts` | NPC reports | Fermé confirmé | Lot 2C; test aucun PDF lu si `reportId` n'appartient pas au `studentId` | PDF rapport autre élève | Bruit script | P1 |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | NPC reports | Fermé confirmé | Lot 2C; tests generated reports | Régénération rapport autre élève | Bruit script | P1 |
| `app/api/coach/students/[studentId]/generated-reports/route.ts` | NPC reports | Fermé confirmé | Lot 2C; projections sans IA interne | Rapports générés autre élève | Bruit script | P1 |
| `app/api/admin/stages/[stageId]/coaches/route.ts` | Stages admin | P0 ouvert | Tests `admin.stages.route.test.ts` existent mais pas de preuve Lot P0 dédiée | Ajout/retrait coach sur mauvais stage | Inclure dans Lot 2F ou 2F-bis selon taille | P0-B |
| `app/api/admin/stages/[stageId]/route.ts` | Stages admin | P0 ouvert | Tests admin stages existent, audit P0 non consolidé | Modification/suppression stage | Inclure dans Lot 2F-bis si le lot public est trop large | P0-B |
| `app/api/admin/stages/[stageId]/sessions/route.ts` | Stages admin | P0 ouvert | Pas de preuve P0 dédiée trouvée dans plan | Création/listing sessions mauvais stage | Inclure dans Lot 2F-bis | P0-B |
| `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts` | Stages admin | P0 ouvert | Pas de preuve P0 dédiée trouvée dans plan | Mutation session non liée au stage | Inclure dans Lot 2F-bis | P0-B |
| `app/api/stages/[stageSlug]/inscrire/route.ts` | Stages public | P0 ouvert | Route publique; inventaire P0; pas de lot P0 dédié | Inscription publique, PII email/téléphone, écriture DB, spam | Prochain Lot 2F | P0-A |
| `app/api/stages/[stageSlug]/reservations/route.ts` | Stages reservations | P0 ouvert | Inventaire P0; plan seulement "corrigé partiellement" | Listing réservations d'un stage, fuite PII possible | Prochain Lot 2F | P0-A |
| `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts` | Stages reservations | À confirmer | Lot 1 a contraint `stageSlug`; test `stages/confirm.test.ts` cité | Confirmation réservation hors stage ou non-staff | Retester dans Lot 2F avec négatifs staff/non-staff | P0-B |
| `app/api/stages/[stageSlug]/bilans/route.ts` | Stages bilans | P0 ouvert | `__tests__/api/stages.bilans.idor.test.ts` existe, audit déploiement P0 non consolidé | Bilans pédagogiques par stage, parent/coach/student scope | Inclure dans Lot 2F si ≤6 routes, sinon Lot 2G bilans | P0-A |
| `app/api/stages/[stageSlug]/route.ts` | Stages public | P0 ouvert | Route publique; inventaire P0 | Données stage public, probablement volontaire | Auditer pour PII/tokens, probablement déclasser | P0-B |
| `app/api/stages/route.ts` | Stages public | P0 ouvert | Route publique; inventaire P0 | Listing public, probablement volontaire | Auditer pour PII/tokens, probablement déclasser | P0-B |
| `app/api/stages/submit-diagnostic/route.ts` | Stages public | P0 ouvert | Test `stages.submit-diagnostic.route.test.ts` existe; pas de smoke P0 dédié | Écriture publique diagnostic, PII, spam/coût | Prochain Lot 2F | P0-A |
| `app/api/bilan-gratuit/route.ts` | Bilans public | P0 ouvert | Test `bilan-gratuit.test.ts` existe, pas de clôture P0 | Endpoint public pédagogique, PII possible, écriture DB/coût | Lot ultérieur si non inclus stages | P0-A |
| `app/api/parent/bilans/[id]/pdf/route.ts` | Bilans parent | P0 ouvert | Non cité dans Lot 1 preuves; inventaire P0 | PDF bilan enfant autre parent | Lot bilans/reports après stages | P0-A |
| `app/api/coach/sessions/[sessionId]/report/route.ts` | Coach reports | P0 ouvert | Tests existants; Lot 1 mentionne fallback session legacy à revoir | Rapport session hors participant | Lot bilans/reports | P0-A |
| `app/api/coach/*stage*/students/[studentId]/*report*` | Coach stage reports | P0 ouvert groupé | Tests `coach.*report*` existent; pas de clôture P0 dédiée | Coach non assigné, parent/student markdown interne | Lot bilans/reports | P0-A |
| `app/api/student/activate/route.ts` | Activation public | À auditer manuellement | Lot 2B a ciblé activation staff; route publique laissée design | Activation abusive/token handling | Micro-lot activation public si inventaire confirme | P0-B |
| `app/api/student/automatismes/series/[id]/route.ts` | Student learning | À auditer manuellement | Pas dans lots fermés | IDOR contenu/progression élève | Lot ultérieur si P0 confirmé | P0-B |

## Faux positifs / bruit d'inventaire

| Route | Pourquoi bruit | Preuve existante | Amélioration script possible |
|---|---|---|---|
| `app/api/documents/[id]/route.ts` | Guard manuel owner/staff non reconnu | `__tests__/api/documents.id.route.test.ts`; Lot 1 | Détecter helper document owner/staff. |
| `app/api/student/documents/[id]/download/route.ts` | Ownership explicite mais route fichier sensible | `__tests__/api/student.documents.download.test.ts`; Lot 1 | Détecter lecture disque après auth. |
| `app/api/assistante/students/[studentId]/documents/route.ts` | Staff-only + projection sans `localPath` non reconnue | Lot 2B; `__tests__/api/documents-access.test.ts` | Détecter sanitizers docs assistante. |
| `app/api/npc/files/[...path]/route.ts` | Guard fichier/path traversal manuel non reconnu | Lot 2C; tests `npc.files`, `npc.storage`; smoke aucun 200 traversal | Détecter `readSecureFile`/safe path helpers. |
| `app/api/invoices/[id]/pdf/route.ts` | Scope parent/token manuel non reconnu | `__tests__/api/invoices.pdf.route.test.ts`; Lot 1 | Détecter `buildInvoiceScopeWhere`. |
| `app/api/invoices/[id]/receipt/pdf/route.ts` | Token/scope receipt manuel non reconnu | `__tests__/api/invoices.receipt.pdf.route.test.ts`; Lot 1 | Détecter token receipt / invoice scope. |
| `app/api/payments/clictopay/webhook/route.ts` | Public par nature mais neutralisé `501` | Lot 2A tests webhook; smoke production | Marquer webhook non product-ready volontaire. |
| `app/api/assessments/submit/route.ts` | Public par design mais durci | Lot 2E; CI `26628271864`; smoke production | Marquer public-write durci avec rate limit. |
| `app/api/assistante/assignments/[id]/route.ts` | Staff-only/ownership testé, script ne voit pas le contrat complet | Lot 2B tests assignments | Détecter helper assignment guard. |
| `app/api/messages/*` | Guard manuel mais inventaire OK depuis Lot 2D | Lot 2D tests + smokes | Continuer à classifier OK. |

## Vrais P0 ouverts

| Route | Risque | Pourquoi P0 | Test à créer | Correction probable |
|---|---|---|---|---|
| `app/api/stages/[stageSlug]/inscrire/route.ts` | Écriture publique PII/spam; rattachement mauvais stage | Route publique dynamique, écrit probablement réservation/lead | Payload invalide, slug inexistant, PII non exposée, rate limit, pas de token brut | Zod strict, rate limit, réponse minimale, pas de champ interne. |
| `app/api/stages/[stageSlug]/reservations/route.ts` | Listing réservations et PII d'un stage | GET dynamique staff/role attendu à confirmer | Non-auth refusé, parent/élève/coach refusés si staff-only, admin/assistante OK, pas email/phone si inutile | Staff-only, projection minimale, pagination. |
| `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts` | Confirmation réservation hors stage ou par non-staff | Lot 1 partiel, nécessite tests négatifs complets | Non-auth refusé, non-staff refusé, `reservationId` d'un autre stage refusé | Vérifier `stageSlug + reservationId`, staff-only. |
| `app/api/stages/submit-diagnostic/route.ts` | Écriture publique diagnostic, PII, spam/coût | Public write route, sensible pédagogique | Payload invalide, taille excessive, pas de détails internes, rate limit | Zod strict, rate limit, réponse minimale. |
| `app/api/stages/[stageSlug]/bilans/route.ts` | Bilans stage visibles/mutables hors scope | Pédagogique sensible, dynamique stage | Coach non assigné refusé, parent/élève hors scope refusés, staff OK | Ownership stage/student/coach, projection par rôle. |
| `app/api/admin/stages/[stageId]/**` | Mutation stage/session/coach staff sensible | Plusieurs routes dynamiques P0 non traitées en lot dédié | Non-admin refusé, stage/session mismatch refusé, payload invalides | Admin/assistante policy explicite, `stageId + sessionId` relationnelle. |

## Prochain micro-lot recommandé

- Nom : `P0-004 Lot 2F — Stages reservations public hardening`.
- Routes incluses :
  - `app/api/stages/[stageSlug]/inscrire/route.ts`
  - `app/api/stages/[stageSlug]/reservations/route.ts`
  - `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts`
  - `app/api/stages/submit-diagnostic/route.ts`
  - `app/api/stages/[stageSlug]/bilans/route.ts`
  - `app/api/stages/[stageSlug]/route.ts` et `app/api/stages/route.ts` seulement pour audit/déclassement si elles ne retournent pas de PII.
- Routes exclues :
  - Documents/factures/payments/assessments/NPC/messages : déjà couverts par lots fermés, seulement bruit d'inventaire.
  - `app/api/admin/stages/[stageId]/**` : à traiter en Lot 2F-bis si le patch public/réservations dépasse 6 routes.
  - Coach stage reports et parent bilans PDF : à traiter dans `Lot 2G — Bilans/reports visibility` si le triage stages confirme qu'ils restent ouverts.
- Justification :
  - Les routes documents/fichiers et factures ont une priorité théorique plus haute, mais elles disposent déjà de preuves Lot 1/2B/2C et de tests nommés.
  - Les routes stages combinent exposition publique, écriture DB, PII potentielle, diagnostics pédagogiques et routes dynamiques encore P0 dans l'inventaire.
  - Le plan sécurité ne les marque que partiellement corrigées, contrairement aux lots 2A-2E.
- Tests attendus :
  - `__tests__/api/stages.inscrire.security.test.ts`
  - `__tests__/api/stages.reservations.access.test.ts`
  - `__tests__/api/stages.confirm.access.test.ts`
  - `__tests__/api/stages.submit-diagnostic.route.test.ts`
  - `__tests__/api/stages.bilans.idor.test.ts`
  - tests négatifs non-auth, parent/élève/coach non autorisés, stage/reservation mismatch, payload invalide, absence email/phone/token dans réponses publiques.
- Déploiement : séparé après correction, tests locaux, push et CI verte.

## Décision go-live

- Go-live large : NON autorisé.
- Bêta contrôlée : maintenue.

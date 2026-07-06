# Lot 1-bis — Audit des requalifications P0

## Synthèse

Le contre-audit ne valide pas les requalifications par confiance aveugle dans le script. La vérification combine :

- revue du diff du script `scripts/security/audit-api-guards.mjs` ;
- test de classification synthétique `__tests__/scripts/audit-api-guards.classification.test.ts` ;
- revue des routes corrigées Lot 1 ;
- tests IDOR/no-leak existants Lot 1 ;
- régénération de `docs/security/API_GUARD_INVENTORY.md` et `docs/go-live/api-security-matrix.full.md`.

Résultat après Lot 1-bis : `P0=0`, `P1=54`, `P2=95`, `OK=27` sur 176 routes.

## Avant / après

| Priorité | Lot 0-bis | Lot 1 | Lot 1-bis |
|---|---:|---:|---:|
| P0 | 44 | 0 | 0 |
| P1 | 42 | 56 | 54 |
| P2 | 62 | 93 | 95 |
| OK | 28 | 27 | 27 |

Limite factuelle : l’inventaire complet Lot 0-bis exact n’est pas versionné séparément. Le snapshot versionné récupérable via `git show HEAD:docs/security/API_GUARD_INVENTORY.md` contient 42 P0/164 routes ; les documents Lot 1-bis/Lot 1 indiquent l’état opérationnel Lot 0-bis à 44 P0/176 routes. Cette limite est documentée, pas comblée par hypothèse.

## Méthodologie

1. Comparaison du snapshot versionné pré-Lot 1 avec l’inventaire régénéré Lot 1-bis.
2. Vérification de chaque famille de fermeture : correction code, test, staff-only, public fixe, 501.
3. Ajout d’un test de script pour empêcher les faux OK/P1 : commentaire `rateLimit` seul, route publique sensible sans contrôle, route 501, route fixe publique, réexport.
4. Durcissement de la détection `rateLimit` : seuls les appels explicites aux helpers sont comptés.

## Routes P0 fermées par correction de code

| Route | Ancien statut | Nouveau statut | Preuve |
| --- | --- | --- | --- |
| `/api/documents/[id]` | P0 | P2 | `app/api/documents/[id]/route.ts`, `__tests__/api/documents.id.route.test.ts` |
| `/api/coach/students/[studentId]/documents` | P0 | P2 | `app/api/coach/students/[studentId]/documents/route.ts`, `__tests__/api/documents-access.test.ts` |
| `/api/student/documents/[id]/download` | P0/P2 selon inventaire | P2 | `app/api/student/documents/[id]/download/route.ts`, logs sans chemin |
| `/api/invoices/[id]/pdf` | P0 | P2 | `lib/invoice/not-found.ts`, `__tests__/lib/invoice/access-scope.test.ts`, `__tests__/api/invoices.pdf.route.test.ts` |
| `/api/invoices/[id]/receipt/pdf` | P0 | P2 | `__tests__/api/invoices.receipt.pdf.route.test.ts` |
| `/api/student/activate` | P0 | P1 | `guardRateLimitAsync`, erreurs sobres, `__tests__/api/student.activate.route.test.ts` |
| `/api/lamis/teacher-report` | P0 opérationnel Lot 0-bis | P1 | Zod strict, rate limit, `__tests__/api/lamis.teacher-report.route.test.ts` |
| `/api/bilan-gratuit` | P0 | P1 | réponse neutre, strict public payload, no enumeration, `__tests__/api/bilan-gratuit.security.test.ts` |
| `/api/sessions/video` | P1 | P2 | Zod strict, rate limit, projection DB, `__tests__/api/sessions.video.route.test.ts` |
| `/api/admin/documents` | P1 | P2 | MIME/taille, projection sans `localPath`, `__tests__/api/admin.documents.route.test.ts` |

## Routes P0 fermées par tests ajoutés

- Documents : IDOR propriétaire, staff autorisé, non propriétaire sans lecture fichier.
- Factures : parent non bénéficiaire/non email legacy => 404 canonical ; admin/staff autorisés.
- Coach documents : coach non assigné => 403.
- NPC : traversal, document absent, coach non assigné sans lecture disque.
- Script audit : route dynamique sensible sans ownership reste P0 ; public sensible sans vrai rate limit reste P0.

## Routes P0 requalifiées par script

Acceptable seulement quand la requalification correspond à une preuve lisible :

- staff-only dynamique avec auth + role guard : P2/P1, pas P0 IDOR propriétaire ;
- route publique fixe sans donnée propriétaire : P2, pas OK ;
- route `501` ClicToPay : P1, pas OK ;
- route publique sensible avec Zod + rate limit : P1, pas OK ;
- réexport : classé selon la source réexportée.

## Routes P0 requalifiées staff-only

| Route | Ancien | Nouveau | Verdict |
| --- | --- | --- | --- |
| `/api/admin/stages/[stageId]` et sous-routes | P0 | P2 | Acceptable comme staff-only, mais tests métier stage encore P2/P1. |
| `/api/admin/invoices/[id]`, `/send` | P0 | P2 | Acceptable staff-only avec Zod ; `/api/admin/invoices` reste P1. |
| `/api/assistante/assignments/[id]` | P0 | P2 | Acceptable staff-only ; audit métier assistante à poursuivre. |
| `/api/assistante/students/[studentId]/documents` | P0 | P2 | Acceptable staff-only, no public ownership ; reste sensible mineurs. |

## Routes P0 requalifiées publiques fixes

| Route | Ancien | Nouveau | Verdict |
| --- | --- | --- | --- |
| `/api/public-documents/corrige-dnb-maths-2026` | P0 opérationnel Lot 0-bis | P2 | Acceptable : document public fixe, sans ressource propriétaire. Pas OK. |
| `/api/stages` | P0 | P2 | Acceptable catalogue public ; pas de donnée propriétaire. |
| `/api/stages/[stageSlug]` | P0 | P2 | Acceptable catalogue public par slug validé ; pas de réservation exposée. |

## Routes P0 requalifiées 410/501

| Route | Ancien | Nouveau | Verdict |
| --- | --- | --- | --- |
| `/api/payments/clictopay/webhook` | P0 | P1 | Acceptable seulement si ClicToPay reste désactivé. Test valide : signature invalide 401, signature valide 501. |
| `/api/payments/clictopay/init` | P1 | P1 | Maintenue non active, ne doit pas devenir OK. |

## Routes dont la requalification est acceptable

Les familles suivantes sont acceptables en Lot 1-bis : documents, factures PDF/reçus, admin/staff-only dynamiques, catalogues publics fixes, activation étudiant durcie, Lamis, sessions vidéo, admin documents.

## Routes dont la requalification est insuffisamment prouvée

Ces routes ne sont plus P0 statiques mais restent P1 critiques :

- `/api/assessments/submit` : public sensible, retourne encore `assessmentId` et `redirectUrl`; décision token/session à trancher.
- `/api/bilan-gratuit` : sécurisé en sortie, mais crée encore des comptes inactifs ; décision `lead_only` Lot 3 requise.
- `/api/payments/clictopay/*` : intégration non active ; pas go-live paiement.
- `/api/admin/invoices` : création/liste factures encore P1, schéma Zod/projection GET à durcir.
- `/api/bilans*` et routes coach report/generate : ownership détecté mais nombreux P1 sans Zod complet.
- `/api/npc/submissions/[submissionId]/documents*` : tests renforcés, mais restent P1 faute de Zod sur PATCH/DELETE/POST selon inventaire.

## Décision

La fermeture P0 statique est acceptée avec réserves. Elle ne vaut pas feu vert go-live large. Les P1 critiques doivent rester bloquants pour bêta élargie/go-live large tant que paiement, bilans, factures, rate limiting distribué production et flux bilan gratuit ne sont pas clos.

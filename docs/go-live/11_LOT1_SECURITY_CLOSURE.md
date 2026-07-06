# Lot 1 — Clôture sécurité API

## Mise à jour Lot 1-bis — 2026-07-02

Le contre-audit Lot 1-bis maintient `P0=0` après correction du script d’audit et régénération. Les P1 passent de 56 à 54.

Routes fermées en plus :

- `/api/sessions/video` : rate limit, Zod strict, projection DB explicite.
- `/api/admin/documents` : MIME/taille, Zod `userId`, réponse sans `localPath`.

Réserves maintenues :

- rate limiting distribué production non prouvé ;
- ClicToPay maintenu `501`, non activable ;
- `/api/bilan-gratuit` sécurisé en sortie mais toujours ambigu produit/RGPD car création de comptes inactifs ;
- 54 P1 restent ouverts.

Preuves : `docs/go-live/12_LOT1BIS_SECURITY_VERIFICATION.md` et `docs/go-live/_evidence/lot1bis-*.md`.

---

## Verdict
ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Lot 1 a fermé les P0 API statiques issus de la matrice Lot 0-bis : l’inventaire régénéré passe de 44 P0 à 0 P0, avec 56 P1 restants. Cette baisse combine des corrections de code, des tests IDOR/no-leak et une requalification statique plus précise des routes staff-only, publiques fixes, routes 410/501 et réexports.

Les commandes finales Lot 1 sont vertes sous Node 20. Le go-live large reste non autorisé : le rate limiting distribué n’est pas prouvé en production réelle et 56 P1 restent à durcir avant bêta élargie.

## Routes corrigées

| Route | Correction | Preuve |
| --- | --- | --- |
| `/api/documents/[id]` | Scope DB avant lecture fichier, 404 non révélateur hors propriétaire, projection explicite, logs sans chemin disque | `__tests__/api/documents.id.route.test.ts` |
| `/api/coach/students/[studentId]/documents` | Suppression de `localPath` dans les réponses, `select` explicite, rejet JSON `localPath`, validation MIME/taille upload | `__tests__/api/documents-access.test.ts` |
| `/api/student/documents/[id]/download` | Logs fichier sans erreur brute ni chemin disque | Revue code |
| `/api/invoices/[id]/pdf` | Scope parent par `beneficiaryUserId` enfant + fallback email legacy | `__tests__/lib/invoice/access-scope.test.ts`, `__tests__/api/invoices.pdf.route.test.ts` |
| `/api/invoices/[id]/receipt/pdf` | Même scope facture que PDF | `__tests__/api/invoices.receipt.pdf.route.test.ts` |
| `/api/student/activate` | `guardRateLimitAsync` GET/POST + logs sobres | `__tests__/api/student.activate.route.test.ts` |
| `/api/lamis/teacher-report` | Zod strict, taille bornée, rate limit GET/POST | `__tests__/api/lamis.teacher-report.route.test.ts` |
| `/api/stages/[stageSlug]` | Validation Zod du slug public | Revue code |
| `/api/student/automatismes/series/[id]` | Validation Zod de l’id de contenu | Revue code |

## Routes requalifiées

- `/api/payments/clictopay/webhook` : P1, maintenue en `501` si non configurée et signature HMAC exigée si secret présent.
- `/api/public-documents/corrige-dnb-maths-2026` : P2, document public fixe servi depuis `public/documents`.
- `/api/stages` et `/api/stages/[stageSlug]` : P2, catalogue public sans données propriétaire.
- Routes admin/assistante dynamiques : P1/P2 selon Zod/guard, car staff-only explicite ne relève pas d’un IDOR propriétaire classique.
- Routes coach avec `assertCoachCanAccessStudent` ou contrôles session/stage : P1/P2 selon couverture restante.

## Routes encore P0

Aucune P0 statique restante dans `docs/security/API_GUARD_INVENTORY.md` généré le 2026-07-02.

## Routes désactivées ou maintenues en 501

- `/api/payments/clictopay/webhook` retourne encore `501 CLICTOPAY_NOT_CONFIGURED` hors activation complète.
- `/api/payments/clictopay/init` reste P1 à durcir/valider avant activation réelle.

## Tests ajoutés

- `__tests__/lib/invoice/access-scope.test.ts`
- `__tests__/api/lamis.teacher-report.route.test.ts`

## Tests modifiés

- `__tests__/api/documents.id.route.test.ts`
- `__tests__/api/documents-access.test.ts`
- `__tests__/api/invoices.pdf.route.test.ts`
- `__tests__/api/invoices.receipt.pdf.route.test.ts`
- `__tests__/api/student.activate.route.test.ts`
- `__tests__/api/public-rate-limit.coverage.test.ts`

## Rate limiting

Le code empêche `RATE_LIMIT_DISABLE=1` de bypasser la production et le healthcheck expose `redis`, `upstash` ou `memory`. Lot 1 ajoute le rate limiting sur `/api/student/activate` et `/api/lamis/teacher-report`. Réserve bloquante go-live large : le mode distribué n’est pas prouvé sur production réelle.

## Données sensibles / projections

Les réponses documents coach et téléchargement document ne renvoient plus `localPath`. Le scope facture n’utilise plus seulement `customerEmail` quand un `beneficiaryUserId` enfant existe.

## Risques résiduels

- 56 P1 API restent à durcir.
- `/api/bilan-gratuit` reste P1 produit/sécurité : route sécurisée à poursuivre, mais le flux crée encore des comptes inactifs.
- ClicToPay reste non activable sans Lot paiement complet.
- Rate limiting distribué production non prouvé.
- Smoke Playwright public vert, mais warning runtime local `Prisma P2021` sur table `business_configs` absente pendant le refresh passif de config : à traiter dans le lot infra/DB si reproduit hors environnement local.

## Décision bêta contrôlée

Autorisable avec réserves si environnement isolé, comptes limités, monitoring manuel et ClicToPay désactivé.

## Décision bêta élargie

Non autorisée tant que les P1 documents/factures/bilans/paiements et le rate limiting distribué production ne sont pas fermés.

## Prochain lot recommandé

Lot 2 recommandé : paiement/facturation/entitlements ou Lot 1-bis ciblé P1 API selon priorité direction. Le prochain lot doit traiter en priorité les 20 P1 listés dans `docs/go-live/api-security-matrix.full.md`.

# P0-004 Lot 2F — Stages reservations public hardening

## Résumé

- Objectif : durcir les routes publiques et staff liées aux stages, inscriptions, réservations, diagnostics et bilans.
- Routes auditées :
  - `app/api/stages/route.ts`
  - `app/api/stages/[stageSlug]/route.ts`
  - `app/api/stages/[stageSlug]/inscrire/route.ts`
  - `app/api/stages/[stageSlug]/reservations/route.ts`
  - `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts`
  - `app/api/stages/submit-diagnostic/route.ts`
  - `app/api/stages/[stageSlug]/bilans/route.ts`
- Routes modifiées :
  - `app/api/stages/[stageSlug]/inscrire/route.ts`
  - `app/api/stages/[stageSlug]/reservations/route.ts`
  - `app/api/stages/submit-diagnostic/route.ts`
  - `lib/stages/inscription-schema.ts`
  - `lib/stages/public.ts`
- Routes déclassées comme publiques volontaires :
  - `app/api/stages/route.ts`
  - `app/api/stages/[stageSlug]/route.ts`
- Risques traités : écriture publique non bornée, réponse publique trop riche, fuite de bilans/PII dans le catalogue public, listing staff trop large, `reservationId` diagnostic non corrélé à l'email soumis.

## Justification du lot

| Route | Avant | Risque | Décision |
|---|---|---|---|
| `app/api/stages/[stageSlug]/inscrire/route.ts` | Route publique avec validation Zod non stricte, sans rate limit local, réponse contenant l'id reservation. | Spam/écriture DB publique, injection de champs métier, fuite identifiant interne. | Durcie dans Lot 2F. |
| `app/api/stages/[stageSlug]/reservations/route.ts` | Staff-only mais réponse dépendante des objets Prisma retournés. | Fuite `activationToken`, notes internes ou User complet si projection large. | Projection explicite ajoutée. |
| `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts` | Staff-only, vérification `stageSlug + reservationId` déjà présente. | Confirmation d'une réservation hors stage ou par non-staff. | Auditée; tests existants relancés. |
| `app/api/stages/submit-diagnostic/route.ts` | Route publique avec rate limit et Zod; `reservationId` pouvait être cherché seul. | Modification diagnostic d'une réservation non liée à l'email soumis. | `reservationId + email` exigés ensemble. |
| `app/api/stages/[stageSlug]/bilans/route.ts` | Guard staff/coach et filtrage `contentInterne` existants. | Bilan pédagogique sensible hors scope. | Auditée; tests IDOR existants relancés. |
| `app/api/stages/route.ts` | Catalogue public retournant les bilans publiés avec noms élèves et `pdfUrl`. | PII et URL PDF dans réponse publique. | Bilans retirés du serializer public. |
| `app/api/stages/[stageSlug]/route.ts` | Détail public basé sur le même serializer. | Même risque PII/PDF que le listing. | Déclassée public volontaire après retrait des bilans. |

## Corrections

- `publicStageInscriptionSchema` est désormais strict : les champs métier sensibles non prévus (`price`, `richStatus`, `paymentStatus`, `activationToken`, `academyId`, etc.) sont refusés par Zod.
- `inscrire` applique un `guardRateLimit` avant accès DB et renvoie une réponse publique minimale : statut uniquement, sans id reservation ni token.
- `reservations` reste `ADMIN` / `ASSISTANTE`, mais la réponse est reconstruite explicitement pour exclure token, notes internes, mot de passe, email utilisateur élève et champs stage internes.
- `submit-diagnostic` ne charge une réservation par `reservationId` que si l'email soumis correspond aussi à cette réservation; sans `reservationId`, le fallback email legacy reste inchangé.
- Les logs d'erreur inscription/diagnostic ne renvoient plus de message exception complet.
- Le serializer public des stages ne retourne plus `bilans`, `studentName`, `pdfUrl` ou identifiants pédagogiques liés aux élèves.

## Tests

- `__tests__/api/stages.inscrire.security.test.ts`
  - champs extra sensibles refusés;
  - rate limit avant accès DB;
  - réponse publique sans id, token ou notes.
- `__tests__/api/stages.reservations.access.test.ts`
  - non-auth refusé;
  - parent/élève/coach refusés;
  - listing filtré par stage et projection sans token/notes/User complet.
- `__tests__/api/stages.submit-diagnostic.route.test.ts`
  - `reservationId` non lié à l'email refusé;
  - erreurs internes génériques conservées.
- `__tests__/api/stages/stages-list.test.ts`
  - catalogue public sans PII élève, `pdfUrl`, token ou bilans.
- `__tests__/api/stages/confirm.test.ts`
  - staff-only et mismatch `stageSlug + reservationId` confirmés par tests existants.
- `__tests__/api/stages.bilans.idor.test.ts`
  - parent/élève refusés, coach non assigné refusé, `contentInterne` absent.

Résultats locaux :

- Tests ciblés stages/reservations : 8 suites, 61 tests OK.
- `npm run typecheck` : OK.
- `npm run build` : OK.
- `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.

## Risques résiduels

- Les routes `app/api/admin/stages/[stageId]/**` restent à traiter dans un micro-lot séparé `Lot 2F-bis — Admin stages`.
- Les routes coach stage reports, parent bilans PDF et bilans publics spécialisés restent candidates pour `Lot 2G — Bilans/reports visibility`.
- Les routes publiques d'inscription/diagnostic restent publiques par design; un anti-abus distribué/CAPTCHA peut être étudié en P1.

## Déploiement

- Statut : non déployé production.
- Déploiement à planifier séparément après push et CI verte.

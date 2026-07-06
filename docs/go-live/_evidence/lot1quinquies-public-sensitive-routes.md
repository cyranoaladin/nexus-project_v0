# Lot 1-quinquies — Routes publiques sensibles

## Synthèse

Les routes publiques sensibles sont durcies, mais six P1 restent assumés parce que leur surface publique est une décision produit/sécurité non arbitré ou un flux token sensible.

## Route : `/api/assessments/submit`

- Statut avant : P1
- Statut après : P1
- Pourquoi P1 reste : route publique qui crée une ressource pédagogique mineur ; token/session/auth à arbitrer.
- Zod : oui, schéma top-level, `studentData` et `metadata` stricts.
- Rate limit : oui, `guardRateLimitAsync`.
- Réponse minimale : succès limité à `assessmentId`, `redirectUrl`, `message`.
- No-leak : couvert par test global.
- Tests : `__tests__/api/assessments-submit.test.ts`, `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.
- Décision : à traiter dans un lot produit/pédagogique avant bêta élargie.

## Route : `/api/bilan-gratuit`

- Statut avant : P1
- Statut après : P1
- Pourquoi P1 reste : sortie durcie mais création de comptes inactifs ; dette produit/RGPD.
- Zod : oui.
- Rate limit : oui.
- Honeypot / anti-abus : oui.
- Réponse minimale : oui, pas d'IDs/tokens/email-existence.
- No-leak : couvert.
- Tests : `__tests__/api/bilan-gratuit.security.test.ts`, `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.
- Décision : Lot 3 doit arbitrer `lead_only` vs `account_activation`.

## Route : `/api/lamis/teacher-report`

- Statut avant : P1
- Statut après : P1
- Pourquoi P1 reste : rapport pédagogique public à arbitrer.
- Zod : oui.
- Rate limit : oui.
- Réponse minimale : oui.
- No-leak : couvert.
- Tests : `__tests__/api/lamis.teacher-report.route.test.ts`, `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.
- Décision : auth/token ou décision publique explicite avant bêta élargie.

## Route : `/api/stages/[stageSlug]/inscrire`

- Statut avant : P1
- Statut après : P1
- Pourquoi P1 reste : inscription stage publique volontaire.
- Zod : oui pour params/body.
- Rate limit : oui.
- Réponse minimale : doublon sans `reservationId`, succès sans ID interne.
- No-leak : couvert.
- Tests : `__tests__/api/stages.inscrire.security.test.ts`, `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.
- Décision : acceptable pour campagne contrôlée si monitoring/rate limiting runtime prouvé ; reste P1 avant bêta élargie.

## Route : `/api/student/activate`

- Statut avant : P1
- Statut après : P1
- Pourquoi P1 reste : activation publique par token.
- Zod : oui, body strict.
- Rate limit : oui, GET et POST.
- Réponse minimale : validation/erreurs sans password/token brut.
- No-leak : couvert.
- Tests : `__tests__/api/student.activate.route.test.ts`, `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.
- Décision : conserver public par token, mais auditer expiration/token hashing en Lot RGPD/identity.

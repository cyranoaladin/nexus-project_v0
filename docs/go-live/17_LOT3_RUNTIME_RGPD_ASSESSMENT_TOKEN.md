# Lot 3 — Runtime RGPD assessment token

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Lot 3 maintient `P0=0`, met en place le token signé court pour `assessments/submit`, complète le cadrage RGPD du tunnel `bilan-gratuit` en `lead_only`, garde ClicToPay désactivé contractuellement, et classe le drift local `business_configs`.

## Matrice API

Après régénération : `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`.

La nouvelle route `/api/assessments/public-token` est staff-only et classée `P2`. Les 6 P1 publics/paiement restent visibles, dont `/api/assessments/submit`, car la surface publique manipule toujours des données pédagogiques mineur.

## Redis/Upstash

Non prouvé en staging/production. Le healthcheck production répond `401` sans secret. Le mode local observé est `memory`, donc go-live large interdit.

## Assessment public token

Implémenté par HMAC court, TTL 15 minutes, scope `assessment_submit`, `subject`, `grade`, source/campaign optionnelles. Aucune persistance de token brut.

## Bilan gratuit RGPD

`lead_only` confirmé. `studentBirthDate` est retiré du schéma public et refusé si envoyé. Aucun compte ni token d'activation n'est créé.

## ClicToPay

Désactivé. `init` et `webhook` restent sans succès ambigu. Activation future uniquement via intégration complète.

## Business configs

`business_configs` absent est classé comme `static_fallback` optionnel. Le healthcheck expose le statut.

## Tests ciblés

Pack Lot 3 ciblé : `14` suites passées, `99` tests passés.

## Gates finales

Commandes finales Lot 3 sous Node 20 : `typecheck`, `lint`, `test:unit -- --runInBand`, `build`, `audit-api-guards`, `generate-api-security-matrix`, `audit:site-map`, `check:no-hardcoded`, `check:docs-archive`, `check:bundle-weight` et smoke Playwright public ciblé OK.

Résultats clés : tests unitaires `530` suites passées, `6489` tests passés ; Playwright public `24` tests passés.

## Réserves

- Redis/Upstash runtime non prouvé.
- ClicToPay webhook incomplet et volontairement `501`.
- Les 6 P1 publics/paiement restent bloquants pour go-live large ; `/api/assessments/submit` est durci mais reste P1 par surface publique mineurs.
- Job réel de purge/anonymisation `ContactLead` à implémenter avant go-live large.

## Décisions

- Bêta contrôlée : possible avec réserves si environnement opérationnel surveillé et pas de carte bancaire.
- Bêta élargie : interdite tant que Redis/Upstash n'est pas prouvé.
- Go-live large : interdit.

## Prochain lot recommandé

Lot 4 — Paiement/facturation/entitlements et runbook runtime : finaliser ou désactiver durablement ClicToPay, prouver Redis/Upstash sur staging/production, et implémenter purge/anonymisation des leads.

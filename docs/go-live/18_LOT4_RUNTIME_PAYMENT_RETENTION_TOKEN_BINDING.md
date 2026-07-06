# Lot 4 — Runtime, paiement, rétention, token binding

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Lot 4 ferme l'angle mort principal du Lot 3 : `/bilan-gratuit/assessment` ne génère plus un token assessment depuis de simples query params publics. Le token submit est désormais lié à un contexte lead via cookie HttpOnly signé, hash lead et email assessment pseudonyme.

Le lot ajoute aussi un mécanisme opérationnel de purge/anonymisation ContactLead en dry-run par défaut, durcit la cohérence ClicToPay public/backend, et rend `business_configs` dégradé en production si le fallback statique n'est pas explicitement autorisé.

## Matrice API

Les P1 ne doivent pas baisser artificiellement. Les 6 P1 restent visibles tant que les surfaces publiques/paiement/runtime restent sensibles.

Compteurs attendus après régénération : `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`.

## Assessment token binding

- `/api/bilan-gratuit` pose un cookie HttpOnly `nexus_assessment_flow` après création/mise à jour du lead.
- Le cookie contient un token signé court `assessment_flow`, sans email brut.
- `/bilan-gratuit/assessment` lit uniquement ce cookie et refuse l'accès sans contexte signé.
- Les query params `subject`, `grade`, `email` ne peuvent plus être rendus : toute URL avec query params est redirigée vers `/bilan-gratuit/assessment` avant rendu.
- Le token submit `assessment_submit` contient `binding=lead` et `leadEmailHash`.
- Le submit vérifie l'email assessment pseudonyme dérivé du hash lead.

## Redis/Upstash

Non prouvé en staging/production. Local observé : `memory`, gate `blocked`. Production sans secret : `/api/internal/health` répond `401`.

Décision : bêta élargie et go-live large interdits tant qu'un healthcheck authentifié ne prouve pas `redis` ou `upstash` et un test 429 réel.

## ContactLead

Script ajouté : `scripts/maintenance/contact-leads-retention.ts`.

Contrat :

- `--dry-run` par défaut.
- `--apply` explicite requis.
- Anonymisation des leads non convertis au-delà de la rétention.
- Support des demandes parentales via hash email.
- Aucun email/téléphone en clair dans les résultats.

## ClicToPay

ClicToPay reste désactivé. Si `NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC=true` alors que le backend est toujours désactivé, `/api/payments/clictopay/init` échoue en `503 CLICTOPAY_PUBLIC_FLAG_INCONSISTENT`.

## BusinessConfig

`business_configs` absent :

- local/test : `static_fallback_allowed`;
- production : `static_fallback_unexpected`, `ok=false`, sauf `BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED=true`.

Aucune migration automatique.

## Tests ciblés

- Token binding : OK.
- ContactLead retention : OK.
- BusinessConfig production gate : OK.
- ClicToPay feature flag consistency : OK.
- No-leak routes sensibles : OK.
- E2E `/bilan-gratuit/assessment` : OK après rebuild final.

## Réserves

- Redis/Upstash non prouvé.
- ClicToPay webhook reste `501`.
- Application effective du script ContactLead `--apply` requiert validation humaine/runbook.
- La route assessment est sécurisée par cookie de flux lead-bound, mais le P1 reste visible par nature publique/sensible.

## Décisions go-live

- Bêta contrôlée : possible avec réserves.
- Bêta élargie : interdite tant que Redis/Upstash n'est pas prouvé.
- Go-live large : interdit.

# Lot 5 — Rate limit 429 proof

## Objectif

Vérifier qu'un dépassement réel de limite retourne `429` sans frapper une route métier.

## Route de probe ajoutée

Route : `/api/internal/rate-limit-probe`

Contrat :

- accès protégé par `enforcePolicy('admin.dashboard')` ;
- preset rate limit `auth` ;
- réponse minimale sans secret ;
- route non destructive ;
- utilisable pour une fenêtre de test staging/production.

## Test local exécuté

Commande :

`npm run test:unit -- --runInBand __tests__/api/internal.rate-limit-probe.test.ts`

Résultat : OK.

Preuves :

- non authentifié/policy refusée -> `401` ;
- sous limite -> `200` avec metadata runtime sûre ;
- dépassement même clé -> `429` avec `Retry-After`.

## Test 429 staging/production

Exécuté : NON.

Raison : aucun staging authentifié ni fenêtre dédiée disponible ; ne pas saturer une route production.

## Procédure manuelle staging

À exécuter sur staging ou fenêtre production dédiée, avec credential non affiché :

```bash
for i in 1 2 3 4 5 6; do
  curl -sS -o /tmp/nexus-rl-probe-${i}.json \
    -w "%{http_code} retry_after=%{header_json}\n" \
    -H "Authorization: Bearer ${NEXUS_HEALTH_AUTH}" \
    https://nexusreussite.academy/api/internal/rate-limit-probe
done
```

Adapter l'authentification si l'environnement utilise un cookie admin plutôt qu'un bearer token. Ne jamais afficher le token/cookie.

## Décision

Preuve locale : OK.

Preuve staging/production : NON PROUVÉE.

Bêta élargie et go-live large restent interdits tant qu'un `429` réel n'est pas validé sur staging/production avec Redis/Upstash.


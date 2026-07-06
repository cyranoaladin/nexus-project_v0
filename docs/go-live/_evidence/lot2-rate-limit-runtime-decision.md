# Lot 2 — Décision rate limiting runtime

## État local

Commande :

```bash
npx tsx -e "import { getRateLimitProductionGate } from './lib/rate-limit/index.ts'; console.log(JSON.stringify(getRateLimitProductionGate()))"
```

Résultat :

```json
{"ok":false,"mode":"memory","decision":"blocked","reason":"Memory rate limiting is process-local and blocks go-live large."}
```

## État staging

NON PROUVÉ. Aucun environnement staging accessible sans secret n'a été identifié.

## État production

Commande sûre sans secret :

```bash
curl -sS -i --max-time 10 https://nexusreussite.academy/api/internal/health
```

Résultat résumé :

```text
HTTP/2 401
{"error":"Unauthorized","message":"You must be signed in to access this resource"}
```

L'endpoint est protégé, mais le mode runtime `redis` ou `upstash` n'est pas prouvé.

## Healthcheck attendu

Un opérateur authentifié doit vérifier sans exposer de secret :

```json
{
  "runtime": {
    "rateLimit": {
      "mode": "redis ou upstash",
      "distributed": true,
      "goLiveLarge": "allowed"
    }
  }
}
```

## Test 429 attendu

Exécuter sur staging/production une saturation contrôlée d'une route publique non destructive et vérifier `429`, `Retry-After`, headers `X-RateLimit-*` et comportement partagé entre instances.

## Résultat

Redis/Upstash runtime NON PROUVÉ.

## Décision

GO-LIVE LARGE INTERDIT.

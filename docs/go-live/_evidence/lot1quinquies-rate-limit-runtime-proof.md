# Lot 1-quinquies — Preuve runtime Redis/Upstash

## État local

Commande :

```bash
npx tsx -e "import { getRateLimitProductionGate } from './lib/rate-limit/index.ts'; console.log(JSON.stringify(getRateLimitProductionGate()))"
```

Résultat :

```json
{"ok":false,"mode":"memory","decision":"blocked","reason":"Memory rate limiting is process-local and blocks go-live large."}
```

Le mode local est `memory`, donc non acceptable pour go-live large.

## État staging

À vérifier. Aucun environnement staging accessible sans secret n'a été identifié pendant ce lot.

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

L'endpoint interne est bien protégé, mais le mode `redis` ou `upstash` production n'est pas vérifiable depuis ce poste sans credential.

## Healthcheck attendu

Pour lever le blocage, un opérateur authentifié doit observer :

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

Sur staging/production, exécuter un test de dépassement contrôlé sur une route publique sensible non destructive et vérifier :

- réponse `429` ;
- headers `Retry-After`, `X-RateLimit-*` ;
- comportement partagé entre instances si l'application est multi-process/multi-instance.

## Résultat

Redis/Upstash runtime non prouvé.

## Décision go-live large

INTERDIT.

# Contrat du client OpenRouter canonique

## Frontière

Le seul transport OpenRouter est :

`lib/llm/openrouter/client.ts`

Il est `server-only`, utilise `fetch` natif, ne streame pas et ne persiste rien
en C1. Aucun composant React ni `report-service` n'appelle le réseau.

## Requête

```http
POST /api/v1/chat/completions
Authorization: Bearer <secret>
Content-Type: application/json
HTTP-Referer: https://nexusreussite.academy
X-Title: Nexus Réussite - Bilans pédagogiques
```

Le tiret simple de `X-Title` est la représentation ByteString-compatible du
séparateur demandé ; le tiret cadratin n'est pas sérialisable par `fetch`.

Le payload v1.1 est fermé :

```json
{
  "model": "<un slug approuvé>",
  "messages": [],
  "max_tokens": 2048,
  "reasoning": {
    "effort": "low",
    "exclude": true
  },
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "<nom versionné>",
      "strict": true,
      "schema": {
        "type": "object",
        "additionalProperties": false,
        "required": []
      }
    }
  },
  "provider": {
    "require_parameters": true,
    "data_collection": "deny",
    "zdr": true
  },
  "stream": false,
  "usage": {
    "include": true
  }
}
```

Le schéma réel doit avoir au moins un champ requis. `temperature`, `top_p`,
`seed`, `tools`, `plugins`, `web_search`, `models` et `openrouter/auto` sont
absents.

## Contrat synthétique C1

```json
{
  "schemaVersion": "openrouter-contract-test-v1",
  "status": "ok",
  "echo": "synthetic-no-pii"
}
```

Tous les champs sont requis et `additionalProperties=false`. Ce schéma prouve
le transport et non la qualité d'un bilan.

## Erreurs

| Code | Source | Retry |
| --- | --- | ---: |
| `OPENROUTER_NOT_CONFIGURED` | mode ou clé absent | non |
| `OPENROUTER_INVALID_CREDENTIALS` | HTTP 401 | non |
| `OPENROUTER_INSUFFICIENT_CREDITS` | HTTP 402 | non |
| `OPENROUTER_POLICY_REJECTED` | 400/403, modèle ou contrat incohérent | non |
| `OPENROUTER_TIMEOUT` | 408 ou abort réseau | oui |
| `OPENROUTER_RATE_LIMITED` | 429 | oui |
| `OPENROUTER_PROVIDER_UNAVAILABLE` | 502, fin en erreur ou réseau temporaire | oui |
| `OPENROUTER_NO_COMPLIANT_PROVIDER` | 503 | oui |
| `OPENROUTER_INVALID_RESPONSE` | enveloppe, usage ou génération absent | non |
| `OPENROUTER_SCHEMA_FAILURE` | JSON structuré hors schéma Zod | non |
| `OPENROUTER_BUDGET_EXCEEDED` | coût ou budget invalide | non |

`Retry-After` est respecté dans une borne maximale de 30 secondes afin qu'une
valeur fournisseur excessive n'immobilise pas un worker. À défaut, le backoff
est exponentiel, borné et jitteré. `BILAN_OPENROUTER_MAX_ATTEMPTS` ne peut
dépasser 3. Les enveloppes HTTP sont lues en flux avec une limite stricte de
4 MiB, vérifiée aussi via `Content-Length` lorsqu'il est présent. Aucune erreur
publique ne contient le corps fournisseur, les messages, une réponse, la clé
ou une donnée élève.

## Fallback

Une erreur retryable autorise la tentative suivante. Le primaire et le
fallback ont chacun leur requête et leur provenance. Une erreur non retryable
arrête immédiatement le flux.

## Provenance retournée

- modèle demandé, modèle retourné, slug canonique ;
- identifiant de génération, raison de fin ;
- tokens prompt, complétion et total ;
- coût en micro-USD ;
- latence et numéro de tentative ;
- checksum de capacité ;
- identifiant, version et checksum de politique ;
- version du schéma de réponse.

Le prompt, la réponse brute et le corps d'erreur ne font pas partie de la
provenance.

## Budgets et preuve de capacité

Le plafond par rapport ne peut pas dépasser le plafond journalier. C1 vérifie
la configuration et le coût d'une réponse individuelle. La consommation
atomique du budget journalier nécessite le stockage partagé et la file du lot
C2 ; elle n'est donc pas simulée localement ni présentée comme active dans C1.

Une preuve de preflight acceptée a moins de 24 heures et tolère au plus cinq
minutes de dérive d'horloge vers le futur. Un changement de politique, de slug
canonique ou de capacité requise la rend également invalide.

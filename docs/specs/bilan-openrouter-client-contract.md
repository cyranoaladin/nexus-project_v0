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
  "stream": false
}
```

Le schéma réel doit avoir au moins un champ requis. `temperature`, `top_p`,
`seed`, `tools`, `plugins`, `web_search`, `models` et `openrouter/auto` sont
absents. `usage.include`, désormais déprécié côté requête, est également
absent. L'objet `usage` de la réponse reste obligatoire.

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
| `OPENROUTER_INVALID_REQUEST` | HTTP 400 ou enveloppe 200 équivalente | non |
| `OPENROUTER_POLICY_REJECTED` | HTTP 403, modèle ou contrat incohérent | non |
| `OPENROUTER_TIMEOUT` | 408 ou abort réseau | oui |
| `OPENROUTER_RATE_LIMITED` | 429 | oui |
| `OPENROUTER_PROVIDER_UNAVAILABLE` | 502/503 générique ou réseau temporaire | oui |
| `OPENROUTER_NO_COMPLIANT_PROVIDER` | code fournisseur explicite et validé | oui |
| `OPENROUTER_INCOMPLETE_RESPONSE` | `finish_reason` différent de `stop` | non |
| `OPENROUTER_INVALID_RESPONSE` | enveloppe, usage ou génération absent | non |
| `OPENROUTER_SCHEMA_FAILURE` | JSON structuré hors schéma Zod | non |
| `OPENROUTER_BUDGET_EXCEEDED` | coût ou budget invalide | non |

`Retry-After` est respecté dans une borne maximale de 30 secondes afin qu'une
valeur fournisseur excessive n'immobilise pas un worker. À défaut, le backoff
est exponentiel, borné et jitteré. `BILAN_OPENROUTER_MAX_ATTEMPTS` doit valoir
exactement 3. Une complétion est limitée à 4 MiB, un catalogue à 32 MiB et une
enveloppe d'erreur à 64 KiB. Ces bornes sont vérifiées en flux et via
`Content-Length` lorsqu'il est présent. Aucune erreur
publique ne contient le corps fournisseur, les messages, une réponse, la clé
ou une donnée élève.

## Fallback

Une erreur retryable autorise la tentative suivante selon le plan
`bilan-retry-policy-v1` exact : primaire, fallback, fallback. Le primaire et
chaque fallback ont une requête et une provenance distinctes. Une erreur non
retryable arrête immédiatement le flux.

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

Le résultat contient aussi `attempts`, y compris pour les tentatives échouées.
Chaque entrée porte uniquement dates, modèle, issue, code normalisé, retry,
identifiant de génération, modèle retourné, tokens, coût et raison de fin.
Les champs inconnus sont `null`. Une erreur finale porte le même historique
sûr afin que C2 puisse le persister sans perdre les échecs.

## Budgets et preuve de capacité

Les montants sont parsés sans conversion flottante et conservés comme entiers
micro-USD sûrs :

- audience : `300000` ;
- assessment : `750000` ;
- journalier : `15000000`.

Le plafond audience ne peut pas dépasser assessment, ni assessment dépasser
le journalier. C1 vérifie la configuration et le coût d'une réponse
individuelle. La consommation
atomique du budget journalier nécessite le stockage partagé et la file du lot
C2 ; elle n'est donc pas simulée localement ni présentée comme active dans C1.

Une preuve de preflight expire au plus 24 heures après vérification. Toute
horloge future est refusée. Chaque snapshot doit précéder la vérification de
cinq minutes au plus. Le checksum de preuve lie politique, catalogue, empreinte
non réversible de clé, SHA logiciel exact, dates et snapshots. Un changement de
clé, logiciel, politique, slug ou capacité la rend invalide.

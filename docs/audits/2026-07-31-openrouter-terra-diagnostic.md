# Diagnostic Terra OpenRouter

## Date

31 juillet 2026.

## Contexte

Le preflight C1.2 validait Sonnet mais Terra retournait
`OPENROUTER_INVALID_REQUEST` avec `max_tokens=256`. Aucune cause fondée sur un
minimum de tokens n'était démontrée.

## Méthode

Le diagnostic a été exécuté sur le SHA propre
`19fe9257b0c6a091c10e89b5135fd5acc33f5017`, avec le contrat
`synthetic-no-pii`, sans retry et sans appel Sonnet.

Plafonds :

- trois appels maximum ;
- 20 000 micro-USD par appel ;
- 50 000 micro-USD au total.

## Résultats

| Variante | Paramètre | Reasoning | Résultat | Coût |
| --- | --- | --- | --- | ---: |
| D1 | `max_tokens=2048` | `low` | HTTP 404, code expurgé inconnu | 0 connu |
| D2 | `max_completion_tokens=2048` | `low` | PASS, Azure, `stop` | 720 µUSD |
| D3 | `max_tokens=2048` | `none` | non exécutée | 0 |

D2 a retourné 90 tokens de prompt, 33 tokens de complétion, aucun token de
reasoning rapporté, 123 tokens au total et une latence de 3 125 ms.

## Cause racine

`OPENAI_OUTPUT_TOKEN_PARAMETER_ALIAS`

La limite de sortie et la politique de reasoning étant identiques entre D1 et
D2, le paramètre de transport explique le contraste constaté. Aucun message ou
corps brut fournisseur n'a été conservé.

## Décision

La sélection est figée dans
`content/bilans/model-policies/bilan-transport-policy-v1.json` :

- Sonnet → `max_tokens` ;
- Terra → `max_completion_tokens`.

Le snapshot de capacité, sa checksum et la preuve de preflight incluent ce
choix. Le client utilise la valeur du snapshot et ne déduit jamais la famille
depuis le slug.

## Données et confidentialité

- données réelles envoyées : 0 ;
- appels diagnostic : 2 ;
- coût total : 720 micro-USD ;
- erreur brute stockée : 0 ;
- ZDR, `data_collection=deny` et `require_parameters=true` demandés pour chaque
  variante.

## Rollback

La génération reste désactivée. Aucun moteur métier, worker, stockage ou
déploiement n'est raccordé. Le rollback consiste à ne pas fusionner la PR.

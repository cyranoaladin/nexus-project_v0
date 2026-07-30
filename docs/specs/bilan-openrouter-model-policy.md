# Politique modèle OpenRouter des bilans

## Source canonique

`content/bilans/model-policies/bilan-model-policy-v1.1.json`

- identifiant : `bilan-model-policy`
- version : `1.1`
- valeur de configuration :
  `bilan-model-policy-v1.1`
- SHA-256 canonique :
  `669e194f9cedfdd3131c00652447f0b53ea265babf78b92fa077945278cf0eb9`

Le checksum est calculé sur le JSON canonique (clés triées, sans espace).

## Modèles autorisés

| Rôle | Slug exact |
| --- | --- |
| primaire | `anthropic/claude-sonnet-5` |
| fallback | `openai/gpt-5.6-terra` |

Tout autre slug, `openrouter/auto` et tout suffixe `latest` sont refusés.
Le fallback est une requête Nexus distincte, jamais un tableau `models`.

## Paramètres

| Paramètre | Politique |
| --- | --- |
| `temperature` | `OMIT` |
| `top_p` | `OMIT` |
| `seed` | `OMIT` |
| reasoning | `low`, preflight requis, contenu de reasoning exclu |
| `max_tokens` | requis et borné par configuration |
| structured output | JSON Schema strict requis |
| `require_parameters` | `true` |
| `data_collection` | `deny` |
| ZDR | `true` |

Une capacité supplémentaire observée dans le catalogue est informative. Elle
ne modifie pas la requête. `temperatureDeclaredSupported=true`, par exemple,
n'active jamais `temperature`.

## Snapshot de capacités

Pour chaque modèle, `OpenRouterModelCapabilitySnapshot` conserve :

- modèle demandé et slug canonique ;
- date de lecture ;
- paramètres annoncés ;
- contexte et sortie maximale ;
- capacités structured output et reasoning ;
- présence informative de `temperature` ;
- efforts de reasoning ;
- checksum du snapshot.

Le preflight bloque si le slug canonique change, si une capacité obligatoire
disparaît, si reasoning `low` n'est pas accepté ou si le checksum est invalide.

Le baseline
`content/bilans/model-policies/openrouter-capability-baseline-v1.1.json` est
une capture du catalogue public `/api/v1/models` du 30 juillet 2026. Il fige
les slugs canoniques versionnés :

- `anthropic/claude-sonnet-5-20260630` ;
- `openai/gpt-5.6-terra-20260709`.

Le preflight compare le catalogue live à ces valeurs. Un changement bloque
l'activation et exige une nouvelle décision/version ; il n'est jamais absorbé
automatiquement. La capture ne prouve pas la disponibilité d'un endpoint ZDR.

## Changement de politique

Toute modification fonctionnelle doit :

1. créer une nouvelle version de fichier ;
2. produire un nouveau checksum ;
3. invalider les preuves de preflight précédentes ;
4. mettre à jour l'allowlist et les tests ;
5. rejouer les évaluations qualité avant activation.

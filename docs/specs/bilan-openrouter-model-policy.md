# Politique modèle OpenRouter des bilans

## Source canonique

`content/bilans/model-policies/bilan-model-policy-v1.1.json`

- identifiant : `bilan-model-policy`
- version : `1.1`
- valeur de configuration :
  `bilan-model-policy-v1.1`
- SHA-256 canonique :
  `4f8633be4e26949ebdec408f3ce1fe9ef0f4ee094d2e63fb6145caa488c3c1a7`

Le checksum est calculé sur le JSON canonique (clés triées, sans espace).

La sélection du paramètre de sortie est une seconde politique technique,
non pédagogique :

- source :
  `content/bilans/model-policies/bilan-transport-policy-v1.json` ;
- identifiant : `bilan-openrouter-transport-policy` ;
- version : `1` ;
- SHA-256 canonique :
  `40edfc282a4211dda7e61a2fcc3cc665651968818d6c5cf20b98814decc49838`.

## Modèles autorisés

| Rôle | Slug exact |
| --- | --- |
| primaire | `anthropic/claude-sonnet-5` |
| fallback | `openai/gpt-5.6-terra` |

Tout autre slug, `openrouter/auto` et tout suffixe `latest` sont refusés.
Le fallback est une requête Nexus distincte, jamais un tableau `models`.

## Plan de tentatives

La politique inclut `bilan-retry-policy-v1` :

1. `anthropic/claude-sonnet-5` ;
2. `openai/gpt-5.6-terra` ;
3. `openai/gpt-5.6-terra`.

Le maximum est exactement trois. Toute modification du tableau modifie le
checksum de politique et invalide les preuves existantes.

## Paramètres

| Paramètre | Politique |
| --- | --- |
| `temperature` | `OMIT` |
| `top_p` | `OMIT` |
| `seed` | `OMIT` |
| reasoning | `low`, preflight requis, contenu de reasoning exclu |
| limite de sortie | `max_tokens` pour Sonnet, `max_completion_tokens` pour Terra |
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
- paramètre de sortie exact retenu par la politique de transport ;
- date de lecture ;
- paramètres annoncés ;
- contexte et sortie maximale ;
- capacités structured output et reasoning ;
- présence informative de `temperature` ;
- efforts de reasoning ;
- checksum du snapshot.

Le preflight bloque si le slug canonique change, si le paramètre de sortie
versionné n'est plus annoncé, si une capacité obligatoire disparaît, si
reasoning `low` n'est pas accepté ou si un checksum est invalide.
La preuve est aussi liée au checksum du catalogue, à une empreinte HMAC non
réversible de la clé, au SHA Git exact du logiciel et à une expiration maximale
de 24 heures. Un snapshot de plus de cinq minutes au moment de la vérification
ne peut pas être reconditionné en preuve fraîche.

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

La politique de transport suit les mêmes règles de versionnement et
d'invalidation. Aucun choix n'est dérivé de `startsWith`, `includes`, d'un
suffixe de slug ou d'une famille supposée.

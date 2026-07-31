# Audit de résilience fournisseur OpenRouter

## Date et périmètre

31 juillet 2026. Audit C1.4 exclusivement synthétique, sans donnée de mineur,
moteur métier, base, worker ou publication.

## Constat initial

Les preuves authentifiées antérieures de Sonnet 5 et Terra ont toutes deux
retourné `Azure`. Elles ne démontrent donc pas l'indépendance du fallback.

## Méthode

La commande privée :

```bash
npm run bilan:openrouter:provider-resilience
```

utilise le client unique pour lire le catalogue de modèles et
`/api/v1/endpoints/zdr`. Elle conserve uniquement les endpoints annonçant
structured output, reasoning et le paramètre de sortie versionné. Elle peut
tester au plus une route par modèle et deux appels au total avec
`provider.only`, `require_parameters=true`, `data_collection=deny` et
`zdr=true`.

Aucun nom de fournisseur n'est inventé et aucun échec n'entraîne un
assouplissement.

## Preuve

Le résultat détaillé reste privé sous :

`~/.local/share/nexus-release-evidence/bilan-openrouter-provider-resilience/`

Il porte SHA, checksums de catalogues, routes expurgées, tokens, coût, latence
et statut. Il ne contient ni clé, prompt, completion ou donnée personnelle.
Le résultat factuel est repris dans la description de PR et le rapport de
mission afin de ne pas modifier après coup le SHA de preuve.

## Décision en cas de concentration

`SINGLE_PROVIDER_CONCENTRATION` impose au futur lot retry différé, dead letter
surveillée, absence de publication automatique, alerte opérateur et étude d'un
troisième modèle réellement indépendant. La politique produit v1.1 reste
inchangée dans #91.

## Rollback

L'audit n'écrit aucun état applicatif. Maintenir la génération désactivée et
supprimer la preuve privée selon la politique locale suffit.

# Design C0/C1 — fondation sans exception et contrat OpenRouter

## Date et statut

30 juillet 2026. Design approuvé par décision owner. Ce document n'autorise
ni fusion dans `main`, ni déploiement, ni activation, ni appel OpenRouter réel
en CI.

## Objectifs

C0 supprime la vulnérabilité `brace-expansion` sans exception de risque, rend
la PR #88 verte, propage la fondation par merge explicite dans #89 et renforce
les règles de protection de `main`.

C1 part de la nouvelle tête de #89 et ajoute uniquement la frontière
OpenRouter : configuration, politique modèle, contrats, capacités, client,
erreurs, preflight synthétique, tests et documentation. C1 ne modifie ni
Prisma, ni le moteur de scoring, ni `JobOutbox`, ni les routes et services du
moteur de bilans.

## Séquence Git

```text
#87 integration
  └─ #88 foundation + dependency remediation
       └─ #89 assessment engine + merge explicite de la nouvelle tête #88
            └─ C1 feat/bilan-openrouter-provider-contract
```

Les branches partagées ne sont jamais réécrites. Les mises à jour de #88 et
#89 sont poussées sans force. C1 cible #89 dans une draft PR empilée.

## C0 — résolution de `brace-expansion`

L'avis `GHSA-mh99-v99m-4gvg` déclare toutes les versions `<=5.0.7`
vulnérables et `5.0.8` corrigée. Le graphe initial contient :

- `1.1.16` via ESLint 8 et `minimatch` 3 ;
- `2.1.2` via CycloneDX, `glob` 10 et `minimatch` 9 ;
- `5.0.8` via TypeScript ESLint et `minimatch` 10.

Une mise à jour parent totalement compatible n'existe pas : ESLint 9 conserve
`minimatch` 3 ; ESLint 10 et eslint-config-next 16 constituent une migration
majeure indépendante ; CycloneDX 6 est déjà sa dernière version publiée.

La résolution minimale est donc :

1. override exact de toutes les occurrences vers l'upstream officiel
   `brace-expansion@5.0.8` ;
2. adaptation fail-closed des consommateurs `minimatch@3.1.5` et
   `minimatch@9.0.9`, qui attendent l'ancien export par défaut alors que 5.x
   expose `expand` comme export nommé ;
3. script `postinstall` déterministe qui refuse toute version ou tout contenu
   source non reconnu au lieu de modifier silencieusement une future version ;
4. test du graphe installé, de CommonJS/ESM, des expansions `minimatch`, de la
   limite `EXPANSION_MAX_LENGTH` et d'une entrée hostile bornée ;
5. audit npm complet/runtime et SBOM complet/runtime sans exception.

L'adaptateur ne modifie pas l'algorithme du correctif : il ne fait que relier
l'API historique de `minimatch` à l'export officiel `expand` de 5.0.8.

## Protection de `main`

Le ruleset existant est conservé et renforcé. Il doit :

- interdire suppression et non-fast-forward ;
- imposer une pull request ;
- imposer au moins une approbation humaine ;
- invalider les approbations obsolètes et exiger l'approbation du dernier
  push ;
- exiger la résolution des threads ;
- rendre obligatoires les checks demandés par l'owner.

La mise à jour est réalisée à partir du document complet retourné par GitHub,
sans supprimer les règles existantes et sans acteur de bypass.

## C1 — politique modèle

La source canonique est
`content/bilans/model-policies/bilan-model-policy-v1.1.json`.

La politique est immuable dans son comportement :

- primaire `anthropic/claude-sonnet-5` ;
- fallback `openai/gpt-5.6-terra` ;
- `temperature`, `top_p` et `seed` toujours omis ;
- `reasoning_effort=low` seulement après preflight compatible ;
- structured output strict ;
- `require_parameters=true`, `data_collection=deny`, `zdr=true` ;
- aucun routeur automatique, modèle `latest`, outil, plugin ou web search ;
- aucune capacité nouvellement annoncée n'est activée automatiquement.

Un changement de fichier change son SHA-256, invalide le preflight précédent
et exige une nouvelle version et de nouvelles évaluations.

## Configuration

`BILAN_REPORT_GENERATION_MODE` vaut `DISABLED` par défaut ou
`OPENROUTER_REQUIRED`. Le parseur serveur refuse les configurations
concurrentes, les secrets absents, URLs invalides, modèles hors allowlist,
budgets invalides et paramètres interdits.

La clé n'est exigée qu'en mode `OPENROUTER_REQUIRED`. Les budgets de
production sont obligatoires et sans valeur par défaut illimitée.

## Capacités et preflight

Le catalogue `/api/v1/models` est consulté uniquement par le preflight privé.
Il produit un snapshot immuable expurgé par modèle et un checksum stable.
Une fixture officielle figée remplace tout accès réseau en CI.

Le preflight synthétique contrôle simultanément les capacités, la politique
de confidentialité, reasoning faible, structured output, usage, identifiant
de génération et budgets. Il écrit ses preuves hors dépôt avec répertoire
`0700` et fichiers `0600`.

## Client OpenRouter

`lib/llm/openrouter/client.ts` est l'unique client. Il utilise `fetch` serveur
natif et des requêtes non streamées vers `/api/v1/chat/completions`.

Chaque tentative porte un seul modèle. Le fallback Nexus produit une tentative
séparée et une provenance séparée. Aucun tableau `models` opaque n'est envoyé.

Le client :

- construit un payload fermé et validé ;
- n'accepte aucun champ libre additionnel ;
- applique des retries bornés et `Retry-After` ;
- ne retry pas 400/401/402/403, budget ou schéma de requête invalide ;
- valide le transport synthétique avec Zod ;
- ne journalise jamais messages, réponses, secrets ou corps fournisseur ;
- retourne seulement le contenu validé au demandeur interne et la provenance
  de transport sûre, sans persistance en C1.

## Tests

Un serveur HTTP local contrôle toutes les réponses et inspecte le payload.
Les tests couvrent succès, erreurs HTTP, timeout, retry, fallback, schéma,
budget, absence de métadonnées et absence de fuite.

Les tests d'architecture interdisent les imports Mistral/Chutes dans le moteur,
les clients OpenRouter concurrents, le réseau dans `report-service`, l'accès
depuis React et l'exposition du secret dans le bundle client.

## Rollback

- C0 : revert du commit de dépendances uniquement si une nouvelle correction
  maintenue et non vulnérable le remplace ; aucune exception n'est réactivée.
- C1 : supprimer ou ne pas fusionner la PR empilée. Aucun état DB ni workflow
  métier n'est modifié.
- Production : aucune action prévue dans ce lot.


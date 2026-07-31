# Benchmark synthétique OpenRouter des bilans

## Date

31 juillet 2026.

## Périmètre

Ce benchmark compare uniquement la rédaction structurée de bilans parent à
partir des douze fixtures synthétiques `synthetic-v1`. Il ne lit aucune donnée
Prisma, n'appelle aucune route métier, ne publie rien et ne traite aucune donnée
réelle d'élève.

Les trois candidats sont épinglés dans
`content/bilans/model-policies/bilan-model-benchmark-policy-v1.json` :

- `openai/gpt-5.6-luna` avec `max_completion_tokens` ;
- `openai/gpt-5.6-terra` avec `max_completion_tokens` ;
- `anthropic/claude-sonnet-5` avec `max_tokens`.

La politique produit `bilan-model-policy-v1.1` n'est pas modifiée.

## Frontière local-first

Avant tout appel, Nexus calcule et valide localement :

- le score et la calibration ;
- les compétences et leurs statuts ;
- les priorités ;
- les preuves autorisées ;
- les recommandations du catalogue ;
- le scan PII ;
- la séparation d'audience.

Le DTO LLM ne contient ni score, ni pourcentage, ni texte brut, ni note interne,
ni identifiant de base. Le brouillon LLM ne choisit pas les `evidenceRefs`.
Après validation du texte, Nexus rattache les références canoniques depuis le
contexte local. Le rapport final conserve donc ses preuves, sans permettre au
modèle de les inventer ou de les croiser.

## Contrat réseau

Les appels passent exclusivement par `OpenRouterClient` :

- Chat Completions non streaming ;
- reasoning `low`, réponse de reasoning exclue ;
- structured output strict ;
- `provider.require_parameters=true` ;
- `provider.data_collection=deny` ;
- `provider.zdr=true` ;
- aucun outil, plugin, browsing, sampling ou response cache ;
- aucun retry automatique ;
- maximum 2 048 tokens de sortie ;
- hard stop benchmark à 1 500 000 micro-USD.

Le schéma transport utilise le sous-ensemble portable `type`, `properties`,
`required`, `additionalProperties`, `items`, `enum` et `const`. Les contraintes
de longueur, les assertions sémantiques et les règles de grounding restent
appliquées localement par Zod.

## Résilience et checkpoints

Le runner C1.5 crée le répertoire privé, le manifeste `INITIALIZING`, le plan
des 36 combinaisons et le journal avant toute lecture réseau du catalogue.
Le journal NDJSON est append-only, `fsync` après chaque événement, numéroté et
lié par une chaîne SHA-256. La clé de tentative est
`benchmark:<runId>:<fixtureId>:<modelId>:<sampleIndex>`.

Une combinaison `VALID`, `QUALITY_FAILURE` ou `TRANSPORT_FAILURE_FINAL` n'est
jamais rappelée. Un `ATTEMPT_STARTED` sans terminal devient `UNKNOWN_OUTCOME` :
sa réserve reste bloquée et seule une réconciliation opérateur peut le faire
progresser. Une panne de transport retryable peut recevoir une seule reprise
différée, après le premier passage complet. Une erreur de schéma, de grounding
ou de qualité est un résultat négatif du modèle et n'est jamais régénérée.

## Revue humaine

Le run est complet lorsque les 36 combinaisons ont un état terminal. Seules les
fixtures dont les trois modèles ont une sortie `VALID` entrent dans le paquet
comparatif. Les modèles deviennent `MODEL_A`, `MODEL_B`, `MODEL_C` dans un
ordre différent par fixture. Le paquet reviewer ne contient ni fournisseur,
ni génération, ni coût, ni latence. La clé de révélation est conservée dans
`owner-sealed-model-key/`, séparée de `reviewer-package/`.

La grille comporte :

- fidélité aux faits ;
- clarté ;
- qualité du français ;
- concision ;
- actionnabilité ;
- ton parent ;
- décision `ACCEPT`, `ACCEPT_WITH_MINOR_EDIT` ou `REJECT`.

Le statut initial est toujours `HUMAN_REVIEW_PENDING`. Le code ne peut pas
fabriquer une acceptation.

## Critères d'arrêt

Le benchmark s'arrête fermement sur :

- fuite PII ou inter-audience ;
- score modifié ;
- coût connu plus réserves atteignant le hard stop pré-appel de 1 000 000
  micro-USD ;
- 42 appels réseau réservés ;
- métadonnée de prix absente ou invalide.

Les erreurs de schéma ou de grounding et les affirmations non supportées sont
comptées comme échecs qualité puis la matrice continue. Les coûts connus d'une
sortie invalide sont comptabilisés. Les coûts inconnus restent réservés.

## Rollback

La branche ne contient aucun raccordement produit. Le rollback consiste à ne
pas fusionner la PR benchmark. Aucun état applicatif ou de production n'est à
restaurer.

# ADR 009 — OpenRouter pour la narration canonique des bilans

## Date et statut

30 juillet 2026 — **acceptée pour le contrat fournisseur C1**, non activée.
Cette ADR n'autorise ni donnée réelle de mineur, ni raccordement au moteur,
ni publication, ni déploiement.

## Contexte

Le moteur canonique de la PR #89 calcule et conserve des faits déterministes :
réponses scellées, corrections humaines, score versionné, calibration,
preuves et restitutions par audience. Le dépôt contient aussi deux générations
historiques :

- Mistral pour des bilans et rapports de stages antérieurs ;
- Chutes dans le domaine NPC.

Ces chemins historiques ne doivent pas devenir une seconde implémentation du
nouveau bilan canonique. C1 crée uniquement la frontière de transport qui sera
consommée, dans un lot ultérieur, par une file asynchrone.

## Décision

### Responsabilités

- Le scoring et la calibration restent déterministes, versionnés et auditables.
- Les réponses libres restent corrigées par un humain.
- OpenRouter est l'unique fournisseur prévu pour la future narration canonique.
- Une génération produit un brouillon. Une revue humaine est obligatoire.
- La publication reste une action distincte, autorisée et non automatique.
- Une panne fournisseur ne produit aucun substitut présenté comme bilan final.

### API et modèles

Le client utilise Chat Completions :

`POST https://openrouter.ai/api/v1/chat/completions`

Les modèles sont explicitement figés :

- primaire : `anthropic/claude-sonnet-5` ;
- fallback : `openai/gpt-5.6-terra`.

`openrouter/auto`, les slugs `latest` et un tableau opaque de modèles sont
interdits. Le fallback est décidé par Nexus, tentative par tentative.

### Politique de paramètres v1.1

La politique canonique est
`content/bilans/model-policies/bilan-model-policy-v1.1.json`.

- `temperature` : omise ;
- `top_p` : omis ;
- `seed` : omise ;
- reasoning : effort `low`, seulement après preflight concluant, et exclu de
  la réponse produit ;
- sortie bornée par une politique de transport explicite :
  `max_tokens` pour Sonnet et `max_completion_tokens` pour Terra ;
- structured output JSON Schema : strict ;
- `provider.require_parameters=true` ;
- `provider.data_collection=deny` ;
- `provider.zdr=true` ;
- aucun tool, plugin, browsing ou web search ;
- le paramètre déprécié `usage.include` est absent ; l'objet `usage` de la
  réponse reste obligatoire.

Une capacité nouvellement annoncée n'est jamais activée automatiquement.
L'apparition future de `temperature` dans le catalogue ne change donc pas le
payload. Tout changement nécessite une nouvelle version, un nouveau checksum,
un nouveau preflight et les évaluations qualité du lot de génération.

La sélection du nom du paramètre de sortie est versionnée séparément dans
`content/bilans/model-policies/bilan-transport-policy-v1.json`. Elle repose sur
une table exacte modèle → paramètre, jamais sur une inspection partielle du
slug. Le diagnostic authentifié du 31 juillet 2026 a établi que Terra accepte
`max_completion_tokens=2048` mais refuse `max_tokens=2048`, toutes les autres
contraintes restant identiques. Sonnet conserve `max_tokens`.

### Confidentialité

C1 utilise uniquement la chaîne synthétique `synthetic-no-pii`. Le futur
snapshot métier devra minimiser et pseudonymiser les données avant le client.
Le client ne journalise ni messages, ni réponse, ni corps d'erreur fournisseur,
ni clé. Il retourne seulement la donnée validée au processus appelant et les
métadonnées de transport autorisées.

ZDR et `data_collection=deny` sont des exigences de requête et de preflight.
Ils ne remplacent pas la validation juridique, la configuration privée du
compte OpenRouter, ni la mise à jour de la notice de confidentialité.

### Structured output et validation

C1 possède un schéma synthétique fermé avec `additionalProperties=false`.
La réponse est reparsée et validée par Zod. Le schéma métier final, le
grounding pédagogique et les contrôles inter-audience appartiennent aux lots
suivants.

### Asynchronisme

Le futur appel OpenRouter sera effectué par un worker après commit d'une
transaction courte. Aucun appel réseau ne sera autorisé dans
`prisma.$transaction`. C1 ne modifie ni Prisma, ni `JobOutbox`, ni
`report-service`, ni les routes.

### Provenance

Le client restitue :

- modèle demandé, modèle retourné et slug canonique ;
- identifiant de génération et raison de fin ;
- tokens et coût en micro-USD ;
- latence et numéro de tentative ;
- paramètre de sortie, checksums de capacité, de politique modèle et de
  politique de transport ;
- versions de politique et de schéma.

Il restitue aussi l'historique sûr de toutes les tentatives, y compris les
échecs : modèle demandé, dates, latence, code normalisé, caractère retryable
et seules métadonnées de génération, tokens ou coût déjà connues. Aucun corps
fournisseur n'est conservé.

Le plan `bilan-retry-policy-v1` est figé dans la politique :

1. `anthropic/claude-sonnet-5` ;
2. `openai/gpt-5.6-terra` ;
3. `openai/gpt-5.6-terra`.

Le client consomme ce tableau exact et ne dérive jamais implicitement le
modèle d'une tentative.

C1 ne persiste pas ces données. La relation immuable entre invocation et
révision sera traitée dans C2.

### En-tête `X-Title`

La valeur produit demandée contient un tiret cadratin. L'API native `fetch`
refuse ce caractère dans une valeur d'en-tête HTTP, qui doit être
ByteString-compatible. Le transport utilise donc exactement :

`Nexus Réussite - Bilans pédagogiques`

Cette normalisation limitée au séparateur est testée. Elle n'altère aucun
contenu métier.

### Historique Mistral et Chutes

- Les données Mistral existantes restent lisibles.
- Les routes de stages historiques sont inventoriées mais ne sont pas
  modifiées par C1.
- Le moteur canonique n'importe ni Mistral, ni Chutes.
- Chutes reste borné à NPC.
- C1 ne crée ni dual-write, ni métadonnée OpenRouter rétroactive.

## Conséquences

Le contrat échoue de manière sûre lorsque configuration, capacité, schéma,
budget, identifiant de génération ou usage de réponse sont absents ou
incohérents. Seule une fin `stop` est complète ; `length`, `error`,
`content_filter`, `cancelled`, `null` et toute valeur inconnue sont refusées.
L'activation réelle reste bloquée par le preflight privé, les budgets owner,
la confidentialité, le worker asynchrone et la revue humaine.

## Rollback

C1 n'a ni migration ni état persistant. Le rollback consiste à conserver
`BILAN_REPORT_GENERATION_MODE=DISABLED`, ne pas fusionner ou réverter la PR C1,
et ne démarrer aucun worker. Le scoring, les dashboards et les bilans
historiques restent indépendants.

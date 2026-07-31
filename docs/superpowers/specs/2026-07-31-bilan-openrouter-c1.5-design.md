# C1.5 — Benchmark parent durable et préparation documentaire C2

## Date

31 juillet 2026

## Contexte

Le premier benchmark OpenRouter est invalidé : son contrat de grounding et la
propriété des preuves ont changé, son compteur d'appels et ses coûts par modèle
ne sont pas démontrables, et son preflight Luna n'a pas été persisté. Il reste
conservé hors Git comme preuve historique, sans participer à la sélection d'un
modèle.

## Décision

Le nouveau benchmark est une campagne locale, synthétique, immuable et
rejouable. Son identité est le SHA-256 canonique des politiques, données,
prompts, schémas, SHA du dépôt et graine de randomisation. Toute modification
crée un nouveau `runId`.

La concentration fournisseur est acceptée pour ce benchmark et pour un futur
pilote asynchrone, jamais pour une publication automatique. Le risque
`LLM-PROVIDER-CONCENTRATION-001` reste P1 opérationnel jusqu'à sa revue du
30 septembre 2026.

## Composants

### Identité et planning

`run-identity.ts` calcule les checksums et le `runId`. `schedule.ts` produit un
carré latin équilibré et persiste les 36 combinaisons avant tout appel : chaque
modèle occupe exactement quatre fois chaque position.

### Journal et reprise

`journal.ts` crée le répertoire privé et `run-manifest.json` avant le catalogue,
puis écrit des événements NDJSON append-only. Chaque événement possède un
numéro, le checksum précédent et son propre checksum ; chaque append est suivi
d'un `fsync`. La reprise refuse un autre `runId`, ne rejoue jamais `VALIDATED`,
et classe un `STARTED` sans terminal en `UNKNOWN_OUTCOME`, réservé jusqu'à une
réconciliation ou décision opérateur.

### Budget

`budget-ledger.ts` parse les prix décimaux du catalogue sans flottant monétaire.
Avant un appel, il réserve une borne conservatrice calculée avec la taille
d'entrée, `maxOutputTokens`, les prix prompt/completion/reasoning/request et une
marge. Toute réponse ou erreur possédant un coût est réconciliée. Une issue
inconnue conserve sa réserve. Aucun appel n'est lancé si la réserve pourrait
dépasser 1 USD ou si les prix sont absents.

### Validation et métriques

`runner.ts` sépare sécurité, qualité et transport. Un échec de sécurité arrête
la campagne ; un défaut de qualité devient un résultat négatif sans retry ; un
échec transport est reporté et peut être repris une seule fois, jamais
immédiatement. Les métriques sont calculées uniquement à partir du journal et
ne contiennent aucune valeur parfaite codée en dur.

Les sorties utilisent la source PII `LLM_GENERATED_TEXT`. Une analyse
déterministe propre ne remplace pas la revue humaine de confidentialité.

### Revue humaine

Le paquet `reviewer-package/` contient uniquement des labels aveugles et des
formulaires vides. La correspondance modèles/fournisseurs/générations/coûts
reste dans `owner-sealed-model-key/`. Deux reviewers indépendants sont requis ;
aucune note n'est préremplie.

## Appels réseau

Après un commit et depuis un checkout propre, la campagne crée son répertoire,
persiste son planning, récupère le catalogue, exécute un preflight Luna durable,
puis traite 12 fixtures parent × 3 modèles. Elle s'arrête à 42 tentatives réseau
ou 1 000 000 micro-USD. ZDR, `data_collection=deny` et
`require_parameters=true` restent obligatoires.

## Portée

Le benchmark évalue uniquement l'audience parent. Il ne permet aucune
conclusion sur les audiences élève ou Nexus. La politique v1.2 reste
`PROPOSED=false` et `APPROVED=false` jusqu'à deux revues humaines réelles.

## C2 documentaire

Les documents C2 décrivent queue, leases, ledger, dead letter, retries différés,
provenance, observabilité et rollback. Aucun modèle Prisma, migration, worker,
route ou changement de `report-service` n'est créé.

## Rollback

Le benchmark est hors production. Le rollback consiste à arrêter le processus,
conserver le journal et les réserves, marquer le run `PAUSED` ou `FAILED`, et ne
relancer qu'après réconciliation. Aucun artefact existant n'est supprimé.

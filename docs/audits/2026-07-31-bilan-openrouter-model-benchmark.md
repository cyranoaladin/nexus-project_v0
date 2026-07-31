# Audit du benchmark OpenRouter des bilans

## Date

31 juillet 2026.

## Base

- base fonctionnelle : PR #91, SHA
  `aa69cd981cec9b644c4122e87cd455065dcd92dd` ;
- branche : `feat/bilan-openrouter-model-benchmark` ;
- données : douze fixtures exclusivement synthétiques ;
- politique produit : `bilan-model-policy-v1.1`, inchangée ;
- politique benchmark : `bilan-model-benchmark-policy-v1`.

## Préconditions validées

- clé privée lue par le lecteur sécurisé existant ;
- attestation privée propriétaire valide et bornée à 30 jours ;
- ZDR, collecte refusée et paramètres requis présents dans chaque requête ;
- aucun retry, outil, plugin, browsing ou response cache ;
- aucune donnée réelle de mineur ;
- schémas de rapport parent, élève et Nexus fermés et versionnés ;
- score et preuves rattachés localement.

## Exécution réelle

Le premier preflight Luna synthétique a franchi le contrat de transport sur le
SHA `969148b319745d3c05a11ac3ad60082395463920`. Son résultat n'a pas été écrit
avant l'arrêt du premier benchmark ; ses métriques détaillées ne sont donc pas
retenues comme preuve active.

Les exécutions de dépistage ont ensuite mis en évidence trois défauts distincts,
tous traités sans assouplir la sécurité :

1. une compétence `DEVELOPING` pouvait être proposée comme force : le schéma
   est maintenant lié aux identifiants locaux ;
2. certains mots-clés JSON Schema n'étaient pas portables entre fournisseurs :
   le schéma transport est réduit au sous-ensemble strict vérifié ;
3. Sonnet a croisé une preuve entre compétences sur la fixture synthétique
   `synthetic-complex-03` : les `evidenceRefs` sont désormais retirées du
   brouillon LLM et injectées localement.

Après ces corrections, un run a progressé plusieurs minutes puis a reçu
`OPENROUTER_PROVIDER_UNAVAILABLE`. Aucun retry n'a été exécuté. Les anciennes
versions du runner n'écrivaient pas encore de checkpoint par tentative ; il est
donc impossible de reconstruire honnêtement les métriques par modèle ou un
paquet de revue complet.

## Coût et garde-fous

- consommation de la clé avant le dernier run : 0,14458 USD ;
- consommation observée après arrêt : 0,1830415 USD ;
- hausse correspondant au dernier run : 38 461,5 micro-USD ;
- limite de clé : 2 USD ;
- hard stop benchmark : 1 500 000 micro-USD ;
- dépassement de budget : non.

La consommation agrégée inclut les preflights et tentatives de qualification ;
elle ne doit pas être présentée comme un coût moyen par modèle.

## Résilience fournisseur

Les preflights Sonnet et Terra de #91 ont tous deux été servis par Azure. Le
catalogue ZDR indiquait des routes Amazon Bedrock compatibles pour Sonnet, mais
la tentative explicite vers le slug officiel `amazon-bedrock` n'a pas abouti.
Terra ne présentait que des routes Azure compatibles.

Verdict :

`PROVIDER_DIVERSITY_STATUS=SINGLE_PROVIDER_CONCENTRATION`

L'indisponibilité observée pendant le benchmark confirme que Terra ne constitue
pas nécessairement un fallback d'infrastructure indépendant de Sonnet.

## Résultat

- `SYNTHETIC_ONLY=true`
- `REAL_STUDENT_DATA_SENT_COUNT=0`
- `BENCHMARK_TOTAL_COST_HARD_STOP_EXCEEDED=false`
- `BENCHMARK_CALL_COUNT=UNKNOWN_PRE_CHECKPOINT`
- `BENCHMARK_CALL_COUNT_36_PROVEN=false`
- `HUMAN_REVIEW_PACKAGE_COMPLETE=false`
- `HUMAN_REVIEW_STATUS=BLOCKED`
- `MODEL_POLICY_V1_2_PROPOSED=false`
- `MODEL_POLICY_V1_2_APPROVED=false`

Le benchmark n'est pas qualifié. Aucune comparaison coût/qualité Luna, Terra,
Sonnet ne peut être publiée à partir de résultats partiels.

Le run est formellement classé
`INVALIDATED_BY_CONTRACT_CHANGE`. Ses preuves restent conservées mais ses
résultats ne participent à aucune statistique ni sélection de modèle. Les
causes sont : contrat de grounding et propriété des preuves modifiés,
checkpointing modifié, nombre d'appels et coûts par modèle non prouvables,
preflight Luna non persisté.

## Corrections livrées

- checkpoints privés append-only par tentative ;
- erreurs fournisseur normalisées sans corps brut ;
- poursuite sans retry après une indisponibilité isolée ;
- arrêt après trois indisponibilités consécutives du même modèle ;
- impossibilité de produire un paquet humain complet si une sortie manque ;
- rattachement local des preuves ;
- tests avec serveur HTTP local.

## Risques restants

1. Priorité P1, propriétaire infrastructure : revoir
   `LLM-PROVIDER-CONCENTRATION-001` le 30 septembre 2026. La concentration est
   acceptée pour le benchmark synthétique et le pilote asynchrone, pas pour la
   publication automatique.
2. Priorité P0, équipe pédagogique : effectuer la revue aveugle avec au moins
   deux reviewers indépendants. Acceptation :
   toutes les grilles remplies et identité des modèles révélée après notation.
3. Priorité P0, owner produit : décider la politique v1.2 seulement après les
   résultats automatiques et humains.

## Rollback

Aucun raccordement métier n'existe. Ne pas fusionner la PR benchmark suffit à
retirer ces changements. Aucun rollback Prisma ou production n'est nécessaire.

# Runbook — rollback du worker OpenRouter

## Déclencheurs

- fuite ou suspicion de fuite de données ;
- erreur répétée de schéma/grounding ;
- 401/402, budget dur ou guardrail incohérent ;
- indisponibilité durable du provider ;
- dead letters non surveillées ;
- hausse anormale de 5xx ou duplication.

## Arrêt applicatif

1. définir `BILAN_REPORT_GENERATION_MODE=DISABLED` dans le store runtime
   canonique ;
2. arrêter les nouveaux claims du worker ;
3. laisser expirer ou annuler proprement les appels en cours ;
4. interdire toute nouvelle publication et révoquer seulement sur décision
   staff documentée ;
5. conserver scoring, authentification, dashboards et bilans historiques ;
6. capturer les compteurs, SHA, versions de politique et IDs techniques sans
   contenu pédagogique brut.

Le flag ne doit pas interrompre le scoring. Aucun fallback Mistral, Chutes ou
bilan public déterministe n'est autorisé.

## Réconciliation

- `LEASED` sans appel : remettre en queue après expiration contrôlée ;
- appel démarré sans terminal : `UNKNOWN_OUTCOME`, aucun replay automatique ;
- coût connu : réconcilier le ledger même si la sortie est invalide ;
- réponse sûre déjà persistée : conserver `PENDING_REVIEW`, ne pas publier ;
- dead letter : triage opérateur, relance manuelle idempotente seulement.

## Base de données

Ne jamais utiliser `prisma db push`, supprimer les tables d'invocation ou
réécrire l'historique. Un rollback de schéma est une migration compensatoire
testée fresh/upgrade. Les snapshots, invocations, révisions et audits sont
conservés.

## Reprise

Exiger avant redémarrage : cause racine, secret/guardrail/budget vérifiés,
Redis disponible, migration validée, preflight synthétique ZDR vert, worker
unique sur un petit lot, alertes actives et smoke test sans PII. Réactiver
d'abord l'audience Nexus et un module approuvé ; parent seulement après revue.

## Risque fournisseur

Pour `LLM-PROVIDER-CONCENTRATION-001`, la concentration est acceptée uniquement
pour un pilote asynchrone. Une panne mène à retry différé puis dead letter,
jamais à publication automatique. Revue du risque : 30 septembre 2026.

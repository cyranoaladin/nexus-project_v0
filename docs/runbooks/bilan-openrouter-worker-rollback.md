# Runbook — rollback du worker OpenRouter

## Déclencheurs

401/402, budget dur, fuite ou suspicion de fuite, grounding/schéma répété,
dead letter non surveillée, worker sans heartbeat, Redis indisponible, publication
incorrecte ou incident fournisseur prolongé.

## Actions applicatives autorisées

1. Mettre `BILAN_REPORT_GENERATION_MODE=DISABLED` dans le store runtime canonique
   par une opération approuvée.
2. Arrêter le worker sans redémarrer les autres services.
3. Interdire les nouvelles publications ; conserver scoring, authentification,
   dashboards et bilans historiques disponibles.
4. Laisser les jobs non commencés en attente. Classer les appels commencés sans
   résultat durable en `UNKNOWN_OUTCOME`.
5. Révoquer une publication affectée uniquement par commande auditée et motifée.
6. Conserver l'ancienne release immédiatement réactivable.

## Données

Ne supprimer aucun snapshot, invocation, coût, révision, publication ou événement
d'audit. Ne pas utiliser `prisma db push`. Une incompatibilité de schéma se traite
par migration compensatoire approuvée ; jamais par rollback destructif.

## Vérifications après arrêt

- aucune nouvelle invocation ;
- aucune nouvelle publication ;
- profondeur/âge de queue connus ;
- authentification, pages publiques, dashboards, scoring et bilans legacy sains ;
- notifications non dupliquées ;
- métriques et alertes toujours reçues.

## Reprise

Exiger cause racine documentée, secrets/Redis/budget valides, CI et smoke verts,
preflight synthétique lié au SHA exact, revue des unknown outcomes et accord
opérateur. Réactiver d'abord sur données synthétiques puis audience Nexus ; aucune
publication famille automatique.

## Escalade

Owner opérations : runtime/worker. Owner sécurité : confidentialité et secrets.
Owner produit/pédagogie : revue/publication. Toute action de production exige une
fenêtre et une autorisation séparées de ce document.

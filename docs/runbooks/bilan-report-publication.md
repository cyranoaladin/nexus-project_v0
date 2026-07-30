# Runbook — génération, revue, publication et révocation

## Principe

La génération ne vaut jamais approbation ou publication. Les audiences
`NEXUS`, `PARENT` et `STUDENT` ont des artifacts distincts.

## Générer

1. Vérifier un snapshot `FINAL` avec maximum non nul et provenance complète.
2. Vérifier zéro correction requise en attente.
3. Choisir explicitement l'audience.
4. Générer la révision déterministe.
5. Contrôler template, score source, checksum et absence de corrigé.

Un calibrage `PENDING_POLICY_VALIDATION` doit être présenté comme non validé.
Le flag LLM reste faux.

## Approuver

Un coach affecté ou un admin :

1. vérifie les données factuelles et le périmètre d'audience ;
2. renseigne un motif explicite ;
3. crée une revue nominative liée à `reviewerUserId` ;
4. confirme l'état `COACH_VALIDATED`.

L'identité ne doit jamais être inventée ou partagée.

## Publier

1. Vérifier qu'une revue `APPROVED` existe.
2. Publier la révision pour son audience.
3. Vérifier une seule publication active par artifact.
4. Pour `PARENT`, vérifier :
   - statut demande `PUBLISHED` ;
   - événement d'audit ;
   - notification outbox unique.
5. Confirmer qu'une autre famille obtient 404.

La commande est idempotente. Même clé et même payload retournent la même
publication ; même clé et payload différent produisent un conflit.

## Révoquer

1. Choisir la publication exacte.
2. Saisir un motif non vide.
3. Révoquer sans supprimer l'artifact, la révision ni l'historique.
4. Vérifier que l'audience ne peut plus lire le bilan.
5. Si aucune autre audience n'est active, la tentative revient à `SCORED`.

Une audience révoquée peut être régénérée et republiée même si une autre
audience reste active.

## Rollback opérationnel

- urgence globale : remettre `BILAN_CANONICAL_INTAKE_ENABLED=false` ;
- contenu erroné : révoquer les publications concernées ;
- correction erronée : révoquer toutes les audiences, réviser, rescoring,
  régénération, revue et republication ;
- ne jamais supprimer les preuves ni réécrire une migration appliquée.

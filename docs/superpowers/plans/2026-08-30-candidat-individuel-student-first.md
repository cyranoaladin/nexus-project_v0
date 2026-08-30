# Plan d'implémentation - sélection élève en premier

## Objectif

Permettre à un utilisateur staff de sélectionner directement un élève, résoudre automatiquement son responsable et conserver l'invariant `contactLeadId + studentId` jusqu'à la simulation.

## Étapes

1. Ajouter les tests rouges du contrat API, du composant et du scénario E2E élève en premier.
2. Ajouter la route staff de résolution d'identité, fondée sur les guards RBAC, Prisma et le helper CRM existants.
3. Rendre la recherche élève indépendante de la sélection responsable.
4. Lors du clic élève, afficher un état de résolution puis installer ensemble le responsable et l'élève retournés par le serveur.
5. Conserver le reset et la revalidation lors d'un changement manuel de responsable ou d'une désélection.
6. Exécuter les tests ciblés, puis typecheck, lint, unitaires, DB/intégration, sécurité, build, audit artefact et E2E candidat individuel.
7. Confirmer zéro migration pending et `ACTIVE_INTERNAL`, créer une release immuable, effectuer le cutover atomique et redémarrer uniquement le processus applicatif PM2 ciblé (jamais l'ensemble des processus).
8. Vérifier health local/public, PM2, RBAC, recherche API, absence de 5xx et conserver la release précédente comme rollback.

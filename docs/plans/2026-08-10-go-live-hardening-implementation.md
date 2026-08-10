# Plan d’implémentation — durcissement go-live

## Objectif

Produire une PR isolée qui répare les causes racines du banc rouge, corrige le parent source orphelin, unifie les chemins de contact et de PDF Parent, puis apporte une preuve complète sans échec et sans quarantaine injustifiée.

## Étapes

1. Écrire les tests rouges du bootstrap E2E, du snapshot pytest et du garde de quarantaine.
2. Rendre le seed E2E autonome, bloquant et vérifié ; partager son manifeste de comptes avec Playwright.
3. Aligner le seed Prisma sur le schéma courant et corriger les fixtures real-db obsolètes.
4. Ajouter les tests rouges du tombstone parent, puis la migration additive et l’implémentation transactionnelle.
5. Tester la migration deux fois sur une base PostgreSQL éphémère et vérifier les contraintes obtenues.
6. Introduire le moteur PDF Parent unique, adapter l’ancien modèle et prouver l’équivalence.
7. Introduire le normaliseur d’e-mail générique, migrer les consommateurs et verrouiller les variantes Unicode.
8. Remplacer les quatre hardcodings par les sources canoniques existantes.
9. Inventorier les 51 quarantaines, réactiver les scénarios valides et convertir uniquement les dépendances structurelles en conditions documentées.
10. Corriger les autres défauts réels révélés par les campagnes unitaires, intégration, real-db et concurrence.
11. Exécuter les quality gates et la totalité des suites dans un environnement éphémère, avec rapporteurs produisant les décomptes exacts.
12. Relire la diff, vérifier l’absence de secret et d’impact production, puis publier une PR en demandant la revue d’`abenrhouma`.

## Critères d’arrêt

Un défaut qui ne peut pas être corrigé proprement est conservé comme échec visible et documenté. Aucun contrôle, test ou règle de sécurité n’est neutralisé pour obtenir un résultat vert.

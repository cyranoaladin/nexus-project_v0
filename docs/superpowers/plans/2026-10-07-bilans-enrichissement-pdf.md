# Enrichissement des quatre bilans — plan d’implémentation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Intégrer exhaustivement et avec adaptation pédagogique les deux PDF dans les quatre bilans, en préservant les réponses et accès existants.

**Architecture:** Compléments de contenu séparés des banques historiques, getters partagés pour champs et maîtrise, validation et restitutions cohérentes. Aucun nouveau système d’authentification ni migration de base.

**Tech Stack:** Next.js/React, TypeScript, Prisma/PostgreSQL, Jest, Playwright.

Statut : validé par le « go » utilisateur ; terminé — version enrichie publiée et vérifiée en production. Chaque action ci-dessous constitue une étape courte de travail ; les campagnes de tests et la compilation peuvent durer davantage.

## 1. Contenu et couverture

- [x] Extraire et inspecter les seize pages des PDF, y compris figures.
- [x] Comparer aux banques et identifier les incompatibilités de valeurs/index de navigation.
- [x] Établir la référence de tests actuelle : 846 tests, 47 suites, tous réussis.
- [x] Confirmer le plan avec l’utilisateur.
- [x] Compléter la matrice PDF → quatre profils et la faire relire indépendamment.
- [x] Écrire les tests de couverture et conservation historique ; constater les échecs attendus.
- [x] Ajouter les compléments disciplinaires troisième/seconde et leurs corrigés serveur.
- [x] Ajouter les compléments transversaux adaptés aux quatre profils sans reformuler les réponses historiques.

Fichiers : `lib/espace/bilan-data.ts`, banques `lib/espace/bilan-*.json`, `lib/espace/bilan-corrections.ts`, documentation `docs/pedagogie/bilans-enrichissement-pdf/`, tests `__tests__/lib/espace/bilan-*.test.ts`.

## 2. Contrats et interface

- [x] Écrire les tests rouges de maîtrise complémentaire, échelles, aide prioritaire et métadonnées d’essai.
- [x] Ajouter les getters de maîtrise partagés et la validation stricte correspondante.
- [x] Adapter `BilanWorkbench` : rubriques, échelles compactes, conservation des preuves, navigation par identifiant et relecture.
- [x] Adapter `bilan-display`, `WorkViewer` et `BilanFamilyReport` pour restituer toutes les nouvelles réponses.
- [x] Vérifier les rubriques conditionnelles, les plafonds et les anciennes copies transmises.
- [x] Exécuter les tests ciblés, corriger les échecs constatés et faire relire la conformité puis la qualité.

Fichiers : `lib/espace/bilan-work.ts`, `lib/espace/bilan-profiles.ts`, `lib/espace/bilan-display.ts`, `components/espace/student/BilanWorkbench.tsx`, `components/espace/teacher/{WorkViewer,BilanFamilyReport}.tsx`, leurs tests de composants et contrats.

## 3. Recette

- [x] Compléter les scénarios E2E des quatre profils avec les nouveaux champs et le cycle enseignant.
- [x] Vérifier sauvegarde/reprise, conflits, lecture seule, réouverture et export sur comptes fictifs.
- [x] Exécuter la régression espace et les intégrations sur PostgreSQL jetable.
- [x] Vérifier TypeScript, lint ciblé et `git diff --check`.
- [x] Compiler une release indépendante et vérifier les secrets/corrigés absents des ressources publiques.
- [x] Exécuter les E2E sur l’artefact exact, contrôler mobile et inspecter les PDF.

Commandes : `npm run test:unit -- --runInBand` avec sélection espace ; harnais `scripts/espace/bilan-validation-local.sh` ; configuration Playwright bilan ; scripts officiels de compilation et vérification de release. Utiliser Node22.23.1 et des environnements privés, jamais la base réelle pour les tests.

## 4. Publication et preuve

- [x] Consigner les pointeurs actifs et les empreintes des données existantes, sans secrets dans les journaux.
- [x] Sauvegarder la base et vérifier l’archive.
- [x] Synchroniser les quatre activités, vérifier le catalogue, transférer l’artefact avec contrôle de sommes.
- [x] Basculer par `scripts/espace/switch-release.sh` avec garde de release attendue.
- [x] Vérifier santé, parcours techniques de production et invariants des données réelles.
- [x] Désactiver/clôturer les identités et séances techniques utilisées, conserver les preuves privées.
- [x] Documenter les résultats, limites, version publiée et liens ; informer l’utilisateur.

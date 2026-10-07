# Plan — extension des bilans aux Terminales

**Objectif :** questionnaires distincts et sourcés, accessibles après attribution, exploitables par le professeur sans modifier les réponses historiques.

**Architecture :** registre léger de quatre profils ; deux banques JSON élèves ; corrigés serveur séparés ; getters communs aux validations et vues ; catalogue de neuf activités. Aucune migration de schéma.

1. Analyser en parallèle les livrets maths/NSI et auditer les dépendances du bilan existant. Livrer banques et matrices source/page, corriger les ambiguïtés et vérifier les calculs/programmes.
2. Écrire et exécuter les tests rouges des profils Terminale (routes, huit étapes non vides, compatibilité stockage, prérequis, isolation), puis ajouter registre, banques et getters pour les rendre verts. Garder banque historique intacte.
3. Adapter en parallèle les six surfaces UI/catalogue ; tests rouges puis verts pour matière, quatre aperçus, rapport. Ajouter corrigés serveur et tester leur séparation du contenu client.
4. Écrire huit scénarios E2E Terminale à comptes/groupes jetables (matières, attributions, cycles complets, indépendance, mobile, preview). Contrôler unitaires, intégration, typage et lint.
5. Geler les modifications ; construire dans le clone indépendant Node22.23.1 puis exécuter la matrice E2E sur l’artefact compilé (Chromium/Firefox/WebKit). Revue finale et corrections fondées sur les échecs observés.
6. Sauvegarder la DB, synchroniser uniquement le catalogue via l’outil officiel, vérifier son miroir et préparer une release immuable. Basculer atomiquement avec contrôle de la release attendue ; santé et fumée technique. Fermer les comptes techniques.
7. Attribuer les bilans seulement à la population confirmée, selon matières actuelles, sans modifier les codes. Documenter preuves de tests, sources, release et limites ; fournir les liens.

Les étapes sont découpées en opérations courtes et indépendantes ; l’exécution reprend le format et le déploiement déjà autorisés par l’utilisateur, sans nouvelle demande générale d’approbation.

# Plan d'implémentation — planning UI Pré-rentrée 2026

## 1. Contrats rouges

- Ajouter les tests des formatters publics, des quatre thèmes et du DTO planning.
- Remplacer les attentes historiques qui exposent l'enum ou le statut singulier.
- Ajouter les tests de tableaux, cellules libres, rôles, salles et synchronisation.
- Étendre le scénario Playwright pour clavier, axe, mobile et captures demandées.
- Exécuter les suites ciblées et conserver la preuve de l'échec avant correction.

## 2. Libellés et formatters

- Créer les formatters client-safe de statut, heure, date condensée et lieu.
- Les utiliser dans le configurateur et les informations pratiques.
- Conserver « nouvel onglet » dans le texte accessible uniquement.

## 3. Données et expérience partagée

- Étendre le DTO avec les semaines, rôles de salle et rôles enseignants validés.
- Ajouter un contexte client de classe configurée, nul par défaut.
- Synchroniser planning et programmes sur les nouveaux choix du configurateur.
- Garder les changements manuels des onglets locaux et sans effet sur le formulaire.

## 4. Thème et composants

- Créer la source centrale des quatre thèmes matière.
- Créer un badge matière réutilisable.
- Appliquer le thème au configurateur, au résumé, au planning et aux programmes.

## 5. Planning premium

- Réécrire la section avec légende et onglets Radix accessibles.
- Construire le tableau par classe depuis les sessions du DTO.
- Construire l'emploi du temps par semaine depuis les blocs, salles et sessions.
- Rendre les cartes/listes mobiles sous 640 px.
- Ajouter l'organisation pédagogique dérivée des rôles du DTO.

## 6. Qualification locale

- Exécuter les tests ciblés, typecheck, lint, anti-hardcoding, contraste et axe.
- Exécuter le scénario Playwright sur desktop, tablette, 390 px, 320 px et zoom.
- Lancer le gate global avec PERF_TESTS=1, le build, le standalone et les smokes.
- Lancer audit liens/sitemap, security:repo, diff-check et contrôle secrets.
- Générer puis inspecter les onze captures hors Git.

## 7. Livraison preview

- Produire au maximum quatre commits atomiques et le rapport de preuve.
- Pousser la branche sans force après qualification verte.
- Construire l'image depuis le nouveau SHA exact avec Node 20.20.0.
- Remplacer uniquement l'application de la stack preview existante en conservant
  authentification, base, réseau, noindex et hostname.
- Exécuter les E2E distants et vérifier la production en lecture seule.

# Parcours NSI « Récursivité et programmation récursive »

## Date

2026-10-04

## Contexte

Ajout, à l'espace pédagogique Terminale, d'un troisième parcours NSI autonome, distinct des TP POO 1 et 2 : « Comprendre, tracer et écrire des algorithmes récursifs » (thème « Algorithmique et programmation »). Travail mené en parallèle d'une autre instance d'agent (ARIA, tableaux de bord) : aucun fichier commun (worktree `espace-release`, branche `feat/espace-recursivite`), aucune migration de schéma.

## Problèmes observés

- La table des durées de la demande totalise 133 min alors que le noyau cible est de 110 à 115 min : durées ajustées (8/12/12/14/16/16/10/18/8 = **114 min**), bonus hors durée.
- Le catalogue en base (`espace_activities`) est un miroir : un nouveau parcours exige une ligne avant la première ouverture (ajoutée en production, commande `provision.ts sync-activities` créée).
- Un garde existant (`public-lux-charte-guard`) exige que toute page soit classée : page ajoutée à la liste d'exclusion des pages `/espace`.
- Constat d'accessibilité (axe, 360 px) : un bloc de code défilant n'était pas atteignable au clavier — corrigé (`tabindex="0"` sur les blocs de code du contenu).

## Décisions prises

- Réutilisation intégrale du moteur existant (autosave, remise, annotations, Pyodide/Web Worker) ; aucune infrastructure de sauvegarde parallèle.
- La récursivité est **observée**, pas cherchée dans le texte : enveloppeur de compteur d'appels sur le nom de la fonction de l'élève ; une solution à boucle est signalée (« s'appelle elle-même »), toute écriture récursive valide est acceptée. Limite de profondeur 200 : `RecursionError` lisible sans gel ; récursion exponentielle interrompue par le délai du Worker (recréé ensuite).
- 9 étapes obligatoires + bonus (dichotomie récursive, Fibonacci comme contre-exemple, arbre fractal en lecture seule). Fibonacci n'apparaît jamais avant le bonus. Aucune notion hors programme (récursion terminale, CPS).
- Aides à trois niveaux (cas de base / réduction / squelette) sur chaque exercice ; encadré « Comment construire une fonction récursive ? » répété dans six étapes ; fiche de synthèse imprimable.
- Figure interactive APPEL/RETOUR + pile d'appels (LIFO), modèle pur testé.
- Regroupement par thème des activités NSI (élève) ; compétences suivies = liste du contenu qui pré-remplit le commentaire existant (enseignant).
- Corrigé enseignant privé (PDF) : solutions, traces, difficultés, interventions, « Comment diagnostiquer une mauvaise compréhension ? ».

## Fichiers modifiés

`content/espace/nsi-recursivite/**` (nouveau), `docs/espace/corriges/nsi-recursivite/corrige.html`, `lib/espace/{catalog,lesson-routes,lesson-types,overview,recursion-trace}.ts`, `app/espace/nsi/recursivite/page.tsx`, `app/espace/eleve/{page,matieres/page}.tsx`, `app/espace/enseignant/corriger/[workId]/page.tsx`, `components/espace/student/{figures/CallTrace,figures/FigureView,LessonWorkbench}.tsx`, `components/espace/teacher/CorrectionWorkspace.tsx`, `scripts/espace/{build-corriges,install-resources,provision}.ts`, `next.config.mjs`, `playwright.auth.config.ts`, tests (unitaires, intégration, E2E, fumée de production), documentation `docs/espace/*`.

## Tests exécutés

| Contrôle | Résultat |
|---|---|
| TypeScript | 0 erreur |
| Lint | 0 alerte |
| Unitaires (`jest.unit.config.js`) | 1 148 suites / 13 505 tests ; 1 échec initial (garde de charte, corrigé) puis vert |
| Harnais Python (CPython, même fichier que Pyodide) | 52 tests : solutions et variantes valides passent, codes faux échouent avec message utile, non-terminaison bornée |
| Intégration vraie base (suites `espace-*`) | 7 suites / 138 tests (dont `espace-recursivite.real.test.ts`) |
| E2E Chromium (build du commit) | `espace-recursivite` 15/15 ; `espace-terminale`, `espace-lecons`, `espace-credentials` : 24/24 — aucune régression POO 1, POO 2, Maths, auth, autosave, enseignant |
| Accessibilité | axe : 0 violation à 360 px (étapes diagnostic, pile d'appels, synthèse), pas de débordement horizontal |
| Build de release | clone propre, `ARTIFACT VALID`, `BUILD_ID` `AyxLRAp0A4nhjMiwnYltB` |
| Fumée de production — anonyme | pages publiques 200, parcours → connexion, corrigé et aperçu 401, journaux sans erreur, legacy POO inchangé |
| Fumée de production — authentifiée | **NON exécutée** (voir Risques restants) ; spec `e2e/prod/espace-prod-recursivite.spec.ts` validée 5/5 sur la pile locale |

## Résultats

Release en production : `/var/www/nexus-releases/a35be9fde-espace-recursivite-20261004T1512Z` (commit `a35be9fde`), santé 200, cinq identités concordantes, pm2 en ligne, 0 redémarrage instable. Précédente : `d7f041c1c-espace-credentials-20261003T0900Z`.

## Risques restants

- **Fumée authentifiée de production non faite.** Pour ne modifier aucun vrai travail, elle exige des comptes techniques neufs ; leur création en base de production (tunnel + rôle d'exécution) a été refusée par le garde-fou de la session. Le parcours est donc vérifié en production côté anonyme et par identité de release, et côté authentifié sur un build identique en pile jetable. À exécuter une fois les comptes créés (commandes dans le rapport de session).
- La limite de profondeur de l'atelier (200) diffère de Python standard (≈ 1 000) : annoncé dans le parcours.
- Pas de paquet de secours hors ligne pour ce parcours (le plan de secours du 3 octobre couvre POO 2 et Maths).

## Rollback

Pointeur canonique vers `/var/www/nexus-releases/d7f041c1c-espace-credentials-20261003T0900Z`, garde, `pm2 restart nexus-prod`. La ligne `espace_activities` et le PDF restent (inertes sans le code) ; ne rien supprimer.

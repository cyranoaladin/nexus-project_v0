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

- *(résolu le soir même, voir « Clôture » ci-dessous)* fumée authentifiée de production.
- La limite de profondeur de l'atelier (200) diffère de Python standard (≈ 1 000) : annoncé dans le parcours.
- Pas de paquet de secours hors ligne pour ce parcours (le plan de secours du 3 octobre couvre POO 2 et Maths).

## Rollback

Pointeur canonique vers `/var/www/nexus-releases/d7f041c1c-espace-credentials-20261003T0900Z`, garde, `pm2 restart nexus-prod`. La ligne `espace_activities` et le PDF restent (inertes sans le code) ; ne rien supprimer.

## Clôture (2026-10-04, soir)

Voir `docs/espace/DEPLOIEMENT.md` §10. Résumé : release finale `cabf20ce1-espace-recursivite-cloture-20261004T1718Z` (`BUILD_ID` `xn0iUwo3EQGN24uuPiQLq`) basculée avec verrou et compare-and-swap ; fumée authentifiée de production 8/8 avec les comptes techniques `val.*` existants (réactivés puis refermés) ; compte enseignant réel 2/2 en lecture seule ; empreintes des données réelles identiques avant/après ; plan de secours Récursivité testé sans réseau ; garde catalogue ↔ base (`audit-activities`) ; durcissement de la détection récursive et reformulation de la limite de 200 appels (bac à sable Nexus).

Tests de la clôture : TypeScript 0 erreur, lint 0 erreur (avertissements préexistants hors périmètre) ; unitaires 1 149 suites / 13 498 tests, dont une suite (`architecture/npc-storage-contract`) dont le worker est parfois tué (SIGTERM) en exécution groupée et qui passe 23/23 isolément (intermittence constatée, non liée à ce chantier) ; un échec réel trouvé puis corrigé (inventaire des mutations `User` : réactivation technique) ; intégration `espace-*` 8 suites / 147 tests, E2E Chromium 39/39 sur le build du commit servi, plan de secours 6/6 (requêtes externes bloquées), fumée de production 8/8 + 2/2.

Risque restant : la **publication distante** des sources est refusée par le garde-fou de la session ; branche prête : `release/espace-recursivite-2026-10-04` (historique anonymisé).

## Clôture d'ingénierie (2026-10-04, nuit)

Voir `docs/espace/DEPLOIEMENT.md` §11. Release servie : `e8a81cba0-espace-validation-scope-20261004T1827Z` (`BUILD_ID` `Q83ltYG_UJ8P1SV6vt8qZ`, source `e8a81cba0e693c48c20c6edfa10ef2911ff48c18`). Points : comptes de validation exclus des vues ADMIN (groupe `validation-technique`, `includeValidation` pour l'audit) ; preflight catalogue ↔ base fail closed dans la bascule (bogue de stdin trouvé avant toute bascule et corrigé) ; voie de tests lourde déterministe ; delta de comptage 13 505 → 13 498 expliqué (aucune suppression) ; fumée authentifiée de production 8/8 + 5/5 + 3/3 ; données réelles inchangées ; legacy POO inchangé (`dd6c60e9…`).

Risque restant : publication distante de la branche anonymisée, refusée par le garde-fou de la session.

## Traçabilité Git (2026-10-05)

```text
RELEASE_SOURCE_PUSHED=YES            PRODUCTION_TAG_PUSHED=YES
REMOTE_RELEASE_HEAD=bd2023e94a9163bcd4f22292ae45a3b94421db65 (= tête locale à la publication)
REMOTE_PRODUCTION_TAG=espace-recursivite-production-20261004 -> e8a81cba0e693c48c20c6edfa10ef2911ff48c18 (commit servi)
PRODUCTION_SOURCE_RECONSTRUCTIBLE=YES    TRACEABILITY_COMPLETE=YES (sous réserve de l'incident ci-dessous)
```

## Incident credential enseignant — clôturé

```text
TEACHER_PASSWORD_ROTATED=YES              OLD_EXPOSED_PASSWORD_REVOKED=YES
REAL_TEACHER_RELOGIN_AFTER_ROTATION=PASS  OLD_PASSWORD_CURRENTLY_VALID=NO (connexion refusée en production)
REAL_CREDENTIAL_IN_TEST_CODE=NO           OLD_PASSWORD_PRESENT_IN_PUBLISHED_HISTORY=YES (voir périmètre)
SECURITY_INCIDENT_CLOSED=YES
```

- **Cause** : un credential réel a été recopié comme donnée de test (`__tests__/lib/espace/credential-rules.test.ts`). Le scanner du dépôt ne le signalait pas (valeur dans un appel de fonction de contrôle, hors des motifs d'affectation).
- **Détection** : audit de publication final, après le premier push. Le propriétaire a été informé immédiatement.
- **Traitement** : mot de passe changé par le propriétaire depuis l'interface ; reconnexion réussie avec le nouveau ; ancienne valeur refusée en production (une tentative) ; fixture remplacée par une phrase de passe synthétique (commit de correction `196a014fd`, publié) ; l'ancienne valeur a été retirée du guide confidentiel et du fichier privé d'accès (remplacée par une mention de rotation) ; aucune autre copie locale (Documents/Nexus_Conservation, Téléchargements) ne la contient ; le guide sans credentials n'a jamais contenu de mot de passe.
- **Périmètre historique** : la valeur n'est présente que dans les commits `cf35f3853` à `bd2023e94` de la branche `release/espace-recursivite-2026-10-04` et donc dans l'arbre du commit taggé `espace-recursivite-production-20261004` (`e8a81cba0`). Elle est absente de la tête de branche, de `origin/main` et de toute autre référence distante. Secret historique révoqué ; conservation de l'historique pour stabilité et traçabilité. Pas de `filter-repo`, pas de force-push, tag inchangé (`PRODUCTION_TAG_TARGET_UNCHANGED=YES`). Aucune raison de sécurité impérieuse n'impose une purge : la valeur est inutilisable.
- **Garde-fous renforcés** (`scripts/security/check-versioned-credentials.mjs`) :
  1. nouvelle règle `CREDENTIAL_FIXTURE_REALISTIC` : une valeur sans espace ni « @ », d'au moins 16 caractères et d'entropie ≥ 4 bits/caractère passée à une fonction `check/validate/verify/hash/compare/assert…Password|Passphrase|Pin|Code|Secret(…)` est refusée ; les phrases lisibles et les noms d'exemple restent acceptés ;
  2. comparaison locale aux secrets privés : `NEXUS_PRIVATE_SECRETS_FILES=/chemin/a.txt:/chemin/b.txt node scripts/security/check-versioned-credentials.mjs` (formats `CLE=valeur` et `nom;identifiant;secret`) signale `PRIVATE_SECRET_MATCH chemin:ligne` sans jamais afficher la valeur ; fichier illisible = arrêt (code 2). Les fichiers de secrets restent hors Git et ne sont jamais exportés ; le nouveau mot de passe réel n'est dans aucun de ces mécanismes (le propriétaire peut l'ajouter à son fichier privé local s'il le souhaite) ;
  3. règle de conduite : aucune fixture de test ne dérive d'un vrai secret ; utiliser des valeurs synthétiques lisibles et identifiables.


# SSE — collecte unique et annulation avant lecture

Date : 4 octobre 2026. Campagne source : `efbd719bb7e06b08ff97cfe72976cb1e4192a843`.

## Causes vérifiées

Lint et ARIA zero-test-debt échouent sur la même cause : les nouveaux fichiers `sse-terminal-drain.test.ts` et `native-response-reader.test.ts` sont collectés à la fois par aria-unit et aria-sse. Le contrôle de collecte doit garantir exactement une qualification par fichier. Les deux fichiers restent collectés par aria-sse ; ils sont exclus seulement du glob général aria-unit. Aucun test n’est désactivé.

La couverture CI refuse les 98,43 % de lignes du parseur. La reproduction locale sur les trois suites SSE donne le même résultat : les lignes 114–115 ne sont pas exercées. Elles correspondent à une annulation déjà effective avant la lecture suivante, différente d’une annulation pendant une lecture en attente.

## Correction et preuve

Un scénario déterministe interrompt synchroniquement le consommateur dans onDelta. Il vérifie le refus ABORTED, une unique annulation du transport, un unique signal protocole et aucune annonce de succès. Aucun délai ni seuil n’est modifié.

- Avant : 3 suites, 49 tests réussis ; lignes 98,43 %, statements 96,79 %, branches 96,29 %.
- Après : 3 suites, 50 tests réussis ; lignes 100 %, statements 98,07 %, branches 97,22 %, fonctions 100 %.
- `npm run test:zero-debt` : succès, 6353 fichiers inspectés, zéro test ignoré ou exclusif et zéro test ARIA absent de la qualification.
- ESLint ciblé et git diff --check : succès.

Les artefacts locaux ciblés sont ignorés sous `.artifacts/recovery/sse-coverage-diagnostic`. Ce résultat ne remplace pas la couverture complète ni la CI distante du prochain SHA. Aucun changement de comportement produit ou migration. Rollback : revenir par commit inverse à cette attribution de suites et à ce scénario, sans modifier le parseur.

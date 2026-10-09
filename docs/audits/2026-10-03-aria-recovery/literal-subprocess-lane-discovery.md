# Découverte des lanes npm exécutées par un harness

Date : 2026-10-05. Base de correction : dc54d6dea77616302ae4b986717d3800d7bbf715.

## Cause et critères
Le job Real DB réussissait ses 73 tests V1 et 333 tests Core, puis le contrôle statique ne suivait pas le subprocess npm littéral du harness Golden. Le test obligatoire était déclaré orphelin. Conserver le test, son isolation et toutes les assertions ; découvrir son invocation sans exécuter le wrapper pendant l’analyse.

## Correction
Analyse AST TypeScript des appels npm littéraux spawn/execFile, sans arguments calculés ni sélection de fichiers. Les scripts imbriqués rejoignent la même résolution des scripts canoniques. Quatre tests Node obligatoires sont ajoutés au job CI. Aucun skip, exclusion ni seuil modifié.

## Preuves locales
Deux tests rouges sur quatre avant correction, puis quatre réussites sur quatre. Lint ciblé réussi. `npm run test:lanes:check` : 1726 fichiers déclarés accessibles, aucun orphelin.

## Limites et rollback
La découverte statique ne prouve pas l’exécution ni l’atteignabilité de chaque branche du programme. Le harness Golden reste un job obligatoire qui exige deux tests réellement réussis. La CI distante doit renouveler la preuve sur le SHA publié. Rollback par commit inverse applicatif, sans modification des bases.

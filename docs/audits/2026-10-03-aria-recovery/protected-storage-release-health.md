# Readiness protégée : stockage documentaire et identité de release

Date : 2026-10-05. Base de correction : dc54d6dea77616302ae4b986717d3800d7bbf715.

## Critères
Autorisation avant les probes, réponses private/no-store, répertoire documentaire accessible et indépendant de la release en production, aucune fuite de chemin. Le SHA ne provient que du manifeste vérifié contre le BUILD_ID, jamais d’une variable d’environnement déclarative. Une absence de CWD retourne un état contrôlé.

## Correction
Probe FS en lecture seule, vérification des chemins réels et droits de répertoire. Stockage inaccessible rend le Core non prêt. Identité non vérifiée rend l’état global dégradé, sans bloquer le Core à elle seule. Les dépendances RAG demeurent indépendantes du Core.

## Preuves locales
Après résolution d’une erreur initiale de résolution du module de test, quatre échecs causaux ont été reproduits. Les cas supplémentaires identité et CWD ont ensuite reproduit respectivement un et deux échecs. Résultat final : 2 suites, 21 tests réussis. Service existant d’identité de release : 6 tests réussis séparément dans la lane Core-v2. Typecheck et lint ciblé réussis.

## Limites
Les droits FS ne prouvent ni écriture effective, durabilité, espace libre, restauration ou téléchargement. Les workers et autres stockages ne sont pas qualifiés par cette probe. Aucun SHA servi en production n’est connu par ce test local ; aucune production modifiée. La CI et la qualification opérationnelle restent à renouveler. Rollback par commit inverse ; aucune migration ou suppression de données.

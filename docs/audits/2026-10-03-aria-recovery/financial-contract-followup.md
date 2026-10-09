# Alignement des preuves financières après campagne complète

Date : 4 octobre 2026. Base locale : 8b7dbe25c ; distant testé : 91161a7cf. Statut : NOT_READY.

## Résultats conservés

La suite complète locale a fini avec 1 319 suites réussies / 1 en échec et 14 687 tests réussis / 1 en échec, sur 14 688. Le seul défaut est une fixture du test family-subscription-financial-boundary sans les identifiants sélectionnés par la nouvelle autorité familiale. Ne pas requalifier cette campagne comme verte.

Chromium distant a fini avec 526 réussites, 1 échec, 1 non exécuté. L’attente du header CSRF refusé était private, no-store alors que la route servait private, no-store, max-age=0, must-revalidate. Ces directives supplémentaires renforcent le contrat. Le parcours parent/logout n’a pas échoué dans cette campagne, sans prouver vingt répétitions.

## Corrections des tests

Enrichir la fixture synthétique de Student.userId et parent.userId. Vérifier la sélection minimale de la première requête puis les IDs autorisés dans le WHERE de la seconde ; conserver les interdictions monthlyPrice/ariaCost. Le driver E2E compare exactement le header canonique complet, sans assertion retirée, seuil abaissé ni contrôle serveur modifié.

## Vérifications

13 suites / 78 tests ciblés réussis. Lint ciblé réussi ; collecte Playwright canonique : 3 scénarios, pas une exécution navigateur. Typecheck, scan des credentials versionnés, Gitleaks staged et diff-check réussis. Preuves privées : .artifacts/recovery/family-contract-followup-*-private.log et ci-91161a7cf-auth-chromium-private.log.

La nouvelle CI exacte doit réexécuter la suite complète et le navigateur. Aucun déploiement effectué.

# Nettoyage des fixtures Golden Family et audit immuable

2026-10-05. Base locale : `4c53ad2feaa6c15671606122da0ecd032d31a7a9`.

La campagne cross-browser du SHA publié c76d372eb a terminé avec 77 succès et 3 échecs. Le nettoyage rencontrait la FK Restrict de l’audit de cancellation ; il ne s’agit pas d’une preuve de course de logout. La nouvelle migration protège volontairement cet historique.

Deux tests unitaires ont reproduit le nettoyage incompatible avant correction, puis réussi. Le helper vérifie à chaque appel la base jetable autorisée. Une fixture sans audit est supprimée comme auparavant. Une fixture auditée conserve ses relations et son historique : les credentials sont révoqués transactionnellement, les versions de session avancent une seule fois. Un second nettoyage reste idempotent. Aucun trigger ni FK n’est contourné.

Le scénario E2E conserve ses assertions métier et d’autorisation ; son contrôle terminal vérifie désormais la révocation et la conservation de l’historique au lieu d’exiger une suppression contradictoire avec l’audit append-only.

Preuve isolée `1791159822` : 3 suites PostgreSQL / 24 tests verts et 1 suite réelle de teardown / 2 tests verts. Migration du schéma courant sur une base synthétique vide, restauration chiffrée synthétique et interruption/reprise DDL réussies. Instance tmpfs appartenant au rehearsal arrêtée après vérification de stabilité des sources. Ces preuves ne constituent pas une restauration de sauvegarde de production.

Typecheck renouvelé : succès. La qualification navigateur distante du nouveau SHA et les répétitions requises restent à exécuter. Aucune règle de rétention de production n’est déduite du traitement des fixtures jetables.

## Revue indépendante en lecture seule

Revue de fb03be7be : aucun nouveau P0/P1 démontré. Limites explicites : la preuve vérifie les changements persistés et non un login/OTP après révocation ; la détection couvre les audits de cancellation, pas toutes les catégories d’audit. Une création concurrente d’audit après comptage peut faire échouer une suppression par FK, sans effacement silencieux de l’audit. Ce helper reste réservé aux fixtures jetables et ne définit pas la rétention de production. Aucun test ni écriture effectué par le reviewer.

## Campagne complète

`npm run test:unit -- --runInBand --json --silent` sur fb03be7be51379001fa3e82d799bcf034a122941 : 1343 suites et 14886 tests réussis, zéro échec, zéro test en attente, sortie 0. Scan Gitleaks des quatre commits locaux : zéro secret détecté. Diff-check : succès. Les documents ajoutés après cette campagne ne changent pas le code exécuté ; la CI finale reste requise sur le commit documentaire publié.

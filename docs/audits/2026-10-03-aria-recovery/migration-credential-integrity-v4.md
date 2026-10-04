# Preuves de migration sans empreinte rapide de credential

## Décision et compatibilité

La ligne opérationnelle conserve son vérificateur bcrypt. La preuve d'intégrité utilise des métadonnées, un sentinel PRESENT/ABSENT et une révision scrypt déterministe liée à l'identité et au format. Une rotation du vérificateur continue donc à modifier la preuve. Le hash générique refuse récursivement les champs nommés `password` ; il ne constitue pas un scanner universel de secrets.

Le format passe à `core-v2-migration/4`. Les plans de version 3 sont refusés avant toute lecture cible et doivent être régénérés ; aucune conversion opaque ni modification de credential. Aucune migration SQL et aucune opération de production.

Le calcul lent des révisions source/cible s'effectue hors transaction. Sous verrou de ligne paramétré sur `users`, le service relit le tuple d'identité : toute modification depuis le calcul provoque un refus atomique. Il ne remplace jamais l'identité canonique par celle de la source historique.

## Preuves exécutées

- Boundary générique avant correction : 4 échecs attendus et 25 réussites.
- Transform après correction : 32 réussites, 3,193 s.
- Migration sur deux bases PostgreSQL synthétiques : 27 réussites, 24,141 s, y compris rotation concurrente après préparation, blocage observé via PostgreSQL, refus atomique et absence de nouvelles écritures/audits.
- Typecheck global, lint ciblé sans avertissement et diff-check : code de sortie 0.
- Premier essai avec mauvais fichier de configuration : aucun test trouvé. Premier essai du verrou sur un nom de table incorrect : échec corrigé en utilisant le mapping `users`. Ces essais ne sont pas des preuves vertes.
- Journaux : `.artifacts/recovery/migration-integrity-boundary-red.log`, `migration-integrity-boundary-green.log`, `migration-integrity-real-concurrency-green.log`.

## Risques et gates

Le coût scrypt est payé par utilisateur préparé ; mesurer le temps total selon le roster avant exécution opérationnelle. Une modification pendant préparation impose une nouvelle préparation, jamais un contournement du contrôle. CodeQL distant, campagne globale et restauration représentative restent à qualifier sur le nouveau SHA.

Mesure locale isolée : 100 utilisateurs synthétiques, 16 844 ms, sans transaction de base. Ce microbenchmark mesure uniquement la dérivation ; il ne prouve ni le débit complet d'une migration ni son RTO.

## Correction du guard d'autorité du client

La CI de `71e8cec8d2e6876ade6e46294c3d073e8942cc27` a refusé l'import valeur de `Prisma` depuis le module généré : 1 échec et 38 réussites dans le guard d'architecture. Reproduction locale identique. Le verrou utilise maintenant `$queryRaw` tagué, sans accès valeur au module généré. Après correction : 39 tests du guard réussis, 27 tests PostgreSQL réussis (25,36 s), typecheck et lint ciblé réussis. Aucun guard affaibli.

Une campagne Core locale a terminé avec 76 suites et 762 tests réussis (224,68 s), mais le petit changement d'import a été réalisé pendant son exécution : ce résultat est diagnostique et ne qualifie aucun SHA figé. La CI du prochain SHA doit renouveler la preuve complète.

Revue en lecture seule du delta : aucun P0/P1 nouveau identifié ; pas d'approbation GitHub ni de validation opérationnelle implicite.

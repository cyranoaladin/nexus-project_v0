# Autorité familiale avant réémission d’activation

Date : 4 octobre 2026. Base : 74396d4e1. Statut global : NOT_READY.

Le service consultait seulement le lien parentId legacy avant de remplacer le jeton et éventuellement l’identifiant/sessionVersion. Il consulte maintenant la façade canonique avec action mutation avant toute transaction. Seul LEGACY_ALLOWED entre dans la transaction existante ; DENIED ou CORE_VERIFIED_READ ne permettent aucune écriture. AUTHORITY_UNAVAILABLE donne un 503 privé dans la route. Le verrou FOR UPDATE et la revérification du rattachement legacy restent conservés.

Quatre tests rouges reproduisent les refus et la mauvaise traduction d’une panne. Après correction : 4 suites, 32 tests verts, typecheck et lint concernés réussis. Revue indépendante lecture seule : aucun fail-open nouveau démontré. La campagne initiale PostgreSQL utilisait par erreur le script test:db, qui ne découvre pas cette suite ; aucun test exécuté, échec explicite. Le script canonique test:integration découvre ensuite la suite réelle et réussit, migrations complètes et replay réussis, instance tmpfs propre à cette mission arrêtée. Résultat réel : 1 suite, 1 scénario complet réussi (création staff, rattachement, activation, anti-rejeu et concurrence). Résultats conservés dans la preuve privée.

Aucune migration ni changement de format de jeton dans ce lot. La course d’une migration Core entre snapshot et transaction V1 n’est pas résolue ; les opérations de cutover doivent être quiescentes. Le hash SHA-256 du jeton legacy reste à auditer séparément, ce lot ne revendique pas sa migration HMAC. CI du prochain SHA et E2E restent à exécuter. Aucun déploiement.

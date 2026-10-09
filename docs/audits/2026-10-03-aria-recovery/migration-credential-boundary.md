# Frontière des credentials de migration

## Critères et défaut reproduit

Un compte actif migré ne doit jamais conserver un mot de passe en clair, un digest
rapide ou une représentation bcrypt invalide. Le plan doit échouer avant `apply`,
sans afficher le credential ni modifier automatiquement le compte source.

`deriveAccount` acceptait toute chaîne non vide. Huit tests négatifs échouaient
sur cette absence de refus : plaintext synthétique, SHA-shaped, coût 09, coût 32,
longueur incorrecte, version non supportée, saut de ligne, plan complet invalide.

## Décision

Le transformateur `/3` accepte uniquement une représentation bcrypt de 60 caractères,
versions 2a/2b/2y, coût 10 à 31 (maximum du format). Il conserve ses octets sans
rehashing. Le coût minimum suit la recommandation pour les systèmes bcrypt
historiques : https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html.
Les nouveaux mots de passe restent dérivés par le service account (coût 12).
Cette vérification structurelle ne démontre ni la qualité du mot de passe ancien,
ni la validité cryptographique d'un hash issu d'une source compromise.

Les credentials de familles jamais activées restent supprimés du **plan cible**,
comme auparavant ; leurs comptes demeurent PENDING_ACTIVATION. Aucune source n'est
modifiée. Un credential actif non supporté déclenche uniquement
`MIGRATION_SOURCE_CREDENTIAL_UNSUPPORTED`, avant toute écriture cible.

## Preuves

Configuration canonique `jest.core-v2.config.js`, test
`__tests__/core-v2/migration-transform.test.ts` : RED 8 échecs / 17 réussites,
puis GREEN 25 / 25. Logs privés `migration-credential-{red,green}.log` sous
`.artifacts/recovery`. La fixture générique `hash` était une chaîne opaque
incompatible avec la nouvelle frontière ; elle est remplacée par une fixture
bcrypt structurelle synthétique. Les assertions de préservation restent exactes.

Aucune migration SQL, aucun reset de compte et aucune écriture production.
La relance de la suite Core complète et la CI du SHA publié restent nécessaires.

## CodeQL et limites

L'empreinte SHA-256 du manifeste couvre une représentation déjà dérivée afin de
détecter sa dérive ; elle ne sert pas à authentifier. Cette frontière rend explicite
la précondition du dossier de sécurité #104. Elle ne constitue pas une clôture
automatique de l'alerte. Aucune suppression CodeQL, exclusion ou dismissal effectué.
L'arbitrage de faux positif suit exclusivement le processus de sécurité autorisé.

Le verrou de migration contre les écritures concurrentes V1 et la qualification
complète des formats historiques restent des contrôles distincts à terminer.

# Dossier de décision sécurité — CodeQL et empreintes

## Revalidation du 4 octobre sur fb9738226

Les alertes de `refs/pull/337/head` sont encore ouvertes et high au SHA exact
`fb97382265406b74c349b330506afed46046c162` : #113 au test HMAC ligne 74,
et #104 à l'empreinte de réconciliation ligne 101. Le check CodeQL est rouge.
Ce résultat ne qualifie pas les commits ultérieurs.

Le contrat du migrateur est désormais fail-closed : un compte actif à mot de
passe doit présenter un format bcrypt valide, coût 10–31, avant construction du
plan. Un credential incompatible arrête le plan entier sans l'afficher ni
désactiver son compte. TRANSFORM_VERSION est 3. Le test de répétition réel
utilise maintenant coût 10 et conserve la preuve de rotation des credentials.
La limite supérieure de format ne constitue pas une recommandation de coût 31.

Le digest de manifeste ne sert toujours pas à vérifier un mot de passe. Il
détecte une modification du hash déjà dérivé. Le retirer ferait perdre cette
preuve d'intégrité. L'oracle HMAC du test #113 reste indépendant du service et
porte sur le bearer opaque CSPRNG 256 bits, jamais un mot de passe humain.
Aucune assertion, annotation ou règle CodeQL n'a été retirée pour cacher ces
traces. La proposition de faux positif reste soumise à une décision sécurité
humaine étroite et une revalidation de l'analyse sur le SHA final.

## Analyse exacte après correction HMAC

SHA analysé : `699343b4bb03a5b336d94f0ad3c905bc8bf2420f`, ref `refs/pull/337/head`, analyse CodeQL `1887522632`, check `111343061400`. Deux résultats `js/insufficient-password-hash` / CWE-916 maintiennent ce check rouge. Aucun finding n’a été supprimé ou classé par cette session.

L’ancien sink runtime #102 n’apparaît plus dans les résultats de cette analyse de PR après le passage au HMAC dédié/versionné. L’alerte globale #102 demeure ouverte sur le main `5ffd4dd…` ; ne pas confondre correction sur la branche et état du main non fusionné.

| Finding exact | Source et sink | Usage réel / décision proposée |
| --- | --- | --- |
| [#113](https://github.com/cyranoaladin/nexus-project_v0/security/code-scanning/113) | `requestPasswordReset` → `reset.rawToken` → `account-token-hmac.test.ts:74`, HMAC indépendant | Vérifie le digest d’un secret opaque CSPRNG 256 bits avec clé dédiée, domain/purpose/version. Le mot de passe humain a été traité séparément par bcrypt coût 12. Classement faux positif étroit proposé après revue sécurité. |
| [#104](https://github.com/cyranoaladin/nexus-project_v0/security/code-scanning/104) | `SourceUser.password` → `TargetUser.password` → `transform.ts:101`, SHA-256 du JSON canonique | Empreinte de réconciliation d’un hash bcrypt existant, pas nouvelle dérivation de mot de passe. Le champ doit rester dans l’empreinte pour détecter une rotation de credentials. Préexistant sur main ; revue du contrat d’entrée et classement étroit requis, sans suppression du champ. |

Le digest du manifeste ne publie pas le contenu de l’objet ou son hash bcrypt. L’empreinte SHA ne remplace pas le vérificateur d’authentification ; le migrateur conserve les credentials reconnus par V1. L’assurance que toute entrée de migration respecte le format de hash attendu doit être examinée, et ne se déduit pas du seul nom `password`. Une entrée source non conforme doit être traitée comme défaut de données et refusée sans afficher sa valeur.

Preuves locales disponibles avant publication : suite Core canonique 73/720 réussie sur f12201789c2600e7d1256cf504f7cf4c6b8a8682, incluant contrats HMAC/rotation/replay et transformation ; suite unitaire 1281/14346 réussie. Ces résultats ne constituent pas la CI du nouveau SHA. La revue doit conserver l’assertion indépendante du HMAC et les tests prouvant qu’un changement du credential change l’empreinte, sans valeur de credential dans un artefact public.

Action réservée à un responsable sécurité autorisé : examiner les deux chemins sur le SHA soumis, accepter ou rejeter les justifications, puis utiliser le mécanisme officiel GitHub pour un éventuel classement **de ces seules instances**. Renouveler le check et vérifier les résultats exacts après décision. Aucune exclusion de règle, annotation, test supprimé ou changement de seuil n’est proposé. La PR demeure Draft et le déploiement interdit tant que le contrôle reste rouge.

## État historique avant remédiation

Ce dossier décrit le SHA publié `1e2d0a5c745479ef11e58edef575e390af6583d1`. La proposition de classement faux positif ci-dessous est remplacée par la correction réelle HMAC dédiée/versionnée décrite dans [account-token-hmac.md](account-token-hmac.md). Aucun classement ou suppression de finding n’a été effectué. Les preuves historiques SHA-256 ne qualifient pas le nouveau format.

## État de la décision historique

Alerte ouverte, bloquante. Aucune suppression, annotation d'exclusion,
modification du ruleset ou classification automatique. La proposition de
classification étroite ci-dessous nécessite la revue indépendante autorisée
par le mandat de clôture §3.1. Elle ne vaut pas approbation.

Finding : `js/insufficient-password-hash`, CWE-916, niveau high,
`lib/core-v2/services/account.ts`, fonction `hashInvitationToken`.
L'alerte a aussi été observée ouverte sur le main GitHub de départ.

## Actifs et flux

Les deux producteurs, `issueInvitation` et `requestPasswordReset`, appellent
`crypto.randomBytes(32)` : 256 bits issus du CSPRNG système. Base64url produit
43 caractères ; ce secret opaque n'est ni un mot de passe choisi par l'humain
ni un code court. Le digest SHA-256 déterministe permet la recherche de
l'invitation sans conserver son bearer token en clair dans `Invitation`.
Les mots de passe humains utilisent séparément bcrypt, coût 12.

Les consommateurs valident le purpose ACTIVATION/PASSWORD_RESET,
`expiresAt`, `consumedAt` et `revokedAt`, puis consomment transactionnellement
le jeton. Activation et reset incrémentent `sessionVersion`. Réémission,
désactivation et changement de mot de passe révoquent les preuves concernées.
Le reset sérialise ses écritures par verrou utilisateur. Le digest possède
un index unique ; un index partiel protège l'unicité du jeton ouvert par
utilisateur et purpose. Aucun token brut n'est reconstituable depuis le digest.

Le service remet une fois le token au transport e-mail. Le lien de délivrance
est nécessairement récupérable dans l'outbox chiffrée AES-256-GCM ; ne pas
prétendre qu'aucune base ne contient jamais une représentation du token.
Les assertions d'absence en clair portent sur identité, invitations et audit.
La clé de l'outbox, les URL de délivrance et les sessions ne doivent pas figurer
dans les logs, analytics ou rapports. Aucun secret n'est reproduit ici.

## Menaces et choix de primitive

| Compromission / abus | Protection et limite |
|---|---|
| Lecture seule de la table des invitations | Recherche de préimage sur un secret aléatoire de 256 bits ; aucune faible entropie à ralentir |
| Mot de passe humain faible | Bcrypt coût 12 et politique distincte ; jamais traité par `hashInvitationToken` |
| Token ou boîte mail volé | Bearer utilisable jusqu'à consommation, expiration ou révocation ; SHA, HMAC ou bcrypt ne corrigent pas le vol du bearer |
| Outbox et sa clé volées | Délivrances déchiffrables ; séparation des clés, accès et rétention à qualifier en exploitation |
| Écriture arbitraire en base | Compromission des identités et états ; HMAC seul ne protège pas le domaine entier |
| Essais en ligne | Validation et rate limiting indépendants du digest ; non-énumération à la frontière HTTP |
| Rejeu et concurrence | Consommation atomique, contrôles d'état, audit et rotation des sessions |

Un digest rapide est adapté au vérificateur aléatoire de forte entropie ;
le coût d'un KDF de mot de passe ne remédie ici à aucune faiblesse d'entropie.
La correction HMAC dédiée/versionnée est déjà implémentée sur la branche,
avec rotation et refus des anciens digests non versionnés ; voir le dossier
account-token-hmac.md. Les observations SHA-256 précédentes restent historiques
et ne sont pas une approbation de leur maintien.

Références primaires : [règle CodeQL sur les mots de passe](https://codeql.github.com/codeql-query-help/javascript/js-insufficient-password-hash/),
[OWASP Session Management — vérificateurs aléatoires](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Preuves et limites de qualification

`account.test.ts`, `password-reset-api.test.ts` et `concurrency.test.ts`
couvrent activation, mot de passe, expiration, révocation, replay, séparation
des purposes, sessions, réémission concurrente et rollback sur défaut d'audit.
`account-token-contract.test.ts` ajoute les appels CSPRNG 32 octets,
43 caractères/décodage 32 octets, digest attendu, absence du token brut dans
les données identité/audit, double confirmation et expiration UTC exacte.
Les résultats exécutés doivent être joints au SHA contenant ces tests.

Exécution locale avant commit : ces trois suites de service/HTTP, incluant
les quatre nouveaux contrats, ont réussi 32/32 tests sur PostgreSQL réel
éphémère. Typecheck et lint du nouveau fichier réussis. Il n'y a pas de
red artificiel : ces contrats attestent une propriété existante, sans
changer de primitive pour satisfaire le scanner. La CI distante du SHA
publié doit renouveler ces preuves et statuer sur son finding.

Les bornes de configuration (invitation 1–720 h ; reset 5–1440 min) ne
prouvent pas les TTL effectivement choisis en production. Redaction des
logs, protection des URL/referers, rétention et configuration outbox restent
des contrôles d'exploitation distincts. Aucun déploiement n'est qualifié ici.

## Action de sécurité proposée

Un mainteneur sécurité autorisé doit examiner uniquement les flux des findings
#113 et #104 sur le HEAD final et les preuves associées. Un classement faux
positif éventuel doit suivre le mécanisme GitHub officiel et sa revue requise,
avec justification propre à chacun. Sinon, ils restent ouverts et bloquants.
L'ancienne proposition concernant #102 est retirée : son sink runtime a reçu
une correction réelle, et son état sur main doit suivre la fusion protégée.
Renouveler ensuite CodeQL et toute la CI du HEAD exact. Ce document n'autorise
ni le classement, ni un déploiement, ni une modification du ruleset.

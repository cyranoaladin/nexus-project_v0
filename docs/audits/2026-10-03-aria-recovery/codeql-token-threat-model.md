# Dossier de décision sécurité — CodeQL #102

## État de la décision

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
Une évolution HMAC éventuelle exigerait une clé dédiée versionnée, une
rotation, une compatibilité TTL et des preuves opérationnelles ; elle ne doit
pas être improvisée pour faire disparaître une heuristique.

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

Un mainteneur sécurité autorisé doit examiner le flux du finding
[#102](https://github.com/cyranoaladin/nexus-project_v0/security/code-scanning/102)
sur le HEAD soumis et les résultats associés. S'il confirme que le sink
concerne exclusivement les vérificateurs CSPRNG décrits, classifier ce seul
finding comme faux positif par le mécanisme GitHub officiel, avec référence
à ce dossier. Sinon, conserver l'alerte ouverte et définir la remédiation
cryptographique nécessaire. Vérifier ensuite à nouveau CodeQL et la CI sur
le HEAD exact ; aucun vert ne peut être déduit de ce document seul.

# Réinitialisation V1 après transition d’autorité

## Critères d’acceptation

1. V1_ONLY accepte une preuve V1 valide sans contacter Core-v2.
2. HYBRID refuse la mutation V1 lorsque Core-v2 possède l’identité par ID ;
   pour une preuve e-mail, la résolution de cet e-mail est aussi vérifiée.
3. HYBRID/Core indisponible refuse, sans fallback ni consommation de preuve.
4. V2_ONLY refuse toute preuve V1, même si l’ID n’existe pas dans Core-v2.
5. Téléphone : émission, vérification et consommation respectent cette
   autorité ; aucune réponse ne simule un changement ou une vérification.
6. Les nouveaux contrôles passent par le bridge d’auth déjà autorisé ; aucune
   importation Core-v2 supplémentaire dans ARIA ou les routes V1.
7. Tests négatifs HTTP/services, contrôles de mode et preuve PostgreSQL sur
   deux bases synthétiques ; aucun secret dans les sorties.

## Défaut observé

La demande e-mail résout l’autorité, mais la confirmation d’une ancienne
preuve n’effectue pas ce contrôle. Le téléphone vérifie uniquement son
challenge V1. Un ancien jeton encore valide peut donc changer le miroir V1
après migration, alors que la connexion utilise le hash Core-v2. Cela prouve
une divergence et un faux succès possible ; aucune prise de contrôle de
Core-v2 n’est démontrée.

## Borne de concurrence

Un recontrôle ne constitue pas une transaction distribuée. La migration
d’identité doit être coordonnée avec les écritures de credentials par la
procédure officielle ; la quiescence/fence et sa reprise restent à qualifier
avant go-live. Ne pas transformer une preuve V1 en token Core-v2 ni déduire
une autorité V1 d’une indisponibilité Core-v2.

## État

Reprise depuis `d65806143971d00e4ad2062e558ac718878b64cd`, identique au
HEAD distant de la PR #337. Quatre tests rouges réexécutés : deux réponses
HTTP 200 au lieu de 400/503, deux preuves téléphone acceptées au lieu de refus.

Correction dans le bridge autorisé, utilisée à l'émission/vérification/
consommation téléphone et après validation HMAC de la confirmation e-mail.
Aucune migration, aucune transformation de token, aucune écriture Core-v2.
L'indisponibilité d'autorité donne un refus explicite ; le téléphone conserve
son erreur HTTP contrôlée existante sans exposer le fournisseur.

Vérifications locales du lot : 73 tests ciblés (cinq suites, incluant les
gardes architecturaux), 56 tests voisins (six suites), typecheck et lint ciblé
réussis ; scan Gitleaks des sept fichiers du lot réussi, aucune détection.
Les anciens cas d'expiration, révocation, relecture et consommation concurrente
restent couverts par la suite téléphone existante.

La preuve spécifique sur deux bases synthétiques et la coordination pendant
une migration d'identité restent à exécuter. Ce lot n'est pas une qualification
production ni une preuve de transaction distribuée ; ne pas déclarer le
critère 7 entièrement satisfait ou la gate go-live fermée.

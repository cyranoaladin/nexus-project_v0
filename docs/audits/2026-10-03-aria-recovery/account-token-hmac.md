# Correction réelle du digest des jetons Core

## Critères avant implémentation

Invitation et reset sont des jetons opaques CSPRNG de 32 octets ; les mots de passe restent bcrypt coût 12. La correction attendue utilise HMAC-SHA256 avec une clé serveur dédiée, distincte des clés de session et d'outbox. Le raw token encode la version et un identifiant public de clé ; le digest stocké encode également cette version. Le HMAC lie le domaine Core, la version et le purpose ACTIVATION/PASSWORD_RESET.

La configuration doit être explicite, bornée, sans secret par défaut. Une clé manquante ou invalide refuse l'émission et la consommation ; aucun secret ni erreur de parsing brute n'est journalisé. Un format invalide, une version inconnue ou une clé retirée donnent le refus public habituel. Aucun fallback SHA.

Les anciennes lignes sont conservées ; les liens non versionnés deviennent inutilisables et doivent être réémis à la demande. Pas de copie de token brut ni de migration destructive. La version fait partie du format du champ String existant. L'outbox conserve son chiffrement ; son dedupe utilise le nouveau digest.

Rotation : déployer le nouveau jeu de vérification sur toutes les instances avant de changer l'identifiant d'émission. Conserver la clé précédente jusqu'à expiration du dernier jeton et traitement des e-mails encore en attente. Son retrait révoque les jetons associés. Une ancienne release SHA ne peut vérifier les nouveaux liens : rollback avec une release compatible HMAC ou suspension explicite du parcours et réémission contrôlée, jamais un downgrade permissif.

Preuves requises : primitive/domaine/entropie, aucun raw dans identité/audit/logs, refus ancien SHA, format/version/key-id invalides, rotation puis retrait de clé, absence de configuration, expiry/replay/révocation/consommation concurrente, sessions et rate limit, transports HTTP/e-mail/E2E et CodeQL du SHA final. Ce document décrit les critères ; il ne revendique pas encore leur réussite.


## Preuves locales du lot

Avant correction, quatre tests de service échouaient sur le SHA non versionné, la rotation et le refus d’une configuration absente. Deux tests de démarrage échouaient en résolvant au lieu de refuser une configuration manquante. Après correction : 77/77 contrats ciblés sur PostgreSQL réel, 7/7 tests readiness/startup, quatre suites voisines d’architecture réussies, puis 73 suites Core / 720 tests réussis. Typecheck, ESLint ciblé, diff check et deux scanners du contenu indexé réussis. Schéma Prisma : commentaire uniquement, aucun changement de structure, aucune migration de données.

Le helper E2E génère des clés éphémères séparées et masque clé brute/keyring sur GitHub avant persistance. Chaque job HYBRID indépendant conserve une seule génération entre serveur et navigateur. Compose transmet explicitement la configuration ; les exemples restent sans clé. Hors Jest et fixtures jetables, aucune valeur de remplacement n’existe.

Qualification distante CodeQL non encore obtenue : l’alerte #102 reste ouverte sur le dernier SHA publié. Build final, suites générales, navigateurs et CI doivent être renouvelés sur le commit contenant ce lot. La PR reste Draft, la release production n’est pas autorisée. Les anciens liens doivent être réémis sans envoi massif ; une release antérieure sans HMAC ne constitue pas un rollback compatible.

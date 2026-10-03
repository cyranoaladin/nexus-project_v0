# Politique des nouveaux mots de passe — récupération du 3 octobre 2026

## Critères d'acceptation

- Refuser moins de huit caractères et plus de 72 octets UTF-8 avant toute
  recherche de jeton, écriture ou consommation d'une invitation.
- Accepter exactement 72 octets, y compris des caractères accentués.
- Conserver les contraintes lettre/chiffre des formulaires administratifs.
- Ne pas modifier la vérification des mots de passe historiques à la connexion.
- Partager une validation pure entre V1 et Core-v2 sans importer de client DB.

## Défauts reproduits

Le schéma administratif acceptait 73 octets ASCII et 74 octets UTF-8 : deux
tests rouges, deux tests de frontière déjà verts. La réinitialisation e-mail
acceptait également les dépassements avant cette correction. Trois appels de
modification coach (mot de passe trop court et deux dépassements) répondaient
200. Deux tests d'activation démontraient l'absence de validation de la limite.
Les sorties initiales sont conservées dans le dossier privé de preuves.

## Décision

`lib/security/password-policy.ts` centralise uniquement la validation des
nouvelles credentials : minimum huit caractères, maximum 72 octets UTF-8. Le
reset e-mail, les activations, le canal téléphone, les formulaires administratifs
et les services Core-v2 l'utilisent. Les contraintes administratives existantes
lettre/chiffre restent applicables. Un mot de passe vide dans une modification
coach garde le sens historique « ne pas changer le mot de passe ».

Le coût de hachage d'une modification coach passe de 10 à 12, conformément aux
autres écritures runtime existantes. Les anciens hashes restent vérifiables.
Cette tranche n'ajoute aucune migration et ne réécrit aucun compte existant.

## Vérifications

Les dix suites ciblées (routes, activation, validation et gardes d'architecture)
passent : 163 tests, zéro échec. Les assertions de refus et d'absence de lookup
ne sont pas affaiblies. La qualification Core-v2 et les contrôles statiques sont
relancés avant commit : Core-v2 68 suites / 670 tests verts, typecheck exit 0,
lint ciblé exit 0, scan du diff et nouveaux fichiers zéro détection,
`git diff --check` exit 0. Le test d'activation vérifie explicitement l'absence
de lookup User et StageReservation avec un jeton de forme valide.

## Limites et suite nécessaire

Le changement authentifié V1 et son audit transactionnel sont implémentés dans
`1a409bbb395a0628b157a7f760cc4edf955a4ccf`; leur qualification est suivie dans
`v1-password-change.md`.
Les routes administratives historiques acceptant encore un mot de passe défini
par un opérateur doivent être remplacées par invitation/réinitialisation selon
le mandat ; cette validation ne qualifie pas ce parcours administratif.
La qualification du build précédent `c4587a98` ne vaut pas qualification de ce
nouveau lot. Aucun déploiement n'est réalisé sur la base de ces seuls tests.

## Retour applicatif

Retour au code précédent possible sans changement de schéma ni migration de
données. Conserver les mots de passe déjà choisis : aucun backfill n'est requis.

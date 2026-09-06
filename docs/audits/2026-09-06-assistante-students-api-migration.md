# Migration de la création assistante vers le foyer canonique

## Date

6 septembre 2026.

## Contrat et consommateurs

Le formulaire assistante utilise désormais `POST /api/assistante/families` pour créer de un à six enfants. La recherche dans `app`, `components`, `e2e` et `scripts` ne trouve plus de consommateur applicatif de `POST /api/assistante/students` ; les lectures de cet annuaire restent inchangées.

L’ancien POST est un adaptateur du même service transactionnel, avec les mêmes permissions. Il accepte toujours la forme plate `parentFirstName`, `parentLastName`, `parentPhone`, `parentEmail`, `studentFirstName`, `studentLastName`, `studentGrade`, `studentSchool`, `studentEmail`. Le téléphone parent et l’en-tête `Idempotency-Key` sont désormais obligatoires ; les adresses email sont facultatives. Un client ancien doit donc collecter le téléphone et générer une clé stable pour une même tentative, conservée lors des renvois réseau.

La réponse canonique contient `parentUserId` et `children[].studentId`. L’adaptateur conserve aussi `studentId` au premier niveau lorsqu’un seul enfant est créé. Aucun identifiant unique fictif n’est renvoyé pour plusieurs enfants. Les réponses de validation et de doublon restent celles du service canonique.

La création ne fixe aucun mot de passe parent, n’active pas le compte et ne réinitialise pas un parent actif. L’invitation WhatsApp en attente et l’activation effective restent deux faits distincts. Les anciens appels sans téléphone sont refusés explicitement ; conserver leur activation immédiate contredirait le nouveau parcours validé.

## Vérifications

Tests du proxy : transmission au service canonique, réponse historique `studentId`, propagation des refus sans succès artificiel. Tests du service famille : validation, permissions, doublons, idempotence et atomicité. Aucun schéma de base ni historique de paiement modifié par cet adaptateur.

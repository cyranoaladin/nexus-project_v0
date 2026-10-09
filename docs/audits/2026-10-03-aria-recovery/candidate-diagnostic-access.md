# Autorisation avant lecture des diagnostics candidat-libre

## Acceptation et reproduction

Un coach sans affectation active ne peut résoudre le profil d'un élève tiers.
Un refus parent, élève ou coach ne doit jamais charger réponses, documents ou noms.
L'intention read/mutation reste explicite pour le guard familial Core.

La fonction `getStudentForActor` ne contrôlait aucune affectation pour COACH.
`getDiagnosticForActor` contrôlait l'accès après chargement du diagnostic complet.
Neuf tests négatifs/ordre d'accès échouaient avant correction, un test passait.
Une première invocation sans config explicite a été refusée par Jest (deux configs) ;
elle ne constitue pas une reproduction du défaut. La reproduction utilise ensuite
le script canonique `npm run test:unit -- --runInBand --runTestsByPath ...`.

## Correction et validation

Le coach doit posséder une affectation ACTIVE avant lecture du profil. Le diagnostic
est d'abord résolu par identifiants uniquement, puis autorisé, puis chargé avec une
condition liant les identifiants diagnostic/élève/utilisateur précédemment vérifiés.
L'absence ou le changement d'identité donne un 404 contrôlé. Aucun détail n'est
chargé en cas de refus ou d'indisponibilité de l'autorité familiale.

Quatre suites ciblées, 74 tests verts : accès, visibilité par audience, quotes parent,
quotes élève. Les assertions négatives incluent les appels Prisma exacts et leur
ordre, et ne remplacent pas les tests de visibilité existants. Logs privés sous
`.artifacts/recovery/candidate-ownership-*`. Typecheck et lint ciblé verts ; le
premier typecheck signalait une fixture Prisma renvoyant une Promise simple à la
place du client Prisma typé. La fixture utilise maintenant `mockResolvedValue`,
sans cast de production ni désactivation de vérification. Aucune migration ni
donnée production modifiée.

## Limites

Ce lot protège les lectures V1 concernées. Il ne démontre pas encore la coordination
transactionnelle entre les deux bases ni l'autorité de toutes les affectations
coach historiques après migration. Les autres endpoints familiaux restent à porter
au contrat d'autorité central. Il ne qualifie pas l'ensemble du domaine production.

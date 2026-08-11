# Saisie papier avec e-mail parent différé — conception

## Contexte

L'assistante doit pouvoir créer un foyer et un élève à partir d'une copie papier alors que l'établissement ne dispose encore que du téléphone du parent. Le bilan canonique doit ensuite suivre le même scoring déterministe, la même génération plancher et la même revue que le flux actuel. L'accès parent et la diffusion restent bloqués jusqu'à l'ajout d'un canal de contact activable ; cette livraison ne met en œuvre que l'e-mail.

La branche part de `origin/main` après le merge de la PR #115. Elle ne touche ni au scoring, ni au middleware ADMIN, ni au candidat libre, ni au sujet #108.

## Constats d'audit

- `app/dashboard/assistante/bilans/saisie-papier/family-form.tsx` exige actuellement `parentEmail` dans l'état de complétude et le payload.
- `lib/bilans/saisie-papier/famille.ts` exige un e-mail valide dans `requestSchema`, normalise cet e-mail, recherche le parent par e-mail puis crée immédiatement les intentions d'activation parent et élève.
- `prisma/schema.prisma` déclare `User.email String @unique` et `User.phone String?`. La migration initiale `prisma/migrations/20260201114538_init_postgres_prod/migration.sql` crée `users.email` en `NOT NULL` ainsi que l'index unique `users_email_key`.
- `ParentProfile.userId` et `Student.parentId` sont obligatoires, mais l'identité relationnelle repose déjà sur les identifiants internes cuid. Aucun e-mail n'est stocké sur ces modèles.
- `lib/bilans/api/paper-entry.ts` pose `SAISIE_PAPIER` à l'INSERT et lance le job canonique sans lire l'e-mail du parent.
- `lib/bilans/staff/review-service.ts` expose les bilans prêts comme `En attente de diffusion` et autorise validation puis publication sans contrôler le contact parent.
- Il n'existe pas de téléphone canonique : seul `User.phone` optionnel conserve une valeur d'affichage libre.

## Modèle de données

`User.id` reste l'identité. Les coordonnées sont des attributs :

- `User.email` devient nullable ; l'index unique existant reste en place. PostgreSQL autorise plusieurs `NULL` avec cet index et continue d'interdire deux valeurs non nulles identiques. Prisma conserve donc `@unique` pour les recherches exactes par e-mail sans introduire de divergence de schéma.
- `User.phone` reste le champ d'affichage.
- `User.phoneNormalized` est ajouté, nullable et indexé. Pour un numéro tunisien accepté, il contient les huit chiffres locaux, sans espace ni préfixe (`+216`, `00216` ou `216`).

La migration est additive : suppression du seul `NOT NULL`, ajout et indexation de `phoneNormalized`, puis backfill prudent des numéros tunisiens déjà interprétables. Aucune valeur e-mail présente n'est modifiée.

## Création du foyer et prévention des doublons

Le formulaire exige prénom et nom du parent, téléphone parent valide, prénom et niveau de chaque élève. L'e-mail est facultatif.

Avant l'écriture idempotente, le service cherche les foyers candidats :

- même `phoneNormalized` ;
- ou même prénom + nom de l'élève et même `gradeLevel`, après normalisation de comparaison des noms.

Une correspondance renvoie un résultat explicite `POTENTIAL_DUPLICATE` sans écriture. L'interface présente « Ce foyer existe peut-être déjà — rattacher ? » avec deux décisions humaines : rattacher à l'existant ou créer un nouveau foyer. La seconde requête transporte cette décision et reste idempotente. Le serveur revalide qu'un rattachement cible bien l'un des candidats proposés ; aucune fusion n'est automatique.

Sans e-mail, le compte parent est créé avec `email`, `password`, `activatedAt`, `activationToken` et `activationExpiry` nuls. Les comptes élèves et les liens de consentement sont créés comme aujourd'hui, mais aucune intention e-mail n'est mise en file. Avec e-mail, le flux d'activation existant est conservé.

## Diffusion différée et complétion du contact

La prévisualisation, les PDF, le scoring et la revue restent possibles sans e-mail. La publication est protégée deux fois :

- la projection de revue porte `parentEmailMissing`, affiche `Prêt — e-mail parent manquant` et désactive le bouton de diffusion ;
- le service `validateAndPublishPendingReport` refuse la mutation avant la validation si le parent n'a pas d'e-mail.

Le tableau de revue affiche un compteur distinct des bilans prêts mais bloqués.

L'action « Ajouter l'e-mail du parent » agit sur le foyer, jamais sur `ReportRevision`, `ReportArtifact`, `CanonicalAssessmentAttempt` ni leur contenu figé :

- si l'e-mail est libre, le compte parent courant est complété et reçoit un jeton d'activation ;
- si l'e-mail appartient déjà à un compte parent, les élèves du foyer incomplet sont rattachés au profil existant sans créer un second utilisateur portant cet e-mail ;
- si l'adresse appartient à un autre rôle, l'opération est refusée ;
- un compte parent déjà activé n'est pas réinitialisé ; sinon une activation est mise en file.

Les liens de consentement sont recalculés par le service canonique existant lors d'un rattachement. Le test d'immutabilité compare le snapshot du bilan avant et après la complétion.

## Extension future des canaux

La condition de diffusion est isolée dans un prédicat de disponibilité du contact, actuellement satisfait uniquement par un e-mail parent. Un futur lien remis par SMS, WhatsApp ou en main propre pourra remplacer ce prédicat sans coupler le state machine du bilan à l'e-mail. Aucun canal supplémentaire n'est construit ici.

## Sécurité et exploitation

- Toutes les routes et actions restent staff-only selon les gardes existants.
- Le téléphone n'est jamais loggé.
- L'e-mail reste normalisé et unique quand il est présent.
- Aucun déploiement ni merge n'est effectué.
- Le rollback applicatif consiste à revenir le commit ; le rollback de schéma peut conserver les colonnes additives. Rétablir `NOT NULL` exige auparavant de compléter ou traiter chaque utilisateur sans e-mail.

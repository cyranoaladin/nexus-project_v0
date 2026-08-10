# Saisie papier sans e-mail — audit et correction

## Date

10 août 2026

## Contexte

L'assistante doit pouvoir créer un foyer, saisir une copie papier, calculer le score et générer le bilan avec le seul téléphone parent. L'e-mail est complété plus tard pour activer le compte parent et autoriser la diffusion. La branche part de `origin/main` après le merge de la PR #115. Aucun déploiement n'est inclus.

## Problèmes observés

### Phase A — audit initial

- `app/dashboard/assistante/bilans/saisie-papier/family-form.tsx` rendait l'e-mail parent obligatoire dans l'interface et l'utilisait pour déterminer si le formulaire était complet.
- `lib/bilans/saisie-papier/famille.ts` imposait `parentEmail` dans son schéma Zod, normalisait systématiquement cette adresse, cherchait ou créait le parent par e-mail, puis créait immédiatement les jetons et intentions d'activation parent et élève. `app/api/bilans/saisie-papier/famille/route.ts` expose ce handler staff-only.
- `prisma/schema.prisma`, modèle `User`, déclarait `email String @unique` et `phone String?`. La migration initiale `prisma/migrations/20260201114538_init_postgres_prod/migration.sql` créait `users.email` en `TEXT NOT NULL` et l'index unique `users_email_key`. `ParentProfile.userId` et `Student.userId` sont uniques et pointent vers les cuid internes ; `Student.parentId` pointe vers le foyer. Aucun modèle parent distinct n'utilise l'e-mail comme clé primaire.
- PostgreSQL ne permettait donc pas de créer un `User` parent sans e-mail. L'unicité était globale quand l'adresse était présente. Aucun champ de téléphone normalisé n'existait ; seul `User.phone`, texte libre d'affichage, était disponible.
- `lib/bilans/api/paper-entry.ts` posait déjà `provenance: 'SAISIE_PAPIER'` à l'INSERT. Le scoring, la génération plancher et la revue ne dépendaient pas du contact parent.
- `lib/bilans/staff/review-service.ts` portait les révisions actionnables en `PENDING_REVIEW` ou `COACH_VALIDATED`, puis appelait explicitement validation et publication. L'écran ne distinguait que « En attente de diffusion », « Diffusé » et « Rejeté » : aucun état ne représentait un bilan prêt mais non diffusable faute de contact.
- `lib/auth/pending-account-lifecycle.ts` considérait tout parent non activé et sans mot de passe comme un candidat au nettoyage. Sans garde supplémentaire, un foyer papier sans e-mail aurait pu être confondu avec une activation abandonnée.

## Décisions prises

### Phase B — correction

- Le cuid `User` reste l'identité interne. `email` devient nullable ; l'index PostgreSQL unique existant est conservé. Il autorise plusieurs `NULL` et continue de refuser deux adresses non nulles identiques, soit l'unicité conditionnelle demandée sans introduire un second index concurrent.
- `User.phone` conserve la forme d'affichage `99 19 28 29`. `User.phoneNormalized` conserve les huit chiffres tunisiens locaux `99192829`, sans espace ni indicatif, et reçoit un index de recherche.
- La création papier exige un téléphone tunisien valide mais accepte l'absence d'e-mail. Sans e-mail, aucun jeton ni e-mail d'activation n'est créé. La provenance, le scoring et la génération ne sont pas modifiés.
- Avant création, une recherche porte sur le téléphone normalisé ou sur chaque triplet prénom élève + nom élève + niveau. Une correspondance renvoie une suggestion, sans mutation ; l'assistante choisit explicitement le rattachement ou la création d'un nouveau foyer. La cible de rattachement est revalidée côté serveur.
- Les parents sans e-mail sont exclus du nettoyage des activations abandonnées.
- La revue affiche l'état « Prêt — e-mail parent manquant », un compteur visible « X bilans prêts en attente d'e-mail parent », et désactive la diffusion. La prévisualisation, le PDF, la revue pédagogique et le rejet restent disponibles.
- L'action « Ajouter l'e-mail du parent » complète le parent source ou rattache tous ses élèves à un compte parent existant. Elle synchronise les liens de consentement, révoque les sessions éventuelles lors d'une mutation d'activation, enfile l'activation si nécessaire et ne modifie aucune révision, tentative, preuve, score ni matérialisation du bilan.
- `hasAvailableParentContact` centralise la condition de diffusion. Il ne reconnaît que l'e-mail aujourd'hui, mais offre le point d'extension minimal pour un futur canal d'activation. Aucun autre canal n'est construit dans cette PR.

## Migration

`prisma/migrations/20260809090000_deferred_parent_email/migration.sql` :

- retire uniquement `NOT NULL` de `users.email` ;
- conserve `users_email_key` ;
- ajoute `users.phoneNormalized` nullable et son index ;
- rétro-remplit seulement les numéros tunisiens historiques non ambigus ;
- ne supprime aucune donnée ni colonne.

La migration a été appliquée depuis zéro sur plusieurs bases PostgreSQL locales isolées. Le diff Prisma ne signale aucune dérive sur `email` ou `phoneNormalized`; il signale seulement l'index historique `eam_progress(user_id)`, antérieur et hors périmètre.

## États d'écran

- Sans e-mail, après génération : `Prêt — e-mail parent manquant` ; diffusion désactivée.
- Avec e-mail présent : `En attente de diffusion` ; diffusion disponible si les autres validations passent.
- Après publication : `Diffusé`.
- Après rejet : `Rejeté`.

## Fichiers modifiés

- Schéma et migration : `prisma/schema.prisma`, `prisma/migrations/20260809090000_deferred_parent_email/migration.sql`.
- Contact et création foyer : `lib/contact/parent-phone.ts`, `lib/contact/user-email.ts`, `lib/bilans/saisie-papier/famille.ts`.
- Complétion et diffusion : `lib/bilans/staff/parent-contact-service.ts`, `lib/bilans/staff/review-service.ts`, `lib/auth/pending-account-lifecycle.ts`.
- Interface staff : `app/dashboard/assistante/bilans/saisie-papier/family-form.tsx`, `app/dashboard/assistante/bilans/saisie-papier/page.tsx`, `app/dashboard/assistante/bilans/page.tsx`, `app/dashboard/assistante/bilans/actions.ts`.
- Adaptations de nullabilité : routes et services qui consomment un e-mail utilisateur non nullable par contrat métier.
- Tests : unités de contact, foyer, revue, migration et complétion ; intégrations PostgreSQL de saisie, nullabilité/unicité et immutabilité.

## Tests exécutés

- Tests ciblés de la fonctionnalité : verts.
- Migrations sur clones PostgreSQL : vertes.
- Intégration CI segmentée sur cinq bases isolées : 32 suites, 200 tests verts.
- Suite unitaire complète sans filtre : 760 suites, 8 500 tests et 7 snapshots verts, avec PostgreSQL local jetable migré explicitement et fournisseurs LLM neutralisés.
- `npm run typecheck` : vert.
- `npm run lint` : vert avec 29 avertissements préexistants, tous dans le candidat libre laissé hors périmètre.
- `next build` : compilation, typage et génération des 91 pages verts. L'audit standalone et les digests de l'artefact sont verts.
- La chaîne `npm run build` s'arrête uniquement dans `scripts/validate-next-traces.js` : ce garde classe tout chemin absolu contenant `.worktrees` comme interdit, y compris les `node_modules` normaux du worktree isolé. L'artefact produit ne contient aucun répertoire `.worktrees`, aucun test et aucune donnée runtime.
- Playwright applicatif non lancé : aucun scénario authentifié dédié à cet écran staff n'existe ; les comportements UI sont couverts par Testing Library et les parcours serveur par PostgreSQL réel. Chromium 145 a toutefois été installé et les suites PDF réelles du test unitaire complet sont vertes.

## Résultats

Le foyer papier est créable et le bilan est générable sans e-mail. Le téléphone est obligatoire, validé, stocké dans ses deux formes et utilisé pour la suggestion anti-doublon. L'absence d'e-mail bloque uniquement activation et diffusion. La complétion tardive débloque le contact sans réécrire le snapshot du bilan.

## Risques restants

- Le schéma actuel confond encore identité de compte et identité de foyer dans `User`/`ParentProfile`. Lors d'un rattachement à un compte existant, les élèves actifs sont déplacés vers le profil cible ; le compte source vide est conservé comme trace interne afin de ne pas casser les références historiques. Une consolidation générale des identités dépasserait ce correctif.
- Les autres parcours historiques qui écrivent `User.phone` ne renseignent pas tous `phoneNormalized`. La migration couvre les valeurs existantes non ambiguës ; ce correctif garantit la normalisation pour la saisie papier, son périmètre demandé.
- Le futur canal non e-mail devra étendre la disponibilité du contact et son activation, sans modifier les snapshots de bilan.

## Rollback

Avant merge, supprimer la branche ou revert le commit suffit. Après application de la migration, le code peut être reverté en laissant la colonne nullable et `phoneNormalized` en place. Ne pas rétablir `NOT NULL` tant que des foyers sans e-mail existent ; une migration de données et une décision produit seraient alors nécessaires.

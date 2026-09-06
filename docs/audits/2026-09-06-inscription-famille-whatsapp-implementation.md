# Réalisation — inscription familiale WhatsApp

## Autorisation

GO utilisateur du 6 septembre 2026 sur la conception `2026-09-06-inscription-famille-whatsapp-conception.md`. Option retenue par défaut proposé : WhatsApp + mot de passe. Transport réel non confirmé : développement et tests simulés, aucun envoi réel ni déploiement.

## Isolation

Worktree existant `.worktrees/dashboard-bilans-sans-credits`, branche `codex/dashboard-bilans-sans-credits`, base `76d542ebf4600e9ea845ca22cfc603fd4d40b179`. Conserve le retrait des crédits précédent. Aucun commit/merge automatique. Espace disque surveillé, aucune dépendance partagée ni modification des autres instances.

## Plan validé et ownership

- Identité : Prisma/migration additive, réservation+preuve téléphone, activation/récupération, connexion email compatible, pages auth. Sous-agent identité.
- Famille : extraction service commun, anciennes API compatibles, annuaire multi-enfant, situation scolaire et profil candidat progressif. Sous-agent assistante.
- Notification : outbox chiffrée sur jobs existants, transport Meta configurable, worker protégé et callbacks authentifiés, aucun faux succès. Sous-agent transport.
- Finalisation : API parent, formulaire de confirmation familiale, navigation, tests ownership et consentements. Agent principal.

Chaque lot : tests RED → minimum GREEN → revue contrats → revue sécurité/qualité. Intégration séquentielle des dépendances (schéma puis génération du client, services puis routes et pages). Vérifications ciblées puis lint/typecheck/build, tests de concurrence sur base jetable si disponible. Aucun accès base réelle.

## Contrats partagés

`User.parentPhoneState` NONE/RESERVED/VERIFIED, `parentPhoneVersion`, `phoneVerifiedAt`, `registrationCompletedAt`. `phoneNormalized` canonique conservé. `ParentPhoneChallenge` lie compte, numéro/version, finalité, expiration et consommation/révocation. Index partiel protège réservations et identités vérifiées ; trigger invalide la preuve si contact modifié.

`issueParentPhoneChallenge(tx,{userId,purpose,now})` puis `enqueueParentWhatsAppInvitation(tx,{userId,challengeId,rawToken,phoneNormalized,phoneVersion,purpose,expiresAt})` internes ; aucun jeton renvoyé au staff. Activations vers `/auth/parent-phone`, puis `/dashboard/parent/inscription`. Un ajout d’enfant ne réinitialise pas le mot de passe ni les sessions ; il remet la confirmation de dossier à compléter.

## Vérifications et résultats

- TDD sur les trois lots et la finalisation : RED puis GREEN observés.
- Revue croisée : nom propre de chaque enfant, refus du rattachement implicite malgré CREATE_NEW, parent fusionné refusé ; informations bac inconnues ne deviennent plus des faux négatifs.
- Création initiale : identité, niveau, situation scolarisé/candidat individuel, établissement facultatif. Le projet bac détaillé est saisi ensuite dans le dossier candidat canonique (selon disponibilité du pipeline). L’API peut créer le profil dans la transaction seulement avec les discriminants académiques explicitement fournis ; elle ne les invente pas.
- Finalisation : empreinte des informations effectivement affichées, vérifiée sous transaction ; tout dossier changé exige relecture. Changement de compte sans démontage : aucun dossier précédent ni succès tardif visible. Consentement de consultation des bilans distinct, facultatif et jamais implicite.
- Lien expiré : renouvellement d’activation directement accessible, réponse générique ; changement de lien efface les mots de passe et ignore les réponses obsolètes.
- `npm run lint` et `npm run typecheck` : succès (lint global avec avertissements existants).
- Toutes les migrations du dépôt appliquées à deux bases PostgreSQL jetables isolées. Les sept tests réels de `parent-phone-identity.real.test.ts` passent : unicité partielle, ancien numéro modifié, rôles/fusion, email, consommation concurrente unique, renouvellement et expiration.
- Première suite globale exécutée pendant les dernières corrections : 925/931 suites réussies, 10 133 tests réussis, six échecs. Les six suites ont ensuite été relancées après correction : 53 tests réussis. Seconde exécution globale : 932 suites, 10 155 tests et 29 snapshots réussis. Les six suites des derniers ajustements ont également été rejouées : 33 tests réussis. Les quatre tests réels de finalisation ajoutés dans `family-registration.real.test.ts` passent (ownership, révision périmée, absence de consentement implicite, rollback réel).
- Recette navigateur réelle sur données synthétiques : assistante authentifiée, foyer de deux enfants aux noms distincts, parent sans email, invitation chiffrée récupérée dans l’outbox pour simuler sa remise, activation et connexion téléphone, confirmation mobile sans consentement implicite, tentative de rejeu du lien refusée. Aucune requête Meta. Les premiers échecs venaient des sélecteurs de recette et de la configuration proxy du serveur local, corrigés sans contourner les contrôles applicatifs.
- Revue visuelle desktop/mobile : double translation du dialogue corrigée localement, défilement interne vérifié avec deux enfants ; textes d’aide du parent rendus lisibles, libellés de niveaux réutilisés. Captures avec données exclusivement synthétiques dans `artifacts/2026-09-06-inscription-famille/`.
- Smoke HTML local : huit pages publiques prioritaires répondent 200 et présentent un H1 unique. Cela ne certifie pas toutes leurs interactions ni leur contenu commercial.
- Factures : liste alignée sur la politique canonique des téléchargements, via bénéficiaires enfants et fallback email non vide. Les parents sans email ne peuvent jamais lister les factures au moyen d’une chaîne vide. Une facture historique sans bénéficiaire ni email correspondant demande un rattachement par l’assistante.
- `npm run typecheck -- --incremental false`, lint global final et `git diff --check` : succès. Build : réalisé dans une copie indépendante hors `.worktrees` pour conserver le validateur de traces intact ; comparaison des sources applicatives sans différence. Premier passage : signature de page candidat individuel rejetée par les types Next générés ; paramètre par défaut corrigé et 26 tests ciblés réussis. Deuxième passage complet : `npm run build` réussit (sortie 0), 97 pages générées, validation des traces et audit de production réussis, `STANDALONE_ARTIFACT_VALID=true`. Aucun contrôle de publication assoupli. Le manifeste porte un identifiant de validation locale, pas celui d’une release déployée.


## Déploiement, conservation et limites

Aucune base réelle modifiée et aucun envoi WhatsApp réel. Transport Meta et scheduler sont désactivés par défaut. La clé de chiffrement doit être configurée dès la création familiale ; sans cette clé, la transaction échoue intégralement plutôt que créer un compte sans invitation sécurisée. Les modèles Meta approuvés, secrets, webhook et worker doivent être configurés et leur livraison testée avant activation opérationnelle. Voir `lib/whatsapp/README.md`.

Les numéros existants ne sont ni fusionnés ni déclarés vérifiés automatiquement. Les parents historiques restent au statut NONE et conservent leur accès email. Le présent flux WhatsApp cible les nouveaux foyers et les comptes en attente gérés par le service familial. La conversion d’un parent historique déjà actif vers une identité téléphone vérifiée demande un parcours dédié de vérification, hors de ce lot.

Les candidats majeurs autonomes demeurent soumis au modèle familial existant ; aucun parent fictif n’est créé. Le formulaire initial n’est pas un remplacement du dossier bac canonique, de ses parcours, de ses révisions ni de ses contrôles de gouvernance.

Les migrations sont additives, sauf assouplissement NULL de `SubscriptionRequest.requestedByEmail` nécessaire pour les parents sans email ; aucune donnée supprimée. Trigger et index SQL constituent des protections que Prisma seul ne décrit pas intégralement : conserver les migrations comme source de déploiement, ne pas les remplacer par un simple db push.

## Intégration et rollback

Conserver le travail dans le worktree isolé jusqu’à intégration coordonnée avec les autres instances. Appliquer les migrations avant la version applicative. Aucun merge ni déploiement effectué. Un retour à une ancienne application ne supprime pas les nouveaux comptes mais ne leur offre plus la connexion téléphone ; ne pas rétrograder sans un plan d’accès pour ces familles. Préférer une correction en avant ; ne pas supprimer les champs, challenges ou intentions de notification pour annuler une version.


## Fichiers principaux

- Identité : `prisma/schema.prisma`, deux migrations `20260906120000_parent_phone_identity` et `20260906120100_optional_subscription_request_email`, `lib/auth/parent-phone.ts`, `lib/auth/credentials-authorize.ts`, `auth.ts`, guards et types de session.
- Entrées : `app/api/assistante/families/route.ts`, `lib/families/create-family.ts`, proxy papier et ancienne API étudiants, `components/dashboard/assistante/FamilyForm.tsx`, annuaire/fiches assistante, liaison au workspace candidat.
- Invitation : `lib/whatsapp/`, routes auth téléphone, drain interne, webhook, `instrumentation.ts`, écrans connexion/récupération/activation.
- Finalisation : `lib/families/parent-registration.ts`, `app/api/parent/registration/route.ts`, `app/dashboard/parent/inscription/page.tsx`, `components/dashboard/parent/ParentRegistrationForm.tsx`, navigation et rate-limit.
- Compatibilité : création enfants parent, demande abonnement sans email, accès factures via `lib/invoice/not-found.ts`, garde des stages élève.
- Tests : suites auth, famille, UI, finalisation, transport, factures, architecture et deux lanes PostgreSQL réelles.

Journaux de vérification locaux : `/tmp/nexus-inscription-full-tests-final.log`, `/tmp/nexus-inscription-last-delta-tests.log`, `/tmp/nexus-registration-db-tests.log`, `/tmp/nexus-family-registration-db-tests.log`, `/tmp/nexus-registration-browser.log`, `/tmp/nexus-registration-public-smoke.log`, `/tmp/nexus-inscription-typecheck-delivery.log`, `/tmp/nexus-inscription-lint-stable.log`, `/tmp/nexus-registration-build.log`, `/tmp/nexus-registration-build-final.log`. Aucun secret nécessaire à la lecture de ces preuves ; les journaux serveur de développement bruts ne sont pas livrés (ils contiennent les URL de jetons synthétiques).


## Clôture de la recette

Serveur local arrêté, conteneur PostgreSQL dédié supprimé après les vérifications, configurations temporaires de recette contenant les secrets synthétiques retirées. Les quatre captures sont conservées dans ce dépôt. La copie de build indépendante reste temporairement disponible sous le chemin indiqué par `/tmp/nexus-registration-build-path.txt` pour inspection ; elle n’est pas une release publiée.

Aucun fichier d’une autre instance restauré. Seule la date générée automatiquement par le test shadow a été remise à sa valeur initiale après vérification de la différence exacte. Aucun commit, merge, déploiement ni envoi réel.

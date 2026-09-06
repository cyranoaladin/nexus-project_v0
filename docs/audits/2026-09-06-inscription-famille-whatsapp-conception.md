# Inscription familiale assistée et identifiant WhatsApp — conception proposée

## Date, portée et statut

6 septembre 2026. Lecture du code au HEAD `76d542ebf4600e9ea845ca22cfc603fd4d40b179`, dans le worktree `dashboard-bilans-sans-credits`, avec ses modifications de retrait des crédits. Ce document est une proposition à valider, pas une fonctionnalité réalisée. Aucun compte créé, message envoyé, secret consulté ou accès à une base réelle. Les autres instances ne sont pas modifiées.

La demande : comprendre la logique globale, prendre en charge les élèves scolarisés et les candidats individuels (deux ans, un an, redoublement et autres situations), permettre à l’assistante d’inscrire une famille et ses enfants, utiliser le WhatsApp du parent comme identifiant et lui adresser une invitation pour finaliser.

## 1. Logique métier commune

La chaîne à préserver est : demande/contact → foyer et dossier élève → qualification scolaire et examen → diagnostic/bilan → proposition pédagogique et devis → engagement accepté → facturation/paiements → droits et affectations confirmés → travail/séances → retours publiés et suivi.

Ces états sont distincts. Un compte activé n’est pas une inscription payée. Un devis accepté n’est pas un paiement. Un lien familial n’est pas un consentement pédagogique. La création chez Nexus ne vaut pas inscription officielle auprès du service des examens. Le retrait des crédits reste applicable à toute cette chaîne.

### Élèves scolarisés

Le dossier contient niveau, voie/série, spécialités, établissement et objectifs. L’accompagnement complète la scolarité : remédiation, entraînement, méthodologie, préparation d’épreuves, stages et bilans. Une formule commerciale n’est pas le parcours académique.

### Candidats individuels

Le dossier contient les faits nécessaires à la préparation : session visée, niveau de départ, voie/spécialités/langues, modalités des évaluations, historique de présentation, redoublement, notes et demandes de conservation, dispenses et pièces de vérification pertinentes. Les informations sont collectées progressivement.

Le moteur existant dérive déjà les parcours : P1/P2 deux ans, P3 même session sous conditions, P4/P5 redoublement, P6 amélioration, P7 titulaire d’un bac, P8 bascule scolarisé vers individuel, P10 anticipées seules, P11 second groupe, P12 étalement. P9 est un modificateur et non un parcours exclusif. Ne pas ajouter un menu de codes P1–P12 à saisir manuellement.

Une préparation en un an est un projet pédagogique, pas une preuve de recevabilité administrative. Les déclarations et vérifications restent séparées ; les dispenses ou notes reconduites non confirmées ne deviennent pas automatiquement des épreuves dispensées.

Références officielles relues : [candidats individuels](https://eduscol.education.gouv.fr/5694/candidats-individuels-au-baccalaureat-general-et-au-baccalaureat-technologique), [situations particulières](https://www.education.gouv.fr/bo/2025/Hebdo32/MENE2523745N), [redoublement](https://eduscol.education.gouv.fr/5655/redoublement-et-conservation-des-notes-au-baccalaureat-general-et-technologique). Elles confirment la nécessité de distinguer modalités de présentation, conditions de même session et conservation des notes. Cette consultation n’est pas une certification exhaustive de toutes les règles du moteur ni des formalités du centre d’examen de Tunis.

## 2. Sources de vérité existantes

- Identité stable : `User.id`. Le téléphone de connexion peut changer sans déplacer les données de la famille.
- Foyer : `ParentProfile`, `Student.parentId`, et liens/consentements canoniques utilisés par les bilans. Les écritures doivent rester coordonnées, jamais se déduire implicitement les unes des autres.
- Élève : `Student` (`prisma/schema.prisma:291`) pour niveau, filière et spécialités. Ne pas déduire le statut individuel d’un établissement vide.
- Candidat : `ProfilCandidat` et ses révisions (`schema.prisma:1368`), puis `lib/exams/parcours.ts` et carte d’examen dérivée. Plusieurs profils peuvent exister ; sélectionner une révision de référence explicitement, pas le dernier enregistrement arbitraire.
- Catalogue/prix : `data/pricing.canonical.json` et loaders. Les devis/factures conservent leur version historique.
- Bilans : artefacts publiés et droits d’audience existants ; pas de fusion automatique entre anciens diagnostics et bilans canoniques.
- Droits : moteur d’entitlements existant, sans crédits ; planning/affectations restent des faits opérationnels distincts.

## 3. Constats vérifiés dans le code

### P0 — création et accès incompatibles avec la demande

1. `app/api/assistante/students/route.ts:194` exige email parent et élève, accepte un téléphone facultatif non normalisé, un enfant par requête. Le parent est marqué activé immédiatement (`:337`, `:350`) et reçoit un PASSWORD_RESET. Ajouter un enfant à un parent actif ne doit ni réinitialiser son accès ni lui réexpédier une procédure de création.
2. Même route : parent créé/modifié avant le contrôle d’un élève existant (`:300–365`). Le retour `{ok:false}` à l’intérieur de la transaction valide les écritures précédentes malgré le conflit HTTP. À corriger par échec transactionnel réel et test de rollback.
3. `lib/auth/credentials-authorize.ts:7` recherche seulement l’email. `lib/services/student-activation.service.ts:111` refuse les comptes sans email même avec jeton valide. La page d’activation et la récupération sont également centrées sur l’email.
4. `User.phoneNormalized` est indexé mais non unique. Un `findFirst` par téléphone ne peut pas devenir un mécanisme de connexion : il serait ambigu pour les numéros partagés ou doublonnés.

### P1 — éléments déjà présents à réutiliser

5. `lib/bilans/saisie-papier/famille.ts:54` crée un parent et 1 à 6 enfants, téléphone normalisé, email facultatif, rapprochement des foyers, idempotence, transaction et consentements en attente. C’est le socle à extraire vers un service familial général ; la saisie papier reste un consommateur compatible.
6. `lib/contact/parent-phone.ts:40` conserve les huit chiffres tunisiens historiques. Ne pas réécrire ces données en E.164 silencieusement ; `lib/whatsapp.ts:47` ajoute l’indicatif à la frontière d’envoi.
7. Les jetons d’activation existent : hash, finalité parent/élève, expiration 72 h et consommation conditionnelle. L’outbox email est chiffrée, transactionnelle et dédupliquée. Réutiliser ces garanties sans détourner un schéma email pour stocker du WhatsApp.
8. `lib/bilans/staff/whatsapp-send-service.ts:15` prépare un message et un lien wa.me ; l’assistante effectue l’envoi. Aucun transport automatique d’invitation WhatsApp n’a été identifié dans le code inspecté.

### P1 — continuité pédagogique à raccorder

9. La création assistante ne crée/rattache pas de ProfilCandidat. Les dashboards familiaux ne projettent pas son parcours dérivé.
10. La génération du devis candidat recalcule bien côté serveur et conserve profil/carte/règles, mais les résultats diagnostiques sont fournis par la requête staff dans le chemin inspecté. Préférer une référence de diagnostic publié avec provenance vérifiable.
11. Dans le chemin inspecté, accepter un devis écrit son statut/audit mais ne matérialise pas à lui seul les affectations, le planning ou l’inscription pédagogique. Ne pas afficher ces étapes comme accomplies sans leur enregistrement effectif.
12. Profil candidat, diagnostic et commercialisation ont des drapeaux d’activation distincts. Les conserver tant que la disponibilité effective n’a pas été explicitement établie.

## 4. Parcours assistante proposé

### Étape A — retrouver ou créer la famille

Saisir WhatsApp avec indicatif affiché, prénom/nom du parent ; email secondaire facultatif. Rechercher les correspondances canoniques. Proposer un foyer existant à sélectionner délibérément ; ne jamais fusionner deux familles automatiquement sur le seul numéro ou une homonymie. Ajouter un enfant à un foyer actif conserve son mot de passe et ses sessions.

### Étape B — ajouter les enfants

Pour chacun : prénom, nom explicite (ne pas supposer celui du parent), niveau, voie, situation scolarisé/individuel, session ou objectif, établissement si pertinent. Ajouter les spécialités nécessaires selon niveau. Aucune adresse email personnelle ni mot de passe d’enfant exigé au premier contact. La naissance et les autres pièces sont demandées lorsqu’elles servent la minorité ou une condition de parcours, pas comme collecte indiscriminée.

Pour un candidat : rattacher/créer le profil canonique, proposer les questions conditionnelles et conserver les états « déclaré », « à vérifier », « confirmé ». Permettre d’enregistrer un dossier incomplet sans inventer de réponses. Reprendre le même élève et le même historique après changement de statut ou de session.

### Étape C — enregistrer et inviter

Une transaction enregistre parent, enfants, relations, profil de référence éventuel, trace de l’opérateur et intention de notification. Échec enfant ou conflit : aucune écriture familiale partielle. Rejeu/double clic : pas de doublon de famille ni d’invitation.

Le compte reste en attente. Invitation familiale unique, personnelle, expirante, révocable. Aucun mot de passe créé par l’assistante, aucun mot de passe envoyé. Notification sans bilan, note ou donnée scolaire détaillée.

### Étape D — suivre la finalisation

La fiche affiche les dimensions séparées : dossier enregistré ; invitation en attente/en erreur/prise en charge/transmise ; compte activé ; inscription à compléter/finalisée ; qualification pédagogique à vérifier/confirmée. Les statuts proposés sont des états d’interface dérivés des faits, pas une instruction de dupliquer des flags contradictoires.

Un échec de notification ne supprime pas le foyer et ne le marque pas comme activé. Renvoi contrôlé, dernier lien valide uniquement. Un accusé d’acceptation du fournisseur ne vaut pas remise au parent.

## 5. Parcours parent proposé

1. Le parent reçoit un message Nexus avec bouton « Finaliser mon inscription ».
2. Il ouvre le lien personnel, vérifie le contact et choisit son mot de passe (hypothèse recommandée en attente de sa préférence utilisateur).
3. Il confirme/corrige ses informations et la liste des enfants. Une correction de contact ou un enfant inattendu conduit à une demande contrôlée, pas à une appropriation de dossier tiers.
4. Il complète les données utiles et consentements par finalité/enfant ; l’activation technique ne force pas l’acceptation des usages optionnels et ne déclare pas le dossier complet par elle-même.
5. Il accède à « Mes enfants », aux bilans autorisés, prochaines étapes et documents financiers de son foyer. Les travaux internes des coachs ne deviennent pas visibles.
6. Connexions suivantes : numéro WhatsApp + mot de passe si option retenue. L’email existant continue de fonctionner pour les comptes historiques. Comptes élèves distincts, activation ultérieure depuis le circuit actuel.

Pour un candidat majeur autonome, distinguer élève, responsable légal et payeur. Le schéma actuel exige un parent pour Student : ne pas créer de parent fictif. Ce cas demande un lot relationnel explicite si inclus dans la mise en œuvre ; aucune visibilité parent automatique sur la seule qualité de payeur.

## 6. Identité téléphonique et notifications

### Option recommandée : téléphone + mot de passe, invitation WhatsApp

Réutilise l’authentification actuelle et limite la dépendance au fournisseur à l’activation/récupération. Le numéro n’est pas un secret ni une preuve de possession à lui seul.

Évolution additive envisagée : autorisation explicite de connexion téléphonique pour les parents, date de vérification, contrainte unique partielle sur les parents autorisés non fusionnés, même valeur `phoneNormalized` canonique. Les contacts historiques ambigus restent conservés et exclus de l’activation automatique. L’unicité couvre aussi une attribution réservée avant activation (états réservée/vérifiée, pas uniquement les comptes déjà activés). La réservation et la revendication finale sont atomiques ; un conflit laisse le compte inactif et ne modifie jamais le titulaire existant. Une réservation expirée est libérée par une transition explicite qui révoque son challenge, conserve le contact historique et journalise la décision ; aucune condition temporelle dynamique dans l’index. Ne pas établir une vérification sur la seule saisie assistante ou un statut « envoyé ».

La preuve de possession est la consommation valide et unique d’un challenge livré au numéro prévu par le transport d’authentification, dont le secret n’est pas exposé dans les réponses staff. Un lien préparé avec wa.me est visible par l’assistante : son ouverture seule ne suffit pas à renseigner phoneVerifiedAt ; dans cette variante, la connexion téléphonique attend un challenge distinct. Aucune attestation staff implicite.

Le jeton doit être lié au compte et à la version du numéro prévu. Le changement de numéro révoque les invitations et sessions concernées. Toute écriture du numéro, y compris via les services historiques, invalide la vérification/autorisation précédente et la réservation ou met à jour une version que la preuve doit correspondre exactement. Une modification de contact staff seule ne prouve jamais la possession et n’accorde pas l’accès. Prévoir perte d’accès au numéro : email de secours avec preuve distincte de vérification s’il existe, sinon procédure staff auditée avec contrôle indépendant ; jamais réassigner un compte par simple correspondance téléphonique. Le modèle actuel ne possède pas cette preuve email dédiée : prévoir un état/jeton distinct, sans assimiler activatedAt à une vérification d’email et sans backfill automatique.

### Alternative : code WhatsApp à chaque connexion

Moins de gestion de mots de passe, mais dépendance à la livraison à chaque connexion et nécessité de protections anti-abus, expiration, nombre d’essais, indisponibilité fournisseur et récupération. Ce choix change le périmètre ; préférence demandée à l’utilisateur.

### Envoi automatique ou assisté

Pour satisfaire littéralement « recevoir une notification après création », cible : transport WhatsApp Business connecté à une outbox, modèle d’invitation configuré, suivi des statuts et callbacks authentifiés. Aucun fournisseur opérationnel confirmé dans cette mission. Références Meta : [Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [exemples officiels et signatures webhook](https://github.com/fbsamples/whatsapp-api-examples).

Le worker vérifie avant envoi que l’invitation reste valide et que la version du numéro correspond ; un job obsolète ne part pas vers l’ancien numéro. Les callbacks sont authentifiés, dédupliqués et ne font pas régresser un état sur arrivée tardive.

Le lien wa.me existant peut servir au circuit assisté si retenu. Il doit être affiché « prêt à envoyer », jamais « reçu ». Il ne constitue pas une automatisation. La disponibilité d’un compte WhatsApp Business/API a été demandée ; aucune notification réelle n’est envoyée pour cet audit.

## 7. Découpage d’implémentation proposé

Chaque lot suit tests RED → correction minimale GREEN → revue. Ce découpage est à valider avant code.

1. **Famille canonique et atomicité.** Extraire le cœur familial réutilisable ; tests de collision élève sans écriture parent, multi-enfants, double clic, foyer existant sans reset. Faire consommer ce cœur par annuaire et saisie papier. Fichiers : route assistante students, service famille papier, formulaire et tests associés.
2. **Identité téléphone.** Rapport de collisions en lecture seule, contrainte additive ciblée et service de résolution ; tests formats équivalents, mauvais rôle, compte fusionné, téléphone partagé et course concurrente. Fichiers : Prisma/migration additive, normalisation et auth credentials. Aucun backfill de vérification fictive.
3. **Activation et récupération.** Activation sans email, consommation atomique, lien lié au numéro, connexion email compatible, renvoi/récupération/changement de numéro. Fichiers : activation-controller, student-activation.service, credentials-authorize, auth.ts, pages signin/activate et routes de récupération.
4. **Invitation WhatsApp.** Transport choisi, intention chiffrée transactionnelle sur l’infrastructure de jobs, traitement idempotent, états réels, reprise après erreur et contrôle webhook. Tests entièrement simulés avant recette fournisseur ; pas d’envoi client dans les tests.
5. **Finalisation et inscription assistante.** Formulaire par étapes, enfants multiples, sélection de foyer, complétion parent et suivi d’état, accès bilans non élargi. Tests API/permissions puis recette mobile sur familles synthétiques.
6. **Qualification académique.** Situation scolaire explicite, liaison révision ProfilCandidat, projection du parcours dérivé et provenance du bilan/devis ; pas de deuxième moteur. Séparer confirmation réglementaire, acceptation commerciale et ouvertures pédagogiques.
7. **Intégration coordonnée.** Vérifier la lignée cible avec les autres instances ; ne pas fusionner le worktree sans revue. Lint, typecheck, tests ciblés, tests DB jetons/identifiants/concurrence, build sur chemin compatible avec le validateur d’artefact, recette de bout en bout.

## 8. Critères de réception

Une assistante crée deux enfants de parcours différents sous un même parent sans email ; le parent reçoit l’invitation par le canal réellement configuré, finalise, se connecte avec son numéro et retrouve seulement ses enfants. Ajouter un troisième enfant ne modifie pas son accès. Un numéro ambigu ne livre aucun accès arbitraire. Aucun échec n’active le compte ni ne laisse une création partielle. Les comptes email existants, bilans publiés/consentements, paiements, factures et historiques restent utilisables. Aucun crédit réintroduit.

## Vérifications exécutées

Lecture croisée en trois sous-audits, vérification directe des chemins critiques et revue de la conception identité. Cette revue a fait préciser preuve de possession, réservation concurrente, invalidation après changement de numéro et preuve distincte de récupération email. Commande : `NEXTAUTH_URL=http://localhost:3000 npm test -- --runInBand __tests__/bilans/saisie-papier-famille.test.ts __tests__/bilans/saisie-papier-household-matching.test.ts __tests__/lib/credentials-authorize.test.ts __tests__/lib/parent-activation.test.ts __tests__/lib/exams/parcours.test.ts __tests__/lib/exams/parcours-declaratifs.test.ts`.

Résultat : 6 suites, 120 tests réussis. Ils prouvent les contrats actuellement couverts, pas le fonctionnement du nouveau parcours ni l’absence des défauts statiques identifiés. Pas de nouveau build, migration ou test navigateur pour cette étape de conception.

## Fichiers modifiés et retour arrière

Ce document et une synthèse Canvas hors dépôt uniquement pendant cette mission. Le code du retrait des crédits de la mission précédente est conservé. Aucun changement de comportement à annuler ; aucune donnée créée.

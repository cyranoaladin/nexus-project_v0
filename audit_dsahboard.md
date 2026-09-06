# Audit vivant — inscriptions, authentification et dashboards Nexus Réussite

> **Nom de fichier conservé à la demande du responsable produit :** `audit_dsahboard.md`.
>
> Ce document est le registre opérationnel de référence pour comprendre l'état réel des comptes, des accès et des espaces connectés. Il décrit séparément le code validé, la production et la cible métier. Il doit être actualisé à chaque modification de ces parcours.

## 1. Fiche de contrôle

| Élément | État au 6 septembre 2026 |
|---|---|
| Dépôt audité | `nexus-project_v0` |
| Branche auditée | `integration/parent-whatsapp-sans-credits-20260906` |
| Commit applicatif audité | `57a28f8120f23d20955f368c8f42c8ee0ff54fcd` |
| Pull request | [#212 — Parent WhatsApp sans crédits](https://github.com/cyranoaladin/nexus-project_v0/pull/212) |
| Production observée | `https://nexusreussite.academy` |
| Image web observée en production | révision OCI `45ea5d6ad2f62244bafdbe1563050eac6010be72` |
| Statut du lot WhatsApp manuel | implémenté et validé sur la branche, pas encore déployé |
| Transport WhatsApp retenu | envoi assisté depuis l'application WhatsApp Business de l'équipe |
| Logique de crédits | retirée des parcours actifs ; héritage de données conservé |
| Dernière recette fonctionnelle du lot | environnement local jetable, foyer à deux enfants, sans envoi externe |
| Responsable de la prochaine mise à jour | auteur de toute PR touchant les fichiers listés au § 22 |

### Légende

- **ACTIF** : fonction visible et utilisable dans le code audité.
- **VALIDÉ** : fonction couverte par une preuve de test récente.
- **HÉRITAGE** : donnée ou route conservée pour compatibilité, sans usage métier nouveau.
- **ÉCART** : comportement réel différent de la cible métier décidée.
- **NON DÉPLOYÉ** : présent sur la branche, absent de la production observée.

## 2. Verdict exécutif

Le socle connecté repose sur cinq rôles : `ADMIN`, `ASSISTANTE`, `COACH`, `PARENT` et `ELEVE`. Un candidat individuel n'est pas un sixième rôle : il reste un élève avec un statut de scolarité et un dossier candidat spécifiques.

Le parcours cible assisté est maintenant cohérent sur la branche : l'assistante crée le parent et un à six enfants, le téléphone WhatsApp du parent devient son identifiant, l'assistante prépare un message dans WhatsApp Business, puis le parent choisit son mot de passe et confirme son dossier. Aucun crédit n'est accordé ni débité dans ce parcours.

Plusieurs parcours historiques contournent encore cette cible. Les deux entrées familiales les plus visibles sont `/bilan-gratuit`, qui crée directement un parent et un élève par e-mail, et le dashboard parent, qui permet encore d'ajouter soi-même un enfant. Le CRUD admin, le renvoi d'activation e-mail et certaines confirmations de stage constituent d'autres chemins concurrents détaillés au § 6.5. Ils doivent être transformés en demandes à traiter par l'assistante, limités à leur périmètre légitime, ou leur exception métier doit être explicitement validée. Tant que cette décision n'est pas appliquée, le service de création familiale assistante n'est pas l'unique porte d'entrée des foyers.

Le code contient plusieurs familles de bilans et de restitutions. Les contrôles d'accès existent, mais la navigation et la terminologie restent fragmentées. La source de vérité des données est identifiable ; la source de vérité de l'expérience utilisateur doit encore être unifiée.

## 3. Cible métier à préserver

### 3.1 Familles et élèves scolarisés

1. L'assistante recueille les données minimales du parent et de ses enfants.
2. Le téléphone WhatsApp normalisé identifie le compte parent.
3. Le compte est créé sans mot de passe choisi par le personnel.
4. L'assistante prépare le message d'activation et vérifie le destinataire dans WhatsApp Business.
5. Le parent envoie son choix de mot de passe via le lien temporaire.
6. Le parent se connecte avec son téléphone et confirme la composition du foyer.
7. Le consentement donnant accès aux bilans est explicite et séparé de la simple confirmation du dossier.
8. Les dashboards exposent des bilans, des séances, des documents, des paiements et des factures selon le rôle.

### 3.2 Candidats individuels au bac français

Le candidat individuel réutilise l'identité `ELEVE` et le foyer existants. Son cas est décrit par :

- `Student.schoolingStatus = INDIVIDUAL` ;
- `ProfilCandidat` pour sa situation d'examen ;
- `StudentAcademicEnrollment` pour les enseignements réellement suivis ;
- `CandidateDiagnostic` pour le diagnostic isolé ;
- `Quote` pour le devis ;
- `ParcoursType` pour les parcours réglementaires dérivés.

Les parcours couverts comprennent notamment la préparation sur deux ans, la préparation en un an sous conditions, le redoublement de première ou terminale, l'amélioration après un bac, la bascule scolaire vers candidat libre, les épreuves anticipées seules, le second groupe et l'étalement sur plusieurs sessions. Cette classification ne doit pas créer un compte ou un rôle parallèle.

## 4. Sources de vérité

| Domaine | Source canonique | Règle |
|---|---|---|
| Identité et rôle | `User` dans `prisma/schema.prisma` | un compte, un rôle courant, une version de session |
| Téléphone parent | `User.phoneNormalized`, `parentPhoneState`, `parentPhoneVersion` | ne jamais comparer le champ d'affichage `phone` comme identifiant |
| Profil parent | `ParentProfile` | données propres au responsable familial |
| Élève | `Student` lié à un `User` | entité métier unique pour l'élève |
| Composition familiale | `Student.parentId` | rattachement structurel au foyer |
| Consentement parent-bilan | `ParentStudentLink` | un rattachement familial ne vaut pas consentement de consultation |
| Scolarité | `Student.schoolingStatus`, `gradeLevel`, `academicTrack` | distinguer scolarisé et individuel sans dupliquer l'élève |
| Enseignements suivis | `StudentAcademicEnrollment` + catalogue `data/curriculum/` | ne pas réintroduire un tableau libre de spécialités |
| Candidat individuel | `ProfilCandidat` et moteur `lib/exams/` | le parcours est dérivé des faits déclarés et validés |
| Bilans canoniques | modèles `CanonicalAssessment*`, révisions et `ReportArtifact` | publication et audience contrôlées |
| Tarifs | `data/pricing.canonical.json` via `lib/pricing.ts` | aucun prix métier dupliqué dans les composants |
| Abonnements | `Subscription`, `SubscriptionRequest` | décrit l'offre souscrite, pas l'encaissement |
| Paiements | `Payment` et `ClicToPayTransaction` | seuls les paiements `COMPLETED` constituent du revenu encaissé |
| Factures | `Invoice`, `InvoiceItem`, `InvoiceSequence` | document comptable distinct d'un abonnement |
| Droits produits | `Entitlement` et moteur `lib/entitlement/engine.ts` | accès produit sans réintroduire des crédits |
| Accès | `User.role`, `lib/rbac.ts`, règles de propriété métier | le middleware seul ne suffit jamais pour protéger une API |

## 5. États du compte parent et du téléphone

| État | Signification | Connexion par téléphone |
|---|---|---|
| `NONE` | aucune identité téléphonique utilisable | refusée |
| `RESERVED` | numéro réservé pour un parent en attente d'activation | refusée |
| `VERIFIED` | challenge consommé et compte activé | autorisée si le mot de passe est correct |

Les challenges sont stockés dans `ParentPhoneChallenge`. Du jeton, seule l'empreinte SHA-256 est persistée dans cette table ; les autres colonnes portent l'utilisateur, le numéro, sa version, la finalité et les dates de contrôle. En mode manuel, le jeton brut n'est pas placé dans une outbox. En mode automatique optionnel, l'outbox doit pouvoir le restituer au fournisseur : elle le conserve uniquement dans une charge chiffrée AES-256-GCM. Une activation expire après 72 heures, une récupération après une heure. Un nouveau challenge révoque les challenges non consommés antérieurs.

Le passage à `VERIFIED` prouve la consommation du lien correspondant au numéro inscrit. Dans le mode manuel actuel, il ne constitue pas une preuve indépendante fournie par l'opérateur télécom : la sécurité dépend aussi de l'assistante qui vérifie le destinataire avant l'envoi.

## 6. Parcours d'inscription et de création

### 6.1 Parcours canonique assistante — ACTIF et VALIDÉ sur la branche

**Interface :** `components/dashboard/assistante/FamilyForm.tsx`  
**API :** `POST /api/assistante/families`  
**Service :** `lib/families/create-family.ts`

Données principales :

- téléphone parent obligatoire ;
- prénom et nom du parent ;
- e-mail parent facultatif ;
- de un à six enfants ;
- prénom, nom, niveau et situation scolaire par enfant ;
- établissement et dossier candidat facultatifs selon le cas.

Garanties :

- transaction unique pour le graphe familial et l'invitation ;
- rapprochement explicite en cas de foyer existant ;
- comptes fusionnés exclus des nouveaux rattachements ;
- mot de passe jamais choisi par l'assistante ;
- clé `Idempotency-Key` pour éviter une double création ;
- ajout d'un enfant à un foyer existant qui remet le dossier en attente de confirmation, sans supprimer le mot de passe du parent ;
- réponse rejouable sans jeton WhatsApp brut.

En mode manuel, la transaction réserve le numéro et crée déjà un challenge d'activation haché, sans outbox. Quand l'assistante choisit ensuite « Préparer l'invitation », la route révoque ce premier challenge inutilisé et en crée un nouveau dont le lien peut être transmis immédiatement.

L'ancienne API `POST /api/assistante/students` est un adaptateur vers le même service. Elle doit rester une façade de compatibilité et ne pas redevenir un second moteur de création.

### 6.2 Invitation WhatsApp assistée — ACTIF et VALIDÉ sur la branche

**API :** `POST /api/assistante/parents/[parentId]/whatsapp-invitation`  
**Interface :** `components/dashboard/assistante/ParentWhatsAppInvitation.tsx`

Déroulé :

1. La route vérifie une session `ADMIN` ou `ASSISTANTE`.
2. Elle impose le contrôle CSRF, l'origine applicative stricte et une limite de fréquence.
3. Elle charge le numéro canonique depuis la base.
4. Elle choisit côté serveur `ACTIVATION` ou `RECOVERY` selon l'état du parent.
5. Elle révoque les anciens challenges inutilisés et retourne temporairement une URL `wa.me` préremplie.
6. Le composant conserve cette URL en mémoire seulement.
7. L'assistante ouvre WhatsApp Business, vérifie le destinataire et confirme elle-même l'envoi.

La plateforme ne déclare jamais le message « envoyé », « livré » ou « lu » dans ce mode. Aucun enregistrement d'outbox WhatsApp n'est créé.

Le mode est choisi uniquement côté serveur : `WHATSAPP_SEND_ENABLED=true` active le transport automatique Meta ; toute autre valeur conserve le mode manuel. L'activation automatique exige en plus l'outbox chiffrée, le worker, les modèles Meta approuvés et une recette fournisseur réelle. Ce transport reste disponible dans l'architecture, mais il n'est pas le fonctionnement opérationnel retenu actuellement.

### 6.3 Activation parent

**Page :** `/auth/parent-phone?token=…`  
**API :** `GET/POST /api/auth/parent-phone`  
**Service :** `lib/auth/parent-phone.ts`

La consommation valide le jeton, sa finalité, le numéro, sa version, l'expiration et l'état du compte. Le mot de passe est haché avant l'ouverture de la transaction. La transaction atomique :

- écrit le nouveau hash bcrypt ;
- passe le téléphone à `VERIFIED` ;
- marque le challenge comme consommé ;
- révoque les autres challenges ;
- incrémente `sessionVersion` pour invalider les sessions antérieures.

### 6.4 Confirmation finale du dossier parent

**Page :** `/dashboard/parent/inscription`  
**API :** `GET/POST /api/parent/registration`  
**Service :** `lib/families/parent-registration.ts`

Le parent confirme la liste exacte de ses enfants à partir d'une révision opaque. Si le dossier change entre l'affichage et la confirmation, l'API refuse l'écriture concurrente. Le consentement aux bilans est facultatif, explicite et distinct.

### 6.5 Parcours historiques concurrents — ÉCART

| Entrée | Comportement réel | Écart avec la cible |
|---|---|---|
| `POST /api/bilan-gratuit` | crée directement un `User` parent, un `ParentProfile`, un `User` élève et un `Student`, puis envoie une activation par e-mail | contourne la création assistante et ne réserve pas l'identité téléphonique canonique |
| `POST /api/parent/children` | un parent connecté crée un enfant et reçoit son lien d'activation | contourne la validation initiale par l'assistante |
| `POST /api/admin/users` | création générique par rôle avec mot de passe fourni | ne doit pas servir à créer un foyer parent ; le profil et l'activation parent ne sont pas garantis par ce chemin |
| `POST /api/auth/resend-activation` | émet par e-mail un nouveau lien pour tout parent ou élève inactif trouvé par son adresse | peut activer par e-mail un parent créé pour le parcours WhatsApp, même si cet e-mail n'a pas encore été qualifié comme preuve d'identité |
| confirmation de réservation de stage | peut créer un compte dans un contexte spécialisé | doit réutiliser ou réconcilier le foyer canonique |

Décision cible : conserver `/bilan-gratuit` comme demande de bilan à faible friction, puis laisser l'assistante qualifier et créer le foyer par le service canonique. Le bouton « Ajouter un enfant » du parent doit devenir une demande de modification ou être retiré si aucune exception métier n'est validée.

## 7. Authentification et sessions

### 7.1 Mécanisme

- NextAuth v5 avec fournisseur `Credentials` uniquement.
- Session JWT ; aucune table NextAuth `Account` ou `Session` n'est requise.
- Identifiant normalisé dans `lib/auth/credentials-authorize.ts`.
- Une chaîne contenant `@` est traitée comme un e-mail.
- Une autre chaîne est normalisée comme téléphone et n'est admise que pour un unique parent `VERIFIED` non fusionné.
- Le mot de passe reste obligatoire dans tous les cas.
- Les rôles `PARENT` et `ELEVE` doivent avoir `activatedAt` renseigné.
- Chaque JWT contient l'identifiant utilisateur dans le claim `id`, le rôle et `sessionVersion` ; la version est revérifiée en base à chaque rafraîchissement du jeton.

### 7.2 Révocation

Une modification sensible de mot de passe, d'identité, de rôle ou de téléphone incrémente `sessionVersion`. Un jeton absent, mal formé, associé à un rôle différent ou à une ancienne version est refusé par `lib/auth/session-revocation.ts`.

### 7.3 Récupération

- Parent avec téléphone admissible, mode manuel : `/api/auth/parent-phone/recovery` valide la forme et les limites de fréquence, puis oriente vers l'assistante sans rechercher le compte.
- Compte avec e-mail de confiance : `/api/auth/reset-password` utilise l'outbox e-mail et une réponse anti-énumération.
- Un e-mail de contact fourni lors d'une inscription téléphonique n'est pas automatiquement une preuve de récupération. Cette règle est appliquée par la récupération de mot de passe, mais pas encore par le renvoi historique d'activation `/api/auth/resend-activation` : ce dernier est un canal concurrent à encadrer.

Un parent historique actif sans téléphone `VERIFIED`, ou dont l'identité téléphonique a été invalidée, ne peut pas recevoir immédiatement un challenge `RECOVERY`. L'assistante doit d'abord qualifier et régulariser son identité ; le message public d'aide ne garantit donc jamais qu'un lien sera préparé.

### 7.4 Redirection après connexion

`/dashboard` redirige selon le rôle :

- `ELEVE` → `/dashboard/eleve` ;
- `PARENT` → `/dashboard/parent` ;
- `COACH` → `/dashboard/coach` ;
- `ASSISTANTE` → `/dashboard/assistante` ;
- `ADMIN` → `/dashboard/admin`.

## 8. Défense d'accès

La protection fonctionne en couches :

1. `middleware.ts` bloque les utilisateurs non connectés et sépare les préfixes de dashboards.
2. `app/dashboard/layout.tsx` exige également une session.
3. `lib/rbac.ts` décrit des permissions par ressource et des politiques de routes.
4. Les APIs vérifient le rôle, puis la propriété du parent, de l'élève ou l'affectation du coach.
5. Les bilans ajoutent leurs propres règles de publication, d'audience et de consentement.

Le middleware est un filtre grossier. Toute nouvelle route API doit conserver une vérification serveur autonome.

Écart d'architecture : les cartes de rôles sont répétées dans `auth.config.ts` et `middleware.ts`, tandis que les routes utilisent alternativement `lib/rbac.ts`, `lib/guards.ts`, `lib/access/` ou des conditions locales. Cette dispersion augmente le risque de dérive. La consolidation doit se faire progressivement, avec tests contractuels, sans réécriture massive.

Écart d'accès confirmé : la fiche candidat sous `/dashboard/assistante/students/[studentId]/candidat` déclare accepter `ADMIN` et `ASSISTANTE`, et `middleware.ts` prévoit une exception admin. `auth.config.ts` redirige toutefois l'admin vers son propre préfixe avant que cette exception soit utile. Le test actuel neutralise ce callback et ne reproduit donc pas la chaîne réelle complète.

Deux helpers génériques ne doivent pas être étendus sans correction : un contrôle de `lib/guards.ts` compare directement un `User.id` avec un `Student.id`, et un chemin `allowOwner` de `lib/rbac.ts` peut autoriser une politique quand `resourceId` manque. Les routes métier auditées n'en dépendent pas actuellement.

## 9. Dashboard élève

**Entrée :** `/dashboard/eleve`  
**API principale :** `/api/student/dashboard`  
**Projection :** `lib/dashboard/student-payload.ts`

Fonctions visibles ou spécialisées :

- cockpit et prochaine action ;
- séances ;
- programme et ressources ;
- ARIA selon les droits produits ;
- stages ;
- documents ;
- automatismes ;
- diagnostics et rapports NPC ;
- trajectoire ;
- modules spécialisés NSI, EAF, mathématiques et stages ;
- bilans canoniques dans `/dashboard/eleve/mes-bilans` ;
- bilans publiés par partage dans `/dashboard/eleve/bilans/[publicShareId]`.

Visibilité : l'élève ne reçoit que ses propres données. Un bilan partagé doit être publié et contenir une version élève. Les versions parent ou internes ne doivent pas être servies par cette route.

Écart ergonomique : « Mes bilans » n'est pas une entrée principale de `navigation-config.ts`, alors que les bilans constituent une valeur métier centrale.

## 10. Dashboard parent

**Entrée :** `/dashboard/parent`  
**API principale :** `/api/parent/dashboard`  
**Fiche enfant :** `/dashboard/parent/enfant/[studentId]`

Fonctions :

- confirmation de l'inscription ;
- vue multi-enfants ;
- prochaines séances ;
- historique de progression disponible ;
- abonnements ;
- paiements ;
- factures ;
- ressources ;
- stages ;
- diagnostics NPC ;
- bilans canoniques publiés pour un enfant autorisé ;
- contact WhatsApp avec Nexus.

Règle bilan : `ParentStudentLink` doit être vérifié, non révoqué et non expiré. La simple présence de l'enfant dans `ParentProfile.children` ne suffit pas à ouvrir les bilans.

Limites actuelles :

- `nexusIndex`, `alerts` et `subjectProgress` sont encore renvoyés vides ou `null` par l'API principale ;
- le champ `progress` correspond au ratio séances réalisées / séances prévues, pas à une mesure d'acquisition pédagogique ;
- « Total Mensuel » agrège le prix mensuel des abonnements actifs et ne doit pas être assimilé au solde comptable des factures ;
- l'ajout direct d'enfant par le parent reste actif, en contradiction avec le parcours assistante demandé.

## 11. Dashboard assistante

**Entrée :** `/dashboard/assistante`  
**API principale :** `/api/assistante/dashboard`

Fonctions :

- file de traitement des bilans canoniques ;
- création et gestion des foyers et élèves ;
- invitations WhatsApp parent ;
- planning et séances ;
- assignation coach-élève ;
- gestion des coaches ;
- abonnements et demandes d'abonnement ;
- validation des paiements ;
- facturation ;
- devis, dont candidats individuels ;
- stages ;
- documents.

Les revenus affichés proviennent des paiements `COMPLETED`. Les contrats et abonnements ne sont pas comptés comme encaissements.

### Retrait des crédits

- aucune entrée « Crédits » dans la navigation assistante ;
- `/dashboard/assistante/credits` et `/credit-requests` redirigent vers `/paiements` ;
- les anciennes APIs crédits authentifient encore le personnel puis répondent `410 Gone` ;
- les nouveaux flux de paiement et de facture bloquent les produits historiques de crédit via `lib/entitlement/credit-retirement.ts` ;
- aucune écriture active d'incrément ou de débit de crédits n'a été trouvée dans les APIs auditées.

## 12. Dashboard coach

**Entrée :** `/dashboard/coach`  
**API principale :** `/api/coach/dashboard`

Fonctions :

- séances et comptes rendus ;
- élèves suivis ;
- disponibilités ;
- bilans et plans de groupe ;
- dossiers, notes et documents élève ;
- rapports pédagogiques générés ;
- stages ;
- diagnostics et remédiation NPC ;
- parcours spécialisés EAF, mathématiques et NSI.

La propriété est contrôlée par affectation coach-élève et, pour certains accès, par l'existence d'une séance confirmée ou terminée. Limite à décider : une ancienne séance peut maintenir l'accès au dossier sans borne temporelle. Une politique de fin d'accès doit préciser la durée utile de conservation pédagogique.

## 13. Dashboard admin et direction

**Entrée :** `/dashboard/admin`  
**Vue direction :** `/admin/directeur`

Fonctions :

- utilisateurs ;
- analytics et activités ;
- abonnements ;
- stages ;
- facturation ;
- documents ;
- prévisualisation ARIA ;
- tests système ;
- indicateurs de direction.

La création générique d'utilisateurs dans `/api/admin/users` reste adaptée aux comptes internes lorsqu'elle respecte leur profil. Elle ne doit pas devenir une seconde méthode de création d'un foyer parent ou d'un élève, car elle ne porte pas tous les invariants familiaux, téléphoniques et de consentement.

Le défaut est concret : un parent créé par cette API reçoit un mot de passe, mais aucun `ParentProfile` et aucune identité téléphone canonique. Sa connexion est d'abord bloquée par `activatedAt = null`, mais `/api/auth/resend-activation` peut ensuite l'activer par e-mail ; il peut donc se connecter à un compte familial structurellement incomplet. Un élève créé directement peut ne pas recevoir de `ParentStudentLink`. L'interface admin expose pourtant ces rôles.

Les changements de rôle et de profil ne sont pas regroupés dans une transaction. Une mise à jour peut modifier `User`, puis échouer faute de parent ou pendant la mise à jour scolaire, laissant un rôle sans son profil obligatoire. Ce CRUD doit être limité aux opérations sûres ou raccordé aux services canoniques avant d'être considéré comme une source de vérité.

## 14. Bilans et visibilité

| Acteur | Ce qu'il doit voir | Contrôle principal |
|---|---|---|
| Élève | sa passation, sa restitution publiée et ses actions pédagogiques | identité élève + publication + audience élève |
| Parent | synthèse compréhensible, progrès, priorités et rapports de ses enfants | foyer + `ParentStudentLink` vérifié + publication |
| Coach | réponses, faits, dossier enseignant, plan d'action et rapports des élèves autorisés | affectation/propriété + état du bilan |
| Assistante | file opérationnelle, statut de revue, publication et transmission | rôle staff |
| Admin | gouvernance, audit, catalogue, qualité et supervision | rôle admin |

Les familles de contenu actuellement coexistantes sont :

- évaluations canoniques `CanonicalAssessment*` ;
- modèle historique `Bilan` ;
- diagnostics NPC ;
- diagnostics candidat individuel ;
- questionnaires et rapports spécialisés de stages.

La coexistence peut être légitime au niveau domaine, mais l'utilisateur doit disposer d'un point d'entrée « Bilans et diagnostics » cohérent. La future consolidation doit unifier la présentation et les statuts, sans fusionner arbitrairement les tables ni perdre les traces pédagogiques.

## 15. Paiements, abonnements et factures

### Parent

- consulte ses abonnements ;
- initie ou déclare un paiement selon le canal disponible ;
- consulte ses transactions ;
- consulte ou télécharge ses factures et reçus autorisés.

### Assistante

- voit les paiements en attente ;
- approuve ou rejette les déclarations ;
- crée et gère les factures ;
- traite les demandes d'abonnement ;
- ne gère aucun solde de crédits.

### Admin

- supervise la facturation, les statuts et les indicateurs consolidés.

Les factures ont leur propre contrôle d'accès par session et périmètre, ou par jeton public haché et temporaire. Le revenu du dashboard doit rester fondé sur les paiements confirmés. Toute évolution doit éviter de confondre prix catalogue, abonnement, échéance, paiement et facture.

## 16. Héritage technique conservé

La suppression fonctionnelle des crédits ne justifie pas une suppression immédiate des données historiques. Restent notamment :

- `Student.credits` ;
- `Subscription.creditsPerMonth` ;
- `SessionBooking.creditsUsed` ;
- `CreditTransaction` ;
- les anciennes valeurs de type de paiement ;
- quelques libellés ou branches d'affichage historiques.

Ces éléments sont **HÉRITAGE**. Ils ne doivent plus porter d'attribution, de consommation ou de réactivation de crédits. Les écritures de compatibilité initialisent encore certains champs à zéro. Leur suppression exige une politique de conservation, une analyse des factures et paiements historiques, une migration dédiée et un plan de rollback.

## 17. Sécurité, données de mineurs et auditabilité

Garanties présentes :

- mots de passe hachés avec bcrypt ;
- jetons d'activation aléatoires et stockés sous forme hachée ;
- expiration, usage unique et révocation ;
- limitation de fréquence sur les routes sensibles ;
- réponses de récupération anti-énumération ;
- en-têtes `no-store` et `no-referrer` sur les liens sensibles ;
- invalidation des sessions après changement d'identité ;
- contrôle de propriété parent/enfant et coach/élève ;
- consentement bilan séparé ;
- anonymisation prévue pour les données téléphone et charges WhatsApp ;
- absence de numéro ou jeton brut dans les messages d'erreur du lot WhatsApp.

Points à renforcer :

1. `createFamilyHandler` utilise encore `request.json()` sans lecteur de corps borné ni garde CSRF explicite, contrairement à la route de préparation WhatsApp.
2. L'idempotence est indexée par acteur, route et clé, sans empreinte du corps. Réutiliser une même clé avec un autre contenu rejoue la première réponse.
3. `POST /api/parent/children` ne correspond pas à la gouvernance d'inscription assistée et expose temporairement un lien d'activation au parent.
4. Les décisions de rôles et de propriétés sont dispersées entre plusieurs bibliothèques et contrôles locaux.
5. Le mode WhatsApp manuel ne fournit aucune preuve automatique d'envoi ou de livraison ; toute mention contraire serait trompeuse.
6. `ParentPhoneChallenge` ne conserve pas l'identifiant du membre du personnel ayant préparé ou révoqué un lien manuel. Une récupération de mot de passe initiée par le staff n'est donc pas attribuable durablement.
7. Les inventaires de gardes API sont obsolètes : les documents générés recensent 176 ou 74 routes selon le fichier, alors que 227 fichiers `route.ts` sont présents. Le scanner ne reconnaît pas correctement tous les handlers construits par factory.
8. Deux systèmes de journalisation coexistent. Le logger principal utilise le redactor canonique, tandis que le logger middleware possède un filtre distinct et un preset pouvant journaliser un e-mail brut. Leur convergence est nécessaire avant d'étendre l'observabilité des comptes.

## 18. Migrations et production

Migrations structurantes du lot identité parent :

- `20260906120000_parent_phone_identity` ;
- `20260906120100_optional_subscription_request_email` ;
- `20260906130000_parent_email_activation_invalidation`.

Elles ajoutent l'identité téléphonique, les challenges, l'unicité partielle des numéros réservés ou vérifiés, les contraintes de cohérence et les invalidations nécessaires. Le mode manuel ajouté ensuite ne nécessite aucune migration supplémentaire.

Conséquence opérationnelle de la migration de contact : les anciens liens d'activation par e-mail de 12 parents non activés ont été révoqués une fois. Si un parent concerné reprend son inscription, un nouveau lien doit être émis par le canal désormais autorisé. Les preuves de migration établissent ce nombre sans exposer leur identité.

État observé le 6 septembre 2026 :

- les trois migrations avaient été appliquées lors du lot d'intégration précédent ;
- 105 migrations étaient alors appliquées, sans migration inachevée ;
- une dérive historique de checksum sur `20260425113000_add_maths_progress_track` restait consignée et volontairement inchangée ;
- le code de la PR #212 n'était pas déployé ;
- `/`, `/auth/signin`, `/offres` et `/bilan-gratuit` répondaient `200` ;
- `/dashboard` redirigeait vers l'authentification puis répondait `200` ;
- `/auth/parent-phone` répondait `404`, ce qui confirme l'absence du nouveau parcours en production ;
- le conteneur web observé était sain ;
- aucun envoi WhatsApp réel n'a été déclenché pendant l'audit.

## 19. Preuves de validation disponibles

### Lot WhatsApp manuel et familles

- 139 tests ciblés réussis après les dernières corrections ;
- suite complète : 1 068 suites, 12 162 tests, 7 snapshots, zéro échec ;
- typecheck réussi ;
- lint réussi, avec seulement des avertissements préexistants du domaine candidat individuel ;
- scanner d'artefacts interdits réussi ;
- build de production standalone validé ;
- CI GitHub du commit applicatif `57a28f812` : 40 jobs réussis, aucun échec ;
- revue indépendante familles/bilans approuvée ;
- revue finale de code approuvée sans finding restant.

### Recette navigateur jetable

Scénario validé :

1. création d'un foyer sans e-mail avec deux enfants ;
2. réservation du téléphone ;
3. préparation puis renouvellement du message WhatsApp ;
4. invalidation de l'ancien lien ;
5. absence d'outbox WhatsApp ;
6. activation locale ;
7. connexion par téléphone ;
8. confirmation des deux enfants ;
9. absence de consentement pédagogique implicite ;
10. suppression des ressources de recette.

Le lien `wa.me` a été inspecté sans ouvrir de conversation réelle et sans envoyer de message. Les logs, captures et la preuve JSON de cette recette applicative synthétique étaient conservés au moment de l'audit dans `/tmp/pr212-manual-b225-review/`. Les tests et le build finaux sont rattachés au commit applicatif `57a28f812`; la recette navigateur précédait ce commit documentaire et ne constitue pas une preuve d'envoi WhatsApp réel.

## 20. Registre des écarts

### P0 — avant mise en service du nouveau parcours

1. **Déploiement absent.** La route `/auth/parent-phone` est encore absente de production.
2. **Portes d'entrée concurrentes.** `/bilan-gratuit` et l'ajout direct d'enfant par le parent contournent la création assistante voulue et empêchent une seule source de vérité opérationnelle.

### P1 — cohérence et sécurité

1. Ajouter une lecture bornée et une garde CSRF explicite au service de création familiale.
2. Lier l'idempotence à une empreinte stable du contenu ou rejeter une clé réutilisée avec un autre corps.
3. Décider et tester la durée d'accès coach après la dernière séance ou la fin d'affectation.
4. Remplacer les indicateurs parent vides ou techniques par des bilans pédagogiques réels et expliqués.
5. Distinguer dans l'interface parent la projection d'abonnement, les échéances, les paiements et le solde facturé.
6. Rendre « Bilans et diagnostics » visible et cohérent dans les navigations élève et parent.
7. Établir une politique unique pour la création des comptes internes, parents et élèves.
8. Corriger la chaîne d'autorisation de la fiche candidat pour que l'accès admin déclaré fonctionne réellement.
9. Rendre atomiques les changements de rôle et la création des profils associés dans le CRUD admin.
10. Attribuer durablement au membre du personnel la préparation et la révocation des liens parent sensibles.
11. Restreindre le renvoi d'activation par e-mail aux adresses qualifiées ou aux cohortes historiques explicitement autorisées, afin qu'un e-mail facultatif du parcours WhatsApp ne devienne pas une preuve d'activation implicite.

### P2 — consolidation progressive

1. Réduire la duplication des règles de rôle entre middleware, configuration NextAuth, RBAC et routes.
2. Harmoniser les termes « élève », « étudiant », « enfant », « bilan », « diagnostic » et « rapport ».
3. Consolider les cartes et vues de synthèse sans fusionner les domaines de données incompatibles.
4. Préparer l'archivage contrôlé des schémas de crédits après décision de conservation.
5. Ajouter une vue d'audit staff des activations : préparée, expirée, consommée, réémise, sans prétendre suivre la livraison WhatsApp manuelle.
6. Retirer les politiques crédits devenues inactives de `lib/rbac.ts` après vérification des consommateurs historiques.
7. Régénérer un inventaire exhaustif des gardes API, y compris les routes exportées par factory.
8. Unifier la redaction des journaux et supprimer tout preset susceptible d'émettre un e-mail brut.

## 21. Critères de mise en service

Le parcours parent WhatsApp peut être mis en service seulement lorsque :

- la PR est approuvée et fusionnée ;
- toutes les vérifications requises sont réussies ;
- l'application correspondant au commit fusionné est déployée ;
- les migrations attendues sont confirmées sans dérive ;
- `/auth/parent-phone` répond en production ;
- une assistante autorisée peut créer un foyer contrôlé ;
- le destinataire et le texte WhatsApp sont relus avant envoi ;
- le parent de recette active le compte, se connecte et confirme le foyer ;
- aucun ancien lien ne fonctionne après réémission ;
- aucune action de crédit n'apparaît dans les parcours actifs ;
- les preuves sont consignées sans PII, jeton ni mot de passe.

## 22. Procédure de mise à jour de ce document

Toute PR modifiant l'inscription, l'authentification, les rôles, les dashboards, les bilans, les paiements ou les factures doit :

1. mettre à jour la date, la branche et le commit audités ;
2. modifier les sections fonctionnelles concernées ;
3. ajouter ou fermer les écarts P0/P1/P2 ;
4. distinguer clairement « branche validée » et « production observée » ;
5. consigner les migrations ajoutées ou appliquées ;
6. consigner les commandes de test et leurs résultats ;
7. ajouter une ligne au journal ci-dessous ;
8. ne jamais inclure de secret, numéro réel, e-mail familial, jeton ou mot de passe.

Fichiers déclenchant obligatoirement une relecture de cet audit :

- `auth.ts`, `auth.config.ts`, `middleware.ts` ;
- `lib/auth/**`, `lib/rbac.ts`, `lib/guards.ts`, `lib/access/**` ;
- `lib/families/**`, `lib/contact/**`, `lib/whatsapp/**` ;
- `app/api/auth/**`, `app/api/assistante/**`, `app/api/parent/**`, `app/api/student/**`, `app/api/coach/**`, `app/api/admin/**` ;
- `app/dashboard/**`, `components/dashboard/**`, `components/navigation/**` ;
- `prisma/schema.prisma` et toute migration relative aux utilisateurs, bilans, paiements, factures ou droits.

## 23. Journal de mise à jour

| Date | Commit de référence | Modification | Preuve |
|---|---|---|---|
| 2026-09-06 | `57a28f812` | création du registre ; intégration du parcours famille et WhatsApp manuel ; cartographie des cinq dashboards ; retrait fonctionnel des crédits ; écarts d'inscription recensés | tests complets, build, recette jetable, revues indépendantes et lecture production |

## 24. Références internes

- `docs/audits/2026-09-06-integration-familles-whatsapp.md`
- `lib/whatsapp/README.md`
- `docs/superpowers/specs/2026-09-06-parent-whatsapp-manuel-design.md`
- `docs/superpowers/plans/2026-09-06-parent-whatsapp-manuel.md`
- `docs/bilans/context-reconstruction/03_ACTORS_AND_PERMISSIONS.md`
- `docs/bilans/context-reconstruction/05_BACKEND_AND_ROUTES_MAP.md`
- `docs/bilans/context-reconstruction/06_DATA_MODELS_AND_REPORT_CHAINS.md`
- `docs/convergence/DOMAIN_CANDIDAT.md`

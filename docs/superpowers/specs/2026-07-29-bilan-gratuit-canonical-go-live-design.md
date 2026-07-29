# Bilan gratuit canonique — conception go-live

**Date :** 29 juillet 2026
**Statut :** validé par le produit au fil de la session du 29 juillet 2026
**Périmètre pilote :** demande de bilan avec compte parent et comptes enfants, diagnostic « Mathématiques — Terminale spécialité », suivi équipe en temps réel, résultat provisoire déterministe, revue et publication humaine
**Dépôt :** `nexus-project_v0`

## 1. Décision

Le bilan gratuit devient une tranche verticale du workflow canonique des bilans. Il ne doit plus être :

- un simple formulaire public qui crée des comptes sans dossier opérationnel ;
- un `ContactLead` utilisé comme source de vérité pédagogique ;
- une porte vers l'ancien moteur `Assessment` public et ses traitements non durables ;
- un pipeline parallèle aux modèles canoniques déjà présents.

Le parcours retenu est :

```text
Compte parent
  → compte enfant rattaché
  → demande de bilan traçable
  → diagnostic publié et éligible, ou suivi humain
  → score provisoire déterministe
  → rapport à revoir
  → validation coach/admin
  → publication au parent vérifié
```

Les anciens `Assessment`, `Diagnostic`, `StageBilan`, `Bilan` et rapports spécialisés restent consultables. À compter de l'activation du nouveau tunnel, ils ne reçoivent aucune nouvelle écriture issue de `/bilan-gratuit`.

Cette conception complète et précise `docs/superpowers/specs/2026-07-14-workflow-bilans-pedagogiques-design.md`. Pour le pilote public, elle remplace les décisions antérieures qui imposaient une authentification élève préalable et interdisaient à l'administrateur de publier. Le produit a validé un parcours parent-first et l'autorisation de publication par coach affecté ou administrateur.

## 2. État observé au 29 juillet 2026

### 2.1 Parcours public

La production répond HTTP 200 sur `/bilan-gratuit`, rend un H1 unique, ne demande plus de mot de passe et ne déborde pas horizontalement à 375 px. Le parcours mobile reste très long et cumule trois formulaires sur la page.

Le formulaire principal collecte notamment :

- l'identité et les coordonnées du parent ;
- le prénom, la classe et l'établissement de l'élève ;
- les matières ;
- le besoin principal et un message libre ;
- le consentement au contact.

### 2.2 Défauts bloquants

La route `POST /api/bilan-gratuit` :

- crée immédiatement un `User` parent, un `ParentProfile`, un `User` élève et un `Student` ;
- ne crée aucun dossier de bilan ;
- ne persiste pas les matières, objectifs et difficultés hors contexte de campagne particulier ;
- ne notifie pas l'équipe sur la branche courante ;
- révèle l'existence d'un compte par un statut et un message différents ;
- bloque un parent existant, notamment lors de l'ajout d'un deuxième enfant ;
- promet une activation et une analyse sans workflow opérationnel associé.

Les champs `ParentProfile.bilanGratuitCompletedAt` et `bilanGratuitDismissedAt` alimentent une bannière, mais aucun parcours ne marque réellement le bilan comme terminé.

La page historique `/bilan-gratuit/assessment` prend encore des informations d'identité en query string et pointe vers l'ancien moteur `Assessment`. Elle n'est pas reliée au formulaire courant.

### 2.3 Moteurs pédagogiques

Le moteur `Assessment` :

- reste accessible par une soumission publique fondée sur l'identité fournie par le client ;
- conserve un traitement de génération fire-and-forget ;
- persiste un résultat de scoring même lorsque sa validation Zod échoue ;
- mélange encore des contrats de réponses insuffisamment précis ;
- ne constitue pas la cible du nouveau tunnel.

La fondation canonique existe déjà :

- `ParentStudentLink` ;
- `CanonicalAssessmentAttempt` ;
- `ScoreSnapshot` et `EvidenceItem` ;
- `ReportArtifact`, `ReportRevision` et `ReportReview` ;
- `JobOutbox` et `NotificationOutbox` ;
- contrats d'état et résolveur de catalogue sous `lib/bilans/`.

Elle n'est pas branchée au runtime public. Les quatre packs Maths/NSI adaptés sont tous `REVIEW_REQUIRED`. Aucun pack canonique n'est actuellement publiable.

### 2.4 Baseline de vérification

La sélection de 16 suites de tests Bilans/Assessments a produit :

- 15 suites réussies ;
- 181 tests réussis ;
- 1 test échoué à cause des modifications locales préexistantes de la navbar pré-rentrée ;
- plusieurs tests `Assessment` réussissent alors que le log prouve que le scoring invalide est persisté, ce qui confirme un défaut de contrat plutôt qu'une couverture correcte ;
- `npm run typecheck` réussit.

## 3. Principes produit

1. Le bilan gratuit nécessite un compte parent, mais ne demande pas de mot de passe avant le diagnostic.
2. Le parent peut créer et gérer plusieurs comptes enfants.
3. Un enfant n'a ni mot de passe ni activation séparée au lancement. Son accès personnel pourra être activé ultérieurement.
4. Un nouveau parent peut commencer immédiatement le diagnostic dans la session de création.
5. Un parent existant doit prouver le contrôle de son compte par lien magique avant de sélectionner ou créer un enfant.
6. Le système renvoie toujours une réponse publique neutre afin d'empêcher l'énumération de comptes.
7. Le résultat provisoire déterministe est visible après soumission.
8. Le bilan personnalisé final exige la vérification du compte et une validation humaine.
9. Seuls un coach effectivement affecté ou un administrateur peuvent valider et publier.
10. L'assistante suit, affecte, relance et traite les incidents opérationnels sans pouvoir publier.
11. Un test n'est proposé que pour un pack explicitement validé, publié et compatible.
12. Une matière sans pack publié crée le même dossier, notifie l'équipe et passe en suivi humain.
13. Le premier pack pilote est « Mathématiques — Terminale spécialité ».
14. Aucun score ne dépend d'un LLM.
15. Aucun événement temps réel ou email ne peut être la seule trace d'une action.

## 4. Parcours utilisateurs

### 4.1 Nouveau parent

1. Le parent renseigne son identité, son email, son téléphone et accepte le contact relatif au bilan.
2. Le serveur valide la requête, applique les protections publiques et résout l'email de façon insensible à la casse.
3. Une transaction crée :
   - le compte parent inactif ;
   - le profil parent ;
   - le compte enfant inactif, avec identifiant interne sans PII, et son profil ;
   - le lien parent-enfant en attente de vérification ;
   - le dossier `BilanRequest` ;
   - l'événement de création ;
   - les outbox nécessaires.
4. Le serveur place un jeton de parcours court et scopé dans un cookie `HttpOnly`. Le statut, le corps, les en-têtes et la présence de ce cookie sont identiques lorsque l'email correspond à un compte existant.
5. Le parent peut continuer immédiatement vers le diagnostic du nouvel enfant.
6. Un lien magique est envoyé en parallèle pour vérifier le compte et reprendre le parcours.
7. La vérification fait passer le lien parent-enfant à `VERIFIED` et donne accès au tableau de bord et au futur bilan publié.

La session temporaire ne donne accès qu'au dossier et à la tentative nouvellement créés. Elle ne donne accès à aucun historique, autre enfant ou donnée de compte.

### 4.2 Parent existant non connecté

1. Le parent soumet la même première étape.
2. La réponse HTTP et la session temporaire sont indistinguables de celles du nouveau parent.
3. Une demande provisoire est créée avec les seules informations nouvellement soumises. Aucun historique du compte, enfant ou relation existante n'est exposé.
4. Le parent peut commencer le diagnostic nouvellement demandé avec le jeton strictement lié à cette demande.
5. Un lien magique de reprise, court et à usage unique, est envoyé à l'adresse enregistrée.
6. Après authentification, le parent sélectionne un enfant existant ou confirme l'ajout du nouvel enfant.
7. La demande et la tentative provisoires sont alors reliées au parent et à l'enfant dans une transaction auditée.

Cette différence interne ne doit être observable ni dans la réponse publique ni dans les étapes accessibles avant vérification. Le jeton provisoire ne donne accès qu'aux données qui viennent d'être soumises dans cette demande.

### 4.3 Parent déjà connecté

Le parent accède directement à la sélection d'enfant, peut ajouter un enfant et renseigne ensuite le besoin. La relation existante doit être vérifiée ; un enfant nouvellement ajouté suit le contrat de vérification applicable.

### 4.4 Diagnostic disponible

1. Le serveur résout le pack canonique à partir de la classe, la matière, l'année scolaire et la spécialité.
2. Seul un pack `PUBLISHED` est démarrable.
3. Une tentative est créée et liée au dossier.
4. Les questions sont fournies par une API serveur sans solution, explication privée ni barème.
5. Les réponses sont autosauvegardées.
6. La soumission scelle la tentative et crée atomiquement le job de scoring et les événements.
7. Le scoring déterministe produit un snapshot et des preuves.
8. Le résultat provisoire est consultable depuis la session de parcours ; le rapport final ne l'est pas.

### 4.5 Diagnostic indisponible

Lorsque la sélection ne correspond à aucun pack publié :

- le dossier passe à `HUMAN_FOLLOWUP_REQUIRED` ;
- le parent voit une explication sobre et les moyens de contact ;
- l'équipe reçoit l'alerte « nouvelle demande » ;
- aucune approximation générique n'est présentée comme diagnostic disciplinaire.

## 5. Modèle métier

### 5.1 `BilanRequest`

`BilanRequest` est la source de vérité du parcours commercial et opérationnel. Il contient au minimum :

- identifiant ;
- parent utilisateur nullable tant que la reprise d'un compte existant n'est pas terminée ;
- élève nullable tant qu'il n'est pas sélectionné ;
- identité enfant provisoire minimale lorsque la demande n'est pas encore rattachée ;
- tentative canonique nullable ;
- matière, classe, année scolaire, voie et spécialité ;
- besoin principal et message libre ;
- offre et contexte de campagne validés côté serveur ;
- canal et source d'acquisition ;
- consentement, version du texte et date ;
- état courant ;
- état de vérification du compte, indépendant de l'avancement pédagogique ;
- coach affecté nullable ;
- dates de création, dernière activité, soumission, revue et publication.

Les données de formulaire ne sont jamais enfouies dans une chaîne `notes`. Les champs utiles au pilotage sont structurés et validés.

### 5.2 `BilanRequestEvent`

Chaque mutation métier produit un événement append-only :

- `REQUEST_CREATED` ;
- `ACCOUNT_VERIFICATION_REQUESTED` ;
- `ACCOUNT_VERIFIED` ;
- `CHILD_SELECTED` ;
- `CHILD_CREATED` ;
- `ASSESSMENT_STARTED` ;
- `ASSESSMENT_AUTOSAVE_CHECKPOINTED` ;
- `ASSESSMENT_SUBMITTED` ;
- `ASSESSMENT_SCORED` ;
- `ASSESSMENT_SCORING_FAILED` ;
- `REPORT_READY_FOR_REVIEW` ;
- `REPORT_APPROVED` ;
- `REPORT_REJECTED` ;
- `REPORT_PUBLISHED` ;
- `HUMAN_FOLLOWUP_REQUIRED` ;
- `TECHNICAL_ACTION_REQUIRED` ;
- `NOTIFICATION_DELIVERY_FAILED`.

L'événement conserve l'acteur, la date, le type, un identifiant de corrélation et un payload technique minimisé. Il ne duplique pas les réponses, le rapport ou les textes personnels. Les autosaves fréquentes mettent à jour le brouillon ; elles ne créent qu'un checkpoint événementiel borné, afin d'éviter une croissance non maîtrisée.

### 5.3 États du dossier

La vérification du compte et l'avancement du diagnostic sont deux axes parallèles. Ils ne doivent pas être fusionnés dans un enum linéaire, puisque le produit autorise le nouveau diagnostic avant vérification.

```text
AccountVerificationState
UNVERIFIED → VERIFICATION_PENDING → VERIFIED

BilanRequestStatus
NEW
  → READY_FOR_ASSESSMENT
  → ASSESSMENT_IN_PROGRESS
  → ASSESSMENT_SUBMITTED
  → SCORED
  → REVIEW_PENDING
  → PUBLISHED
```

États de sortie ou d'intervention :

- `HUMAN_FOLLOWUP_REQUIRED` ;
- `TECHNICAL_ACTION_REQUIRED` ;
- `CANCELLED`.

Les échecs détaillés restent portés par la tentative, le job et les outbox. Le dossier expose seulement l'état opérationnel utile à l'équipe.

Invariants obligatoires :

- la matrice des transitions et acteurs autorisés est définie dans un module unique et testée exhaustivement ;
- la vérification du compte n'empêche pas la passation liée à la session temporaire, mais bloque le dashboard et toute lecture du bilan final ;
- une transition pédagogique ne peut pas modifier implicitement l'état de vérification du compte ;
- `PUBLISHED` exige au moins une projection parent validée et un compte parent vérifié ;
- une erreur de notification ne fait jamais régresser le dossier publié.

### 5.4 Relations familiales

Le produit conserve la relation historique `Student.parentId` pour compatibilité et crée également un `ParentStudentLink` canonique.

- Le lien d'un nouveau compte reste `PENDING_PARENT_CONSENT` jusqu'à la vérification du compte parent.
- Il devient `VERIFIED` de façon traçable après contrôle du canal.
- Les lectures du nouveau domaine n'utilisent que le lien canonique vérifié.
- Plusieurs enfants par parent et plusieurs responsables par enfant restent possibles dans le modèle.

### 5.5 Projection CRM

`ContactLead` peut recevoir une projection minimale pour les outils commerciaux existants. Cette projection :

- n'est pas la source de vérité ;
- référence le `BilanRequest` ;
- ne doit pas contenir les réponses du diagnostic ;
- ne doit pas être nécessaire au fonctionnement ou à la reprise du dossier.

## 6. Pack pilote Terminale spécialité Maths

### 6.1 Gate de publication

Le pack ne peut passer à `PUBLISHED` que si les éléments suivants sont complets :

- programme et source officielle 2026/2027 ;
- identifiant, date d'effet et checksum de la source ;
- matrice compétences/questions ;
- banque sans ambiguïté ni solution exposée ;
- règle de scoring versionnée ;
- golden set de réponses et résultats ;
- modèle de résultat et rapport ;
- identité et date du reviewer pédagogique ;
- checksum de chaque composant.

Le code ne doit jamais promouvoir automatiquement un pack adapté depuis un flux legacy.

### 6.2 Questions et réponses

Le client reçoit un DTO public contenant seulement :

- identifiant ;
- texte ;
- choix présentables ;
- ordre et informations d'accessibilité.

Le serveur conserve les solutions, explications, poids, compétences et règles.

Les statuts de réponse sont distincts :

- `ANSWERED` ;
- `DONT_KNOW` ;
- `NOT_STUDIED` ;
- `NO_ANSWER`.

`NOT_STUDIED` et `DONT_KNOW` ne sont jamais transformés silencieusement en réponse incorrecte. La maîtrise et la couverture sont deux mesures distinctes. Une tentative incomplète reste reprenable plutôt que d'inventer des zéros.

### 6.3 Résultat provisoire

Le résultat provisoire affiche :

- couverture du diagnostic ;
- maîtrise globale et par domaine ;
- points d'appui ;
- priorités ;
- qualité et limites des preuves ;
- mention claire de la revue pédagogique à venir.

Il ne contient ni promesse de résultat, ni classement trompeur, ni texte LLM non revu.

### 6.4 Rapport final

Le domaine ajoute une audience explicite aux artefacts canoniques. Une tentative produit un artefact distinct par audience et chaque révision ne contient que sa projection :

- élève ;
- parent ;
- équipe Nexus.

La contrainte d'unicité porte sur `(assessmentAttemptId, audience)`. Une publication parent ne peut donc jamais désigner une révision élève ou Nexus. Le résultat provisoire possède également un DTO famille dédié et n'expose ni les rationales internes ni les réponses détaillées.

Le rapport déterministe est toujours disponible. Un enrichissement LLM est optionnel, derrière un flag, validé par schéma et contraint à référencer les `EvidenceItem`. Un échec LLM conserve le fallback et ne modifie ni le score ni la tentative.

La publication exige :

- compte parent vérifié ;
- révision en attente de revue ;
- coach affecté ou administrateur ;
- décision explicite enregistrée ;
- création transactionnelle de la publication et des événements.

La publication est explicite par audience. La projection parent exige un lien familial vérifié ; la projection élève reste non accessible tant que l'enfant ne possède pas d'accès actif ; la projection Nexus ne possède aucune route de lecture familiale.

## 7. Notifications et temps réel

### 7.1 Source de vérité

La mutation métier et l'écriture de l'événement/outbox sont réalisées dans la même transaction. L'interface temps réel et l'email consomment ces enregistrements ; ils ne créent pas eux-mêmes l'historique.

### 7.2 Notifications équipe

La chronologie du tableau de bord affiche tous les événements. Les emails immédiats sont limités à :

- nouvelle demande réelle ;
- diagnostic terminé ;
- erreur technique nécessitant une intervention.

Les destinataires sont configurables et utilisent par défaut le canal pédagogique approprié. Aucun email interne ne doit contenir les réponses détaillées du mineur.

Le schéma de notification canonique doit supporter explicitement `EMAIL` en plus des canaux déjà présents. Le destinataire par défaut de ces alertes métier est `pedagogie@nexusreussite.academy`, surchargeable par configuration.

Les types d'événement/outbox sont étendus au minimum avec `BILAN_REQUEST_CREATED`, `ASSESSMENT_SUBMITTED` et `TECHNICAL_ACTION_REQUIRED`. L'envoi d'email reste un job durable distinct de l'événement métier.

### 7.3 Transport

Le tableau de bord utilise :

1. un flux serveur authentifié et autorisé, ne projetant que les événements accessibles au rôle, reprenable avec identifiant du dernier événement ;
2. reconnexion automatique ;
3. polling borné comme fallback.

Le worker d'email :

- lease les entrées ;
- utilise des clés d'idempotence ;
- applique des retries bornés et un backoff ;
- enregistre l'échec sans modifier l'état pédagogique ;
- place les échecs persistants dans la file d'intervention.

## 8. Interfaces

### 8.1 Tunnel public

Le tunnel comporte cinq étapes :

1. compte parent ;
2. sélection ou création de l'enfant ;
3. besoin, classe et matières ;
4. diagnostic ou suivi humain ;
5. résultat provisoire et prochaines étapes.

Les engagements UX sont :

- mot de passe non demandé avant le diagnostic ;
- progression visible ;
- validation accessible ;
- autosave ;
- reprise après lien magique ;
- erreurs champ par champ ;
- WhatsApp et téléphone disponibles à chaque étape ;
- aucun renseignement personnel dans l'URL ;
- un seul formulaire principal, sans formulaire de rappel concurrent ;
- mobile sans débordement et sans perte de contexte.

### 8.2 Espace équipe

L'espace « Dossiers bilans » fournit :

- compteurs par état ;
- filtres matière, classe, urgence, coach, source et ancienneté ;
- affectation et réaffectation ;
- chronologie ;
- résultat déterministe et preuves ;
- état des jobs et notifications ;
- action de relance technique ;
- revue, refus motivé et publication selon le rôle ;
- indicateur de délai sans promesse publique non configurable.

### 8.3 Autorisations

| Rôle | Autorisations |
| --- | --- |
| Parent vérifié | gérer ses enfants liés, passer/reprendre leur diagnostic, voir les résultats provisoires et les bilans publiés autorisés |
| Session temporaire | passer/reprendre uniquement le diagnostic nouvellement demandé et voir son résultat provisoire famille ; aucun dashboard ni historique |
| Enfant sans accès actif | aucun login requis ; le parent pilote la passation |
| Coach affecté | lire, revoir, refuser, valider et publier les dossiers de ses élèves affectés |
| Assistante | suivre, filtrer, affecter, relancer et traiter l'opérationnel ; jamais valider ou publier |
| Admin | accès transversal, affectation, revue, validation, publication, relance et audit |
| Worker | transitions techniques explicitement autorisées uniquement |

Une absence d'autorisation renvoie une réponse non énumérable. Aucun rôle ne peut demander au client de fournir l'identité faisant foi.

## 9. Sécurité, données et mineurs

- validation Zod stricte à toutes les frontières ;
- réponse neutre pour nouveau compte, compte existant et honeypot ;
- réponse et session temporaire indistinguables pour nouveau compte et compte existant ;
- jetons aléatoires, courts, à usage unique, hachés au repos et scopés ;
- cookie de parcours `HttpOnly`, `Secure` en production et `SameSite=Lax` ;
- CSRF, limite de corps et rate limiting partagé ;
- transaction pour compte, enfant, dossier, événement et outbox ;
- contrôle d'ownership au niveau de la requête Prisma ;
- aucune solution dans le bundle client ;
- aucune PII, réponse ou texte libre dans les logs, métriques et identifiants de jobs ;
- cache privé/no-store pour les résultats ;
- politique de rétention et procédure d'effacement avant généralisation ;
- messages d'erreur client sobres et codes internes stables ;
- aucune notification externe sans consentement et canal vérifié.

## 10. Résilience et erreurs

| Défaillance | Comportement |
| --- | --- |
| Email indisponible | compte/dossier conservé, retry outbox, parcours immédiat du nouveau parent maintenu |
| Redémarrage serveur | jobs et notifications repris depuis l'outbox |
| Double clic/soumission | même clé d'idempotence, aucune double tentative ou notification |
| Scoring invalide | aucun snapshot persisté, état d'intervention et événement technique |
| Pack non publié | suivi humain, aucune question legacy de secours |
| Génération LLM/RAG indisponible | rapport déterministe, revue maintenue |
| Flux temps réel indisponible | polling de fallback, historique intact |
| Parent existant non authentifié | lien magique, aucune donnée historique exposée |
| Session temporaire expirée | reprise par lien magique, données sauvegardées |

## 11. Tests d'acceptation

### 11.1 Unitaires

- schémas de demande et états ;
- création/résolution de jetons ;
- transitions légales et acteurs ;
- DTO public sans solution ;
- scoring golden et statuts `DONT_KNOW`/`NOT_STUDIED` ;
- projections élève/parent/Nexus ;
- idempotence des événements et notifications.

### 11.2 Intégration PostgreSQL réelle

- transaction nouveau parent/enfant/dossier ;
- parent existant sans fuite ;
- plusieurs enfants ;
- lien vérifié, révoqué et accès croisé ;
- autosave et soumission immuable ;
- score et outbox atomiques ;
- concurrence de lease ;
- revue coach affecté ;
- publication admin ;
- refus assistante ;
- migration vierge et upgrade.

### 11.3 Playwright

- nouveau parent, diagnostic immédiat et vérification parallèle ;
- parent existant, lien magique, sélection/ajout d'enfant ;
- matière sans pack publié ;
- pilote Terminale Maths ;
- autosave, interruption et reprise ;
- résultat provisoire ;
- revue et publication ;
- erreur email et worker ;
- desktop, tablette et mobile ;
- accessibilité clavier et absence de débordement.

### 11.4 Sécurité

- anti-énumération ;
- contrat identique de statut, corps, en-têtes, cookie et ordre de grandeur du temps de traitement entre email nouveau et existant ;
- IDOR parent/enfant/coach ;
- tentative et rapport non publiés ;
- audience interne inaccessible à la famille ;
- absence de PII dans URL/logs/outbox ;
- solutions absentes du client ;
- rate limit multi-instance ;
- jeton expiré/rejoué.

## 12. Activation, migration et rollback

### 12.1 Flags

Les activations sont séparées :

- tunnel compte et dossier canonique ;
- pack pilote Terminale Maths ;
- résultat provisoire ;
- temps réel équipe ;
- enrichissement LLM.

### 12.2 Migration

Les migrations sont additives. Aucun historique n'est modifié pendant le pilote. Le nouveau domaine écrit uniquement dans les objets canoniques et le dossier de demande. Les projections CRM sont à sens unique.

### 12.3 Rollback

Le rollback désactive les flags et redirige vers le canal de contact existant. Il ne supprime jamais les comptes, enfants, demandes, événements, tentatives, scores ou rapports créés. Les workers finissent ou suspendent proprement les jobs déjà persistés selon le flag opérationnel.

### 12.4 Gate go-live

Le go-live est bloqué jusqu'à preuve de :

- migration testée sur base vierge et copie de test ;
- pack Terminale Maths validé nominativement ;
- score golden accepté ;
- worker et outbox observables ;
- email équipe et lien magique vérifiés ;
- RBAC/IDOR sur PostgreSQL réel ;
- build, lint, typecheck et suites pertinentes verts ;
- smoke Playwright desktop/mobile ;
- runbook de migration, activation, rollback et reprise d'incident ;
- politique de rétention approuvée.

## 13. Hors périmètre de la première tranche

- migration des historiques legacy ;
- publication simultanée de toutes les matières ;
- activation autonome d'un compte enfant ;
- paiement ou réservation ;
- notation d'une copie libre par LLM ;
- WhatsApp transactionnel automatique ;
- remplacement des bilans de stage ou EAF ;
- refonte générale des dashboards non liée aux bilans ;
- déploiement en production sans instruction distincte.

## 14. Résultat attendu

La tranche est terminée lorsqu'un nouveau parent peut créer son compte et un enfant, commencer un diagnostic Terminale Maths publié, reprendre la passation, obtenir un score provisoire reproductible, puis recevoir un bilan validé et publié ; lorsqu'un parent existant peut reprendre sans fuite d'existence ; lorsqu'une autre matière crée un suivi humain ; et lorsque l'équipe voit chaque dossier et chaque événement, reçoit les trois alertes convenues et peut traiter les erreurs sans perdre de données.

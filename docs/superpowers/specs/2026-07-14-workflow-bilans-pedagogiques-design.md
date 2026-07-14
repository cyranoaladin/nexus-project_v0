# Workflow canonique des bilans pédagogiques

**Statut :** validé par le produit le 14 juillet 2026  
**Dépôt cible :** `nexus-project_v0-bilans-security`  
**Portée :** lycée général français, de la Seconde à la Terminale. La plateforme est conçue pour toutes les matières et spécialités ; Maths, Physique-Chimie, NSI, Français, SVT et SES constituent les six premiers packs publiés.

## 1. Objectif produit

Nexus Réussite doit offrir un parcours privé et longitudinal qui transforme un questionnaire disciplinaire en bilan pédagogique rigoureux, ciblé et personnalisé. Le parcours doit fonctionner pour toutes les matières et spécialités ciblées sans créer de moteur ou de modèle de données par matière.

Un bilan explique :

- le niveau de maîtrise actuel de l'élève ;
- les compétences et prérequis fragiles, y compris ceux des niveaux antérieurs ;
- les priorités de remédiation et un plan de travail exploitable ;
- les preuves qui justifient les recommandations ;
- la version du programme, du questionnaire et de la règle de scoring appliqués.

Le produit ne promet aucun résultat scolaire. Il fournit un diagnostic documenté, une recommandation pédagogique et un suivi humain.

## 2. Décisions de conception

1. **Un workflow unique.** Les flux historiques `Assessment` et `Diagnostic` convergent vers le même contrat canonique. Les spécificités disciplinaires résident dans des packs versionnés, non dans des routes, modèles ou pages parallèles.
2. **Accès privé et relationnel.** L'élève doit être authentifié avant toute passation. S'il n'a pas de compte, il s'inscrit puis est rattaché à un parent vérifié. Les bilans ne sont pas publics et ne sont jamais récupérés par nom ou lien anonyme.
3. **Validation humaine obligatoire.** Aucun parent ni élève ne voit un bilan avant validation explicite par le coach référent autorisé.
4. **Scoring déterministe, IA encadrée.** Les scores sont calculés sans LLM. L'IA ne peut enrichir qu'un artefact structuré, validé et rendu par un gabarit déterministe. Une indisponibilité IA ne supprime ni la tentative ni les scores.
5. **Catalogue comme source unique de vérité.** Les packs officiels, compétences, dépendances, règles de scoring, questionnaires, gabarits de bilan et politiques RAG sont versionnés dans un catalogue validé. Les composants et API utilisent le catalogue via un service ; ils ne lisent pas directement des fichiers ou des prompts dispersés.
6. **Notifications WhatsApp minimisées.** Les notifications signalent un événement et dirigent vers Nexus après authentification ; elles ne contiennent ni score, ni diagnostic, ni données scolaires détaillées.

## 3. Périmètre pédagogique

### Niveaux et disciplines

| Niveau | Couverture initiale |
| --- | --- |
| Seconde générale et technologique | Maths, Français, Physique-Chimie, SVT, SES et SNT comme socle préparatoire à la NSI. |
| Première générale | Enseignements et spécialités Maths, Physique-Chimie, NSI, Français, SVT et SES selon le parcours de l'élève. |
| Terminale générale | Spécialités Maths, Physique-Chimie, NSI, SVT et SES ; continuité du Français via les acquis de Première et l'historique de l'élève. |

Le catalogue enregistre le type d'enseignement (commun, spécialité, option), la voie, l'année scolaire et la période d'effet. Les options supplémentaires ne sont pas implicites : elles sont des packs explicites quand Nexus décide de les commercialiser et de les faire valider. Un élève ne peut démarrer qu'un pack publié et éligible à son niveau, sa voie, son année scolaire et ses spécialités déclarées. Une matière ou spécialité non encore publiée est reconnue par le catalogue, mais n'ouvre pas de questionnaire ; elle est ajoutée au même workflow après revue pédagogique et golden set.

### Référentiels

Chaque version de curriculum conserve : l'URL et l'identifiant de la source officielle, la date de consultation, la date d'effet, le checksum de la source, l'état de revue pédagogique Nexus et la personne qui l'a validée. Les documents du Ministère et d'Éduscol constituent la base des contenus. Les modalités d'évaluation et les changements réglementaires sont stockés comme données de version, non codés dans les prompts.

## 4. Source de vérité pédagogique

Le catalogue est le seul endroit où les données éditoriales sont définies. Il fournit les unités suivantes :

| Unité | Responsabilité | Entrées / sorties |
| --- | --- | --- |
| `CurriculumVersion` | Identifie un programme applicable pour une matière, un niveau et une année scolaire. | Références officielles en entrée ; compétences publiées en sortie. |
| `Competency` | Décrit un attendu atomique, observable et évaluable. | Indicateurs, erreurs fréquentes, ressources et remédiations. |
| `PrerequisiteEdge` | Déclare qu'une compétence dépend d'une autre, y compris entre niveaux. | Graphe acyclique validé ; priorisation des fragilités en sortie. |
| `AssessmentPack` | Définit une passation : questions, barème, durée, accessibilité et seuils. | Version de curriculum en entrée ; soumission validable en sortie. |
| `ScoringPolicy` | Convertit les réponses en niveaux de maîtrise, confiance et alertes. | Réponses et barèmes en entrée ; `ScoreSnapshot` reproductible en sortie. |
| `ReportPack` | Définit les sections et la politique de recommandations pour élève, parent et Nexus. | Scores, preuves et prérequis en entrée ; artefact de bilan structuré en sortie. |
| `CorpusManifest` | Autorise les ressources RAG et leurs métadonnées. | Documents approuvés en entrée ; retrieval filtré et auditable en sortie. |

Une compétence a un identifiant stable, un libellé, un niveau cognitif, une matière, un niveau, des indicateurs de réussite, des erreurs fréquentes et une ou plusieurs ressources de remédiation. Les liens de prérequis permettent d'expliquer, par exemple, qu'une difficulté de Terminale peut nécessiter la reprise d'un acquis de Seconde ou de Première.

Le catalogue est validé par schémas Zod/JSON Schema, contrôle des identifiants, unicité, liens de prérequis, références de questions et couverture minimale. Il est publié seulement après revue d'un référent pédagogique Nexus.

## 5. Modèle métier et source de vérité opérationnelle

Le dossier élève et les relations d'accès sont les sources de vérité opérationnelles. Une tentative est immuable après soumission ; aucune correction ne modifie ses réponses ou son score. Une nouvelle passation crée une nouvelle tentative. Une révision concerne uniquement le rapport produit à partir d'une même tentative : elle peut être régénérée ou enrichie, mais garde les mêmes réponses et le même `ScoreSnapshot`.

Les objets canoniques sont :

| Objet | Responsabilité |
| --- | --- |
| `Student` et `ParentStudentLink` | Identité, inscription élève et rattachement vérifié à un ou plusieurs parents. |
| `CoachStudentAssignment` | Source unique de l'autorisation du coach référent. |
| `AssessmentAttempt` | Contexte de passation, pack appliqué, réponses, horodatages et statut. |
| `ScoreSnapshot` | Résultat déterministe, par compétence et domaine, calculé à partir d'une tentative. |
| `EvidenceItem` | Réponse, score, compétence et règle ayant motivé une conclusion. |
| `ReportArtifact` | Bilan structuré par audience, versionné, avec état de validation et rendu. |
| `ReportReview` | Décision, commentaire, coach valideur et date de validation/refus. |
| `NotificationOutbox` | Événement WhatsApp idempotent, consentement, destinataire, statut fournisseur et journal d'envoi. |

Les identifiants immuables et les relations de base de données remplacent tout fallback par e-mail, nom normalisé ou paramètre URL. Les lectures et mutations suivent toujours la relation authentifiée demandant l'accès.

Chaque `AssessmentAttempt` scelle, au moment de `SUBMITTED`, les identifiants et versions de `CurriculumVersion`, `AssessmentPack` et `ScoringPolicy`, ainsi que le checksum du pack. Chaque `ReportArtifact` scelle les identifiants et versions du `ReportPack` et du `CorpusManifest`, la révision de prompt, le checksum du contexte d'entrée et la référence du `ScoreSnapshot`. Une suppression ou une nouvelle version de catalogue ne change jamais ces références historiques.

## 6. Parcours utilisateur et machine à états

### Inscription et rattachement

1. L'élève s'authentifie ; à défaut, il crée un compte.
2. L'élève crée une demande de rattachement avec le contact du parent ; le lien est `PENDING_PARENT_CONSENT` et n'accorde aucun accès.
3. Le parent invité s'authentifie ou crée son compte, accepte le rattachement et prouve la maîtrise du canal de contact. Le lien devient `VERIFIED` après le contrôle Nexus requis pour les mineurs.
4. Le parent ou Nexus peut demander la révocation ; seul Nexus applique la révocation après contrôle. Un lien invité non accepté expire. `REVOKED` et `EXPIRED` retirent immédiatement tout accès futur sans réécrire l'historique d'audit.
5. Un parent non vérifié n'accède à aucun dossier ni bilan. Les informations de preuve et les délais de conservation sont séparés des réponses pédagogiques et suivent la politique de protection des mineurs de Nexus.
6. Un administrateur attribue un coach référent lorsque nécessaire.
7. L'élève ne peut commencer qu'un `AssessmentPack` compatible avec son parcours scolaire déclaré et ses droits.

### Passation, génération et publication

`DRAFT → SUBMITTED → SCORED → REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED`

- `DRAFT` : brouillon autosauvegardé, visible uniquement par l'élève.
- `SUBMITTED` : réponses scellées ; le coach est averti de la soumission.
- `SCORED` : `ScoreSnapshot` et preuves sont produits de façon déterministe.
- `REPORT_PENDING_REVIEW` : une `ReportRevision` est produite ou régénérée ; elle est visible seulement au coach référent.
- `COACH_VALIDATED` : le coach autorisé valide une révision précise ; il peut aussi la refuser avec motif. Une demande de régénération crée une nouvelle `ReportRevision` et retourne à `REPORT_PENDING_REVIEW`, sans modifier la tentative ni le score.
- `PUBLISHED` : l'élève et les parents liés peuvent consulter la révision validée ; leurs notifications sont mises dans l'outbox WhatsApp.

Les états d'échec techniques sont explicites et réessayables : `SCORING_FAILED` repart vers `SUBMITTED` avec les mêmes réponses après un retry worker ; `REPORT_GENERATION_FAILED` repart vers `SCORED` puis crée une nouvelle révision, ou produit le fallback déterministe ; `NOTIFICATION_FAILED` ne change jamais l'état publié et ne relance que l'outbox. Seul le worker autorisé effectue ces reprises, avec clé d'idempotence et tentatives bornées. Un coach ne corrige pas les réponses soumises : il peut refuser une révision ou demander une nouvelle passation à l'élève. Les transitions sont vérifiées côté serveur et journalisées.

## 7. Autorisations et notifications

| Rôle | Actions autorisées |
| --- | --- |
| Élève | Démarrer, sauvegarder et soumettre ses questionnaires ; voir ses propres bilans publiés et plans de travail. |
| Parent vérifié | Voir les seuls bilans publiés des élèves auxquels il est rattaché. |
| Coach référent | Lire les dossiers des élèves qui lui sont attribués, commenter, valider, refuser et demander une régénération. |
| Assistante | Gérer les demandes de rattachement, les attributions coach-élève et les relances opérationnelles ; elle ne peut ni publier un bilan ni modifier le catalogue. |
| Admin | Gérer les rôles, les révocations, les exceptions de publication tracées, les versions de catalogue et les journaux d'audit ; toute publication exceptionnelle exige un motif et est journalisée. |

Les événements WhatsApp sont :

1. soumission d'un questionnaire vers le coach référent ;
2. bilan prêt à revoir vers le coach référent ;
3. bilan validé et publié vers le parent vérifié et l'élève.

L'envoi est créé dans une outbox transactionnelle, dédoublonné par une clé d'événement, puis livré par un worker. La préférence de contact, le consentement, le numéro vérifié, le statut de livraison et les erreurs du fournisseur sont tracés. Le contenu se limite à l'événement et à une invitation à se connecter à Nexus.

## 8. Génération de bilan et résilience

Le moteur de rapport reçoit seulement un contexte minimal : identité pseudonymisée lorsque possible, pack, scores, preuves, prérequis, plan de remédiation et références autorisées. Il suit la séquence :

1. assemblage du contexte ;
2. retrieval filtré sur le manifeste approuvé ;
3. production éventuelle d'un JSON structuré ;
4. validation stricte du schéma et contrôles anti-invention ;
5. fallback déterministe si l'IA, le RAG ou le JSON échoue ;
6. rendu déterministe des vues élève, parent et Nexus ;
7. création d'une révision à valider.

Le LLM ne reçoit pas le droit de modifier une note, d'inventer une compétence ou de publier. Les logs opérationnels excluent les réponses et textes libres de l'élève ou du coach ; ils utilisent des identifiants techniques et des codes d'erreur.

La génération, le PDF éventuel et WhatsApp sont traités par des jobs durables avec verrou, checksum d'entrée, tentatives bornées, dead-letter queue, métriques et relance contrôlée par le personnel. Les requêtes HTTP ne lancent pas de traitement non durable en arrière-plan.

## 9. Migration et intégration avec l'existant

Le dépôt possède aujourd'hui des flux `Assessment` et `Diagnostic` concurrents, des types et statuts proches mais divergents, ainsi que des générateurs de bilans hétérogènes. La migration est additive et progressive :

1. introduire les contrats canoniques et le catalogue sans supprimer les flux en production ;
2. adapter les routes et écrans universels vers les nouveaux services ;
3. porter les packs Maths et NSI existants vers le catalogue ;
4. basculer chaque pack de façon atomique : à partir de sa date de bascule, le workflow canonique est la seule source de vérité en écriture pour ce pack et le legacy devient lecture seule ; aucune double écriture ni synchronisation bidirectionnelle n'est autorisée ;
5. migrer les historiques par scripts idempotents avec rapport de correspondance, identifiants de provenance et rollback ; les liens historiques résolvent vers un adaptateur de lecture ou vers l'artefact canonique migré ;
6. déprécier les anciennes routes seulement après bascule et vérification des données.

Les prix, l'authentification, le RBAC, les relations parent-élève et les dashboards existants restent intégrés via leurs services canoniques ; aucune page ne contourne les garde-fous d'accès existants. Le journal de migration indique pour chaque paquet la source de lecture, l'état de bascule et l'artefact de rollback.

## 10. Qualité, sécurité et critères d'acceptation

### Tests obligatoires

- validation des packs et du graphe de prérequis ;
- golden tests de scoring, reproductibles à réponses identiques ;
- tests de génération structurée, fallback et rendu déterministe ;
- tests de chaque transition d'état et de l'idempotence des jobs ;
- tests RBAC/IDOR pour élève, parent, coach et admin ;
- tests WhatsApp de déduplication et de minimisation du contenu ;
- tests d'intégration avec une file et un fournisseur simulés ;
- tests Playwright du parcours authentification → questionnaire → validation coach → publication parent.

### Critères de succès

- toute matière est ajoutée par un pack validé, sans nouvelle route ni nouveau modèle de tentative ;
- un bilan publié peut être expliqué par ses preuves et ses versions de contenu ;
- un parent ne peut jamais voir un brouillon, une autre fratrie ou un bilan non validé ;
- un échec IA n'empêche jamais l'accès du coach aux scores et au bilan de secours ;
- un événement WhatsApp n'est envoyé qu'une fois par événement logique ;
- les six matières prioritaires disposent chacune d'un parcours de contenu revu avant mise à disposition ;
- toute évolution réglementaire crée une nouvelle version de curriculum sans modifier l'historique.

## 11. Contrats d'intégration et exploitation

Les frontières de modules sont explicites :

| Interface | Commande / événement | Garantie |
| --- | --- | --- |
| Catalogue → passation | `resolveEligiblePack(student, selection)` | Retourne un pack publié figé ou une erreur d'éligibilité explicite. |
| Passation → scoring | `submitAttempt` / `AttemptSubmitted` | Crée une tentative immuable, une seule fois par clé de soumission. |
| Scoring → rapport | `ScoreAttempt` / `AttemptScored` | Produit un score déterministe lié aux versions scellées. |
| Rapport → revue | `GenerateReportRevision` / `ReportReadyForReview` | Crée une révision non publiée, validée par schéma ou fallback. |
| Revue → publication | `ValidateReportRevision` / `ReportPublished` | Vérifie l'assignation coach-élève et ne publie que la révision validée. |
| Publication → WhatsApp | `ReportPublished` / `NotificationRequested` | Crée une outbox dédoublonnée ; l'échec d'envoi ne modifie pas le bilan. |

Les erreurs sont des codes stables, non des messages de fournisseur. Le personnel dispose d'une file de relance pour les échecs de génération, les validations en attente et les notifications non livrées ; l'alerte opérationnelle ne révèle pas de contenu pédagogique sensible.

Les réponses, pièces de preuve, rapports et PDF suivent une politique de conservation versionnée. Les demandes d'export, de suppression et de pseudonymisation passent par une procédure d'administration auditée, sans effacer les traces minimales légalement requises ni rompre les contraintes de référentiel.

## 12. Ordre de livraison

1. Contrats, états, migration de données minimale, RBAC et outbox.
2. Catalogue versionné, validation et graphe de prérequis.
3. Scoring et moteur de bilan déterministe, worker durable, revue coach et publication.
4. Parcours UX authentifié et notifications WhatsApp.
5. Packs Maths et NSI, puis Physique-Chimie, Français, SVT et SES, un pack à la fois avec revue pédagogique et golden set.
6. Migration complète des anciens diagnostics, observabilité et pilote contrôlé avant généralisation.

Cette séquence livre d'abord la sécurité et la cohérence du produit ; elle n'expose une nouvelle matière qu'après validation de son contenu et de ses cas de référence.

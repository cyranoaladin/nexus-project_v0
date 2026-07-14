# Workflow canonique des bilans pédagogiques

**Statut :** validé par le produit le 14 juillet 2026  
**Dépôt cible :** `nexus-project_v0-bilans-security`  
**Portée :** lycée général français, de la Seconde à la Terminale ; Maths, Physique-Chimie, NSI, Français, SVT et SES en priorité.

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

Le catalogue enregistre le type d'enseignement (commun, spécialité, option), la voie, l'année scolaire et la période d'effet. Les options supplémentaires ne sont pas implicites : elles sont des packs explicites quand Nexus décide de les commercialiser et de les faire valider.

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

Le dossier élève et les relations d'accès sont les sources de vérité opérationnelles. Une tentative est immuable après soumission ; une correction ou une nouvelle passation crée une nouvelle révision/tentative, jamais une réécriture silencieuse.

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

## 6. Parcours utilisateur et machine à états

### Inscription et rattachement

1. L'élève s'authentifie ; à défaut, il crée un compte.
2. Un parent est invité ou crée un compte, puis confirme le rattachement à l'élève selon le protocole de vérification Nexus.
3. Un administrateur ou l'assistante attribue un coach référent lorsque nécessaire.
4. L'élève ne peut commencer qu'un `AssessmentPack` compatible avec son parcours scolaire déclaré et ses droits.

### Passation, génération et publication

`DRAFT → SUBMITTED → SCORED → REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED`

- `DRAFT` : brouillon autosauvegardé, visible uniquement par l'élève.
- `SUBMITTED` : réponses scellées ; le coach est averti de la soumission.
- `SCORED` : `ScoreSnapshot` et preuves sont produits de façon déterministe.
- `REPORT_PENDING_REVIEW` : le bilan structuré est produit ou régénéré ; il est visible seulement au coach référent.
- `COACH_VALIDATED` : le coach autorisé valide la révision ; il peut aussi demander une nouvelle révision, qui retourne à `REPORT_PENDING_REVIEW`.
- `PUBLISHED` : l'élève et les parents liés peuvent consulter la révision validée ; leurs notifications sont mises dans l'outbox WhatsApp.

Les états d'échec techniques sont explicites et réessayables (`SCORING_FAILED`, `REPORT_GENERATION_FAILED`, `NOTIFICATION_FAILED`). Ils conservent les entrées déjà persistées et ne donnent jamais un faux statut publié. Les transitions sont vérifiées côté serveur et journalisées.

## 7. Autorisations et notifications

| Rôle | Actions autorisées |
| --- | --- |
| Élève | Démarrer, sauvegarder et soumettre ses questionnaires ; voir ses propres bilans publiés et plans de travail. |
| Parent vérifié | Voir les seuls bilans publiés des élèves auxquels il est rattaché. |
| Coach référent | Lire les dossiers des élèves qui lui sont attribués, commenter, valider, refuser et demander une régénération. |
| Admin / assistante | Gérer les relations, le catalogue, les versions, les exceptions opérationnelles et l'audit, selon le RBAC existant. |

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
4. mettre les autres flux en lecture seule, puis les migrer par scripts idempotents avec rapport de correspondance et rollback ;
5. déprécier les anciennes routes seulement après bascule et vérification des données.

Les prix, l'authentification, le RBAC, les relations parent-élève et les dashboards existants restent intégrés via leurs services canoniques ; aucune page ne contourne les garde-fous d'accès existants.

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

## 11. Ordre de livraison

1. Contrats, états, migration de données minimale, RBAC et outbox.
2. Catalogue versionné, validation et graphe de prérequis.
3. Scoring et moteur de bilan déterministe, worker durable, revue coach et publication.
4. Parcours UX authentifié et notifications WhatsApp.
5. Packs Maths et NSI, puis Physique-Chimie, Français, SVT et SES, un pack à la fois avec revue pédagogique et golden set.
6. Migration complète des anciens diagnostics, observabilité et pilote contrôlé avant généralisation.

Cette séquence livre d'abord la sécurité et la cohérence du produit ; elle n'expose une nouvelle matière qu'après validation de son contenu et de ses cas de référence.

# Intégration utilisateurs et dashboards — Pré-rentrée 2026

## Statut

**APPROVED comme contrat cible par OWNER-014 et OWNER-015.** Aucun écran, compte ou modèle n'est créé dans cette phase. Les détails physiques de relation, vérification et révocation restent à concevoir additivement.

## Invariants d'identité

- Une demande publique peut exister sans `User`.
- Une adresse email/téléphone déclarée n'est pas une preuve d'identité.
- Un parent peut gérer plusieurs enfants.
- Un élève peut avoir plusieurs responsables légaux après évolution additive du modèle.
- Une liaison demande ↔ parent/élève exige une preuve : session authentifiée, lien signé, OTP ou validation staff auditée.
- Une fusion d'identités est une opération administrative explicite, réversible et journalisée.
- Aucun compte technique ne doit devenir le responsable métier d'un nouvel élève Pré-rentrée.
- Un changement d'email ne rompt pas les inscriptions : les relations utilisent des IDs.

## Cycle de vie complet

### 1. Visiteur non connecté

1. Consulte l'édition, ses modules et les cohortes réellement disponibles/en constitution.
2. Sélectionne niveau, profil académique et 1 à 4 matières.
3. Reçoit un planning et un devis calculés côté serveur.
4. Fournit les coordonnées minimales du responsable légal et l'identité minimale de l'élève.
5. Accepte les informations de traitement et modalités de préinscription.
6. Soumet avec clé d'idempotence.
7. Reçoit un accusé sans identifiant interne, prix client fiable ni promesse d'ouverture.

Statut initial recommandé : `DEMANDE_RECUE`.

### 2. Qualification

Le staff vérifie :

- identité du responsable et canal ;
- enfant concerné ;
- niveau d'entrée ;
- spécialités/options/voie ;
- matières souhaitées ;
- compatibilité et besoin pédagogique ;
- accord sur les dates/horaire ;
- doublons probables.

Les ambiguïtés utilisent `ARBITRAGE_PEDAGOGIQUE_REQUIS`. Aucun compte n'est créé automatiquement pour résoudre une ambiguïté.

### 3. Rattachement des identités

#### Parent existant authentifié

- proposer ses enfants autorisés ;
- lier seulement après confirmation explicite ;
- si nouvel enfant, créer le dossier via le workflow parent existant ;
- journaliser actor, relation et preuve.

#### Nouveau parent

- envoyer un lien d'activation signé au responsable ;
- créer le compte seulement après validation ou lors d'une étape transactionnelle contrôlée ;
- ne pas obliger l'activation avant l'accusé de demande.

#### Élève existant

- rapprocher par ID via parent/session ou staff ;
- les correspondances email/nom/date de naissance ne sont que des suggestions ;
- ne jamais lier automatiquement sur nom+email non vérifié.

#### Plusieurs responsables

- relation avec rôle (`RESPONSABLE_PRINCIPAL`, `RESPONSABLE_SECONDAIRE`, etc.) et permissions ;
- état `INVITE`, `VERIFIE`, `REVOQUE` ;
- consentement/autorité et historique ;
- un responsable révoqué perd immédiatement l'accès futur sans effacer l'historique.

### 4. Devis et acompte

- devis immuable avec version pricing/checksum ;
- paiement rattaché au parent vérifié et à la demande ;
- montant recalculé serveur ;
- preuve CGV et politique groupe non ouvert ;
- acompte reçu ne confirme ni cohorte ni inscription élève.

### 5. Affectation et confirmation

Une inscription est confirmée lorsque : identité liée, variante qualifiée, cohorte confirmée, place réservée transactionnellement et condition financière satisfaite. Chaque choix de matière a son propre statut ; le pack global est dérivé.

### 6. Exécution du stage

- emploi du temps personnel dérivé des enrollments ;
- présence par séance ;
- supports avec audience contrôlée ;
- communications idempotentes ;
- bilan final publié selon audience.

### 7. Clôture

- solde et facture réconciliés ;
- cohortes clôturées ;
- présence/bilan conservés selon politique ;
- données de lead non nécessaires supprimées/anonymisées selon la politique de rétention encore attendue sous `GATE-RETENTION-001`.

## Détection et fusion de doublons

### Signaux, jamais preuves seuls

- email parent normalisé ;
- téléphone vérifié au format E.164 ;
- email élève ;
- nom/prénom normalisés ;
- date de naissance ;
- établissement/niveau.

### Workflow

1. calculer les candidats doublons ;
2. bloquer la création automatique si score ambigu ;
3. afficher seulement au staff habilité ;
4. comparer les relations/inscriptions/paiements ;
5. choisir identité survivante ;
6. déplacer les liens dans une transaction ;
7. conserver une table de correspondance et un événement d'audit ;
8. ne jamais fusionner deux responsables uniquement parce qu'ils partagent un téléphone familial.

## Dashboard parent

### Données à afficher

- liste des enfants autorisés ;
- édition et modules choisis par enfant ;
- variante libellée de manière compréhensible ;
- statut de chaque demande/cohorte/inscription ;
- séances, horaires `Africa/Tunis`, salle et enseignant confirmé ;
- acompte, solde, paiements, facture/remboursement ;
- documents et communications ;
- informations manquantes à compléter.

### Actions

- confirmer/corriger le profil ;
- accepter un devis/CGV ;
- déclarer un paiement via un produit serveur ;
- choisir remboursement/report lorsqu'offert ;
- télécharger facture/documents ;
- inviter un second responsable selon ses droits, avec vérification et audit.

### Autorisation

Toutes les requêtes filtrent par relation responsable–élève vérifiée. Aucun ID passé par query string ne suffit. Aucune liste nominative de cohorte n'est exposée.

## Dashboard élève

### Données à afficher

- emploi du temps personnel ;
- matière, parcours public utile, salle, enseignant ;
- supports et travail demandé ;
- présence personnelle ;
- bilan publié ;
- changements/annulations qui le concernent.

### Données à masquer

- prix/acompte/solde par défaut ;
- coordonnées des responsables et autres familles ;
- notes internes/arbitrages ;
- capacité nominative et liste d'attente.

### Autorisation

`Student.userId = session.user.id` et enrollment personnel. Aucun filtre par email.

## Dashboard coach

### Données à afficher

- uniquement les cohortes affectées ;
- cinq séances, salle/modalité, conflits signalés ;
- élèves inscrits dans ces cohortes ;
- variante et besoins pédagogiques strictement nécessaires ;
- présence, supports, travail, bilan ;
- état de complétude des bilans.

### Données à masquer

- paiements, remises, remboursement ;
- emails/téléphones familiaux sauf nécessité validée ;
- cohortes d'autres enseignants ;
- notes internes administratives.

### Autorisation

L'accès est fondé sur `TeacherAssignment(cohortId, coachProfileId)`, pas seulement `StageCoach`. Une affectation élève générique ne donne pas accès à une autre cohorte.

## Dashboard administrateur

### Écrans futurs

- liste des éditions V1/V2 avec discriminant ;
- détail édition V2 ;
- modules/variantes ;
- cohortes et seuils ;
- ressources enseignants/salles/équipements ;
- planning et conflits ;
- demandes/qualification/doublons ;
- inscriptions/listes d'attente ;
- devis/paiements/remboursements/factures ;
- communications ;
- arbitrages et audit trail ;
- dry-run template/migration.

### Actions dangereuses

Exigent confirmation, rechargement de version et permission : déplacer séance, changer enseignant/salle, fermer cohorte, annuler inscription, rembourser, fusionner identité, révoquer responsable, republier template.

Suppression physique interdite dès qu'une inscription, un paiement, une présence ou un document existe. Utiliser clôture/archivage.

## Dashboard assistante

Bien que non demandé comme rôle final séparé, il existe dans le dépôt et doit être intégré :

- lecture édition/cohorte/planning ;
- qualification et contact famille ;
- gestion contrôlée des attentes ;
- déclaration/validation selon permissions financières existantes ;
- aucune modification de catalogue, template, règle pédagogique ou migration ;
- escalade admin/pédagogie pour arbitrages.

La dérive entre la base auditée et `origin/main` modifie actuellement certains scopes de facture pour `ASSISTANTE`. Aucun droit financier de ce rôle ne doit être déduit de l'UI existante : il sera explicitement fixé et testé dans la matrice RBAC de la branche d'implémentation.

## Matrice de visibilité

| Donnée/action | Public | Parent | Élève | Coach | Assistante | Admin |
|---|---|---|---|---|---|---|
| Édition/modules publics | Lecture | Lecture | Lecture liée | Lecture affectée | Lecture | Gestion |
| Places agrégées | Lecture limitée | Lecture | Lecture limitée | Cohorte affectée | Lecture | Gestion |
| Identité élève | Non | Ses enfants | Soi | Affectés, minimum | Oui métier | Oui métier |
| Autres élèves cohorte | Non | Non | Non | Affectés | Oui métier | Oui |
| Contact parent | Non | Soi | Non | Non par défaut | Oui | Oui |
| Choix/parcours | Non | Ses enfants | Soi | Affectés utile | Oui | Oui |
| Prix/devis | Public agrégé | Ses dossiers | Non par défaut | Non | Lecture | Gestion contrôlée |
| Paiement/remboursement | Non | Ses dossiers | Non | Non | Selon RBAC | Gestion |
| Présence | Non | Enfant | Soi | Saisie affectés | Lecture/correction contrôlée | Gestion |
| Supports | Publics seulement | Enfant autorisé | Autorisés | Cohorte affectée | Lecture | Gestion |
| Bilan | Non | Version parent | Version élève | Rédaction affectés | Validation/lecture | Gestion |
| Audit interne | Non | Communications propres | Non | Actions propres limitées | Selon rôle | Oui |

## États nécessaires par dashboard

- chargement ;
- vide réel ;
- donnée partielle ;
- qualification requise ;
- groupe en constitution ;
- cohorte confirmée ;
- liste d'attente ;
- ressource manquante ;
- paiement en attente/reçu/remboursé ;
- séance déplacée/annulée ;
- erreur réessayable ;
- accès refusé sans révéler l'existence d'une ressource.

## Notifications

Événements minimum : demande reçue, informations manquantes, devis prêt, acompte reçu, groupe en constitution, cohorte confirmée/non ouverte, changement planning, rappel, document disponible, solde dû, remboursement, bilan publié.

Chaque envoi possède clé idempotente, version de template, audience, canal, statut, timestamp et référence métier. Pas de PII dans les logs techniques ni de Telegram nominatif par défaut.

## Gaps actuels à fermer

- association Stage par email ;
- parent technique ;
- parent unique ;
- duplication `/api/student/stages` et `/api/eleve/stages` ;
- payload dashboard élève séparé des pages dédiées ;
- confirmation historique multi-effets non transactionnelle ;
- coach au niveau Stage ;
- finance et pédagogie confondues dans un seul statut ;
- absence d'outbox/audit Stage.

## Références

- [Audit système](../audits/2026-07-pre-rentree-system-impact-audit.md)
- [Carte d'impact](pre-rentree-2026-system-impact-map.md)
- [Matrice de tests](pre-rentree-2026-test-matrix.md)
- [Décisions owner](../decisions/pre-rentree-2026-owner-approval.md)
- [Gates d'activation](pre-rentree-2026-activation-gates.md)
- [Audit de dérive de main](../audits/2026-07-pre-rentree-main-drift-audit.md)

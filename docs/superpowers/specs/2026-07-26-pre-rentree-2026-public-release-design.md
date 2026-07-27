# Pré-rentrée 2026 Public Release Design

## Date

2026-07-26

## Contexte

La release consolide la pile des PR #75 à #78 depuis
`c13f44281a77f2bd17b607bbb46614785a2e0a57` vers une PR finale ciblant `main`.
Elle publie uniquement une information sur les stages. Elle n'active ni
réservation, ni paiement, ni parcours Bilan gratuit.

Le territoire Bilan défini par la mission reste strictement en lecture seule.

## Approches considérées

### 1. Réutiliser directement le DTO interne existant

Cette approche aurait intégré rapidement `ScheduleSection` et `ProgramsSection`,
mais elle aurait envoyé au client des rôles enseignants, des codes internes et
des champs de gouvernance. Elle est rejetée.

### 2. Construire un adaptateur public serveur sanitisé

Le serveur lit les sources canoniques, valide leurs invariants puis produit un
DTO public contenant uniquement les niveaux, matières, cohortes publiques,
dates, horaires, salles autorisées, programmes, capacités non confirmées et
documents allowlistés. Les composants clients ne lisent aucun JSON interne.

Cette approche est retenue : elle conserve une source de vérité unique et rend
la frontière de publication testable.

### 3. Créer un nouveau JSON public maintenu à la main

Cette approche séparerait nettement les surfaces, mais créerait une seconde
source de vérité pour le planning, les matières et les prix. Elle est rejetée.

## Architecture retenue

### Sources canoniques

- `data/campaigns/pre-rentree-2026.json` porte le calendrier et la version.
- `content/pre-rentree-2026/modules.json` porte les 14 modules pédagogiques et
  leurs 70 séances modèles.
- `data/pricing.canonical.json`, via `lib/pricing.ts`, porte les tarifs.
- `content/pre-rentree-2026/proofs.registry.json` porte les preuves publiables.
- `content/pre-rentree-2026/release-gates.json` porte les gates.

### Frontière publique

`lib/campaigns/pre-rentree-2026/public-surface.ts` reste l'unique adaptateur
fail-closed. Il produit :

- quatre niveaux et les matières dérivées du contrat canonique ;
- 14 modules pédagogiques et 70 séances modèles sans champ interne ;
- 17 cohortes opérationnelles et 85 occurrences calendaires ;
- des lignes par matière fixées à 5 séances et 10 h par élève ;
- une ou plusieurs cohortes horaires par matière ;
- une capacité `CAPACITY_TO_CONFIRM` tant qu'aucune donnée live ne confirme une
  place ;
- exactement sept documents publics.

Les identités enseignantes, `teacherRole`, décisions propriétaire, gates et
codes d'exploitation ne traversent pas cette frontière.

### Planning

Une matière est un objet pédagogique unique. Les cohortes alternatives sont des
choix horaires enfants de cette matière ; elles ne s'additionnent jamais.

Taxonomie :

- `pedagogicalModuleCount = 14`
- `pedagogicalSessionTemplateCount = 70`
- `operationalCohortCount = 17`
- `scheduledSessionOccurrenceCount = 85`
- `studentSessionsPerSubject = 5`
- `studentHoursPerSubject = 10`

Le sélecteur limite la sélection à quatre matières. Seuls `COMPACT` et
`NO_SHARED_DAY` autorisent une demande de disponibilité. Tous les autres
statuts bloquent le CTA et expliquent qu'une revue est nécessaire.

Le calcul propose une structure horaire ; il ne réserve rien. Le statut public
est `STRUCTURALLY_COMPACT` avec capacité `CAPACITY_TO_CONFIRM`.

### Salles

Deux salles sont permanentes. Une troisième salle temporaire est limitée au
bloc C de Terminale du 24 au 28 août 2026.

La baseline porte `roomAssignmentsValidated=false` sans preuve propriétaire
suffisante. La release conserve donc le gate faux et masque les numéros de
salle sur le site et les sept PDF publics. Les exports internes conservent les
affectations nécessaires aux contrôles de collision.

### Page canonique

`/stages/pre-rentree-2026` suit cet ordre :

1. hero ;
2. niveaux et matières ;
3. offres et tarifs ;
4. planning et sélecteur ;
5. méthode ;
6. programmes et sept PDF ;
7. FAQ ;
8. CTA WhatsApp.

`/pre-rentree` redirige vers cette page. Avant `PUBLIC_READY`, les routes HTML
et les téléchargements restent 404/noindex. Le commit de GO est distinct et
n'est créé qu'après tous les gates locaux, distants et privés.

### Documents et campagne

`pre-rentree:public-pdfs` devient le nom canonique du générateur réellement
servi depuis `public/documents/pre-rentree-2026`.
`pre-rentree:legacy-pdfs` reste un alias déprécié.

`pre-rentree:public-pdfs:verify` contrôle les sept fichiers, leur structure,
texte, polices, liens, absence de page vide, claims interdits et checksums.

Les kits sociaux sont générés dans deux familles :

- `REVIEW/` avec filigrane ;
- `PUBLIC/` sans filigrane, avec CTA disponibilité, WhatsApp, Mutuelleville et
  dates 17–28 août 2026.

Le calendrier est régénéré avec la date de lancement Africa/Tunis du jour de la
release. Les matières viennent exclusivement du contrat commercial canonique.

## Sécurité et échec fermé

- Aucun fichier Bilan n'est modifié.
- Aucun check requis n'est neutralisé.
- L'audit npm complet doit être vert ; sinon le verdict est
  `RELEASE BLOQUÉE PAR DEPENDENCY INTEGRITY`.
- `PUBLIC_READY`, merge et déploiement restent interdits sans runbook privé,
  rollback validé et CI complète verte.
- Le SHA servi en production doit égaler le SHA fusionné.

## Tests

La mise en œuvre suit TDD :

- tests unitaires des lignes matière/cohortes et des comptes 14/70/17/85 ;
- tests composants du plafond à quatre, statuts bloquants, CTA et capacité ;
- tests de la page canonique et de la frontière sanitisée ;
- tests Python du pipeline PDF et des kits sociaux ;
- tests E2E fermé et release candidate ;
- audit npm, SBOM, sécurité, typecheck, lint, intégration et build ;
- revue visuelle mobile, tablette, desktop, PDF, Feed et Story.

# ADR 006 — Frontière canonique entre bilans et corpus pédagogique

## Date

2026-07-29

## Statut

Accepté.

## Contexte

Le workflow de bilan gratuit persiste des familles, demandes, preuves
d'authentification, tentatives, résultats et documents. Le corpus de
pré-rentrée définit 17 modules, 17 CPS, 85 séances et leurs ressources sous
`content/pre-rentree-2026/`.

Avant cette ADR, `lib/bilans/catalog` adaptait quatre diagnostics TypeScript
historiques Maths/NSI. Cette adaptation devenait une seconde définition
pédagogique concurrente dès l'intégration du corpus YAML canonique.

Le corpus est intégralement marqué `HUMAN_VALIDATION_REQUIRED`. Le statut
`VALIDATED` de `modules.json` qualifie la structure du catalogue de campagne,
pas la validation disciplinaire des tests et supports.

## Décision

### Séparation des responsabilités

- `content/pre-rentree-2026/modules.json` définit les modules et séances.
- `content/pre-rentree-2026/pedagogy/manifest.yaml` indexe les ressources,
  versions, statuts et empreintes.
- `content/pre-rentree-2026/pedagogy/positioning/` et `session-kits/`
  contiennent les seules sources éditables détaillées.
- `.artifacts/pre-rentree-2026/pedagogy/` contient uniquement des sorties
  reproductibles et non suivies par Git.
- Prisma conserve l'état applicatif et les références immuables utilisées,
  jamais une copie éditable du corpus.

### Contrat applicatif

`lib/pre-rentree/pedagogy/` est l'unique frontière serveur. Elle expose :

- `PedagogyCatalog` ;
- `ModuleDefinition` et `SessionDefinition` ;
- `AssessmentDefinition` et `AssessmentDefinitionRef` ;
- `ContentVersion` et `ContentPublicationStatus`.

Le chargeur valide les schémas, recalcule les hashes annoncés, recoupe toutes
les relations et refuse les identifiants inconnus. Les routes HTTP ne lisent
pas de YAML et le navigateur ne reçoit pas de chemin interne.

`lib/bilans/catalog` adapte ce contrat. L'adaptateur historique
`maths-nsi.v1.ts` est supprimé. Les packs injectés restent possibles dans les
tests de validation, mais le catalogue par défaut est exclusivement canonique.

### Versionnement et historique

Chaque `AssessmentDefinitionRef` contient :

- `definitionId` ;
- `moduleId` ;
- `version`, composée de la campagne, de la version du manifeste et de
  l'édition ;
- `sha256`, empreinte du CPS validée contre le manifeste.

`CanonicalAssessmentAttempt` possède déjà les champs scellés
`assessmentPackId`, `assessmentPackVersion` et `assessmentPackChecksum`, ainsi
que les versions du curriculum et du scoring. Ils recevront cette référence au
moment de la future affectation. Une mise à jour du corpus ne réinterprète donc
pas une tentative historique.

Le présent lot n'ajoute aucune table d'affectation ou de réponse : le moteur
complet est reporté et doit réutiliser ces champs plutôt que créer une copie du
contenu.

### Publication

Les usages sont séparés :

- `INTERNAL_REVIEW` accepte un contenu en attente de validation ;
- `ASSIGNMENT` exige au moins `CLASSROOM_READY` ;
- `PUBLICATION` exige `PUBLICATION_APPROVED`.

Le manifeste, le module indexé et le CPS doivent porter un statut cohérent. Une
validation humaine terminée exige un relecteur nominatif et une date. Le
chargeur échoue de manière sûre en cas d'écart.

`modules.json.publicationStatus = VALIDATED` ne lève jamais ce verrou.

### Correction manuelle

Le contrat du futur moteur distingue :

1. `BROUILLON` ;
2. `AFFECTE` ;
3. `COMMENCE` ;
4. `SOUMIS` ;
5. `EN_ATTENTE_CORRECTION_MANUELLE` ;
6. `CORRIGE` ;
7. `RESULTAT_CALCULE` ;
8. `BILAN_GENERE` ;
9. `TRANSMIS_OU_PUBLIE`.

Une `reponse_courte` non corrigée est exclue du scoring automatique et n'est
pas considérée fausse. Tant qu'elle manque, le contrat bloque le score final,
le calibrage définitif du groupe et le bilan final.

Cette règle est testée dans ce lot. Sa persistance et son orchestration
appartiennent au prochain lot moteur.

### Physique-Chimie Seconde

Le chargeur refuse explicitement tout module de Physique-Chimie Seconde et
retourne `UNKNOWN_DEFINITION` pour
`physique-chimie-entree-seconde`. Le verrou demeure jusqu'à l'ajout volontaire
de cinq séances et d'un CPS validés dans les sources canoniques.

## Conséquences

### Positives

- une seule chaîne de vérité pédagogique ;
- provenance historique scellée sans duplication ;
- publication et affectation fail-closed ;
- aucun parsing YAML dans les routes ;
- compatibilité avec les invariants Prisma existants ;
- prochain moteur développable sur des contrats testés.

### Contraintes

- le corpus doit être inclus dans le trace serveur standalone des routes bilan,
  sans être copié sous `public/` ;
- toute promotion éditoriale nécessite une modification de source, une nouvelle
  empreinte, les validateurs et une validation humaine ;
- le moteur d'affectation/réponse/correction reste à implémenter.

## Alternatives rejetées

- synchroniser les YAML dans Prisma ;
- compiler manuellement une copie TypeScript du corpus ;
- exposer les fichiers internes au navigateur ;
- considérer `VALIDATED` comme publiable ;
- ajouter maintenant des tables spéculatives pour le moteur incomplet.

## Rollback

Revenir au commit précédant le raccordement restaure l'ancien adaptateur
TypeScript, sans migration de données. Cette option réintroduit cependant la
duplication et ne doit servir qu'à un rollback technique temporaire. La
migration additive du workflow bilan reste indépendante et ne doit pas être
supprimée si elle a déjà été appliquée.

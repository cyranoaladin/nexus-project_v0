# Feuille de route après le lot 1

## Statut

Le lot 1 organise le corpus ; il ne met pas en œuvre l'expérience applicative.
Les lots ci-dessous restent bloqués tant que les sources concernées n'ont pas
reçu une validation pédagogique humaine traçable.

## Gate préalable

Avant tout lot applicatif :

1. relire chaque module avec un enseignant disciplinaire ;
2. enregistrer le responsable pédagogique, l'enseignant, la date et la version ;
3. vérifier les supports élève et enseignant séparément ;
4. ne promouvoir que les modules effectivement validés ;
5. conserver les sorties internes sous `.artifacts/`.

## Lot 2 — Modèle de domaine et compilation

- compiler les CPS YAML vers un snapshot JSON validé ;
- définir les types TypeScript et les contrats de validation ;
- auditer `lib/diagnostics/`, `lib/assessments/`, le moteur de scoring et les
  modèles Prisma existants ;
- formaliser l'état `EN_ATTENTE_CORRECTION_MANUELLE` ;
- rédiger un ADR avant toute migration Prisma.

Une réponse manuelle en attente ne doit jamais réduire le score.

## Lot 3 — Tests de positionnement

- interface élève accessible et responsive ;
- sauvegarde et reprise des tentatives ;
- QCM et réponses courtes ;
- correction manuelle réservée aux rôles autorisés ;
- scoring par nœud et palier ;
- tests unitaires, intégration et Playwright.

## Lot 4 — Bilans individualisés

Créer trois restitutions séparées :

- élève : acquis, priorités et conseils ;
- parent : synthèse claire et non stigmatisante ;
- enseignant/Nexus : détail par nœud et correction manuelle.

Aucune restitution ne doit produire de diagnostic médical ou psychologique,
promettre un résultat ou confondre score automatique et appréciation humaine.

## Lot 5 — Supports et documents

- navigateur par module et séance ;
- séparation stricte élève/enseignant ;
- sélection du palier A/B/C ;
- cahier élève et guide enseignant générés ;
- contrôle visuel des PDF ;
- publication module par module après autorisation.

## Lot 6 — Exploitation

- tableau de bord des validations ;
- journal des versions pédagogiques ;
- indicateurs sans données personnelles ;
- archivage, sauvegarde et restauration ;
- contrôle d'accès et traçabilité.

## Hors périmètre du lot 1

Ne pas démarrer implicitement ces lots à l'occasion d'une correction de
pipeline. Toute API, interface complète, bilan applicatif, migration Prisma ou
publication requiert une mission, une revue de sécurité et des critères
d'acceptation propres.

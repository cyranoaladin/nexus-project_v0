# Bilans pré-rentrée — identité humaine, PDF staff et UX assistante

## Date

2026-08-09

## Contexte

La chaîne canonique calcule et conserve une `FactSheet` pseudonymisée dont
`student.alias` suit le format `ELEVE_XXXX`. La révision de rapport reprend cet
alias afin que le snapshot, la FactSheet, la révision et le moteur restent
exempts d'identité civile. En revanche, le document remis à l'élève, à ses
parents ou lu par Nexus doit porter le prénom et le nom réels de l'élève.

L'écran `/dashboard/assistante/bilans` sait prévisualiser le HTML d'une révision
en attente, mais ne fournit aucun PDF staff. L'écran
`/dashboard/assistante/bilans/saisie-papier` montre cinq libellés d'étapes sans
que les étapes 2 et 5 deviennent réellement courantes, et sa recherche expose
les comptes synthétiques de recette.

## Décisions

### Frontière d'identité

- Le snapshot, la `FactSheet`, `canonical_report_revisions.content` et toutes
  les entrées du moteur conservent exclusivement l'alias canonique.
- Une structure `HumanRenderIdentity`, limitée au `displayName`, est construite
  depuis `student.user.firstName` et `student.user.lastName` par le service de
  rendu.
- Le moteur déterministe continue de recevoir l'identité pseudonyme. Le nom
  humain n'est fourni qu'au gabarit d'en-tête HTML/PDF, après la construction du
  contenu pédagogique.
- Les nouvelles matérialisations officielles peuvent ainsi contenir le vrai nom
  au moment de leur émission. Les trois matérialisations historiques ne sont ni
  réécrites ni régénérées.

### PDF de revue

- Une route GET sous la surface dashboard assistante rend une audience unique
  (`ELEVE`, `PARENTS` ou `NEXUS`) pour une révision encore actionnable.
- La route exige un rôle `ASSISTANTE`, vérifie le pack et la révision par le
  service de revue, puis génère un vrai PDF Chromium sans persistance.
- Le même PDF est servi `inline` pour la prévisualisation et `attachment` pour
  le téléchargement. Les réponses sont privées et `no-store`.
- Le moteur existant embarque déjà `DM Sans` et `Fraunces` en WOFF2 avec les
  glyphes latins. Un test extrait réellement `é à è ê ç` du PDF ; aucune police
  de remplacement n'est ajoutée sans nécessité.

### Tableau de bord assistante

- La vue récente contient les révisions en attente, diffusées et rejetées.
- Chaque carte présente le nom de l'élève, le bilan, la date et un badge
  opérationnel : `En attente de diffusion`, `Diffusé` ou `Rejeté`.
- Le JSON brut et les identifiants techniques ne constituent plus le contenu
  principal des cartes.
- Les actions de prévisualisation, PDF, validation et rejet restent limitées aux
  révisions actionnables et gardent les contrôles de diffusion existants.

### Recherche et parcours de saisie

- Une politique centrale reconnaît les adresses contenant `smoke`,
  `DO_NOT_USE` ou `residual`, les domaines `@example.test` et
  `@invalid.residual`, ainsi que
  `parent-technique@nexusreussite.academy`.
- La recherche exclut un foyer lorsque l'adresse de l'élève ou celle du parent
  correspond. Aucun compte n'est supprimé.
- Le filtrage est appliqué à la requête et réappliqué à la projection affichée,
  y compris lors d'un chargement direct par `studentId`.
- La recherche par nom d'élève ou adresse du parent met à jour les résultats
  avec un court délai, tout en conservant une soumission clavier classique.
- Les cinq étapes deviennent observables : accueil/foyer (1), résultats et
  enfant (2), matière (3), réponses incomplètes (4), validation prête (5).
  Les étapes déjà franchies et les liens de retour permettent de revenir sans
  cul-de-sac.

## Sécurité et invariants

- Aucun changement du scoring, des réponses, du score, de la calibration ou de
  la provenance `SAISIE_PAPIER`.
- Aucun changement de `middleware.ts`, du périmètre ADMIN, de #108 ou du
  candidat libre.
- La route PDF staff ne rend jamais une révision inaccessible, désactivée,
  rejetée ou appartenant à un pack non activé.
- Les rôles parent et élève reçoivent une réponse indistinguable d'une ressource
  absente.
- Aucun contenu Nexus ne traverse les routes parent ou élève existantes.

## Validation

- Tests unitaires de séparation identité canonique / identité humaine pour les
  trois audiences.
- Test du snapshot et de la révision conservant `ELEVE_XXXX`.
- Test réel Chromium et extraction des accents.
- Tests de route PDF staff et de refus des rôles non-staff.
- Tests de politique d'exclusion sur l'élève et le parent.
- Tests des cinq étapes et des trois états de revue.
- Suite Jest complète sans filtre, lint, typecheck et build avec `.env` local
  neutralisé et `NEXTAUTH_URL=http://localhost:3000` explicite comme en CI.

## Rollback

Revenir au commit précédent restaure l'alias dans les futurs documents et
retire la route/UX staff. Aucun rollback de base n'est nécessaire : aucune
migration ni réécriture d'artefact historique n'est prévue.

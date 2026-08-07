# Statut — Diagnostic candidat libre 2027

Dernière mise à jour : 2026-08-07. Branche `feat/candidat-libre-diagnostic`, PR #100 (ouverte, non mergée).
Flag produit `CANDIDATE_DIAGNOSTIC_ENABLED` : **OFF partout, y compris en prod**. Aucun compte réel
provisionné. `main` intact.

## Fait

- **Intégration** du lot livré (16 modules, 266 items) dans `nexus-project_v0` : modèles Prisma isolés
  `CandidateDiagnostic*`, 8 routes API, composants élève/parent, banque de questions et moteur de scoring
  `server-only`.
- **Guard IDOR coach** (`lib/guards.ts`, `requireCoachAssignedToStudent`) : comparait un `User.id` à
  `CoachStudentAssignment.coachId`, qui référence en réalité `CoachProfile.id` — espaces d'id distincts.
  Corrigé via la relation (`coach: { userId }`), 3 tests de régression.
- **Migration validée sur clone schéma seul** (Postgres jetable `pgvector/pgvector:pg16`, aucune donnée
  réelle) : 60 migrations existantes rejouées, la nôtre appliquée seule par-dessus, idempotente, `migrate
  status` clean, `migrate diff` sans écart, zéro instruction destructive. Un nom d'index à 64 caractères
  (limite Postgres 63) trouvé et corrigé (`map:` explicite, 48 caractères).
- **Fuite cross-audience scores/avis** : le GET diagnostic partagé élève/parent renvoyait `autoScore`/
  `reviewSummary` de tous les modules à tout viewer. Corrigé dans `serializeCandidateDiagnostic` —
  statut/progression restent visibles (UX « en attente du parent »), score/avis masqués hors audience.
- **Fuite documents (productions du mineur)** — gap plus sévère, trouvé lors de l'audit exhaustif : un
  parent pouvait lister ET télécharger les copies écrites (`WRITTEN_COPY`) et l'enregistrement du Grand
  oral (`ORAL_RECORDING`) de l'enfant, sans aucun filtre. Corrigé aux 3 points d'exposition
  (`isDocumentVisibleToViewer`, sérialiseur + liste + téléchargement direct par id).
- **Audit cross-audience exhaustif verrouillé par tests** : matrice champ × audience complète
  (`docs/DIAGNOSTIC_CANDIDAT_LIBRE_CROSS_AUDIENCE_AUDIT.md`), tests qui assertent l'ensemble exact des
  clés retournées par audience et la matrice catégorie × audience des 9 catégories de documents — une
  régression future casse un test, pas seulement les cas déjà connus.
- **Grilles de relecture pédagogique tronc commun** (Q6, partiel) : 218 items extraits (14 modules
  communs à tout profil), 7 grilles CSV staff/offline + index (`docs/relecture-pedagogique/tronc-commun/`).
- **Flag OFF prouvé, pas seulement déclaré** : `lib/diagnostics/candidat-libre/feature-flag.ts`, câblé
  sur les 16 points d'entrée (8 fichiers de routes API + 2 pages). Test
  `__tests__/api/diagnostics/candidat-libre/feature-flag-dark.test.ts` : chaque route renvoie 404 sans
  toucher auth/RBAC/rate-limit/DB, y compris pour une session qui serait normalement admise (ADMIN) —
  le flag court-circuite avant toute résolution de rôle, donc la protection ne dépend d'aucun rôle.

## Gaté (et sur qui)

### 1. Merge — séquencement avec l'instance A
- Attendre le merge de **PR #98** (instance A) dans `main`.
- Rebaser #100 sur le nouveau `main`.
- **Re-tester la migration sur un clone du nouveau baseline** (répéter la procédure Postgres jetable +
  schéma seul, pas maintenant — le baseline va changer avec #98).
- Approbation du responsable → merge #100.
- Jamais deux migrations/déploiements prod concurrents.

### 2. Ops / légal (hors code, prérequis dur avant tout dossier réel — mineur concerné)
- Notice d'information RGPD (finalités, destinataires, durée de conservation, droits) élève + parent.
- Politique de rétention et purge automatique des documents et réponses.
- Sauvegarde chiffrée du stockage documentaire privé, restauration testée.
- CSP / limites de requête au reverse proxy, alerting sur échecs de dépôt/saturation/base.
- Antivirus (`DIAGNOSTIC_AV_MODE=clamdscan`) configuré et testé en conditions réelles.

### 3. Relecture pédagogique (Q6)
- **Prêt** : grilles tronc commun (218 items, 7 fichiers), voir `docs/relecture-pedagogique/tronc-commun/README.md`.
- **Non couvert** :
  - anglais / histoire-géo / LVB / méthodologie du tronc commun — 17 items, aucun relecteur du vivier nommé.
  - Grand oral — 12 items, sujet dépendant des spécialités réelles, assignation différée.
  - 126 items transversaux (accueil, profil, autonomie, potentiel d'apprentissage, documents, validation,
    questionnaire parent) — proposés au responsable comme coordinateur pédagogique, **à confirmer**.
  - NSI (26 items) et SES (22 items) — non extraits, en attente de confirmation formelle des spécialités.

### 4. Provisionnement (Phase P)
- 2 comptes réels (père PARENT, fils ELEVE_CANDIDAT_LIBRE) par le chemin canonique sûr, liés, coachs
  affectés (Maths + NSI selon l'échange précédent, à reconfirmer formellement — voir décisions attendues).
- Activation réelle, consentement élève + parent.
- En toute fin, une fois 1 → 3 verts.

## Décisions attendues du responsable

- (a) **Les 2 spécialités de l'élève** — confirmation formelle (Maths + NSI évoqué précédemment, à
  reconfirmer pour engager la relecture pédagogique de ces modules).
- (b) **Qui relit les 126 items transversaux** et si le rôle de « coordination pédagogique » proposé au
  responsable est le bon découpage.
- (c) **Relecteurs pour les 17 items non couverts** (anglais, histoire-géo, LVB, méthodologie).
- (d) **Confirmer le choix produit** « le parent ne voit pas les productions académiques de l'enfant
  (copies écrites, Grand oral) » — c'est le défaut sûr implémenté, mais c'est un choix produit qui mérite
  une validation explicite, pas seulement une décision technique unilatérale.

## Ce qui ne doit PAS se produire avant que ces gates soient levées

Merge dans `main` sans séquencement avec #98, déploiement, flip du flag, provisionnement d'un compte réel,
ou ouverture d'un dossier réel sans RGPD + relecture + consentement.

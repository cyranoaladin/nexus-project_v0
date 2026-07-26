# Audit final de reproduction — release publique Pré-rentrée 2026

## Date

2026-07-26, Africa/Tunis.

## Baselines

- `origin/main` : `a0db57a7bc4db25b8d163d92c2ed3e95b65da961`
- tête réelle PR #78 :
  `c13f44281a77f2bd17b607bbb46614785a2e0a57`
- merge-base réel : `e137009e8d5a6d80a183eb84682f0a72da1e6db3`
- branche isolée : `release/pre-rentree-2026-public-ready`
- production contrôlée :
  `https://nexusreussite.academy/stages/pre-rentree-2026`

`origin/main` n'est pas un ancêtre Git de la PR #78. Son seul commit exclusif
depuis le merge-base ne porte toutefois aucun delta de tree. La pile #75 à #78
est bien contenue dans la tête #78.

## Résultats de reproduction

| # | Statut | Gravité | Constat et preuve baseline |
|---|---|---|---|
| 1 | Reproduit | P0 | `ScheduleSection.moduleRows()` regroupe par matière puis additionne toutes les occurrences. Première SVT, Terminale NSI et Terminale SVT ont deux cohortes de 5 occurrences et deviennent 10 séances / 20 h. |
| 2 | Reproduit | P1 | `ScheduleSection.tsx` contient « Deux salles pédagogiques » et « occupation des deux salles » alors que `salle-3` est utilisée en Terminale, bloc C, du 24 au 28 août. |
| 3 | Reproduit | P0 | `StagePlanningSelector` n'a pas de plafond, affiche « Pré-inscrire sur ces créneaux » et ne bloque que `SIMULTANEOUS`. Le calcul baseline produit des `LONG_IDLE` actifs à 195 min, notamment Maths expertes + Physique-Chimie. |
| 4 | Reproduit | P0 | La page canonique rend le hero, les matières, les offres, la méthode et la FAQ. Elle n'importe ni planning, ni sélecteur, ni programmes, ni liste des PDF. La production présente le même manque. |
| 5 | Reproduit | P0 | `week-one-campaign.fr.json` et les rendus Week One annoncent encore Physique-Chimie en Seconde dans copies, alt text, calendrier, manifest et SVG. |
| 6 | Partiellement reproduit | P1 | Les sept PDF publics et les visuels Week One inspectés n'ont pas de filigrane REVIEW. En revanche les familles PUBLIC/REVIEW ne sont pas séparées et le CTA source reste « Programme et inscription sur WhatsApp ». |
| 7 | Reproduit | P0 | `week-one-calendar.json` contient sept valeurs `"date": null`; les manifests Week One et Full Campaign ont aussi `launchDate=null`. |
| 8 | Reproduit | P0 | Le gate `downloads` déclare neuf PDF. Le dossier final contient huit PDF : sept candidats publics et un `DossierAccueil_PRINT` interne. `public/` contient exactement sept PDF. |
| 9 | Reproduit | P0 | Le manifeste qui décrit simultanément les sept `PUBLIC_FINAL` porte globalement `purpose=REVIEW_ONLY`. |
| 10 | Reproduit | P0 | `release-inventory.json` référence la branche `feat/pre-rentree-planning-scheduler`, la PR #75 et le SHA `d1096f5…`, pas la release finale. |
| 11 | Reproduit | P1 | `data/campaigns/pre-rentree-2026.json` porte encore `version=2.0.4` malgré S5. |
| 12 | Reproduit | P1 | `getters.ts` documente « 17 module programs / 85 sessions » et « 70 individual sessions ». La taxonomie active mélange modules, cohortes, modèles et occurrences. |
| 13 | Reproduit | P0 | Le workflow exécute `pre-rentree:ci`, qui génère le paquet interne `.artifacts`, mais n'exécute pas `pre-rentree:legacy-pdfs`, seul pipeline qui régénère `public/documents/pre-rentree-2026`. |
| 14 | Reproduit | P1 | Le PDF Tarifs public contient « avant de réserver » et une comparaison « même zone tarifaire [...] qu'un cours particulier classique du marché ». |
| 15 | Reproduit | P0 | Le gate salles affirme qu'aucun numéro n'est un engagement public, alors que le site Planning et les PDF affichent Salle 1, Salle 2 et Salle 3. `roomAssignmentsValidated=false`. |
| 16 | Partiellement reproduit | P1 | Les visuels principaux sont sans filigrane, lisibles et portent le WhatsApp. La contact sheet montre de grands vides, une hiérarchie incomplète et aucun CTA clair. Les matières détaillées restent incohérentes en Seconde. |

## Constats déjà corrigés dans la baseline

- `public/documents/pre-rentree-2026` contient déjà exactement sept fichiers.
- Les sept fichiers commencent par `%PDF-`, ont un MIME PDF, passent
  `qpdf --check`, contiennent du texte et des polices embarquées.
- Les sept PDF publics inspectés n'ont pas de filigrane REVIEW.
- S5 contient bien 17 cohortes et 85 occurrences, sans collision de salle ni
  d'enseignant selon les rapports existants.
- L'assignation de cohortes choisit une seule cohorte par matière dans le
  configurateur ; le défaut restant se situe dans `moduleRows()` et les
  surfaces/documentations qui agrègent encore les cohortes.

## Bloquants confirmés

1. Dependency Integrity : `npm audit --audit-level=high` retourne 36
   vulnérabilités hautes liées à `brace-expansion <=5.0.7`.
2. La page canonique n'est pas le parcours parent complet.
3. Les surfaces planning et PDF se contredisent sur les salles.
4. La campagne Week One contient une matière Seconde obsolète et aucune date
   finale.
5. La provenance et les gates ne décrivent pas la release réelle.
6. Le pipeline CI documentaire ne régénère pas les PDF servis.

## Commandes de preuve exécutées

- `gh pr view` et `gh pr list` pour les PR #75 à #78.
- `git ls-remote`, `git merge-base`, `git log`, `git diff`.
- `npm ci`.
- `npm audit --omit=dev --audit-level=high` : vert.
- `npm audit --audit-level=high` : rouge, 36 high.
- `npm run pre-rentree:test:ts` : 46 suites, 359 tests verts.
- `npm run pre-rentree:snapshot`.
- `npm run pre-rentree:commercial-contract`.
- `npm run pre-rentree:test:py` : 154 tests verts en 605 s.
- `qpdf --check`, `pdftotext`, `pdfinfo`, `pdffonts`, `file`, `sha256sum`
  sur les sept PDF publics.
- calcul exhaustif des itinéraires jusqu'à quatre matières.
- inspection réelle de la page de production et de la contact sheet Week One.

## Décision avant correction

État : **à corriger, non publiable**.

`releaseStatus` et `publication_authorization` ne doivent pas être modifiés
avant que les corrections, la CI, la QA visuelle, le runbook privé et le
rollback soient réellement validés.

## État post-correction

| # | État | Preuve après correction |
|---|---|---|
| 1 | corrigé | le DTO public regroupe les cohortes alternatives sous une matière unique ; Première SVT, Terminale NSI et Terminale SVT restent à 5 séances / 10 h |
| 2 | corrigé | deux salles permanentes et une troisième temporaire sont expliquées ; aucun numéro n'est publié tant que l'affectation reste non validée |
| 3 | corrigé | plafond à quatre matières, message explicite, statuts bloquants et CTA de disponibilité |
| 4 | corrigé | page canonique complète, vérifiée dans un candidat contrôlé |
| 5 | corrigé | sources et rendus dérivés sans Physique-Chimie en Seconde |
| 6 | corrigé | familles `PUBLIC` sans filigrane et `REVIEW` avec filigrane ; CTA informatifs |
| 7 | corrigé | calendrier daté à partir du 2026-07-26, Africa/Tunis |
| 8 | corrigé | allowlist de sept PDF ; dossier d'accueil interne exclu |
| 9 | corrigé | manifestes public et revue séparés, sans statut contradictoire |
| 10 | partiel | ancien inventaire PR #75 supprimé ; inventaire final à générer après création de la PR finale |
| 11 | corrigé | campagne version 2.1.0 |
| 12 | corrigé | taxonomie 14 / 70 / 17 / 85 nommée et testée |
| 13 | corrigé | workflow public PDF régénère et vérifie les fichiers servis depuis `public/` |
| 14 | corrigé | comparaison marché et formulation « avant de réserver » supprimées |
| 15 | corrigé | gate salles alignée avec l'absence de numéros sur le site et dans les PDF |
| 16 | technique validé | visuels PUBLIC lisibles, CTA et WhatsApp présents, Story principale rééquilibrée ; validation humaine propriétaire encore en attente |

## Bloquants après correction

1. `npm audit --audit-level=high` reste rouge sur les dépendances de tooling.
2. Les checks GitHub de la PR finale doivent encore être exécutés.
3. Le runbook privé réel et la preuve de rollback ne sont pas accessibles.
4. La validation humaine propriétaire de campagne n'est pas enregistrée.

La release reste fail-closed et aucun GO ne peut être enregistré.

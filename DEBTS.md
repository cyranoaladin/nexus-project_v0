# Dettes et gates — Pré-rentrée 2026 · PR #74

## État au 23 juillet 2026

- Branche : `feat/svt-integration-clean`.
- Statut de release : `READY_FOR_REVIEW`.
- Verdict de publication : `BLOCKED`.
- `PUBLIC_READY` est interdit sans toutes les preuves et un GO écrit du propriétaire.
- Le site, les API, les téléchargements, le SEO et la préinscription restent fail-closed.

## Corrections techniques acquises

- Fondations : 4 à 6 élèves, maximum 6 ; Premium : 3 à 5, maximum 5.
- Seconde : Mathématiques, Français, Physique-Chimie **et « initiation informatique / algorithmique / SNT »** (module de 5 séances, `subjectId` NSI, label public SNT) — R2 rétabli le 2026-07-23.
- Première et Terminale conservent la **NSI** (spécialité), intitulé distinct du module SNT de Seconde ; ne pas confondre.
- Tarifs, acompte et solde sont dérivés du pricing canonique et testés.
- Provenance documentaire séparée en ancre métier, commit construit et empreinte des sources.
- Modules Maths révisés marqués comme propositions ; SVT maintenue en DRAFT.
- Kit, PDF, rasters, planches contact et manifestes régénérés.
- Formulation matériel SVT validée dans les sources : « Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant. »
- Les anciennes cibles et commandes d'exploitation ont été neutralisées dans l'arbre courant ; les helpers publics échouent volontairement.

## Arbitrages résolus

### B-7 — Grille tarifaire · **RÉSOLU** (décision direction, grille production 2026-07-20 confirmée)

Statut : **RÉSOLU**. La grille tarifaire de référence est la **grille production** enregistrée par la décision propriétaire `d0ce22411` (« docs(pre-rentree): enregistrer les décisions propriétaire 2026 », 2026-07-22) et confirmée par la direction. Toute grille alternative — notamment la variante « 3-5 / 140 » — est **périmée et interdite**.

- **Premium** (`pre_rentree_packs`, 1 à 4 matières) : groupe 3 à 5 (`group_max: 5`), prix 480 / 900 / 1350 / 1800 TND, acompte **30 % exact** (144 / 270 / 405 / 540).
- **Fondations** (`pre_rentree_foundations`, entrée 3e / Seconde) : groupe 4 à 6 (`group_max: 6`), prix 350 / 400 TND, acompte 30 % (105 / 120), sous `commercial_exception PRE2026-3E-350` approuvée le 2026-07-20 par `DIRECTION_NEXUS_REUSSITE`.

Source de vérité : `data/pricing.canonical.json`. Cohérence vérifiée : page, configurateur et FAQ lisent les prix depuis le canonique (aucun montant codé en dur, aucune fuite de la grille périmée). Le gate humain « tarifs » reste validé. Traçé aussi dans `content/pre-rentree-2026/publication-decisions.owner.json` → `decisions.pricingGrid`.

### R2 — Module informatique Seconde · **RÉSOLU** (décision direction 2026-07-23)

Le module **« initiation informatique / algorithmique / SNT »** (`seconde-informatique-snt`, 5 séances, `subjectId` NSI, label public SNT) est **réintégré** à l'offre Seconde, portant celle-ci à **quatre matières**. Retiré involontairement par le commit `66feafed0` (bundlé avec l'alignement capacités R1) puis gaté hors offre publique (`DEC-PRE2026-SECONDE-SNT: CLOSED_EXCLUDED`) : le retrait amputait l'offre Seconde d'un quart. Restauration **chirurgicale** (dimension SNT uniquement ; l'alignement capacités 4→6 / grille R1 reste scellé). Créneau rétabli en semaine 2, bloc A/salle-1 (`teacherRole` COMPUTER_SCIENCE_TEACHER_A). Intitulé Seconde **SNT** ≠ spécialité **NSI** Première/Terminale : distinction codée (labels de module). Tracé : `owner.json → decisions.secondeSubjects`, `proofs.registry → DEC-PRE2026-SECONDE-SNT (APPROVED / PUBLIC)`.

## P0 humains encore ouverts

| Référence | Gate | État | Preuve de sortie attendue | Responsable |
|---|---|---:|---|---|
| B-1 | Affectations enseignants | ❌ | Affectation et disponibilité confirmées pour chaque matière et créneau, conservées hors supports publics | Direction pédagogique et opérations |
| B-1 bis | Qualifications (affectation individuelle) | ❌ | Contrôle **individuel** documenté par enseignant affecté. NB : distinct de la **mention collective** « certifiés/agrégés » qui, elle, est **autorisée** sur les supports commerciaux (R4, preuve sous responsabilité direction) — ce gate ne la bloque pas. | Direction pédagogique |
| B-2 | Validation SVT | ❌ | Validation écrite d'un enseignant SVT qualifié ; les deux PDF restent DRAFT jusque-là | Direction pédagogique |
| M-1 | Validation Maths | ❌ | Revue écrite des modules Maths Seconde et Première révisés à partir des BO 2019/2026 | Direction pédagogique |
| O-1 | Salles | ❌ | Salles et capacités validées pour chaque créneau | Direction des opérations |
| O-2 | Paiement et reçu | ❌ | Parcours d'encaissement, rapprochement et reçu testés | Direction des opérations |
| J-1 | Annulation/remboursement | ❌ | Conditions et CGV approuvées | Direction et conseil juridique |
| J-2 | Confidentialité/rétention | ❌ | Notice, finalités, durées et droits validés | Responsable confidentialité |
| Q-1 | Téléchargements | ❌ | Manifestes, liens, poids, checksums et contrôle E2E final verts | Qualité documentaire |
| Q-2 | Téléphone, WhatsApp, formulaires | ❌ | Parcours de contact testés sans collecte excessive | Communication et technique |
| C-1 | Manuels/remise annuelle | ❌ | Conditions, stock, éligibilité et non-cumul validés ; avantages masqués jusque-là | Direction commerciale |
| C-2 | Date de lancement | ❌ | Date écrite par le propriétaire ; J1…J29 sont calculés depuis cette date | Propriétaire |
| D-5 | Autorisation de publication | ❌ | GO écrit, daté, rattaché au SHA exact | Propriétaire |

Les seuls gates humains actuellement validés sont la capacité et les tarifs.

## Arbitrages éditoriaux

### Statut « certifiés / agrégés » — **RÉSOLU (R4, décision direction 2026-07-23)**

La mention **« enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice »** est **rétablie** sur les supports commerciaux de la campagne pré-rentrée (Tarifs, Flyer, Planning). C'est le différenciateur central de Nexus, revendiqué par la direction ; la preuve du statut relève de la direction.

Distinction essentielle actée : le **STATUT** est une **qualification collective** de l'équipe — il ne nomme personne et reste compatible avec l'anonymat nominatif (aucun nom d'enseignant en public). Le filtre qui avait retiré la mention (test contract `assert not in`) la confondait avec une donnée nominative : c'est le **filtre** qui a été corrigé, pas le contenu. La formulation dégradée « expérimentés, en exercice dans le système français » n'est plus la référence pour ces supports. Le site marketing général (hors campagne) n'a jamais porté la mention et n'est pas concerné. Voir `content/pre-rentree-2026/publication-decisions.owner.json` → `decisions.teacherStatusStatement`, `ARBITRAGE_ENSEIGNANTS.md`.

### Affectations, salles et rôles

La politique actuelle est fail-closed : aucun nom réel ni code de rôle interne n'est public. Les créneaux et salles ne peuvent être exposés qu'après validation du gate `rooms`; si des rôles sont ensuite affichés, ils restent abstraits. La position métier antérieure « publier salles + créneaux + rôles abstraits » est conservée comme option, pas comme autorisation.

## P1/P2 bornées

| Dette | Priorité | Sortie attendue |
|---|---:|---|
| Réconciliation des dépôts divergents | P1 | Chantier séparé ; aucune réconciliation dans la PR go-live |
| Purge de l'historique Git contenant d'anciens détails d'infrastructure | P1 | Décision propriétaire et procédure dédiée ; impossible ici sans réécriture/force-push interdits |
| Runbook privé et rollback staging | P1 | Runbook hors dépôt public et exercice staging daté ; aucune cible staging fournie dans cette mission |
| Warnings ESLint historiques | P2 | Réduction progressive sans relever le budget ni neutraliser le lint |

## Verdict

`BLOCKED` jusqu'à clôture des contrôles automatisables de la PR et résolution des gates humaines P0. Un feu vert technique ne vaut ni GO commercial ni autorisation de publication.

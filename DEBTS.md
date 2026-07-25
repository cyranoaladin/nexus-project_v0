# Dettes et gates — Pré-rentrée 2026

## État au 24 juillet 2026 (branche `feat/pre-rentree-planning-scheduler`)

Chantier planning fenêtres + week-end (Volet 1) et sélecteur de planning parents (Volet 2), en plus des arbitrages du 23/07 ci-dessous (branche `feat/svt-integration-clean`, toujours valides). Détail technique complet : `GO_LIVE_CHECKLIST.md`, `SEPARATION_STAGES_ANNUEL.md`.

### Arbitrages résolus le 24/07

- **Conflit salle 2 / bloc A (24-25-26 août)** — RÉSOLU. PC Terminale déplacé du bloc A au bloc D (seul créneau salle 2 libre sur toute la fenêtre 2) ; SVT 1re, PC 1re, SVT Tle inchangés. Les 4 gates opérationnels + complétude sont verts.
- **Seuil d'ouverture** — RÉSOLU, **unifié à 3 partout** (Fondations ET Premium), remplaçant l'ancien seuil Fondations à 4 (cf. B-7 ci-dessous, désormais amendé). Constante unique `PRE_RENTREE_MIN_COHORT_OPENING`. Touche `data/pricing.canonical.json` (`group_min_open` des deux produits Fondations pré-rentrée + `commercial_exception PRE2026-3E-350`, scope mis à jour « 3 à 6 élèves »).
- **Philosophie** — RÉSOLU, purge complète. Philosophie n'existe dans aucun stage de pré-rentrée (jamais dans `SUBJECT_THEMES`, les schémas Zod, `commercial-contract.fr.json`, ou les contenus marketing). Remplacée par **Mathématiques expertes** (Terminale uniquement) partout où elle apparaissait pour ce niveau. Garde-fou permanent ajouté (test de non-régression sur liste fermée de matières autorisées).
- **Seconde = Maths + Français** — RÉSOLU (arbitrage direction définitif, 2026-07-24, tranchant le conflit R2/R2-bis ci-dessous). `commercial-contract.fr.json` ne vend plus Physique-Chimie ni Informatique-SNT en Seconde (2 SKU retirés après vérification qu'il s'agissait bien de SKU de STAGE, même `pricingId` `pre2026-foundations-seconde-subject` que Maths/Français — pas d'une contamination annuelle). `pre-rentree-2026-full-coherence.test.ts` est vert sur les 4 niveaux.

## État au 23 juillet 2026

- Branche : `feat/svt-integration-clean`.
- Statut de release : `READY_FOR_REVIEW`.
- Verdict de publication : `BLOCKED`.
- `PUBLIC_READY` est interdit sans toutes les preuves et un GO écrit du propriétaire.
- Le site, les API, les téléchargements, le SEO et la préinscription restent fail-closed.

## Corrections techniques acquises

- Fondations : ~~4 à 6 élèves~~ **3 à 6 élèves** (seuil unifié à 3, arbitrage direction 2026-07-24 — voir plus haut), maximum 6 ; Premium : 3 à 5, maximum 5.
- Seconde : ~~Mathématiques, Français, Physique-Chimie et « initiation informatique / algorithmique / SNT » (module de 5 séances, `subjectId` NSI, label public SNT) — R2 rétabli le 2026-07-23~~ **TRANCHÉ le 2026-07-24** : la nouvelle grille de stage (fenêtres + week-end), donnée explicitement comme source de vérité par la direction, redéfinit Seconde à **Maths + Français uniquement**. Le module `seconde-informatique-snt` a été retiré de `modules.json` (14 modules au lieu de 17) et de `data/campaigns/pre-rentree-2026.json`. `content/pre-rentree-2026/commercial-contract.fr.json` a été aligné en conséquence (les 2 offres Seconde Physique-Chimie/Informatique-SNT ont été retirées, vérifiées au préalable comme SKU de stage et non comme fuite annuelle) — voir R2 ci-dessous.
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

### R2 — Module informatique Seconde · **TRANCHÉ le 2026-07-24 (arbitrage direction définitif)**

Le module **« initiation informatique / algorithmique / SNT »** (`seconde-informatique-snt`, 5 séances, `subjectId` NSI, label public SNT) avait été **réintégré** à l'offre Seconde le 23/07, portant celle-ci à **quatre matières**. Retiré involontairement par le commit `66feafed0` (bundlé avec l'alignement capacités R1) puis gaté hors offre publique (`DEC-PRE2026-SECONDE-SNT: CLOSED_EXCLUDED`) : le retrait amputait l'offre Seconde d'un quart. Restauration **chirurgicale** le 23/07 (dimension SNT uniquement ; l'alignement capacités 4→6 / grille R1 restait scellé).

**Le 24/07, la direction a explicitement tranché ce conflit** entre les deux décisions scellées (R2 du 23/07 vs la nouvelle grille de stage fenêtres + week-end) : pour les STAGES de pré-rentrée, **Seconde = Maths + Français uniquement**, la grille du 24/07 faisant foi. Avant tout retrait, vérification effectuée que les 2 offres Seconde Physique-Chimie/Informatique-SNT dans `commercial-contract.fr.json` partageaient le même `pricingId` (`pre2026-foundations-seconde-subject`) que les offres Maths/Français conservées — confirmant qu'il s'agissait bien de SKU de STAGE et non d'une contamination annuelle qui aurait fuité dans le contrat de campagne. Les 2 offres ont donc été retirées de `commercial-contract.fr.json` (14 → 12 offres), ainsi que toutes les références correspondantes (`parent-documents.fr.json`, `full-campaign.fr.json`, assets générés). Le module technique reste supprimé (`data/campaigns/pre-rentree-2026.json`, `modules.json`, `content-schema.ts`). La décision `DEC-PRE2026-SECONDE-SNT` dans `proofs.registry.json` est repassée à `CLOSED_EXCLUDED` / `HIDDEN` (elle documente l'historique du 23/07, plus l'état public actuel). `pre-rentree-2026-full-coherence.test.ts` confirme la cohérence sur les 4 niveaux (grille, incompatibilités, sélecteur, PDF, page publique).

## P0 humains encore ouverts

| Référence | Gate | État | Preuve de sortie attendue | Responsable |
|---|---|---:|---|---|
| B-1 | Affectations enseignants | ❌ | Affectation et disponibilité confirmées pour chaque matière et créneau, conservées hors supports publics | Direction pédagogique et opérations |
| B-1 bis | Qualifications (affectation individuelle) | ❌ | Contrôle **individuel** documenté par enseignant affecté. NB : distinct de la **mention collective** « certifiés/agrégés » qui, elle, est **autorisée** sur les supports commerciaux (R4, preuve sous responsabilité direction) — ce gate ne la bloque pas. | Direction pédagogique |
| B-2 | Validation SVT | ❌ | Validation écrite d'un enseignant SVT qualifié ; les deux PDF restent DRAFT jusque-là | Direction pédagogique |
| M-1 | Validation Maths Seconde/Première (BO n°14 du 2 avril 2026) | ❌ | Revue écrite des modules Maths Seconde et Première révisés | Direction pédagogique |
| M-1 bis | Validation contenu 3e (nouveau, 2026-07-24) | ❌ | Revue écrite des modules 3e (Mathématiques, Français), même exigence que M-1 | Direction pédagogique |
| O-1 | Salles | ✅ RÉSOLU | 2 salles, rôles abstraits, grille actée pour publication (`GO_LIVE_CHECKLIST.md` #4) | — |
| O-2 | Paiement et reçu | ❌ | Parcours d'encaissement, rapprochement et reçu testés | Direction des opérations |
| J-1 | Annulation/remboursement | ❌ | Conditions et CGV approuvées | Direction et conseil juridique |
| J-2 | Confidentialité/rétention | ❌ | Notice, finalités, durées et droits validés | Responsable confidentialité |
| Q-1 | Téléchargements | ❌ | Manifestes, liens, poids, checksums et contrôle E2E final verts | Qualité documentaire |
| Q-2 | Téléphone, WhatsApp, formulaires | ❌ | Parcours de contact testés sans collecte excessive | Communication et technique |
| C-1 | Manuels/remise annuelle | ❌ | Conditions, stock, éligibilité et non-cumul validés ; avantages masqués jusque-là | Direction commerciale |
| C-2 | Date de lancement | ❌ | Date écrite par le propriétaire ; J1…J29 sont calculés depuis cette date | Propriétaire |
| D-5 | Autorisation de publication | ❌ | GO écrit, daté, rattaché au SHA exact | Propriétaire |

Les seuls gates humains actuellement validés sont la capacité et les tarifs.

~~R2-bis — Seconde : retrait de 2 SKU déjà approuvés (Physique-Chimie/Informatique-SNT)~~ — n'est plus un gate ouvert. **TRANCHÉ le 2026-07-24** par arbitrage direction définitif (Seconde stage = Maths + Français uniquement, grille du 24/07 fait foi) ; voir R2 ci-dessus pour le détail et la preuve technique.

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

**Mise à jour 2026-07-24 (round 2) :** l'incohérence Seconde détectée par `pre-rentree-2026-full-coherence.test.ts` a été traitée comme bloquante (étanchéité stages, pas dette commerciale) et résolue par l'arbitrage direction ci-dessus. Il ne reste **aucune incohérence technique ouverte** — chaque ligne restante de ce document requiert une décision ou une preuve humaine (pédagogie, date de lancement, GO écrit), jamais un nouveau commit sans cette décision préalable. Voir `GO_LIVE_CHECKLIST.md` pour le détail des tests et le statut release à jour.

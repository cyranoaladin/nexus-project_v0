# Reconstruction évidence-first du référentiel « parcours candidat individuel » (P1→P12)

**STATUS = DRAFT_RECONSTRUCTED_FROM_EVIDENCE — NOT_DIRECTION_APPROVED**

> Ce document n'est PAS le brief original. Il ne le remplace pas et ne prétend pas le retrouver. C'est une reconstruction, par preuve, de tout ce qui peut être établi sur la taxonomie P1→P12 à partir des artefacts réellement accessibles dans ce dépôt (fichiers, historique git complet, worktrees voisins, PR/issues GitHub). Toute case non sourcée reste marquée `ABSENT` ou `AMBIGU` — jamais comblée par une supposition. Aucun code (`ParcoursType`, `ProfilCandidat`, `genererCarteExamen`, migration Prisma, logique conditionnelle P1→P12) n'a été écrit pour produire ce document.

---

## 1. Sources inspectées

- `docs/audit-devis-candidats-libres.md` — lu intégralement (contexte de cette conversation).
- `docs/superpowers/plans/2026-08-23-lot1-socle-reglementaire.md` — lu intégralement, exécuté (Lot 1 terminé avant ce document).
- `docs/audits/candidat-individuel-production-release-2026-08-23.md` — texte intégral récupéré.
- PR GitHub #160 — corps complet récupéré (`gh pr view 160`).
- `git log --all` avec recherche pickaxe (`-S`) sur `ParcoursType` et `ProfilCandidat` — couvre toutes les branches, y compris commits ultérieurement supprimés d'une branche mais encore atteignables.
- `git worktree list` puis grep de chaque worktree listé, en particulier `.worktrees/candidate-offer-consistency`.
- `gh pr list` / `gh issue list` avec recherche plein texte.
- `lib/quotes/*.ts`, `lib/exams/*.ts`, `prisma/schema.prisma`, `e2e/*.spec.ts`, `docs/decisions/`, `docs/adr/`, `docs/missions/`, `docs/specs/`, `docs/archive/`, `docs/audits/`, `docs/QUESTIONS_OPEN.md` — grep ciblé.

Recherche exécutée par un agent dédié en lecture seule ; aucune modification produite par cette recherche.

## 2. Brief original recherché mais non retrouvé

**Confirmé : le texte source n'existe nulle part dans ce dépôt.** Ni sous la numérotation `brief §X.Y` citée par l'audit (§2.8, §2.9, §6.6, §8, §12, §14, §15), ni sous une autre forme, dans l'arbre de travail actuel, dans l'historique git complet (toutes branches, y compris commits orphelins atteignables), ou dans les worktrees voisins.

Trois faits renforcent cette conclusion plutôt que de simplement la répéter :

1. **Confirmation indépendante antérieure.** Le corps de la PR #160 (mergée le 2026-08-22, la veille de l'audit, par une session différente qui a construit le moteur de base) déclare déjà explicitement : *« le texte source du cahier des charges avec cette numérotation n'est pas disponible dans ce dépôt/session pour en vérifier le contenu exact attendu. »* — deux sessions indépendantes, à un jour d'intervalle, arrivent à la même conclusion sans se citer l'une l'autre.
2. **Les chaînes `ParcoursType` et `ProfilCandidat` n'existent dans git QUE depuis le commit de cette session-ci** (`fe99881ba`, qui a committé l'audit et le plan Lot 1 eux-mêmes — ces deux documents étaient `untracked` depuis le début de cette conversation). Autrement dit, je ne peux pas vérifier, par l'historique, que la session qui a écrit l'audit citait fidèlement un document tiers réel : je n'ai que sa paraphrase, jamais la source.
3. **Deux numérotations distinctes et non réconciliées coexistent.** L'audit cite un « brief §X.Y » (notation décimale : §2.8, §6.6…). Le code déjà en place (`lib/quotes/*.ts`) cite un « CDC §N » (notation entière : §6 à §68, cahier des charges). Là où les deux se recoupent numériquement (§12), le contenu ne correspond pas : l'audit dit *« 12 tests dédiés »* (`docs/audit-devis-candidats-libres.md:135`), le code dit *« hardcoded (CDC §12/§13) »* à propos de ne jamais coder en dur une donnée réglementaire (`lib/quotes/exam-profile.ts:4`). Ce ne sont probablement pas le même référencement — je ne peux donc pas utiliser l'un pour valider l'autre.

## 3. Matrice de preuves

| # | Élément | Exigence observée | Source exacte | Statut |
|---|---|---|---|---|
| 1 | Référentiel « 12 parcours P1→P12 » | Doit exister, remplacer le modèle actuel (candidat primo-inscrit générique) | `docs/audit-devis-candidats-libres.md:24,115` | EXPLICITE *(dans l'audit — mais l'audit lui-même est une paraphrase non vérifiable d'un brief introuvable)* |
| 2 | `ParcoursType` comme type de données distinct de l'offre commerciale | Un type/enum doit exister, en amont du calcul tarifaire | audit lignes 115, 138 ; Lot 1 plan, Goal | DÉDUIT_MÉCANIQUEMENT |
| 3 | P5 = redoublant, conservation de note à coefficient divergent entre session d'obtention et session de représentation | Cité nommément | audit `:172` ; Lot 1 plan, préambule Task 8 | EXPLICITE *(cohérent entre les deux documents secondaires, mais tous deux non vérifiables contre l'original)* |
| 4 | P6 = lié à P5, sans description propre | `genererCarteExamen` pour « P5/P6 » cité ensemble | Lot 1 plan, section finale « Ce qui reste à arbitrer », point 2 | AMBIGU |
| 5 | P7/P8/P11 = bascule scolaire / dispenses titulaire / second groupe | L'ordre des 3 schémas construits dans Task 6 correspond à l'ordre des 3 labels du titre de son bloc de test | Lot 1 plan, Task 6, titre `describe` + contenu | DÉDUIT_MÉCANIQUEMENT *(association par ordre d'écriture, jamais nommée terme à terme)* |
| 6 | P2 / P3-bloqué / P5 = scénarios E2E prévus au Lot 6 | Cités comme cible de tests futurs, sans aucune définition | audit `:192` (tableau Lot 6) | EXPLICITE quant à l'existence des labels ; ABSENT quant à leur définition |
| 7 | P3 = bac accéléré (dérogation article 3, même session) | Aucune source ne nomme « P3 » ainsi ; recoupement de 3 indices faibles : (a) « P3-bloqué » existe comme label de test, (b) une fonction `checkBacAccelereEligibility` avec logique `ELIGIBILITY_REQUIRES_HUMAN_REVIEW` existe déjà, (c) le seul autre dispositif de dérogation cité dans tout le corpus est « bac en 1 an » (article 3) | audit `:` (référentiel « incluant déjà l'article 3 ») ; `lib/quotes/exam-profile.ts` | DÉDUIT_MÉCANIQUEMENT, confiance MOYENNE seulement |
| 8 | P1, P4, P9, P10, P12 | Aucune trace, aucune définition, aucun nom, nulle part | Recherche exhaustive (agent dédié) | ABSENT |
| 9 | « Amélioration de notes », « changement de spécialité », « étalement plurisessions » comme catégories de parcours manquantes | Citées comme catégories non modélisées, **jamais associées à un numéro P** | audit `:24` | EXPLICITE quant à la catégorie ; ABSENT quant au numéro P |
| 10 | Aucun test E2E `P2`/`P3-bloqué`/`P5` n'existe déjà dans `e2e/` | Ces labels décrivent un travail futur, pas un scaffold déjà présent | Recherche exhaustive dans `e2e/` | ABSENT (confirmé, pas seulement supposé) |
| 11 | « brief §X.Y » vs « CDC §N » | Deux numérotations distinctes, non réconciliées, contradictoires sur §12 | audit vs `lib/quotes/exam-profile.ts:4` | AMBIGU / CONTRADICTOIRE |

## 4. Distinction parcours réglementaire vs offre commerciale

Confirmée et respectée dans tout ce document : `ParcoursType` doit décrire une **situation académique et réglementaire**, jamais l'une des 6 offres commerciales actuelles (`libre-pilotage`, `libre-sur-mesure`, `premiere-libre-cap-anticipees`, `premiere-libre-renforcee`, `terminale-libre-focus-bac`, `terminale-libre-integrale`). Le sens du pipeline est :

```
ProfilCandidat → ParcoursType (résolu, pas saisi directement) → CarteExamen → besoins pédagogiques → modules → offre/scénario → tarif
```

jamais l'inverse. Ce sens est cohérent avec ce que Lot 1 a déjà construit (le référentiel réglementaire ne connaît aucun prix) mais **la question de savoir si `ParcoursType` est saisi par la famille dans le wizard ou calculé par un résolveur à partir des champs bruts du profil reste ouverte** — voir §10.

## 5. Taxonomie candidate P1→P12

| ID | Nom proposé | Situation | Conditions d'entrée | Contraintes | Sources | Confiance |
|---|---|---|---|---|---|---|
| P1 | *(hypothèse)* Primo-candidat, cycle de 2 ans | Candidat individuel non redoublant, s'inscrit en première puis se présente en terminale | Aucune note antérieure, aucune conservation | — | audit `:24` (« le système actuel modélise implicitement un seul cas primo-candidat, cycle de 2 ans ») — **aucun numéro P ne lui est explicitement attaché nulle part** | FAIBLE — DÉCISION_DIRECTION_REQUISE |
| P2 | — | — | — | — | Aucune | ABSENT — DÉCISION_DIRECTION_REQUISE |
| P3 | *(hypothèse)* Bac accéléré (bac en 1 an, article 3) | Anticipées + terminales la même session | Dérogation article 3 ; `autoCheckable` / `ELIGIBILITY_REQUIRES_HUMAN_REVIEW` déjà codés Lot 1 | Éligibilité parfois auto-vérifiable, sinon revue humaine | audit (référentiel art. 3) ; `checkBacAccelereEligibility` ; label « P3-bloqué » au Lot 6 | MOYENNE — DÉDUIT_MÉCANIQUEMENT |
| P3-bloqué | Bac accéléré — cas non éligible | Sous-cas de P3, éligibilité échouée | `ELIGIBILITY_REQUIRES_HUMAN_REVIEW = true` | Bloque la recommandation automatique | audit `:192` ; logique déjà codée | MOYENNE |
| P4 | — | — | — | — | Aucune | ABSENT — DÉCISION_DIRECTION_REQUISE |
| P5 | Redoublant, conservation de note à coefficient inter-session divergent | Repasse une session ultérieure en conservant une note obtenue sous une session à coefficients différents (ex. Grand Oral 10→8) | Note conservée ≥10/20, valable 5 sessions (codé Lot 1) | Coefficient de la note conservée = `À_VERIFIER` (fail-closed déjà codé, `resolveConservedNoteCoefficient`) | audit `:172` (§5 D6) ; Lot 1 plan Task 8 | MOYENNE-HAUTE — le plus solidement cité du corpus, mais toujours non vérifiable contre l'original |
| P6 | *(hypothèse non sourcée)* Amélioration de notes | Hypothèse de travail seulement — catégorie citée à part dans l'audit sans numéro, simplement adjacente à P5 dans le plan Lot 1 | — | — | Lot 1 plan (« P5/P6 » cités ensemble sans définir P6) ; audit `:24` liste « amélioration de notes » séparément, sans numéro | FAIBLE — DÉCISION_DIRECTION_REQUISE |
| P7 | Bascule scolaire → individuel | Élève scolarisé basculant en cours de cycle ; deux branches : conservation ou renonciation des moyennes de première | Choix déclaratif, définitif | Branche « conservation » : ponctuelles réduites au programme de terminale. Branche « renonciation » : programme complet du cycle terminal + 1 ponctuelle sur le programme de première de la spécialité non poursuivie | audit `:24` (« bascule scolaire→libre ») ; Lot 1 (`basculeScolaireVersIndividuel`, déjà codé avec ces 2 branches exactes) | MOYENNE — association par ordre, jamais nommée terme à terme |
| P8 | Titulaire du bac déjà diplômé | Candidat déjà titulaire déclarant des dispenses obtenues | Déclaratif (arrêté du 14 mai 2020) | Périmètre facturable réduit en conséquence (`perimetre: 'declaratif'`, déjà codé Lot 1) | audit `:24` (« titulaire déjà diplômé ») ; Lot 1 (`dispensesTitulaireBac`) | MOYENNE — idem P7 |
| P9 | — | — | — | — | Aucune | ABSENT — DÉCISION_DIRECTION_REQUISE |
| P10 | — | — | — | — | Aucune | ABSENT — DÉCISION_DIRECTION_REQUISE |
| P11 | Second groupe (rattrapage) | Épreuves orales de rattrapage | Moyenne entre 8 et 10/20 | 2 disciplines au choix parmi les épreuves du premier groupe, fenêtre très courte | audit `:24` (« second groupe ») ; Lot 1 (`secondGroupe`, moyenneMin=8/moyenneMax=10/nombreDisciplines=2) | MOYENNE — idem P7/P8 |
| P12 | — | — | — | — | Aucune | ABSENT — DÉCISION_DIRECTION_REQUISE |

**Catégories citées mais sans numéro P assignable** (ne pas les forcer dans une case vide ci-dessus — ce serait inventer) : *changement de spécialité*, *étalement plurisessions* (les deux citées `audit :24`).

## 6. `ProfilCandidat` — schéma minimal proposé

Construit uniquement à partir de champs déjà justifiés par du code existant (Lot 1, `lib/quotes/schemas.ts`) ou par une catégorie explicitement citée dans l'audit. Aucun champ « au cas où ».

| Champ | Type | Obligatoire | Utilité | Parcours distingués | Source |
|---|---|---:|---|---|---|
| `level` | enum (`premiere`/`terminale`) | oui | Niveau du candidat | tous | `SituationInput` existant |
| `examSession` | Int | oui | Session réglementaire visée | tous ; central pour P5 (session de représentation) | `SituationInput` existant + Lot 1 (`assertSessionSellable`) |
| `specialites` | `[Subject, Subject]` | oui | 2 spécialités conservées en terminale | tous | `SituationInput` existant |
| `specialiteAbandonnee` | `Subject?` | non | Spécialité abandonnée fin de première | tous (terminale) | `SituationInput` existant |
| `langueA` / `langueB` | `Subject?` | non | LVA/LVB si connues | tous | `SituationInput` existant |
| `modalite` | enum A/B | oui | Modalité de passation des ponctuelles | coefficients divergent selon modalité (Lot 1) | audit (« modalités A/B ») ; déjà présent au niveau épreuve dans `bac-general-2027.json` |
| `estRedoublant` | boolean | oui | Distingue primo-candidat de redoublant | P1 vs P5/P6 | audit `:24` (« redoublement ») |
| `notesConservees` | `{epreuveId, note, sessionObtention}[]?` | non | Notes conservées avec leur session d'origine, pour `resolveConservedNoteCoefficient` (Lot 1) | P5 | audit §5 D6 ; fonctions déjà codées Lot 1 |
| `estTitulaireBacDejaObtenu` | boolean | oui | Distingue P8 | P8 | audit `:24` ; Lot 1 (`dispensesTitulaireBac`) |
| `provenance` | enum + `brancheBascule?` (`conservation_moyennes_premiere`/`renonciation_moyennes_premiere`) | oui pour P7 | Distingue P7 | P7 | Lot 1 (`basculeScolaireVersIndividuel`, 2 branches déjà en enum) |
| `moyenneRattrapage` | `Int (0-20)?` | non — seulement si second groupe | Distingue P11 | P11 | Lot 1 (`secondGroupe`, bornes déjà codées) |
| `optionsTerminale` | `string[]` | non | Options choisies, déjà validées par `lib/exams/options.ts` | tous | Lot 1 (`validateOptionsSelection`, déjà codé) |

**Explicitement non ajouté, faute de source** : un champ d'âge/date de naissance. Le terme « 20 ans » figurait dans la liste de recherche fournie, ce qui suggère qu'une condition d'âge existe quelque part dans la réglementation générale (peut-être liée au statut CNED ou à une condition d'inscription IFT), mais **aucune règle d'âge précise n'a été retrouvée dans le corpus disponible à ce dépôt**. `checkBacAccelereEligibility` prend aujourd'hui un sac de réponses génériques (`EligibilityAnswers`, `Record<string, boolean>`) plutôt qu'un champ d'âge structuré — l'âge pourrait déjà être une de ces réponses non structurées, à confirmer avant de créer un champ dédié.

**Note de conception** : `demandeConservationMention` n'est pas un champ séparé — il se déduit de `notesConservees.length > 0` (la perte de mention, déjà codée Lot 1 via `isMentionEligible`, s'applique dès qu'une conservation est demandée). Ajouter une colonne redondante violerait DRY sans bénéfice.

## 7. Invariants proposés

| # | Invariant | Statut | Source |
|---|---|---|---|
| 1 | Un profil ne doit résoudre qu'à un seul `ParcoursType` à la fois (pas de recouvrement silencieux, ex. redoublant qui bascule aussi depuis le scolaire) | AMBIGU — aucune règle de priorité trouvée | — |
| 2 | Éligibilité au bac accéléré (P3/P3-bloqué) : `autoCheckable` / `ELIGIBILITY_REQUIRES_HUMAN_REVIEW` | Déjà codé | `lib/exams/catalog.ts checkSameSessionEligibility` |
| 3 | Conservation de notes (P5) : seuil ≥10/20, valable 5 sessions | Déjà codé Lot 1 | `noteConservation` |
| 4 | Coefficient d'une note conservée en cas de divergence inter-session : fail-closed vers révision humaine | Déjà codé Lot 1 | `resolveConservedNoteCoefficient` |
| 5 | Perte de mention si conservation demandée | Déjà codé Lot 1 | `isMentionEligible` |
| 6 | Coefficients modalité A/B, HG/LVA/LVB/EMC encore `À_VERIFIER` | Déjà codé (sentinelle) Lot 1 | `coefficientParModalite` |
| 7 | EPS hors modalité A/B (épreuve ponctuelle terminale unique) | Déjà codé Lot 1 | test T-modalite (Task 2) |
| 8 | Dispense de partie pratique NSI/PC/SI/SVT | Déjà codé Lot 1 | `dispensePartiePratique` |
| 9 | Session réglementaire inconnue ou non vendable = fail closed | Déjà codé Lot 1 (et durci ce jour, cf. gaps de la revue de code) | `assertSessionSellable` |
| 10 | Tout `ParcoursType` non résolvable avec certitude (P1, P2, P4, P6, P9, P10, P12 tant qu'ils restent `DÉCISION_DIRECTION_REQUISE`) doit refuser de générer une carte d'examen/un devis plutôt que de deviner un parcours par défaut | Proposé, pas encore codé — mais c'est le même patron fail-closed que 2, 4 et 9 ci-dessus | Cohérence avec le reste du Lot 1 |

## 8. Cas de test connus (contraintes)

| Cas audit | Profil déduit | Parcours attendu | Parcours draft | Conforme ? |
|---|---|---|---|---|
| Redoublant conservant Grand Oral coef 10→2027 | `estRedoublant=true`, `notesConservees=[{grand-oral, 2026}]`, `examSession=2027` | P5 (cité explicitement) | P5 | Conforme — seul cas du corpus avec une définition et un exemple concrets |
| E2E « P2 » (Lot 6) | Aucun profil déductible | P2 | Aucun | Non conforme — impossible à construire sans définition |
| E2E « P3-bloqué » (Lot 6) | Bac accéléré non éligible (déduction) | P3-bloqué | P3-bloqué | Partiellement conforme — inféré, non confirmé |
| Bascule scolaire, branche conservation | `provenance=bascule`, `brancheBascule=conservation_moyennes_premiere` | P7 (déduit par ordre) | P7 | Partiellement conforme |
| Bascule scolaire, branche renonciation | `provenance=bascule`, `brancheBascule=renonciation_moyennes_premiere` | P7 (déduit par ordre) | P7 | Partiellement conforme |
| Titulaire du bac | `estTitulaireBacDejaObtenu=true` | P8 (déduit par ordre) | P8 | Partiellement conforme |
| Second groupe | `moyenneRattrapage ∈ [8,10]` | P11 (déduit par ordre) | P11 | Partiellement conforme |

**Un seul cas (P5) est conforme avec certitude.** Les 5 suivants reposent sur une inférence mécanique acceptée comme raisonnable mais non prouvée. Aucun cas de test n'existe pour P1, P2, P4, P6, P9, P10, P12.

## 9. Ambiguïtés

- Seul P5 dispose d'une définition et d'un exemple concrets directement cités.
- P3/P3-bloqué, P7, P8, P11 reposent sur un recoupement d'indices faibles ou un ordre d'écriture, jamais une déclaration terme-à-terme.
- P1, P2, P4, P6, P9, P10, P12 : aucune définition, même partielle.
- Deux catégories citées (« changement de spécialité », « étalement plurisessions ») manquent d'un numéro alors qu'il doit statistiquement en rester au moins 3 à combler — impossible de décider laquelle va où sans invention.
- Deux numérotations documentaires non réconciliées (« brief §X.Y » vs « CDC §N ») — peut-être deux documents distincts, peut-être une citation erronée dans l'un des deux artefacts précédents.
- Le nombre « 12 » lui-même n'est jamais justifié en soi (aucune preuve qu'il ne s'agisse pas d'un arrondi ou d'une approximation) — retenu ici uniquement parce que c'est la seule donnée disponible.

## 10. Décisions de direction requises

1. Fournir ou confirmer la définition de **P1, P2, P4, P6, P9, P10, P12**.
2. Confirmer si **P1** = primo-candidat, cycle de 2 ans (hypothèse la plus probable, non prouvée).
3. Confirmer si **P3/P3-bloqué** = bac accéléré, article 3 (probable, non prouvé).
4. Confirmer si **P6** = amélioration de notes, et en quoi il diffère structurellement de P5.
5. Confirmer l'association par ordre **P7/P8/P11** = bascule / titulaire / second groupe (indice faible en soi).
6. Décider où placer « changement de spécialité » et « étalement plurisessions », ou confirmer qu'ils sont hors périmètre des 12.
7. Clarifier la relation entre « brief §X.Y » et « CDC §N » — même document, deux documents, ou citation erronée ?
8. Décider si `ParcoursType` est **saisi directement** par la famille dans le wizard, ou **résolu** par un moteur à partir des champs bruts de `ProfilCandidat` (proposition de ce document, cohérente avec le pipeline `ProfilCandidat → ParcoursType` explicité en consigne, mais non confirmée par ailleurs).
9. Confirmer si une condition d'âge (« 20 ans ») existe réellement et sous quelle forme — aucune preuve trouvée dans ce dépôt.

## 11. Proposition de version canonique future

Une fois les points du §10 tranchés — par fourniture du texte source, ou par décision produit fraîche assumée comme telle (pas comme une « reconstruction » de l'existant) — verser la taxonomie confirmée dans un fichier canonique versionné et sourcé, sur le modèle de `data/pricing.canonical.json` (ex. `docs/candidat-individuel/parcours-p1-p12.CANONICAL.md` ou un JSON+Zod dans `lib/exams/` si elle doit être machine-consommable comme le reste du référentiel réglementaire). Lot 2 (`ParcoursType`, `ProfilCandidat`, migration Prisma) ne doit démarrer qu'après cette version canonique — pas avant.

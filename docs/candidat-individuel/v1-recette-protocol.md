# Candidat individuel — V1 internal human recette (T5A)

**Baseline** : `fb2ee155f` (T4 freeze + micro-closeout). **Environnement** : DB Postgres jetable
(`nexus-postgres-test`, tmpfs, données synthétiques uniquement), `pricing.candidatIndividuelPipeline.state`
forcé à `ACTIVE_INTERNAL` en test (jamais public). Aucun client réel, aucun email réel, aucun paiement réel,
aucune URL production.

`PUBLIC_RELEASE reste NO_GO`. Ce document ne contient AUCUN verdict humain — chaque champ humain est
`PENDING_HUMAN_REVIEW` jusqu'à ce que la direction le remplace elle-même.

## T5R — Remediation des blockers (§9)

**Baseline T5R** : `0cbc87212`. Historique T5A préservé intégralement ci-dessous, non supprimé.

| Finding | Statut | Commit | Tests | Avant / Après |
|---|---|---|---|---|
| `RECETTE_FINDING_1` (EAF_ECRIT_ORAL bloqué par EAF_DESCRIPTIF) | `RESOLVED` | `7c2a9b8db` | `pipeline.test.ts`, `catalogue.test.ts`, `t3a-catalogue-approval-isolation.test.ts`, `t3c-eaf-recapitulatif.test.ts`, `t4-v1-release-freeze.test.ts`, golden snapshots (P4/P10), `t5a-v1-recette.test.ts` (R1a) | Avant : profil PREMIERE avec eaf-oral dû → `DIRECTION_APPROVAL_REQUIRED`, aucune Quote possible. Après : `READY`, `MOD_EAF_ECRIT_ORAL` facturé normalement ; `MOD_EAF_DESCRIPTIF` toujours jamais une ligne (fail-closed préservé). Mécanisme : `isPendingModuleBlocking` (lib/quotes/catalogue.ts) — un module en attente ne bloque plus que sa propre sélection si son épreuve est déjà couverte par un module frère approuvé. |
| `RECETTE_FINDING_2` (dispenses jamais traitées pour PREMIERE) | `RESOLVED` | `7c2a9b8db` | `pipeline.test.ts` (tests A-E dédiés) | Avant : `lib/exams/carte.ts` retournait avant la boucle `dispensesDeclarees` pour tout profil PREMIERE — dispense silencieusement ignorée. Après : la boucle s'exécute uniformément pour tous les niveaux, après les épreuves du profil. |
| `RECETTE_FINDING_3` (aucune action staff de publication famille) | `RESOLVED` | `628e07496` | `emission-guard.test.ts` (`collectQuotePromotionBlockers`), `t5r-quote-publish.test.ts` (route réelle : auth, 404, promotion valide, idempotence, lien signé avant/après, marge BLOCKED refusée) | Avant : seule une écriture Prisma directe en test atteignait `regulatoryMaturity = CARTE_VALIDATED_DEFINITIVE` — interdit en production. Après : `POST /api/assistante/candidat-individuel/quotes/:quoteId/publish`, authentifié/autorisé/validé serveur/idempotent/audité. |
| `RECETTE_FINDING_4` (PDF sans prix par ligne) | `RESOLVED` (décision direction appliquée) | `642624f68` | `pdf-adapter.server.test.ts` (unitaire), `t5r-quote-publish.test.ts` (PDF réel, extraction poppler, réconciliation) | Avant : « Inclus dans le parcours » n'affichait que le libellé/modalité, jamais de prix. Après : chaque ligne commerciale affiche son montant persisté ; réconciliation `sum(lineTotal) = grandTotal` prouvée sur un devis réel amorti (acompte + mensualités) ; bug de normalisation (`normalizeQuoteData` supprimait silencieusement le nouveau champ) trouvé et corrigé grâce au test DB — un test DTO seul ne l'aurait pas détecté. |
| `RECETTE_FINDING_5` (captures d'écran) | `PENDING_T5B_CAPTURE` | — | — | Non traité par ce lot (instruction explicite : ne pas « résoudre » par un test unitaire) — reporté à la prochaine recette T5B, qui devra capturer un vrai parcours navigateur (UI staff + vue famille signée). |

## Verrou public (§2)

`lib/config/schemas.ts` bloque en dur le passage de `pricing.candidatIndividuelPipeline.state` à
`ACTIVE_PUBLIC`/`ACTIVE_PUBLIC_PERCENTAGE` (invariant 6, non modifié par T5A — confirmé par lecture directe
du code avant toute recette, `__tests__/lib/quotes/pipeline-flag.test.ts` toujours vert).
**`PUBLIC_PIPELINE_STATE = LOCKED`** pendant tout T5A.

## Corpus technique (§4-§10) — `__tests__/database/t5a-v1-recette.test.ts`

Real Postgres, real pipeline, real route staff (`createQuotePOST`), real PDF (poppler), real mécanisme de
lien signé. Aucun override de prix, aucune fixture de catalogue.

### R1 — parcours V1 complet standard

**Finding avant preuve** : aucun profil unique ne peut réunir EAF_ECRIT_ORAL/EAM (anticipées) ET
EDS1/EDS2/PHILOSOPHIE/GRAND_ORAL (tronc terminal) — `lib/exams/carte.ts::buildAnticipeeLine` ne rend les
anticipées `A_PRESENTER` (facturables) que pour un profil PREMIERE ou le parcours P3 (bac accéléré, bloqué
en dur — voir R4) ; pour tout candidat TERMINALE "continu", elles sont `RECONDUITE` (exclues). R1 a donc été
scindé en deux sous-scénarios réglementairement valides et complémentaires, chacun mené jusqu'à Quote →
PDF → tentative de lien signé.

- **R1a** (PREMIERE, anticipées) — **BLOCKER** : voir RECETTE_FINDING_1 et 2 ci-dessous. Techniquement
  `FAIL` pour son objet initial (EAF_ECRIT_ORAL+EAM ensemble) ; les deux causes racines sont prouvées par
  test contre l'API réelle.
- **R1b** (TERMINALE, tronc) — `PASS` technique. EDS1+EDS2+PHILOSOPHIE+GRAND_ORAL+Pilotage, Quote créée
  (201), 5 lignes prix > 0, PDF généré (200). Artefacts : `R1b-pdf.pdf`, `R1b-summary.json`.

### R2 — multi-matières headcount (LVA=1/LVB=2/SPECIALITE_ABANDONNEE=3)

`PASS` technique. LVA→SOLO (720 TND = 180×4h), LVB→DUO (360 TND = 90×4h), spécialité abandonnée→GROUPE
(250 TND), chacune 4h/mois, aucune application croisée d'effectif, `marginGate=MARGIN_OK`, avertissement
« ne prépare aucune épreuve du bac » présent dans le PDF. Artefacts : `R2-pdf.pdf`, `R2-summary.json`.

### R3 — GROUP_PENDING

`PASS` technique. Effectif LVB volontairement omis → HTTP 422, `groupState=GROUP_PENDING`, **aucune** Quote
persistée (`prisma.quote.count()===0`), donc aucun PDF ni lien signé possible — le blocage est prouvé par
l'absence même de ligne, pas par un contournement testé et refusé. Artefact : `R3-summary.json`.

### R4 — P3 accéléré (dérogation même session)

`PASS` technique. Profil avec `p3EligibiliteAudit` confirmé (motif `age20`) → jamais 201, aucune Quote
persistée. Le blocage (`blockingReasonCodes` → `necessiteVerificationHumaine=true`, inconditionnel, sans
exception codée) est structurel, pas un simple gate contournable. Artefact : `R4-summary.json`.

### R5 — DEFERRED / fail-closed

`PASS` technique — réutilise intégralement `__tests__/architecture/t4-v1-release-freeze.test.ts` (12/12
verts sur cette baseline), qui prouve déjà, contre le pipeline réel, qu'aucun des 8 modules + 2 services
différés ne peut atteindre `READY`. **Vérification UI staff (§9)** : `CandidatIndividuelWorkspace.tsx` ne
présente aucun sélecteur/catalogue d'offres cliquables — `optionsTerminale` est un champ texte libre, et
c'est la seule voie de saisie d'options ; il n'existe structurellement aucune UI de type « menu d'offres
activables » où un élément différé pourrait apparaître comme proposable. Le catalogue ne modifie rien pour
cette preuve.

### R6 — cohérence artefact famille

`PASS` technique, avec une réserve documentée (voir RECETTE_FINDING_3). DB ↔ PDF ↔ vue famille signée
comparés sur la Quote de R2 : chaque libellé de ligne apparaît dans le PDF, le total apparaît (formaté),
la vue signée relit `grandTotal`/lignes identiques sans recalcul. Artefact : `R6-coherence.json`.
**Réserve** : la promotion vers un état visible-famille (`regulatoryMaturity = CARTE_VALIDATED_DEFINITIVE`)
n'a aujourd'hui aucune action staff réelle — seule une écriture Prisma directe (technique de test déjà
établie par `__tests__/database/quote-persistence.test.ts` et implicitement par le test T3A §12, qui ne
prouvait que le cas bloqué) permet de l'atteindre.

## RECETTE_FINDINGS

### RECETTE_FINDING_1 — `SEVERITY = BLOCKER`
**SCENARIO** : R1a (PREMIERE, EAF_ECRIT_ORAL+EAM)
**EXPECTED** : `MOD_EAF_ECRIT_ORAL` (INCLUDED_V1, `docs/candidat-individuel/v1-release-scope.md`) produit une
Quote finale quand un candidat PREMIERE a réellement besoin de préparer l'EAF oral.
**OBSERVED** : `HTTP 422`, `status: DIRECTION_APPROVAL_REQUIRED`, `pendingModuleIds` contient
`MOD_EAF_DESCRIPTIF` (DEFERRED_FROM_V1). `MOD_EAF_ECRIT_ORAL` et `MOD_EAF_DESCRIPTIF` partagent la même
épreuve `eaf-oral` ; dès qu'elle est `A_PRESENTER`, les deux modules deviennent sélectionnables
simultanément, et le second bloque tout le devis (`pipeline.ts` étape 6, gate antérieur à toute résolution
de prix). Confirmé pré-existant : le snapshot golden déjà committé
(`P4 — redoublement première`, `pipeline.golden.test.ts.snap`) documente exactement ce même résultat.
**EVIDENCE** : `__tests__/database/t5a-v1-recette.test.ts` (test « R1a finding »),
`R1a-FINDING-eaf-ecrit-oral-blocked.json`.

### RECETTE_FINDING_2 — `SEVERITY = BLOCKER` (compose avec le finding 1)
**SCENARIO** : R1a, hypothèse de contournement testée
**EXPECTED** : dispenser `eaf-oral` spécifiquement libère `MOD_EAM` seul (EAF_ECRIT_ORAL exclu par la même
dispense, mais EAM indépendant).
**OBSERVED** : sans effet — `lib/exams/carte.ts` retourne tôt pour tout profil `level === 'PREMIERE'` et
non bac-accéléré (ligne 458), **avant** que la boucle de traitement de `dispensesDeclarees` (ligne 506) ne
s'exécute jamais. Une dispense déclarée sur un profil PREMIERE est donc silencieusement ignorée — ni
rejetée, ni signalée. `MOD_EAM` reste bloqué exactement comme `MOD_EAF_ECRIT_ORAL`. Tracé exhaustivement :
aucune configuration de profil actuellement supportée (PREMIERE, TERMINALE continu, TERMINALE
redoublant/bascule, P3) ne permet à l'un ou l'autre d'atteindre `READY`.
**EVIDENCE** : `__tests__/database/t5a-v1-recette.test.ts` (test « R1a finding, part 2 »),
`R1a-FINDING-eam-also-blocked-dispense-ignored.json`.

### RECETTE_FINDING_3 — `SEVERITY = MAJOR`
**SCENARIO** : R6 (et implicitement R1/R2)
**EXPECTED** : un workflow staff réel permet de faire passer une Quote candidat-individuel à un état
visible-famille (lien signé).
**OBSERVED** : `lib/quotes/persistence.server.ts` documente explicitement que `createQuote` ne fixe jamais
`regulatoryMaturity` (reste `LEGACY_ESTIMATE_UNVERIFIED`) « jusqu'à une étape de revue staff explicite (non
construite par ce lot) ». Aucune route du dépôt n'écrit `CARTE_VALIDATED_DEFINITIVE` (recherche exhaustive
confirmée). La seule façon d'atteindre cet état, dans toute la suite de tests existante (T3A comme T5A), est
une écriture Prisma directe en test — jamais une action staff réelle. Le parcours « Quote → PDF → lien
signé » ne peut donc pas être exécuté de bout en bout depuis l'interface staff réelle aujourd'hui, pour
AUCUN élément (pas seulement les éléments différés).
**EVIDENCE** : commentaire sourcé dans `lib/quotes/persistence.server.ts` ; absence confirmée par recherche
exhaustive (`grep -rn "CARTE_VALIDATED_DEFINITIVE"`) ; `__tests__/database/t5a-v1-recette.test.ts` (R6).

### RECETTE_FINDING_4 — `SEVERITY = MINOR`
**SCENARIO** : R6 / checklist humaine D (Document)
**OBSERVED** : le PDF famille (`lib/quote/pdf.ts::drawOfferBox`) n'affiche jamais de prix par ligne — chaque
ligne du bloc « Inclus dans le parcours » ne montre que le libellé/modalité/volume ; seuls les totaux
agrégés (mensuel/annuel) et l'échéancier portent un montant. Comportement préexistant, déjà cohérent avec
tous les tests PDF T1-T4 (qui ne vérifient jamais de prix par ligne, seulement le wording de modalité) —
non introduit par ce lot. Signalé pour arbitrage humain (checklist D), pas comme un défaut technique.
**EVIDENCE** : `R1b-pdf.pdf`, `R2-pdf.pdf`, `R6-coherence.json`.

### RECETTE_FINDING_5 — `SEVERITY = MINOR`
**SCENARIO** : artefact pack (§13)
**OBSERVED** : les preuves techniques (DB, PDF réels, comparaison JSON) sont complètes. Aucune capture
d'écran de l'UI staff réelle ni de la vue famille n'a été produite dans cette passe — un parcours navigateur
complet (build + login + navigation) n'a pas été exécuté par souci de budget, la preuve technique par route
réelle étant jugée équivalente et suffisante pour la couche technique. Une capture visuelle reste utile pour
la revue humaine (critère F, UX staff) et pourrait être ajoutée séparément si la direction le demande.

## Artefact pack (§13)

Chemin : `/tmp/nexus-candidat-individuel-v1-recette-fb2ee155f/` (hors dépôt, données synthétiques
uniquement, jamais commité). Contenu : `R1b-pdf.pdf`, `R1b-summary.json`, `R2-pdf.pdf`, `R2-summary.json`,
`R3-summary.json`, `R4-summary.json`, `R6-coherence.json`,
`R1a-FINDING-eaf-ecrit-oral-blocked.json`, `R1a-FINDING-eam-also-blocked-dispense-ignored.json`.

## Checklist humaine (§11) — à remplir exclusivement par la direction

Pour chaque devis inspectable (R1b, R2), les critères suivants restent `PENDING_HUMAN_REVIEW` :

**A. Compréhension commerciale** — un parent comprend ce qui est proposé ; matières correctement nommées ;
volumes compréhensibles ; SOLO/DUO/GROUPE non trompeurs ; prix/totaux immédiatement compréhensibles.

**B. Terminologie** — aucune dénomination technique interne visible ; aucun `moduleId`/`pricingRuleId`
exposé ; wording réglementaire compréhensible ; avertissement spécialité abandonnée correctement formulé.

**C. Financier** — montant total plausible ; échéancier compréhensible ; aucun 0 TND commercial inattendu ;
aucune incohérence détail/total ; aucune marge/coût interne exposé.

**D. Document** — PDF lisible ; aucune coupure importante ; aucune ligne dupliquée ; aucune information
manquante (voir RECETTE_FINDING_4 — absence de prix par ligne, à statuer) ; statut brouillon/final non
ambigu.

**E. Vue signée** — contenu identique au devis ; accès fonctionne (mécanisme de test, voir
RECETTE_FINDING_3) ; pas d'information interne supplémentaire ; pas de possibilité visible de modifier le
devis.

**F. UX staff** — workflow suffisamment clair ; headcounts compréhensibles ; erreurs actionnables ; absence
de saisie par identifiant technique.

## Tableau final de recette (§12)

| SCENARIO | TECHNICAL_RESULT | ARTEFACTS | HUMAN_COMMERCIAL | HUMAN_FINANCIAL | HUMAN_PDF | HUMAN_SIGNED_VIEW | HUMAN_STAFF_UX | FINAL_HUMAN_VERDICT | COMMENTS |
|---|---|---|---|---|---|---|---|---|---|
| R1a | FAIL (voir findings 1 et 2) | R1a-FINDING-*.json | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | N/A | N/A | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | EAF_ECRIT_ORAL/EAM structurellement inatteignables aujourd'hui |
| R1b | TECHNICAL_PASS | R1b-pdf.pdf, R1b-summary.json | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | N/A (non promu) | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | Tronc terminal complet, 5 lignes |
| R2 | TECHNICAL_PASS | R2-pdf.pdf, R2-summary.json | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | N/A (non promu) | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | SOLO/DUO/GROUPE, marge OK |
| R3 | TECHNICAL_PASS | R3-summary.json | N/A | N/A | N/A | N/A | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | Blocage propre, aucune Quote |
| R4 | TECHNICAL_PASS | R4-summary.json | N/A | N/A | N/A | N/A | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | Blocage structurel P3 |
| R5 | TECHNICAL_PASS | (tests T4 réutilisés) | N/A | N/A | N/A | N/A | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | 10 éléments différés, aucune UI d'offre |
| R6 | TECHNICAL_PASS (réserve F3) | R6-coherence.json | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | N/A | PENDING_HUMAN_REVIEW | Promotion signed-view = écriture test uniquement |

**Seule la direction peut remplacer `PENDING_HUMAN_REVIEW` par `PASS`/`FAIL`/`PASS_WITH_RESERVATION`.**

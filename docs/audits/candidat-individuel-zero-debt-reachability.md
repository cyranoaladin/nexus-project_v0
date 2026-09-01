# Candidat individuel — reachability matrix, engine inventory, target architecture (Incrément 2)

**Statut : AUDIT, aucun refactor.** Ce document fige la matrice de reachability, l'inventaire des
moteurs concurrents, les autorités métier, les familles de paiement, la sémantique réelle du flag
`pricing.candidatIndividuelPipeline`, et l'architecture cible — comme prérequis à l'incrément 3+.
Aucune ligne de code produit n'a été modifiée pour produire ce document (hors le scanner
`__tests__/architecture/candidat-individuel-zero-debt-reachability.test.ts` qui verrouille les faits
ci-dessous contre toute dérive silencieuse).

Branche : `fix/candidat-individuel-zero-debt-final`. Toutes les citations sont `file:line` vérifiées
en lisant les fichiers en entier (pas d'échantillonnage), par trois passes de recherche indépendantes
plus vérification directe.

---

## 0. Les deux moteurs réels — cadrage indispensable avant la matrice

Il existe deux fonctions de recommandation/tarification, **pas symétriques en "présence dans le
runtime"** :

1. **`buildRecommendation`** (`lib/quotes/recommendation.ts:115`) — moteur LEGACY. **Réellement live
   en production**, sans aucune garde : c'est lui qui sert `/devis-bac` (le wizard public) ET la
   console staff legacy `/dashboard/assistante/devis`. Zéro dépendance au flag pipeline (§6).
2. **`buildCandidateQuoteRecommendation`** (`lib/quotes/pipeline.ts:275`) — moteur canonique
   carte-aware. **Flag-gated OFF par défaut** (`lib/quotes/pipeline-flag.ts:21-23`,
   `getOverrideOr(..., 'OFF')`) : tant qu'aucun ADMIN n'a explicitement positionné
   `pricing.candidatIndividuelPipeline.state >= ACTIVE_INTERNAL` en base (`BusinessConfig`), les 7
   routes `app/api/assistante/candidat-individuel/**` renvoient 403
   (`lib/quotes/candidat-individuel-guard.server.ts:17-30`). Il n'est donc "canonique" qu'au sens
   architectural (c'est le moteur cible), pas au sens "trafic réel servi aujourd'hui" — sauf activation
   explicite en `ACTIVE_INTERNAL` pour le staff (ce que le statut `ACTIVE_INTERNAL=YES` de ce dépôt
   signifie concrètement : le workspace staff est activé, pas le wizard public).

Toute analyse "code mort" par imports statiques seuls sous-estimerait ce point : le pipeline n'est
"vivant" qu'à la discrétion d'un ADMIN, jamais par défaut.

---

## 1. Matrice de reachability — FRONTEND → API → moteur

### 1.1 Pages

| Path | Rôle | Appelle | Moteur | Classe |
|---|---|---|---|---|
| `app/devis-bac/page.tsx` | Page marketing publique live hébergeant le wizard | `<DevisWizard/>` | `buildRecommendation` | **PUBLIC_CANDIDATE_RUNTIME** |
| `app/devis/[token]/page.tsx` | Vue famille par lien signé (toute origine) | `getQuoteForFamilyView(token)` (`lib/quotes/public-view.server.ts:26`) ; lien PDF ; `<AcceptQuoteButton>` | — (lecture seule) | **PUBLIC_CANDIDATE_RUNTIME** |
| `app/dashboard/assistante/candidat-individuel/page.tsx` | Entrée staff du workspace carte-aware, gate rôle + `isActiveForInternalStaff()` | `<CandidatIndividuelWorkspace/>` | `buildCandidateQuoteRecommendation` | **CANONICAL_CANDIDATE_RUNTIME** — `SANCTIONED_ENTRY_POINT` (`__tests__/architecture/lot5-catalogue-adapter-boundary.test.ts:38`) |
| `app/dashboard/assistante/candidat-individuel/wizard-preview/page.tsx` | Préview staff du FUTUR wizard public | `<PublicWizardPreview/>` | `buildCandidateQuoteRecommendation` | **MIGRATION_TARGET** — jamais lié depuis une page publique (commentaire propre du fichier, lignes 12-21) ; `SANCTIONED_ENTRY_POINT` (test file:39) |
| `app/dashboard/assistante/devis/page.tsx` | Console staff LEGACY (recherche lead, recommend, marge, envoi) | `<DevisWorkspace/>` | `buildRecommendation` | **PUBLIC_CANDIDATE_RUNTIME** (usage staff du moteur legacy — même famille que /devis-bac) |

### 1.2 Composants

| Fichier | Consommateurs live | API | Moteur | Classe |
|---|---|---|---|---|
| `components/quotes/DevisWizard.tsx` | `app/devis-bac/page.tsx` | `POST /api/quotes/recommend`, `POST /api/quotes` | `buildRecommendation` | **PUBLIC_CANDIDATE_RUNTIME** |
| `components/quotes/ScenarioCard.tsx` | `DevisWizard.tsx` + `PublicWizardPreview.tsx` (partagé) | — (UI pure) | — | **PUBLIC_CANDIDATE_RUNTIME** (consommateur primaire) |
| `components/quotes/AcceptQuoteButton.tsx` | `app/devis/[token]/page.tsx` | `POST /api/quotes/[id]/accept` | — | **PUBLIC_CANDIDATE_RUNTIME** |
| `components/dashboard/assistante/CandidatIndividuelWorkspace.tsx` | `app/dashboard/assistante/candidat-individuel/page.tsx` (+ e2e) | 6 routes `app/api/assistante/candidat-individuel/**` | `buildCandidateQuoteRecommendation` | **CANONICAL_CANDIDATE_RUNTIME** |
| `components/dashboard/assistante/PublicWizardPreview.tsx` | `.../wizard-preview/page.tsx` (+ e2e) | `POST /api/assistante/candidat-individuel/simulate` | `buildCandidateQuoteRecommendation` | **MIGRATION_TARGET** |
| `components/dashboard/assistante/DevisWorkspace.tsx` | `app/dashboard/assistante/devis/page.tsx` | `leads/search`, `/api/quotes*`, `/api/quotes/margin`, `/api/quotes/[id]/send`, `POST /api/assistante/quotes/pdf` | `buildRecommendation` | **PUBLIC_CANDIDATE_RUNTIME** |

`components/diagnostics/candidat-libre/**` (le "bilan"/diagnostic candidat-libre) : matché par le glob
`*candidat*` mais **hors chaîne pricing/quotes** — zéro import de `buildRecommendation` ou
`buildCandidateQuoteRecommendation`. Feature "sombre" documentée
(`docs/audits/candidat-individuel-final-closure.md:19-22`, verrouillée par
`__tests__/app/dashboard/candidat-libre-pages-dark.test.tsx`). Classe : **OTHER_PRODUCT_RUNTIME**.

### 1.3 API — `app/api/quotes/**` (moteur legacy, 8 routes + 1 route legacy PDF découverte)

| Route | Méthode | Guard | Rate-limit | Moteur | Écrit DB | Classe |
|---|---|---|---|---|---|---|
| `route.ts:65` | POST | conditionnel (`requireAuth` seulement si studentId/diagnosticId/existingContactLeadId) | `quotes-create` | `buildRecommendation` | **Oui** — `createQuote` | PUBLIC_CANDIDATE_RUNTIME |
| `route.ts:252` | GET | `requireAnyRole([ADMIN,ASSISTANTE])` | `quotes-history-read` | — | Non | PUBLIC_CANDIDATE_RUNTIME |
| `recommend/route.ts:32` | POST | aucun — public | `quotes-recommend` | `buildRecommendation` | Non | PUBLIC_CANDIDATE_RUNTIME |
| `margin/route.ts:29` | POST | `requireAnyRole([ADMIN,ASSISTANTE])` | `quotes-send` (tier partagé) | `buildRecommendation` + `computeMargin` | Non | PUBLIC_CANDIDATE_RUNTIME |
| `[id]/send/route.ts:18` | POST | `requireAnyRole([ADMIN,ASSISTANTE])` | `quotes-send` | — (transition statut) | Oui | PUBLIC_CANDIDATE_RUNTIME |
| `[id]/accept/route.ts:17` | POST | aucun — public, ownership via token | `quotes-accept` | — (transition statut) | Oui | PUBLIC_CANDIDATE_RUNTIME |
| `public/[token]/route.ts:15` | GET | aucun — public | `quotes-public-read` | — (lecture) | best-effort (consult) | PUBLIC_CANDIDATE_RUNTIME |
| `public/[token]/pdf/route.ts:42` | GET | aucun — public | `quotes-public-read` | — | Non | PUBLIC_CANDIDATE_RUNTIME |
| `leads/search/route.ts:18` | GET | `requireAnyRole([ADMIN,ASSISTANTE])` | `quotes-lead-search` | — | Non | PUBLIC_CANDIDATE_RUNTIME |
| `app/api/assistante/quotes/pdf/route.ts:72` *(hors périmètre initial, dépendance découverte)* | POST | `requireAnyRole([ADMIN,ASSISTANTE])` | `quotes-pdf` | — | Non | PUBLIC_CANDIDATE_RUNTIME — flux PDF legacy piloté côté client |

`app/api/quotes/route.ts` est aussi un `SANCTIONED_ENTRY_POINT` pour un canal **shadow-mode
uniquement** : lignes 169-181 exécutent `runShadowComparison`/`logShadowComparisonWithTimeout` derrière
`isShadowModeEnabled()`, jamais visible, jamais bloquant, jamais un Quote contractuel (vérifié par
`lot5-catalogue-adapter-boundary.test.ts:84-90`).

### 1.4 API — `app/api/assistante/candidat-individuel/**` (moteur canonique, 7 routes)

Toutes gardées par `requireInternalPipelineAccess()` = `requireAnyRole([ADMIN,ASSISTANTE])` **ET**
`isActiveForInternalStaff()` (403 fail-closed sinon).

| Route | Méthode | Moteur | Écrit DB | Classe |
|---|---|---|---|---|
| `profils/route.ts:16` (POST), `:37` (GET) | — | Non (POST: oui, nouvelle `ProfilCandidat`) | CANONICAL_CANDIDATE_RUNTIME |
| `profils/[id]/route.ts:16` (GET), `:26` (PATCH) | — | PATCH: oui | CANONICAL_CANDIDATE_RUNTIME |
| `profils/[id]/review/route.ts:14` | — | Oui (marqueur staff) | CANONICAL_CANDIDATE_RUNTIME |
| `profils/[id]/revision/route.ts:11` | — | Oui (nouvelle ligne, jamais mutation de l'ancienne) | CANONICAL_CANDIDATE_RUNTIME |
| `profils/[id]/quote/route.ts:50` | `buildCandidateQuoteRecommendation` + `resolveScenarioEffectiveGroupPricing` + `computeMargin` | Oui — `createQuote` (brouillon, `regulatoryMaturity` reste `LEGACY_ESTIMATE_UNVERIFIED`) | CANONICAL_CANDIDATE_RUNTIME — `SANCTIONED_ENTRY_POINT` |
| `quotes/[quoteId]/pdf/route.ts:38` | — (lecture snapshot) | Non | CANONICAL_CANDIDATE_RUNTIME |
| `simulate/route.ts:17` | `buildCandidateQuoteRecommendation` | Non (simulation pure) | CANONICAL_CANDIDATE_RUNTIME — `SANCTIONED_ENTRY_POINT` |

### 1.5 Fichiers non classifiables

**Aucun.** Chaque fichier du périmètre résout à exactement une classe, prouvée par un graphe de
consommateurs réel (import, whitelist d'architecture existante, ou commentaire explicite du fichier
lui-même). Aucun `DEAD`/`DEPRECATED`/`TEST_ONLY`/`UNCLASSIFIED` dans le périmètre frontend/API —
tout a au moins un consommateur runtime non-test.

---

## 2. Inventaire des moteurs concurrents

### 2.1 Table complète

| Fonction | Définition | Appelants runtime | Verdict |
|---|---|---|---|
| `buildRecommendation` | `recommendation.ts:115` | `recommend/route.ts`, `route.ts` (create), `margin/route.ts`, `shadow-comparison.ts` (shadow) | KEEP (pour l'instant) — seul moteur atteignable par `/devis-bac` et la création contractuelle |
| `buildCandidateQuoteRecommendation` | `pipeline.ts:275` | `simulate/route.ts`, `profils/[id]/quote/route.ts`, `shadow-comparison.ts` (shadow) | KEEP — moteur cible, mais flag-gated OFF par défaut |
| Constructeur de scénario legacy | inline dans `buildRecommendation`, `recommendation.ts:132-183` | — | **DUPLICATION CONFIRMÉE avec `buildScenario`** (logique quasi-identique) |
| `buildScenario` (pipeline) | `pipeline.ts:215-273`, appelé `:445` | — | idem — 2 constructeurs de scénario, pas partagés |
| `matchCanonicalPack` | `recommendation.ts:50-97` | `pipeline.ts:53` (import), `pricing-engine.ts:24` (import) | KEEP — **déjà correctement dédupliqué**, une seule implémentation, 3 consommateurs. Risque : vit dans le fichier "legacy" — à déplacer avant toute suppression de `recommendation.ts` |
| `adaptCatalogueSelectionToExamProfile` | `lib/quotes/catalogue.ts:263` | `pipeline.ts:409` | KEEP pour l'instant / MIGRATE — adaptateur transitoire documenté comme tel (`catalogue.ts:257-262`) |
| `buildIdealRecommendation` | `lib/quotes/pricing.ts:58` | `recommendation.ts:128`, `pipeline.ts:440` | KEEP — implémentation unique, partagée |
| `optimizeForBudget` | `lib/quotes/optimizer.ts:29` | `recommendation.ts:133`, `pipeline.ts:223` | KEEP — implémentation unique, partagée |
| `priceSelection` | `pricing-engine.ts:411` | **aucun** (tests seulement) | **DELETE** |
| `resolveScenarioEffectiveGroupPricing` | `pricing-engine.ts:252` | `profils/[id]/quote/route.ts:111` | KEEP — seule pièce non-morte propre à `pricing-engine.ts`, fait une chose qu'aucun autre moteur ne fait (re-tarification post-confirmation d'effectif réel) |
| `computeCandidatLibreSchedule` | `lib/quotes/pricing.ts:155` | `recommendation.ts:170`, `pipeline.ts:260`, `pricing-engine.ts:321` | KEEP — implémentation unique, 25%/10, partagée par les 3 fichiers moteur |
| `margin.server.ts::computeMargin` | `margin.server.ts:104` | `margin/route.ts:59`, `profils/[id]/quote/route.ts:140` | KEEP — moteur de marge canonique, piloté par `BusinessConfig` (30/40), **le seul appelé en runtime** |
| `pricing-engine.ts::computeMargin` | `pricing-engine.ts:568` | **aucun** — confirmé par grep exhaustif de tous les importeurs de `pricing-engine.ts` | **DELETE** — constantes figées `MARGIN_BLOCKING_THRESHOLD_PCT=45`/`MARGIN_TARGET_THRESHOLD_PCT=55` (`:553-554`), explicitement qualifiées de mortes par `margin.server.ts:82` lui-même ("Not the dead 45%/55% constants in pricing-engine.ts") |
| `assertMarginAcceptable` | `pricing-engine.ts:578` | **aucun** | **DELETE** (avec `computeMargin` ci-dessus) |
| `buildSecondGroupeScenarios` | `pricing-engine.ts:486` | `pipeline.ts:371`, branche `P11_SECOND_GROUPE` | KEEP — câblé et testé, mais **inatteignable contre les données réelles aujourd'hui** : `data/pricing.canonical.json`'s `SVC_SECOND_GROUPE.directionApprovalStatus = "DIRECTION_A_VALIDER"` (pas `APPROVED`) ; `pipeline.ts:347-359` renvoie `DIRECTION_APPROVAL_REQUIRED` avant d'appeler la fonction |

Autres exports de `pricing-engine.ts` confirmés morts hors tests (grep exhaustif, zéro appelant non-test) :
`applyDiscounts`, `checkFloor`, `compareSelectionToCanonicalPacks`, `buildPricingEngineSnapshot`,
`priceSelectedModule`, `pricePilotage`, et la constante `PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES`
(elle-même documentée "jamais activées pour un devis réel", `pricing-engine.ts:632-638`).
`resolveRate`/`resolveGroupModality` restent vivants indirectement (appelés en interne par
`buildSecondGroupeScenarios`/`resolveScenarioEffectiveGroupPricing`).

### 2.2 Compteurs

```
CANDIDATE_ENGINES = 2 : buildRecommendation (LIVE public), buildCandidateQuoteRecommendation (flag-gated OFF par défaut)
SCENARIO_BUILDERS = 2 : constructeur inline de buildRecommendation, pipeline.ts::buildScenario — duplication réelle, non partagée
MARGIN_ENGINES = 2 déclarés, 1 vivant : margin.server.ts::computeMargin (LIVE, 30/40, BusinessConfig) ; pricing-engine.ts::computeMargin (MORT, 45/55 figé) → cible = 1 après suppression
PAYMENT_BUILDERS = 1 partagé (computeCandidatLibreSchedule) + 1 spécifique P11 (computeSecondGroupePayment, pricing-engine.ts:450)
PACK_MATCHERS = 1 : matchCanonicalPack — déjà dédupliqué, aucune action requise
REGULATORY_ADAPTERS = 1 : adaptCatalogueSelectionToExamProfile — transitoire, une seule instance
TRANSITIONAL_ADAPTERS = 1 : adaptCatalogueSelectionToExamProfile (même élément)
```

---

## 3. Autorités métier

| Règle | Sources actuelles | Autorité cible | Duplication | Migration requise |
|---|---|---|---|---|
| exam session | `lib/exams/catalog.ts::requireExamPolicy/assertSessionSellable` (identique dans les 2 moteurs) | `lib/exams/catalog.ts` | Non | Non |
| candidate status | Pipeline seul : `lib/exams/profile-validation.ts::validateProfilCandidat` ; legacy n'a aucun équivalent | `lib/exams/profile-validation.ts` | Non (le legacy manque simplement cette dimension) | **Oui** — écart réel, pas une duplication |
| subjects | Legacy : table statique `exam-profile.ts::buildExamProfile` ; Pipeline : `genererCarteExamen` → `adaptCatalogueSelectionToExamProfile` | `lib/exams/carte.ts::genererCarteExamen` + catalogue | **Oui** | **Oui** |
| language labels | `lib/quotes/subject-labels.ts` (incrément 1) | `lib/quotes/subject-labels.ts` | Non | Non — déjà fermé |
| module eligibility | Legacy : implicite/absent ; Pipeline : `lib/quotes/catalogue.ts::resolveModule` | `lib/quotes/catalogue.ts` | Partielle | **Oui** |
| coverage (anti double-billing) | Pipeline seul : `catalogue.ts::coverageItemsForSelection/detectDoubleBilling` ; legacy n'a aucune protection | `lib/quotes/catalogue.ts` | Non (absence côté legacy) | **Oui — risque réel tant que legacy reste vivant** |
| hours | `data/pricing.canonical.json` via `lib/pricing.ts::getCandidatIndividuelModules`, identique des 2 côtés | `lib/pricing.ts` | Non | Non |
| group thresholds (SOLO/DUO/GROUP) | `candidat_individuel_modules.min_group_open/max_group_size` (candidat individuel) — namespace distinct de `rules.group_min_open` (catalogue général) | namespace candidat-individuel dédié | Non (produits différents) | Non |
| prices | `data/pricing.canonical.json` exclusivement, via `lib/pricing.ts` | `lib/pricing.ts` / JSON | Non | Non |
| annual contract | `QuoteScenario.grandTotal/.months`, identique via `computeCandidatLibreSchedule` | `lib/quotes/pricing.ts::computeCandidatLibreSchedule` | Non | Non |
| deposit / installments | D4 25%/10 (candidat libre) vs 30%/9 (catalogue général) — **divergence volontaire documentée**, pas une duplication accidentelle | chacun sa propre autorité | Non | Non |
| discount | `lib/pricing.ts::applyDiscount` (vivant) vs `pricing-engine.ts::applyDiscounts` (mort) | `lib/pricing.ts::applyDiscount` | **Oui (code mort)** | **Oui — supprimer le doublon mort** |
| teacher cost | `margin.server.ts::getCommercialCostPolicy` (BusinessConfig, vivant) vs `PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES` (mort, non contractuel) | `margin.server.ts` | **Oui (hypothèse morte à côté du vivant)** | **Oui** |
| structure cost / dossier cost | Uniquement dans les hypothèses mortes Phase B — **aucun équivalent vivant** | à concevoir si le modèle décomposé est un jour voulu | N/A | Décision produit requise avant toute migration |
| margin gates | `margin.server.ts` (30/40, BusinessConfig, vivant) vs `pricing-engine.ts` (45/55, figé, mort) | `margin.server.ts` | **Oui (mort)** | **Oui** |
| pack matching | `matchCanonicalPack`, unique | `recommendation.ts::matchCanonicalPack` | Non | Relocalisation seulement si `recommendation.ts` est un jour supprimé |
| Grand Oral | `rules.grand_oral_policy`, lu identiquement par `matchCanonicalPack` et `buildIdealRecommendation` | `lib/pricing.ts` / JSON | Non | Non |
| second groupe | `pricing-engine.ts::buildSecondGroupeScenarios/computeSecondGroupePayment` — unique, gaté par la donnée (`directionApprovalStatus`) | `pricing-engine.ts` (partie vivante) | Non | Non — déjà source unique, juste gaté |

---

## 4. Familles de paiement

`QuotePaymentPolicy` a exactement 2 valeurs (`lib/quotes/schemas.ts:124`) :
`ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS` et `PAY_IN_FULL_AT_BOOKING`. Aucune 3ᵉ valeur nulle part
dans le dépôt (grep confirmé).

**A. Offres fixes publiques candidat individuel** (`data/pricing.canonical.json.offers`, via
`getAnnualOffer`) — 4 offres atteignables par `matchCanonicalPack` :

| offer id | deposit | mensualités | acompte % |
|---|---|---|---|
| `premiere-libre-cap-anticipees` | 1980 | 10×592 | 25.06% |
| `premiere-libre-renforcee` | 2980 | 10×892 | 25.04% |
| `terminale-libre-focus-bac` | 3220 | 10×968 | 24.96% |
| `terminale-libre-integrale` | 4220 | 10×1268 | 24.97% |

**Vérification explicite deposit=0** : recherche récursive complète de `data/pricing.canonical.json`
(31 offres + tous les objets imbriqués portant une clé `deposit`) — **zéro offre à deposit=0 trouvée**.
Non applicable : aucune offre de ce type n'existe à tracer.

**B. Devis personnalisé V1 staff** — `ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS`, moteur
`buildRecommendation`, créé côté staff (`DevisWorkspace.tsx` → `/api/quotes`), CONTRACTUEL une fois
envoyé/accepté (`emission-guard.ts`).

**C. Devis généré `/devis-bac`** — même moteur et même politique que B (aucune politique "publique"
distincte n'existe) ; `/api/quotes/recommend` produit une ESTIMATION jamais persistée (docstring
"Never writes to the DB", `recommend/route.ts:5`), seul `POST /api/quotes` persiste et peut devenir
CONTRACTUEL.

**D. Second groupe** — `PAY_IN_FULL_AT_BOOKING`, `buildSecondGroupeScenarios`, staff uniquement,
**inatteignable contre les données réelles aujourd'hui** (voir §2.1).

**E. Autre valeur** — aucune, le type est fermé et entièrement couvert par B/C/D.

---

## 5. Sémantique exacte du flag `pricing.candidatIndividuelPipeline`

### 5.1 Ce qui existe réellement

`ACTIVE_PUBLIC` **n'est pas un flag séparé** — c'est une des 5 valeurs de l'union
`PipelineState` (`lib/quotes/pipeline-flag.ts:17`) :
`'OFF' | 'SHADOW' | 'ACTIVE_INTERNAL' | 'ACTIVE_PUBLIC_PERCENTAGE' | 'ACTIVE_PUBLIC'`, stockée dans
`BusinessConfig` (namespace `pricing.candidatIndividuelPipeline`, clé `state`).

- `getPipelineState()` — fail-closed, défaut `'OFF'`.
- `isShadowModeEnabled()` — vrai pour SHADOW/ACTIVE_INTERNAL/ACTIVE_PUBLIC_PERCENTAGE/ACTIVE_PUBLIC.
- `isActiveForInternalStaff()` — vrai pour ACTIVE_INTERNAL/ACTIVE_PUBLIC_PERCENTAGE/ACTIVE_PUBLIC.
  **Seule fonction réellement branchée sur un guard** (`requireInternalPipelineAccess`).
- `isActiveForPublic()` (`pipeline-flag.ts:41-43`) — vrai seulement pour
  ACTIVE_PUBLIC/ACTIVE_PUBLIC_PERCENTAGE. **Zéro appelant nulle part dans le dépôt** — code mort/réservé.
- **Invariant 6** (`lib/config/schemas.ts:400-416`) interdit explicitement à un ADMIN d'écrire
  `state = ACTIVE_PUBLIC` ou `ACTIVE_PUBLIC_PERCENTAGE` via l'API admin — un garde-fou délibéré,
  indépendant du fait que rien ne consomme `isActiveForPublic()` de toute façon.

### 5.2 Ce que ce flag contrôle réellement — (a) le workspace staff, uniquement

`requireInternalPipelineAccess` n'a **aucun** appelant en dehors de `app/api/assistante/candidat-
individuel/**` (les 7 routes). `/devis-bac`, `/devis/[token]`, et tout `app/api/quotes/**` public
**n'importent ni le guard ni `isActiveForInternalStaff`** — vérifié en lisant `recommend/route.ts` et
`route.ts` en entier.

### 5.3 Ce qui se passe aujourd'hui si le flag est OFF/absent — prouvé, pas supposé

- Workspace staff carte-aware (`app/api/assistante/candidat-individuel/**`) : **s'arrête** (403 sur
  toutes les routes).
- `/devis-bac` : **continue de fonctionner sans aucun changement** — son chemin de code
  (`buildRecommendation` → `createQuote`) ne lit jamais ce flag ; `isShadowModeEnabled()` retourne
  simplement `false` et le bloc shadow est sauté, sans effet sur la réponse.

### 5.4 `ACTIVE_PUBLIC=NO` du statut ligne-de-commande — que désactive-t-il RÉELLEMENT ?

Réponse sans ambiguïté : **rien de plus que ce que `state < ACTIVE_PUBLIC` désactive déjà** (le
palier de percentage-rollout public du pipeline canonique) — mais ce palier n'a de toute façon
**aucun consommateur câblé** (`isActiveForPublic()` mort). En pratique, `ACTIVE_PUBLIC=NO` aujourd'hui
ne désactive **aucun comportement observable** : ni `/devis-bac` (jamais gaté), ni le workspace staff
(gaté par `ACTIVE_INTERNAL`, pas par `ACTIVE_PUBLIC`). C'est une ambiguïté de vocabulaire confirmée,
exactement comme demandé par la mission.

**FLAG_SEMANTICS_AMBIGUITY = 1 confirmée** (`ACTIVE_PUBLIC` ne gate rien de câblé aujourd'hui) — cible
= 0 après migration (§7).

### 5.5 Mécanisme existant réutilisable — pas de nouveau flag arbitraire

`BusinessConfig` (`prisma/schema.prisma:3443-3459`) est une table générique
`{namespace, key, value: Json, schemaVersion, version, updatedBy}`, `@@unique([namespace,key])` —
déjà prouvée pour exactement ce type de flag de rollout. `lib/config/snapshot.ts` est déjà agnostique
du namespace. Ajouter une distinction "estimateur public" vs "devis définitif public" ne demande
**aucune nouvelle infrastructure** — seulement : un nouveau namespace + enregistrement dans
`NAMESPACE_SPECS` (`lib/config/schemas.ts`) + un point d'appel dans `recommend/route.ts`/`route.ts`
(le vrai chaînon manquant aujourd'hui, pas le stockage).

---

## 6. DB reachability

Modèles lus en entier : `Quote`, `QuoteLine`, `ProfilCandidat`, `ContactLead`, `QuoteAuditLog`,
`BusinessConfig`.

**Fait transverse** : `getQuoteByPublicToken` fait un `findUnique` non restreint (pas de `select`) —
la ligne `Quote` complète est en scope partout où `getQuoteForFamilyView` est utilisé. La projection
JSON (`public/[token]/route.ts:36-67`) est une allow-list explicite (sûre par construction) ; la page
HTML (`app/devis/[token]/page.tsx`, React Server Component) ne rend qu'un sous-ensemble mais rien ne
structure cette garantie de la même façon que l'allow-list JSON.

| Champ | Writers | Readers (décision/affichage) | Exposé public | Snapshotté | Indexé | Orphan |
|---|---|---|---|---|---|---|
| profilId | `persistence.server.ts:122` | `emission-guard.ts`, `family-visibility.ts`, `pdf-adapter.server.ts`, pages/routes PDF | Oui (indirect) | Oui | `@@index` | Non |
| studentId | `persistence.server.ts:106` | `family-visibility.ts`, PDF public route | Oui (indirect) | Oui | `@@index` | Non |
| contactLeadId | `persistence.server.ts:105` | `family-visibility.ts`, PDF public route | Oui (indirect) | Oui | `@@index` | Non |
| regulatoryMaturity | défaut colonne seulement | `emission-guard.ts`, `pdf-adapter.ts`, `app/devis/[token]/page.tsx` | Oui (indirect, bannière) | Oui | non nécessaire | Non |
| snapshotCarte | `persistence.server.ts:123` | `emission-guard.ts`, `pdf-adapter.server.ts` | **Oui, directement** (PDF famille) | Oui | non nécessaire | Non |
| snapshotRegles | `persistence.server.ts:124` | `emission-guard.ts` (présence seule) | **Non** (exclu explicitement du DTO PDF) | Oui | non nécessaire | Non |
| publicTokenHash | `persistence.server.ts:100` | `persistence.server.ts:190` | Non (hash) | Oui | `@unique` | Non |
| publicTokenExpiresAt | `persistence.server.ts:101` | `persistence.server.ts:194` | Non | Oui | non nécessaire | Non |
| idempotencyKey | `persistence.server.ts:102` | `persistence.server.ts:83,166` | Non (exclu explicitement) | Oui | `@unique` | Non |
| pricingVersion | `persistence.server.ts:110` | `emission-guard.ts` (non-vide) | Non (exclu) | Oui | non nécessaire | Non |
| examPolicyVersion | `persistence.server.ts:111` | **aucun lecteur runtime** | Non | Oui | non nécessaire | **Write-only** — pas un orphelin formel (garde une valeur de provenance/audit), mais fonctionnellement non lu aujourd'hui |
| paymentPolicy | `persistence.server.ts:117` | `pdf-adapter.server.ts`, `app/devis/[token]/page.tsx` | Oui (indirect) — **absent de la projection JSON** malgré son usage HTML : asymétrie à corriger | Oui | non nécessaire | Non |
| deposit | `persistence.server.ts:118` | `pdf-adapter.server.ts`, page HTML | **Oui, directement** | Oui | non nécessaire | Non |
| lastInstallmentAmount | `persistence.server.ts:119` | `pdf-adapter.server.ts` | **Oui en JSON**, absent de la page HTML — asymétrie inverse de `paymentPolicy` | Oui | non nécessaire | Non |
| matchedOfferId | `persistence.server.ts:114` | UI pré-persistance (`ScenarioCard.tsx`) | **Oui en JSON**, non rendu en HTML | Oui | non nécessaire | Non |

**DB_ORPHAN_FIELDS calculé (pas supposé)** :
- `Quote.previousRevisionId` — zéro writer ; seules références = commentaire doc + fixtures/asserts de
  tests d'absence (`__tests__/architecture/candidat-individuel-runtime-reachability.test.ts:45`).
- `Quote.supersededBy` — idem.
- `Quote.revisionNumber` (celui de `Quote`, distinct de celui, actif, de `ProfilCandidat`) — jamais
  positionné explicitement (défaut `1`), seules références = tests.
- `diagnosticId`/`diagnosticChecksum` — write-only en production, aucun lecteur runtime (near-orphan,
  signalé bien que non explicitement demandé).

**DB_ORPHAN_FIELDS = 3 confirmés** (`previousRevisionId`, `supersededBy`, `Quote.revisionNumber`) +
2 near-orphans signalés (`diagnosticId`, `diagnosticChecksum`, write-only).

---

## 7. Nginx reachability

**Constat structurant** : aucune configuration Nginx versionnée dans ce dépôt n'est prouvée être celle
qui tourne réellement en production.
- `docker-compose.prod.yml:232-241` : le service nginx est **entièrement commenté**
  ("DISABLED — Managed by Host Nginx").
- `README.md:937` : la vraie config prod "ne pose aucun en-tête sécurité, tout vient du middleware
  Next.js" — elle ne correspond même pas à `nginx/nginx.conf`.
- `ops/nginx/*.conf` sont des extraits à installation manuelle, sans script/CI qui les copie vers l'hôte
  réel ; leur seul consommateur automatisé est un test de cohérence textuelle
  (`__tests__/scripts/nginx-secret-log-guard.test.ts`), pas une preuve de déploiement.

Aucune route candidat-individuel n'a de `location` dédiée nulle part (grep `devis|quotes` sur
`nginx/`/`ops/nginx/` = zéro résultat) ; elles retombent toutes sur `location /` ou `location /api/`
génériques.

Classification :
- **REQUIRED** (mais générique uniquement) : `location /` et `location /api/` — seules règles
  couvrant effectivement les routes candidat-individuel aujourd'hui, rate-limiting de base seulement.
- **REQUIRED, hors périmètre candidat-individuel** : `^~ /bilan/consultation/` +
  `^~ /api/bilan/consultation/` (protège une autre feature à lien signé) ;
  `~ ^/api/auth/(signin|signup|callback)`.
- **REDUNDANT** : aucune trouvée.
- **SHADOWED** : aucune trouvée (les préfixes `^~` gagnent proprement, pas de chevauchement avec les
  routes candidat-individuel).
- **MISSING (delta attendu, pas un P0 — voir §7.1)** :
  1. `/devis/[token]` et `/api/quotes/public/[token]` portent un **token brut dans l'URL**,
     structurellement identique en risque à `/bilan/consultation/[token]` — qui bénéficie d'une
     rédaction de log dédiée (`nexus-safe-log.conf`). Aucun équivalent n'existe pour ces routes.
  2. Aucune zone `limit_req` dédiée/plus stricte pour `/api/quotes/public/[token]*` ou `/devis-bac`.
  3. Aucun `Cache-Control` imposé au niveau edge pour la lecture/PDF publics — uniquement applicatif
     (`Cache-Control: private, no-store` posé dans le code, sans filet Nginx).

### 7.1 Pourquoi ce n'est pas un P0 de cet incrément

Aucune fuite immédiatement exploitable n'a été identifiée : la protection applicative
(`guardSensitiveRateLimit`, `Cache-Control: private, no-store` posé en code) est déjà en place sur les
routes concernées. Le manque de rédaction de log Nginx est un durcissement défense-en-profondeur
(le token de log, s'il fuitait via un accès aux logs serveur, permettrait un accès identique à un
accès direct par lien — pas une élévation de privilège nouvelle), et surtout **la configuration réelle
de production n'est pas dans ce dépôt** : modifier `ops/nginx/*.conf` ici ne changerait rien tant qu'un
opérateur ne l'installe pas manuellement sur l'hôte réel. Ce point est documenté comme delta attendu
pour un incrément de remédiation ultérieur (avec accès à la vraie configuration hôte), pas corrigé ici.

---

## 8. Dette globale pré-existante — root cause, pas juste "pre-existing"

Ces cinq anomalies ont été observées lors des vérifications incréments 1 et 2, et qualifiées ici avec
précision, en isolant l'environnement (clone propre hors du `.worktrees/` local, 22 Go / 30 worktrees
imbriqués sur cette machine ; base de données fraîche pour la n°5) :

| # | Symptôme | Root cause | Scope | Risque | Plan |
|---|---|---|---|---|---|
| 1 | `npm run typecheck` local échouait sur `lib/quotes/subject-labels.ts`/`lib/stages/public.ts` ("missing ARABE/ITALIEN/RUSSE/ALLEMAND") | **Client Prisma généré localement stale** — `node_modules/.prisma/client` sur cette machine avait été généré depuis une AUTRE branche non fusionnée (`00b9dbb48 "six living languages"`), pas depuis `prisma/schema.prisma` de cette branche (qui n'a que 11 valeurs `Subject`) | Environnement dev local uniquement, aucun fichier du dépôt concerné | Aucun — confirmé disparu après `npx prisma generate` local et dans un clone propre (`npm run typecheck` → exit 0, zéro sortie) | Action déjà appliquée localement (`npx prisma generate`) ; aucune action dépôt requise. À documenter dans le runbook onboarding : toujours `prisma generate` après changement de branche sur une machine à `node_modules` partagé |
| 2 | `npm run typecheck` local échouait aussi sur `AUDIT_MACHINE_STOCKAGE_WORKTREES_2026-08-30.canvas.tsx` (`Cannot find module 'cursor/canvas'`) | Fichier **non suivi par git**, débris d'une mission "Antigravity" de nettoyage machine sans rapport avec candidat-individuel, à la racine du dépôt | Racine du dépôt, working tree local uniquement — absent de tout clone/CI | Aucun — absent d'un clone propre par construction (fichier jamais commité) | Aucune action dépôt requise ; fichier laissé en l'état par consigne explicite (ne pas toucher les débris hors périmètre) |
| 3 | `__tests__/architecture/site-architecture-guards.test.ts` et `__tests__/marketing/link-integrity-guard.test.ts` échouaient (`RangeError: Maximum call stack size exceeded` dans `scripts/audit/site-map.mjs::walk()`) | `walk()` ne exclut pas `.worktrees/` de sa récursion (seulement `node_modules`/`.next`/`.git`) ; sur cette machine, `.worktrees/` fait 22 Go et contient 30 worktrees, dont au moins un contenant **lui-même** un sous-dossier `.worktrees/` (confirmé par `find .worktrees -maxdepth 2 -iname .worktrees`) — récursion combinatoire, pas un dépassement de profondeur fixe | Working tree local sur cette machine uniquement — confirmé **absent** dans un clone isolé propre (3/3 exécutions, zéro échec) | Aucun pour candidat-individuel ; risque réel mais générique : `walk()` devrait exclure `.worktrees` par défensivité, tout dépôt clôné à côté d'un `.worktrees` volumineux le reproduirait | Non corrigé dans cet incrément (hors périmètre candidat-individuel, pas un P0). Fix suggéré pour un incrément dette-globale : ajouter `.worktrees` à la liste d'exclusion de `walk()` (`scripts/audit/site-map.mjs:96`) |
| 4 | `__tests__/bilans/teacher-dossier-render.test.ts` échoue parfois (`Exceeded timeout of 5000 ms`) en suite complète | Timeout Jest par défaut (5000ms) trop court pour un test de rendu PDF réel (poppler) sous contention de workers parallèles ; le test prend 1.9-2.5s en isolation (confirmé PASS 4/4 en isolation, y compris dans le clone propre), mais peut dépasser 5s quand ~900 suites tournent en parallèle | `__tests__/bilans/` — feature "bilans"/teacher-brief, **aucun rapport avec candidat-individuel** | Faible — flaky, non déterministe, jamais un échec de correction fonctionnelle | Non corrigé ici (hors produit). Fix suggéré : `jest.setTimeout(15000)` localement dans ce fichier, ou exécuter les tests de rendu PDF avec `--runInBand` pour éviter la contention CPU/poppler |
| 5 | **(découvert en fin de vérification incrément 2)** 3 tests de `__tests__/database/candidat-individuel-pdf.test.ts` (bloc P11) échouaient de façon reproductible (`DIRECTION_APPROVAL_REQUIRED` au lieu de `READY`), puis le conteneur `nexus-postgres-test` a crashé en boucle (`FATAL: could not write to file "pg_wal/xlogtemp...": No space left on device`) | Le conteneur Postgres de test partagé (`docker-compose.test.yml`, `tmpfs size=512m`, up 34h+ avant cette session, réutilisé par de nombreux worktrees sur cette machine) a épuisé son quota tmpfs de 512 Mo après des heures d'usage intensif multi-session — corruption WAL transitoire en conséquence, pas un défaut de code. **Preuve** : les 3 mêmes tests passent 3/3 sur une base fraîche (`nexus_disposable_fresh_test`, créée à la volée) alors que le code produit est strictement inchangé (`git diff` vide sur `pipeline.ts`/`catalogue.ts`/`data/pricing.canonical.json`) ; reproduit à l'identique dans un clone totalement indépendant (node_modules propre), ce qui exclut une cause côté dépôt local. Disque hôte à 90 % (92 Go libres sur 913 Go) au moment du constat — pas une urgence disque immédiate, mais cohérent avec la dette de stockage déjà documentée par les fichiers débris `AUDIT_MACHINE_STOCKAGE_WORKTREES_2026-08-30.*` de cette même machine | Infrastructure de test locale/CI partagée — **aucun rapport avec le code candidat-individuel** | Moyen pour la fiabilité des CI futures sur une machine à forte contention multi-worktrees ; nul pour la correction du produit | Conteneur recréé (`docker compose -f docker-compose.test.yml up -d` après suppression du conteneur mort) ; **208/208 tests `__tests__/database/` confirmés PASS** sur le conteneur reconstruit. Fix structurel suggéré hors périmètre : augmenter `tmpfs size` dans `docker-compose.test.yml`, ou faire tourner le conteneur de test sur un volume disque classique plutôt qu'un tmpfs de taille fixe sur une machine à forte activité multi-worktrees |

**Aucun de ces 5 points n'est un défaut du code candidat-individuel.** Les points 1-3 sont des
artefacts de CETTE machine locale (client Prisma désynchronisé, débris non versionnés, sprawl de
worktrees) — confirmés absents dans un clone isolé propre. Le point 4 est un flaky test pré-existant
et sans rapport, dont le seul lien avec candidat-individuel est de tourner dans la même suite Jest
globale. Le point 5 est une panne d'infrastructure de test partagée (quota tmpfs épuisé), résolue en
recréant le conteneur ; les 208 tests `__tests__/database/` candidat-individuel sont confirmés PASS
sur l'infrastructure reconstruite.

---

## 9. Architecture cible

```
PROFIL (ProfilCandidat, staff-saisi)
   ↓
CARTE RÉGLEMENTAIRE (genererCarteExamen — lib/exams/carte.ts)
   ↓
BESOINS CATALOGUE (resolveModule/coverageItemsForSelection — lib/quotes/catalogue.ts)
   ↓
DIAGNOSTIC / PRIORITÉ (projectDiagnostic + scoreSubjects — partagé, déjà unique)
   ↓
CONSTRUCTEUR DE SCÉNARIO CANONIQUE UNIQUE (à créer — fusionne le constructeur inline de
recommendation.ts et pipeline.ts::buildScenario)
   ↓
RÉSOLUTION EFFECTIF (resolveScenarioEffectiveGroupPricing — déjà unique)
   ↓
TARIFICATION / PAIEMENT CANONIQUE (computeCandidatLibreSchedule + matchCanonicalPack — déjà uniques)
   ↓
COÛT / MARGE CANONIQUE (margin.server.ts::computeMargin — déjà l'autorité vivante ; supprimer le
doublon mort pricing-engine.ts::computeMargin)
   ↓
SNAPSHOT QUOTE (createQuote — déjà unique)
   ↓
PDF STAFF / PUBLICATION (déjà unique par surface)
   ↓
FAMILY VISIBILITY (family-visibility.ts — déjà unique, fermé incrément 1)
```

Contraintes cibles et état actuel :

| Contrainte | Cible | État actuel |
|---|---|---|
| `CANONICAL_CANDIDATE_ENGINE_COUNT` | 1 | 2 (legacy live + pipeline flag-gated) |
| `PRODUCTION_TRANSITIONAL_ADAPTERS` | 0 | 1 (`adaptCatalogueSelectionToExamProfile`) |
| `DUPLICATE_SCENARIO_BUILDERS` | 0 | 2 (constructeur inline + `buildScenario`) |
| `MARGIN_ENGINES` | 1 | 1 vivant + 1 mort à supprimer |
| `PAYMENT_POLICY_AUTHORITY` | 1 par famille commerciale | déjà respecté (D4 candidat libre vs règles catalogue général, divergence volontaire) |
| `PACK_COVERAGE` | STRUCTURED_EXACT | aujourd'hui : somme d'heures uniquement (`matchCanonicalPack`) — pas encore de couverture structurée exacte par module ; scope incrément 5 |
| `PUBLIC/STAFF` | deux façades, un seul noyau | aujourd'hui : deux noyaux (legacy pour la façade publique, canonique pour la façade staff) |

Public et staff peuvent avoir des façades différentes (moins de champs, plus de `HUMAN_REVIEW`, zéro
donnée interne côté public) — mais doivent converger vers le MÊME noyau (`buildCandidateQuoteRecommendation`
+ le futur constructeur de scénario unique), jamais deux moteurs de prix/réglementaire/scénario
séparés.

---

## 10. Plan de suppression (aucune suppression exécutée dans cet incrément)

| Élément | Action | Consommateurs actuels | Consommateurs après migration | Test qui prouvera l'absence |
|---|---|---|---|---|
| `pricing-engine.ts::computeMargin` | DELETE | Aucun (confirmé) | Aucun | Nouveau test source-text : aucun import de `computeMargin` depuis `pricing-engine.ts` nulle part hors son propre fichier |
| `pricing-engine.ts::assertMarginAcceptable` | DELETE | Aucun | Aucun | idem |
| `pricing-engine.ts::priceSelection`/`priceSelectedModule`/`pricePilotage` | DELETE | Aucun (tests seulement) | Aucun | idem, + suppression des tests qui les ciblent exclusivement |
| `pricing-engine.ts::applyDiscounts`/`checkFloor`/`compareSelectionToCanonicalPacks`/`buildPricingEngineSnapshot` | DELETE | Aucun | Aucun | idem |
| `PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES` | DELETE ou déplacer en doc historique | Aucun runtime | Aucun | grep vide sur le nom de la constante hors doc |
| `Quote.previousRevisionId`/`supersededBy`/`revisionNumber` (celui de Quote) | KEEP (colonnes existantes, migration Prisma non triviale à annuler) mais **DEPRECATE_TEMPORARILY** au niveau documentation — ne pas les réactiver sans un vrai plan de révision | Aucun runtime | — | déjà verrouillé par 2 tests d'architecture existants asserting leur absence du code source |
| Constructeur de scénario inline (`recommendation.ts`) + `pipeline.ts::buildScenario` | MIGRATE — fusionner en un seul constructeur canonique | `buildRecommendation`, `buildCandidateQuoteRecommendation` | Le nouveau constructeur unique, appelé par les deux jusqu'à dépréciation du moteur legacy | Scope incrément 4 — RED test à écrire en ouverture de cet incrément (§11) |
| `adaptCatalogueSelectionToExamProfile` | MIGRATE puis DELETE une fois `recommendation.ts`/`exam-profile.ts::buildExamProfile` remplacés | `pipeline.ts` uniquement | — | Scope incrément 3 |
| `buildRecommendation` (moteur legacy) | MIGRATE (public `/devis-bac` bascule vers le moteur canonique) puis DELETE | `/devis-bac`, `/dashboard/assistante/devis`, `/api/quotes/*` | Le moteur canonique, une fois `/devis-bac` migré (incrément 8) | Scope incrément 8-9, hors de cet incrément |

Aucune suppression n'est basée sur un grep seul : chaque ligne ci-dessus a été vérifiée par lecture
complète du fichier et de tous ses importeurs (§2).

---

## 11. Plan TDD incréments 3+

| Incrément | Contenu | RED tests à écrire en ouverture | Fichiers principaux | Risque migration | Rollback | Critère d'acceptation |
|---|---|---|---|---|---|---|
| **I3** | Modèle domaine canonique + retrait de l'adaptateur transitoire `adaptCatalogueSelectionToExamProfile` | Test source-text : `pipeline.ts` n'importe plus `adaptCatalogueSelectionToExamProfile` ; test de non-régression golden sur les scénarios déjà produits par le pipeline | `lib/quotes/pipeline.ts`, `lib/quotes/catalogue.ts`, `lib/quotes/exam-profile.ts` | Moyen — touche le chemin carte-aware déjà en prod interne (`ACTIVE_INTERNAL`) | `git revert` du commit ; le flag pipeline reste désactivable côté staff sans redéploiement | Golden tests carte-aware inchangés ; `PRODUCTION_TRANSITIONAL_ADAPTERS = 0` |
| **I4** | Constructeur de scénario unique + modèle de paiement annuel unifié | Test : un seul fichier exporte une fonction `buildScenario`/`buildCandidateScenario`, `recommendation.ts` et `pipeline.ts` l'importent tous deux, zéro logique de construction de scénario dupliquée (source-text + comportemental R1/R2) | `lib/quotes/recommendation.ts`, `lib/quotes/pipeline.ts`, nouveau fichier scénario | Élevé — touche le chemin public `/devis-bac` en LIVE | Feature flag de bascule par moteur ; conserver l'ancien constructeur en dead code le temps de la validation croisée avant suppression | `DUPLICATE_SCENARIO_BUILDERS = 0` ; R1/R2 identiques avant/après |
| **I5** | Couverture de pack exacte et structurée (remplace la somme d'heures) | Test : un pack ne matche que s'il couvre un superset vérifié des `coverageKeys` requis, jamais par somme d'heures seule | `lib/quotes/catalogue.ts`, `recommendation.ts::matchCanonicalPack` | Moyen — change potentiellement quelles offres matchent | Comparaison shadow avant bascule (réutiliser `shadow-comparison.ts`) | `PACK_COVERAGE = STRUCTURED_EXACT` ; aucune régression sur les 4 offres candidat-individuel existantes |
| **I6** | Effectifs fail-closed, dédup des paliers de groupe | Test : une durée de groupe inconnue lève une erreur domaine/`UNPRICED`, jamais un fallback silencieux à 8h | `lib/quotes/pricing-engine.ts::resolveGroupModality`, table `PETIT_GROUPE_RULE_BY_HOURS` | Faible — resserre un comportement déjà fail-closed ailleurs | Revert simple | `UNKNOWN_GROUP_TIER_FAILS_CLOSED = PASS` |
| **I7** | Modèle de coût Nexus exact, un seul moteur de marge | RED : `pricing-engine.ts::computeMargin`/`assertMarginAcceptable` supprimés, aucun import résiduel (source-text) | `lib/quotes/pricing-engine.ts`, `lib/quotes/margin.server.ts` | Faible — code déjà mort, suppression pure | Revert simple | `MARGIN_ENGINES = 1` ; tests §8/§9 de la mission originale (29.99/30.00/39.99/40.00) toujours verts |
| **I8** | Migration de `/devis-bac` public vers le moteur canonique | RED : test e2e prouvant que `/devis-bac` appelle `buildCandidateQuoteRecommendation`, jamais `buildRecommendation`, avec un flag de rollback immédiat | `app/devis-bac/**`, `components/quotes/DevisWizard.tsx`, `app/api/quotes/recommend/route.ts` | **Élevé — surface publique live** | Flag `pricing.candidatIndividuelPipeline` repositionnable à `OFF`/`ACTIVE_INTERNAL` sans redéploiement ; ancien moteur conservé en dead code une itération complète | Shadow-mode confirmant zéro divergence de prix sur un corpus réel avant bascule |
| **I9** | Consolidation contrat DB/API/PDF/family | RED : tests de contrat pour chaque asymétrie identifiée en §6 (`paymentPolicy` absent du JSON, `lastInstallmentAmount`/`matchedOfferId` absents du HTML) | `app/api/quotes/public/[token]/route.ts`, `app/devis/[token]/page.tsx` | Faible | Revert simple | Zéro asymétrie de champ entre JSON et HTML publics |
| **I10** | Dette globale (site-map.mjs, timeout PDF) | RED : test que `walk()` exclut `.worktrees` ; timeout Jest relevé pour `teacher-dossier-render.test.ts` | `scripts/audit/site-map.mjs`, `__tests__/bilans/teacher-dossier-render.test.ts` | Faible | Revert simple | `GLOBAL_UNIT = PASS` sans qualification, y compris sur une machine à worktrees multiples |
| **I11** | Script de déploiement + qualification finale | Preflight complet, SHA unique, rollback testé | scripts de release | Élevé (déploiement) | Rollback documenté et testé avant tout GO | `READY_FOR_HUMAN_SMOKE_CUTOVER = YES` |

Ordre proposé identique à celui suggéré par la mission — confirmé cohérent avec le graphe de
dépendances réel (I3 doit précéder I4 car I4 touche le même fichier `pipeline.ts` qu'I3 modifie déjà ;
I8 doit suivre I4/I5/I6/I7 car migrer `/devis-bac` avant que le moteur cible soit stabilisé
multiplierait le risque sur la surface publique).

---

## 12. Vérifications incrément 1 (re-confirmées avec preuve exhaustive)

**`COMMERCIAL_READERS_OF_PEDAGOGICAL_URGENCY`** : recherche exhaustive de `monthsRemaining` et
`pedagogicalUrgencyMonths` dans tout le périmètre candidat (`lib/quotes/`, `lib/exams/`,
`app/api/quotes/`, `app/api/assistante/candidat-individuel/`, `components/`) — chaque occurrence de
`monthsRemaining` est soit (a) un champ de contrat HTTP public/staff avec mapping explicite vers
`pedagogicalUrgencyMonths`, soit (b) un commentaire citant l'ADR. Aucune fonction de facturation
(`computeSchedule`, `computeCandidatLibreSchedule`, aucun calcul `*10`/`grandTotal`/`deposit`) ne reçoit
l'une ou l'autre valeur. **`COMMERCIAL_READERS_OF_PEDAGOGICAL_URGENCY = 0`**.

**`FAMILY_VISIBILITY_GATE_COVERAGE`** : 4 points d'entrée famille tokenisés en runtime — `app/devis/
[token]/page.tsx` (HTML), `app/api/quotes/public/[token]/route.ts` (JSON), `app/api/quotes/public/
[token]/pdf/route.ts` (PDF), `app/api/quotes/[id]/accept/route.ts` (accept). Les 4 appellent
`getQuoteForFamilyView` exclusivement. `getQuoteByPublicToken` (primitive non gatée) n'a qu'un seul
appelant runtime : `getQuoteForFamilyView` lui-même — confirmé par grep exhaustif de tous ses
importeurs (le reste sont des mocks/fixtures de test). Aucun mécanisme de "rotate link" n'existe (donc
rien à couvrir de ce côté). **`FAMILY_VISIBILITY_GATE_COVERAGE = 100%`** (4/4 points d'entrée).

---

## Annexe — fichiers "débris" hors périmètre (classification, non modifiés)

Ces fichiers non suivis (`git status` `??`) présents à la racine du dépôt proviennent d'une mission
"Antigravity" de nettoyage de stockage machine, sans rapport avec candidat-individuel :
`ANNEXE_INCIDENT_SOUS_AGENT_COMMIT_2026-08-30.md`,
`AUDIT_MACHINE_STOCKAGE_WORKTREES_2026-08-30.{md,canvas.tsx}`,
`MANIFESTE_{NETTOYAGE,PHASE_4}_ANTIGRAVITY_2026-08-30.json`,
`PLAN_INTEGRATION_MAINTENANCE_STORAGE_2026-08-30.md`,
`PROMPT_ANTIGRAVITY_*.md`, `RAPPORT_{NETTOYAGE,PHASE_4}_ANTIGRAVITY_2026-08-30.md`,
`public/images/identite-nexus-reussite/**` (assets de charte graphique).

Classification : **OTHER_PRODUCT_ARTIFACT / MACHINE_HOUSEKEEPING_UNRELATED** — hors du graphe de
reachability candidat-individuel, non lus en détail (hors sujet), non modifiés, non supprimés.

---

## Addendum incrément 3 — adaptateur transitoire supprimé, scanner AST

**`PRODUCTION_TRANSITIONAL_ADAPTERS` = 0** (était 1 : `adaptCatalogueSelectionToExamProfile`).
`lib/quotes/pipeline.ts` résout désormais les besoins candidat directement via
`lib/quotes/candidate-need.ts::resolveCandidateNeeds(selection, carte)` — plus de conversion vers la
forme legacy `ExamProfileSubject`/`SituationInput`. `adaptCatalogueSelectionToExamProfile`,
`AdaptedExamProfile` et `MODULE_LEGACY_MAPPING` sont supprimés de `lib/quotes/catalogue.ts` (zéro
appelant restant, prouvé par AST — voir plus bas).

**`UNREPRESENTABLE_BECAUSE_LEGACY_SHAPE` = 0.** Le concept "module non représentable car sans slot
`SubjectId` legacy" n'existe plus structurellement : `resolveCandidateNeeds` ne dépend d'aucune table
de compatibilité avec un ancien moteur — un module `SELECTED` sans classification pédagogique connue
(`MODULE_TO_SUBJECT` dans `candidate-need.ts`, une classification catalogue-native, pas un mapping
vers une forme legacy) échoue explicitement en `UNPRICED`, jamais silencieusement. Le champ public
`modulesNonRepresentables` (lu par `CandidatIndividuelWorkspace.tsx`) est conservé pour compatibilité
API/UI mais toujours `[]` par construction sur la branche `READY`.

**Correction au passage (mission §5, pas un simple renommage) :** `MOD_EDS1`/`MOD_EDS2` portaient
jusqu'ici le texte générique du catalogue ("Enseignement de spécialité 1/2") comme libellé partout où
le pipeline canonique facturait ces lignes — jamais la vraie spécialité de la famille. Le vrai nom
était déjà résolu une fois, à la génération de la carte (`lib/exams/carte.ts`, champ `.matiere` de
l'épreuve), mais jamais relu par l'adaptateur. `resolveCandidateNeeds` le lit directement. Verrouillé
par un nouveau cas golden écrit RED avant la migration (jamais fossiliser le texte générique comme
comportement correct, mission §10), GREEN après.

**`REACHABILITY_AST_GRAPH` = PASS, `REACHABILITY_REGEX_ONLY` = NO** (mission §3). Nouveau
`scripts/audit/import-graph.mjs` — TypeScript Compiler API (dépendance déjà présente, aucune nouvelle
dépendance externe), résout imports nommés/aliasés/namespace, ré-exports, barrels, et imports
dynamiques déstructurés (`const { x } = await import(...)`) par AST, pas par regex. Verrouillé par
`__tests__/architecture/candidat-individuel-ast-reachability.test.ts`, qui ré-vérifie par AST (au lieu
du regex de l'incrément 2) : les 9 exports morts de `pricing-engine.ts` (0 importeur non-test),
`getQuoteByPublicToken` (exactement 1 importeur non-test), `resolveCandidateNeeds` (exactement 1,
`pipeline.ts`), et confirme que `adaptCatalogueSelectionToExamProfile`/`MODULE_LEGACY_MAPPING`
n'existent plus comme exports du tout (suppression complète, pas seulement non importée). Pour toute
suppression future (I4+), combiner cet outil + `npm run typecheck` + suite de tests complète — jamais
un grep seul (mission §11/§16).

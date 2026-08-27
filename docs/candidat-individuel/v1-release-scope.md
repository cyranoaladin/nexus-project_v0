# Candidat individuel — V1 release scope (T4 freeze)

**Baseline SHA** : `b2efd1cf70330413f60b28893c7219750a074dc3` (T3D closeout).
**Statut** : `NO_NEW_PRODUCT_ACTIVATION = TRUE` à partir de ce lot — dernier lot d'extension fonctionnelle
avant le release candidate freeze V1 (T3D).

Ce document est un **index minimal**, pas une source de décision concurrente : chaque ligne renvoie vers
l'entrée détaillée de `docs/candidat-individuel/direction-decisions-commercial-governance.md` (le registre
faisant foi pour le raisonnement et les sources). `release-manifest.json` (racine du dépôt) est un manifeste
de **provenance de build** (SHA/hashes) sans rapport avec le périmètre catalogue — il n'a pas été réutilisé
car il ne répond pas à ce besoin ; aucun second manifeste concurrent n'a été créé pour autant, celui-ci se
contente d'indexer le registre existant.

## Légende

- **Reachable** : le pipeline réel (`buildCandidateQuoteRecommendation`) peut-il, avec un input réel ou
  forgé, sélectionner cet élément (statut `SELECTED`/`NEEDS_HUMAN_REVIEW` au niveau catalogue) ?
- **Final Quote possible** : existe-t-il un chemin vers le statut `READY` (donc une `QuoteLine` persistée)
  pour cet élément aujourd'hui ?
- **V1_PUBLIC_SCOPE** : `INCLUDED_V1` / `DEFERRED_FROM_V1` / `INTERNAL_ONLY`.

## Modules (`candidat_individuel_catalogue.modules`, 17)

| moduleId | Label | directionApprovalStatus | Reachable | Pricing path réel | Final Quote possible | V1_PUBLIC_SCOPE |
|---|---|---|---|---|---|---|
| `MOD_EAF_ECRIT_ORAL` | EAF écrit et oral | `APPROVED` | YES | `petit_groupe[hours]` générique | YES | `INCLUDED_V1` |
| `MOD_EAM` | Mathématiques anticipées (EAM) | `APPROVED` | YES | `petit_groupe[hours]` générique | YES | `INCLUDED_V1` |
| `MOD_EDS1` | Enseignement de spécialité 1 | `APPROVED` | YES | `petit_groupe[hours]` générique | YES | `INCLUDED_V1` |
| `MOD_EDS2` | Enseignement de spécialité 2 | `APPROVED` | YES | `petit_groupe[hours]` générique | YES | `INCLUDED_V1` |
| `MOD_PHILOSOPHIE` | Philosophie | `APPROVED` | YES | `petit_groupe[hours]` générique | YES | `INCLUDED_V1` |
| `MOD_GRAND_ORAL` | Grand Oral | `APPROVED` | YES | Branche dédiée (`rules.grand_oral_policy`, forfait amorti /10) — jamais `petit_groupe` | YES | `INCLUDED_V1` |
| `MOD_LVA` | Langue vivante A (petit groupe live) | `APPROVED` (T3A, `4ffaac8ed`→`d5565ba7b`) | YES | `petit_groupe[hours]` générique, 4h/mois direction-approuvé (§3bis) | YES | `INCLUDED_V1` |
| `MOD_LVB` | Langue vivante B (petit groupe live) | `APPROVED` (T3A) | YES | idem | YES | `INCLUDED_V1` |
| `MOD_SPECIALITE_ABANDONNEE` | Spécialité de première non poursuivie | `APPROVED` (T3A) | YES | idem, avertissement obligatoire PDF | YES | `INCLUDED_V1` |
| `MOD_HG_ARIA` | Histoire-Géo (autonomie guidée ARIA) | `DIRECTION_A_VALIDER` | YES (bloque à `DIRECTION_APPROVAL_REQUIRED`) | Aucun — pas de tier ARIA dans le barème | NO | `DEFERRED_FROM_V1` |
| `MOD_ES_ARIA` | Enseignement scientifique (ARIA) | `DIRECTION_A_VALIDER` | YES (idem) | Aucun | NO | `DEFERRED_FROM_V1` |
| `MOD_EMC_ARIA` | EMC (ARIA) | `DIRECTION_A_VALIDER` | YES (idem) | Aucun ; de plus, aucun `MODULE_LEGACY_MAPPING` (double gap) | NO | `DEFERRED_FROM_V1` |
| `MOD_EAF_DESCRIPTIF` | Aide au récapitulatif des activités EAF | `DIRECTION_A_VALIDER` | YES (idem, PREMIERE) | Aucun ; `PRICE_UNIT_SEMANTICS = DEFERRED` (T3C) | NO | `DEFERRED_FROM_V1` |
| `MOD_MATHS_EXPERTES` | Option Mathématiques expertes | `DIRECTION_A_VALIDER` | Bloque plus tôt — `HUMAN_REVIEW_REQUIRED` (coefficient non sourcé, carte) | Aucun | NO | `DEFERRED_FROM_V1` |
| `MOD_MATHS_COMPLEMENTAIRES` | Option Mathématiques complémentaires | `DIRECTION_A_VALIDER` | idem (`HUMAN_REVIEW_REQUIRED`) | Aucun | NO | `DEFERRED_FROM_V1` |
| `MOD_DGEMC` | Option DGEMC | `DIRECTION_A_VALIDER` | idem | Aucun | NO | `DEFERRED_FROM_V1` |
| `MOD_LCA` | Options LCA (latin/grec) | `DIRECTION_A_VALIDER` | idem | Aucun | NO | `DEFERRED_FROM_V1` |

## Services (`candidat_individuel_catalogue.services`, 4)

| serviceId | Label | directionApprovalStatus | Reachable | Pricing path réel | Final Quote possible | V1_PUBLIC_SCOPE |
|---|---|---|---|---|---|---|
| `SVC_PILOTAGE` | Pilotage Nexus | `APPROVED` | YES (inclus par défaut, sauf P11/P12) | `PILOTAGE_MONTHLY` | YES | `INCLUDED_V1` |
| `SVC_EPS_ADMINISTRATIF` | Accompagnement organisationnel EPS | `APPROVED` | NO — `catalogue.services` n'est consulté qu'à 2 endroits câblés en dur (`SVC_PILOTAGE`, `SVC_SECOND_GROUPE`) | Aucun (`pricingRuleId: null` **par conception**, D1 : jamais facturé séparément) | NO (jamais destiné à l'être) | `INTERNAL_ONLY` |
| `SVC_BACS_BLANCS` | Bacs blancs | `DIRECTION_A_VALIDER` | NO — même gap structurel | Aucun ; `PRICE_SEMANTICS`/`COST_SEMANTICS = AMBIGUOUS` (T3D) | NO | `DEFERRED_FROM_V1` |
| `SVC_SECOND_GROUPE` (P11) | Second groupe — produit autonome | `DIRECTION_A_VALIDER` | YES — branche dédiée `pipeline.ts`, bloque à `DIRECTION_APPROVAL_REQUIRED` | `INDIVIDUEL_HOUR_MIN` via `resolveRate`/`buildSecondGroupeScenarios` (câblage prouvé RED→GREEN) mais gate de marge non court-circuité, et jamais activé | NO (approbation manquante) | `DEFERRED_FROM_V1` |

**Décompte** : 21 entrées catalogue. `INCLUDED_V1` = 10 (9 modules + Pilotage). `DEFERRED_FROM_V1` = 10 (8
modules + 2 services). `INTERNAL_ONLY` = 1 (`SVC_EPS_ADMINISTRATIF`, jamais facturable par conception —
aucune décision en attente). `NOT_REACHABLE` : aucune catégorie distincte nécessaire — les deux services
structurellement non consommés (`SVC_BACS_BLANCS`, `SVC_EPS_ADMINISTRATIF`) sont déjà couverts par
`DEFERRED_FROM_V1`/`INTERNAL_ONLY` respectivement.

**Précision d'invariant (T5A §0.B)** : l'invariant release « toute `QuoteLine` finale porte `unitPrice > 0`
et `total > 0` » s'entend explicitement de toute `QuoteLine` **commerciale**. `SVC_EPS_ADMINISTRATIF` ne
génère aujourd'hui, et ne doit jamais générer, la moindre `QuoteLine` (commerciale ou non) — une fonction
purement administrative qui ne produit aucune `QuoteLine` n'est ni une exception tarifaire, ni une offre
gratuite comptabilisée : elle est simplement hors du périmètre auquel l'invariant s'applique.

## Verrou runtime transversal (préexistant, non modifié par T4)

`pricing.candidatIndividuelPipeline.state` (`lib/config/schemas.ts`/`lib/quotes/pipeline-flag.ts`) —
défaut fail-closed `OFF` ; le passage à `ACTIVE_PUBLIC`/`ACTIVE_PUBLIC_PERCENTAGE` est **bloqué en dur** dans
`lib/config/schemas.ts` (validation de configuration, invariant 6) tant qu'une décision de direction séparée
ne lève pas ce blocage. `OFF`/`SHADOW`/`ACTIVE_INTERNAL` restent seuls disponibles. Confirme au niveau code
que `PUBLIC_RELEASE = NO_GO` n'est pas qu'une politique déclarative.

## Entrypoints (§6)

| Entrypoint | Type | Gate |
|---|---|---|
| `app/dashboard/assistante/candidat-individuel/page.tsx` | INTERNAL (staff) | rôle ASSISTANTE/ADMIN + `isActiveForInternalStaff()` |
| `app/dashboard/assistante/candidat-individuel/wizard-preview/page.tsx` | INTERNAL (staff) | idem |
| `app/api/assistante/candidat-individuel/**` (profils, quote, review, revision, simulate, pdf) | INTERNAL (staff) | idem, tous vérifiés |
| `app/devis/[token]/page.tsx`, `app/api/quotes/public/[token]/*` | SIGNED_FAMILY | token opaque haché en base (`publicTokenHash`), aucun secret HMAC dédié requis ; relit la `Quote` persistée, ne recalcule jamais |
| `app/devis-bac/page.tsx` (`DevisWizard.tsx`) + `app/api/quotes/recommend`, `app/api/quotes` | **LEGACY_OUT_OF_SCOPE** | produit public distinct et préexistant, moteur `lib/quotes/recommendation.ts::buildRecommendation` — **jamais** `buildCandidateQuoteRecommendation`. Fait tourner le nouveau pipeline en mode SHADOW pour comparaison uniquement (`isShadowModeEnabled`) — jamais visible famille, jamais persisté comme Quote contractuelle |

Aucun endpoint secondaire ne peut réactiver implicitement un élément différé : le seul moteur candidat-
individuel (`buildCandidateQuoteRecommendation`) est utilisé exclusivement par les entrypoints INTERNAL
ci-dessus, tous gatés par `isActiveForInternalStaff()` (donc par le verrou transversal ci-dessus).

## Config / secrets (audit lecture seule, §8)

Aucune variable d'environnement dédiée trouvée dans `lib/quotes/`, `lib/quote/`, `app/api/quotes/**`,
`app/devis/**` (recherche exhaustive `process.env.*`). Dépendances runtime :

| NAME | REQUIRED/OPTIONAL | SERVER/CLIENT | PRESENT_IN_EXAMPLE_OR_SCHEMA | FAILS_CLOSED_IF_MISSING |
|---|---|---|---|---|
| `DATABASE_URL` | REQUIRED | SERVER | Oui (partagé, tout le dépôt) | Oui — Prisma refuse de démarrer |
| Token public de devis | — | SERVER | N/A — opaque, généré et haché en base, aucun secret externe | Oui — hash ne correspond à rien |
| `BusinessConfig` (`quotes.costPolicy`, `pricing.candidatIndividuelPipeline`) | OPTIONAL | SERVER | Oui, fallback codé (`DEFAULT_COST_POLICY`, `state='OFF'`) | Oui — dégrade vers le fallback sûr, jamais une erreur silencieuse |

Aucune nouvelle dépendance runtime introduite par T1–T4. Aucun secret créé ni modifié.

## Migrations (§9)

`git log --name-only e7f4e3f92..b2efd1cf7 -- prisma/migrations prisma/schema.prisma` = **vide** : aucune
migration ni changement de schéma introduit par T1–T4. 87 migrations au total dans le dépôt (préexistantes,
sans rapport). `prisma validate` = PASS. `prisma migrate deploy` sur la DB de test jetable = « No pending
migrations to apply ».

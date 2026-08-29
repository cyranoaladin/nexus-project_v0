# Archive de demande de décision — risque d'outillage npm résiduel

## Statut

`SUPERSEDED_BY_DEPENDENCY_FIX`

La demande a été rendue sans objet par le commit
`70d2be3b6f51f91231d257f65682587e5c154eb2`. Toutes les chaînes concernées
résolvent désormais vers `brace-expansion@5.0.8`, l'audit npm complet est à
zéro vulnérabilité et aucune exception liée au SHA n'est nécessaire.

Ce document reste suivi uniquement pour préserver l'historique exact. Il ne
doit pas être complété, signé, injecté dans un secret GitHub ou utilisé pour
qualifier une nouvelle tête.

## Résolution appliquée

- migration ESLint 10 flat-config, Jest 30 et générateur natif `npm sbom` ;
- suppression des consommateurs historiques `minimatch@3` et `minimatch@9` ;
- suppression de l'override `brace-expansion`, du `postinstall` et de tout
  adaptateur modifiant `node_modules` ;
- vérification de l'API native `minimatch@10` / `brace-expansion@5.0.8` ;
- vérification du plafond mémoire officiel
  `EXPANSION_MAX_LENGTH=4_000_000` ;
- `BRACE_EXPANSION_VULNERABLE_VERSION_COUNT=0` ;
- audit npm complet et runtime : zéro vulnérabilité.

Le rapport technique actif est
`docs/security/2026-07-30-dependency-risk-report.md`.

## Archive historique — risque initialement soumis

- avis : `GHSA-mh99-v99m-4gvg` ;
- package : `brace-expansion <=5.0.7` ;
- sévérité : HIGH, CVSS 7.5 ;
- audit complet : 36 entrées high, aucune critical ;
- audit production : zéro vulnérabilité ;
- runtime : absent du SBOM et du standalone ;
- entrée publique : non atteignable ;
- entrée CI : contenu contrôlé du dépôt uniquement ;
- suivi : `https://github.com/cyranoaladin/nexus-project_v0/issues/83`.

Les détails et expériences figurent dans
`docs/security/2026-07-30-dependency-risk-report.md`.

## Archive historique — durée proposée

Maximum quatorze jours à partir de l'approbation, sans dépasser
`2026-08-13T23:59:59+01:00` pour une décision prise le 30 juillet, ni la borne
absolue de politique `2026-08-31T23:59:59+01:00`.

## Archive historique — SHA auquel la décision aurait été liée

La décision doit être liée au **SHA de tête final et poussé** de
`fix/bilan-foundation-readiness-20260730`.

Le SHA ne peut pas être inscrit à l'avance dans un fichier appartenant à ce
même commit : toute inscription changerait le SHA et invaliderait la liaison.
Après le dernier commit, l'intégrateur doit publier le résultat exact de :

```bash
git rev-parse HEAD
```

dans la draft PR et dans le rapport final. Aucune modification de code ne doit
suivre l'approbation ; sinon `BOUND_SHA_CHANGED` doit révoquer la décision.

## Archive historique — champs qui auraient été requis

- `ownerName` réel ;
- `securityApproverName` réel ;
- affirmation explicite `securityResponsibilityAssumption: true` ;
- `approvedAt` réel ;
- `expiresAt` conforme ;
- méthode de signature réelle ;
- signature ou identité vérifiable ;
- reconnaissance explicite du risque résiduel.

L'agent ne renseigne aucun de ces champs.

## Archive historique — modèle jamais approuvé

```json
{
  "schemaVersion": "1.1.0",
  "decisionId": "<OWNER_DECISION_ID>",
  "decision": "APPROVE_TIME_BOUND_DEV_TOOLING_EXCEPTION",
  "repository": "cyranoaladin/nexus-project_v0",
  "pullRequest": 79,
  "stageProductSha": "<FINAL_PUSHED_HEAD_SHA>",
  "ciEvidenceSha": "<FINAL_PUSHED_HEAD_SHA>",
  "advisoryId": "GHSA-mh99-v99m-4gvg",
  "severity": "HIGH",
  "affectedPackage": "brace-expansion",
  "affectedVersions": "<=5.0.7",
  "exactDependencyPaths": [
    "node_modules/brace-expansion",
    "node_modules/cacache/node_modules/brace-expansion"
  ],
  "runtimeExposure": "ABSENT",
  "runtimeSbomExposure": "ABSENT",
  "productionAuditResult": "ZERO_HIGH_CRITICAL",
  "fullAuditResult": "36_HIGH_NO_CRITICAL",
  "publicInputReachability": "NOT_REACHABLE",
  "ciInputReachability": "TRUSTED_REPOSITORY_INPUT_ONLY",
  "compensatingControls": [
    "RAW_AUDIT_ARCHIVED",
    "RUNTIME_SBOM_VERIFIED",
    "STANDALONE_ARTIFACT_VERIFIED",
    "CI_JOB_HAS_NO_PRODUCTION_SECRETS"
  ],
  "ownerName": "<REAL_OWNER_NAME>",
  "securityApproverName": "<REAL_SECURITY_APPROVER_NAME>",
  "securityResponsibilityAssumption": true,
  "approvedAt": "<REAL_ISO_8601_APPROVAL_TIME>",
  "expiresAt": "<ISO_8601_AT_MOST_14_DAYS_LATER>",
  "monitoringIssue": "https://github.com/cyranoaladin/nexus-project_v0/issues/83",
  "upstreamTracking": [
    "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
    "https://www.npmjs.com/package/brace-expansion"
  ],
  "automaticRevocationConditions": [
    "OFFICIAL_FIX_AVAILABLE",
    "NPM_TREE_CHANGED",
    "BOUND_SHA_CHANGED",
    "ADDITIONAL_ADVISORY_DETECTED",
    "RUNTIME_PRESENCE_DETECTED",
    "CRITICAL_SEVERITY_DETECTED",
    "PUBLIC_INPUT_REACHABLE",
    "COMPENSATING_CONTROL_MISSING"
  ],
  "residualRiskAcknowledgement": "<EXPLICIT_OWNER_ACKNOWLEDGEMENT>",
  "signatureMethod": "<VERIFIABLE_METHOD>",
  "signature": "<VERIFIABLE_SIGNATURE>"
}
```

Le champ `pullRequest: 79` est imposé par le schéma de politique actuellement
versionné ; il identifie la décision de campagne d'origine. Le SHA, et non ce
numéro historique, borne la tête de code actuelle. Modifier cette politique
est une décision de gouvernance distincte et n'est pas fait silencieusement
dans ce lot.

## Action exacte requise

Aucune approbation de risque et aucune modification de secret ne sont requises
ou acceptées pour la tête corrigée. Les jobs doivent qualifier directement le
graphe de dépendances corrigé. Toute réapparition d'une version
`brace-expansion <=5.0.7` doit faire échouer la CI.

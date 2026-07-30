# Demande de décision — risque d'outillage npm résiduel

## Statut

`OWNER_DECISION_REQUIRED`

Ce document prépare une décision ; il ne constitue ni une approbation, ni une
signature, ni une acceptation de risque.

## Risque soumis

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

## Durée proposée

Maximum quatorze jours à partir de l'approbation, sans dépasser
`2026-08-13T23:59:59+01:00` pour une décision prise le 30 juillet, ni la borne
absolue de politique `2026-08-31T23:59:59+01:00`.

## SHA auquel lier la décision

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

## Champs que le propriétaire doit fournir

- `ownerName` réel ;
- `securityApproverName` réel ;
- affirmation explicite `securityResponsibilityAssumption: true` ;
- `approvedAt` réel ;
- `expiresAt` conforme ;
- méthode de signature réelle ;
- signature ou identité vérifiable ;
- reconnaissance explicite du risque résiduel.

L'agent ne renseigne aucun de ces champs.

## Modèle non valide tant qu'il contient des placeholders

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

1. vérifier le SHA final publié dans la draft PR ;
2. vérifier les artefacts des jobs Dependency Integrity et Security Scan ;
3. compléter et signer le JSON ;
4. remplacer, par une action propriétaire, le secret
   `PRE_RENTREE_DEV_TOOLING_EXCEPTION_JSON` ;
5. relancer les jobs sans modifier le code ;
6. supprimer l'exception dès satisfaction de l'issue #83 ou à l'expiration.

Sans ces six actions, le verdict CI reste rouge et aucune fusion ne doit être
présentée comme approuvée.

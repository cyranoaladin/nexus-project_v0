# R5 — Scope différé : preuve de non-vente (§10)

Baseline : `ea7a86d88`. Preuve technique autoritative : `__tests__/architecture/t4-v1-release-freeze.test.ts`
et `__tests__/architecture/t3a-catalogue-approval-isolation.test.ts` (26/26 PASS sur cette baseline, rejoué
le 2026-08-28 — voir `technical/test-run-log.txt`). Une capture UI réelle complémentaire est fournie pour
`MOD_MATHS_EXPERTES` (`R5-deferred-scope-ui.png`) : sélectionné comme `specialite2`, le profil reste bloqué
(badge « Arbitrage direction requis », bouton « Créer un brouillon de devis » désactivé) — aucun devis,
donc aucune vente possible. Note honnête : dans cette capture précise, le profil TERMINALE utilisé n'a
aucune dispense déclarée, donc HG/ES/EMC (également `DIRECTION_A_VALIDER`) contribuent aussi au blocage
affiché — la capture prouve « aucune vente », pas isolément le motif propre à MOD_MATHS_EXPERTES
(`HUMAN_REVIEW_REQUIRED`, coefficient non sourcé) ; ce motif isolé est prouvé par le test technique cité
ci-dessous, pas par cette capture.

| Élément | VISIBLE_AS_SELLABLE | FORGED_PAYLOAD_FAIL_CLOSED | COMMENTS |
|---|---|---|---|
| `MOD_HG_ARIA` | NO | PASS | `t4-v1-release-freeze.test.ts` — profil nominal (aucune dispense) → `DIRECTION_APPROVAL_REQUIRED`, dans `pendingModuleIds`, jamais confondu avec un module approuvé. |
| `MOD_ES_ARIA` | NO | PASS | idem. |
| `MOD_EMC_ARIA` | NO | PASS | idem ; aucun `MODULE_LEGACY_MAPPING` (gap double, documenté). |
| `MOD_EAF_DESCRIPTIF` | NO | PASS | `t4-v1-release-freeze.test.ts` — jamais une ligne tarifée, dans aucun tier, même après le fix T5R (F1) qui a rendu son frère `MOD_EAF_ECRIT_ORAL` atteignable. |
| `MOD_MATHS_EXPERTES` | NO | PASS | `t4-v1-release-freeze.test.ts` (payload forgé) → `HUMAN_REVIEW_REQUIRED` (coefficient non sourcé), jamais `READY`, jamais de `QuoteLine`. Confirmé aussi en UI réelle ci-dessus (voir note). |
| `MOD_MATHS_COMPLEMENTAIRES` | NO | PASS | `t4-v1-release-freeze.test.ts` (payload forgé) → `HUMAN_REVIEW_REQUIRED`, jamais `READY`. |
| `MOD_DGEMC` | NO | PASS | `t3a-catalogue-approval-isolation.test.ts` + `catalogue.test.ts` — `NEEDS_HUMAN_REVIEW`/`EXCLUDED` selon le cas, jamais `SELECTED`. |
| `MOD_LCA` | NO | PASS | idem. |
| `SVC_BACS_BLANCS` | NO | PASS | `t4-v1-release-freeze.test.ts` — structurellement inatteignable : aucun champ de `publicInput`/`staffExtension` ne peut le sélectionner (`catalogue.services` n'est câblé que pour `SVC_PILOTAGE`/`SVC_SECOND_GROUPE`), confirmé par l'isolation dédiée `t3d-bacs-blancs.test.ts`. |
| `SVC_SECOND_GROUPE` (P11) | NO | PASS | `t4-v1-release-freeze.test.ts` (payload forgé, `moyenneRattrapage` dans la bande P11) → `DIRECTION_APPROVAL_REQUIRED`, `pendingServiceIds` le contient, jamais `READY`. Rejoue `second-groupe-p11.test.ts`. |

**Conclusion** : les 10 éléments `DEFERRED_FROM_V1` restent `NO / PASS` sur la baseline `ea7a86d88`. Aucune
activation n'a été tentée pendant T5B (interdiction §0 respectée).

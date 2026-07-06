# Prompts des prochains lots Codex

## Mise à jour Lot 15 — prompt recommandé suivant

Le prochain lot recommandé est une revue humaine finale avant push. Lot 15 indique `LOCAL_COMMITS_COMPLETE` et `READY_FOR_PUSH_REVIEW`, avec seulement deux exclusions non suivies documentées.

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 15 sont terminés avec réserves.

Objectif : préparer la revue humaine finale avant push, sans push automatique, sans PR automatique et sans déploiement.

Préconditions :
- vérifier `git status --short --untracked-files=all` ;
- vérifier que les seuls fichiers non suivis sont `docs/audits/audit-nexus-reussite.md` et `rapport_audit_2_07_2026.md` ;
- vérifier `git diff --cached --name-only` vide ;
- vérifier les 6 P1 dans `docs/go-live/api-security-matrix.full.md`.

Actions :
- ne pas pousser sans décision humaine explicite ;
- ne pas créer de PR sans demande explicite ;
- ne pas déployer et ne lancer aucune migration ;
- refaire une vérification courte si push demandé : typecheck, lint, P1 matrix, staging vide.

Décisions maintenues :
- `BETA_CONTROLEE_ALLOWED_WITH_RESERVES` ;
- `BETA_ELARGIE_BLOCKED` tant que Redis/Upstash et 429 runtime ne sont pas prouvés ;
- `GO_LIVE_LARGE_BLOCKED`.
```

---

## Mise à jour Lot 14 — prompt recommandé suivant

Le prochain lot recommandé est une revue humaine de push/PR, sans push automatique par Codex et sans déploiement. Lot 14 indique `LOCAL_COMMITS_EXECUTED` et `READY_FOR_PUSH_REVIEW`.

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 14 sont terminés avec réserves. Les 9 commits locaux du runbook Lot 11 ont été exécutés, plus le commit documentaire Lot 14 si présent localement.

Objectif : préparer la revue humaine avant push, sans push automatique, sans PR automatique et sans déploiement.

Préconditions :
- vérifier `git log --oneline` et confirmer la séquence de commits locaux ;
- vérifier `git diff --cached --name-only` vide ;
- vérifier que `rapport_audit_2_07_2026.md`, `docs/audits/audit-nexus-reussite.md`, `.env*`, `.next`, `node_modules`, `test-results` et `playwright-report` ne sont pas staged ;
- relire `docs/go-live/28_LOT14_LOCAL_COMMITS_EXECUTION.md` et `docs/go-live/_evidence/lot14-post-commit-go-no-go.md`.

Actions :
- ne pas pousser sans décision humaine explicite ;
- si push demandé, refaire une vérification courte : typecheck, lint, P1 matrix, staging vide, statut Git ;
- préparer une PR uniquement si demandé explicitement ;
- ne pas déployer, ne pas lancer de migration, ne pas modifier de secret.

Décisions maintenues :
- `BETA_CONTROLEE_ALLOWED_WITH_RESERVES` ;
- `BETA_ELARGIE_BLOCKED` tant que Redis/Upstash et 429 runtime ne sont pas prouvés ;
- `GO_LIVE_LARGE_BLOCKED`.
```

---

## Mise à jour Lot 13 — prompt recommandé suivant

Le prochain lot recommandé est l'exécution humaine manuelle des 9 commits du runbook Lot 11. Le Lot 13 a validé le verrou precommit sans `git add` réel, sans commit, sans push et sans PR.

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 13 sont terminés avec réserves. Lot 13 indique `READY_TO_EXECUTE_MANUALLY`.

Objectif : exécuter manuellement les 9 commits du runbook Lot 11, sans push ni PR automatique.

Préconditions :
- relire `docs/go-live/_evidence/lot11-human-commit-runbook.md` ;
- relire `docs/go-live/_evidence/lot13-human-execution-checklist.md` ;
- vérifier `git diff --cached --name-only` vide ;
- confirmer que `docs/audits/audit-nexus-reussite.md` reste exclu ;
- confirmer qu'aucun `.env*`, `rapport_audit_2_07_2026.md`, `test-results`, `playwright-report`, `.next`, `node_modules` n'est staged.

Actions :
- exécuter uniquement le bloc `git add -- ...` du commit courant ;
- vérifier `git diff --cached --name-only` ;
- relancer les tests recommandés du bloc ;
- committer uniquement si le staging correspond exactement au bloc ;
- répéter pour les 9 commits ;
- ne pas pousser, ne pas créer de PR, ne pas déployer.

Décision : bêta élargie et go-live large restent interdits tant que Redis/Upstash et un vrai `429` runtime ne sont pas prouvés.
```

---

## Mise à jour Lot 11 — prompt recommandé suivant

Le prochain lot recommandé est l'exécution humaine des commits en suivant le runbook Lot 11, après décision explicite sur le fichier en revue humaine. Codex ne doit pas faire de commit, push ou PR sans demande explicite.

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 11 sont terminés avec réserves. Ne fais aucun commit automatique sans demande explicite.

Lis d'abord :
- `docs/go-live/_evidence/lot11-human-commit-runbook.md`
- `docs/go-live/_evidence/lot11-human-commit-runbook-proof.md`
- `docs/go-live/_evidence/lot11-human-review-pending-files.md`
- `docs/go-live/_evidence/lot11-final-human-commit-register.md`
- `__tests__/scripts/release-candidate-human-commit-runbook.test.ts`

Objectifs :
1. Faire décider humainement le sort de `docs/audits/audit-nexus-reussite.md`.
2. Relancer les tests ciblés scripts/manifeste/dry-run/runbook.
3. Si validation humaine reçue, exécuter les `git add` réels commit par commit en suivant exactement le runbook Lot 11.
4. Vérifier avant chaque commit qu'aucun fichier exclu, fichier en revue humaine non validé, artefact généré ou configuration locale sensible n'est staged.
5. Ne jamais pousser ni créer de PR sans demande explicite.
6. Maintenir les 6 P1 visibles, ClicToPay disabled, bêta élargie et go-live large bloqués tant que Redis/Upstash + 429 runtime ne sont pas prouvés.
```

---

## Mise à jour Lot 10 — prompt recommandé suivant

Le prochain lot recommandé est l'exécution humaine contrôlée des commits proposés, après validation explicite du fichier en revue humaine. Aucun commit automatique ne doit être fait par Codex sans demande explicite.

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 10 sont terminés avec réserves. Ne fais aucun commit automatique sans demande explicite.

Lis d'abord :
- `docs/go-live/_evidence/lot10-git-add-dry-run-plan.md`
- `docs/go-live/_evidence/lot10-git-add-dry-run-proof.md`
- `docs/go-live/_evidence/lot10-human-review-pending-files.md`
- `docs/go-live/_evidence/lot10-final-human-commit-register.md`
- `docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md`

Objectifs :
1. Faire décider humainement le sort de `docs/audits/audit-nexus-reussite.md`.
2. Relancer les tests ciblés scripts/manifeste/dry-run.
3. Si validation humaine reçue, exécuter les `git add` réels commit par commit en suivant exactement le plan Lot 10.
4. Vérifier avant chaque commit qu'aucun `.env`, `rapport_audit_2_07_2026.md`, artefact généré ou fichier `Needs human review` non validé n'est staged.
5. Ne jamais pousser ni créer de PR sans demande explicite.
6. Maintenir les 6 P1 visibles, ClicToPay disabled, bêta élargie et go-live large bloqués tant que Redis/Upstash + 429 runtime ne sont pas prouvés.
```

---

## Mise à jour Lot 9 — prompt recommandé suivant

Le prochain lot recommandé est une revue humaine RC puis une séquence de commits manuels, sans PR automatique.

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 9 sont terminés avec réserves. Ne fais aucun commit automatique sans demande explicite.

Lis d'abord :
- `docs/go-live/_evidence/lot9-human-review-checklist.md`
- `docs/go-live/_evidence/lot9-rc-manifest-consistency-proof.md`
- `docs/go-live/_evidence/lot9-final-release-candidate-register.md`
- `docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md`
- `docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md`

Objectifs :
1. Faire décider humainement le sort de `docs/audits/audit-nexus-reussite.md`.
2. Rejouer `__tests__/scripts/release-candidate-manifest-consistency.test.ts`.
3. Si validation humaine reçue, préparer les commits dans l'ordre proposé, sans inclure `rapport_audit_2_07_2026.md` ni `.env*`.
4. Si `NEXUS_HEALTH_AUTH` est fourni sans afficher sa valeur, exécuter le healthcheck runtime Redis/Upstash.
5. Si `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE=true` et fenêtre autorisée, exécuter la probe 429 non destructive.
6. Si `DATABASE_URL` non production et `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB=true` sont fournis, exécuter le dry-run ContactLead sans PII.
7. Ne jamais conclure bêta élargie ou go-live large sans Redis/Upstash et 429 runtime prouvés.
```

---

## Mise à jour Lot 5 — prompt recommandé suivant

Le prochain lot recommandé est un Lot 6 de preuve staging/production assistée humainement. Il doit partir de `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`, avec `/api/internal/rate-limit-probe` disponible.

```md
Tu es le lead senior full-stack, CTO, responsable infra runtime, paiement, RGPD mineurs, sécurité API et garant go-live de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute Lot 6 — validation staging/production assistée humainement et levée go/no-go.

Objectifs :
- maintenir `P0=0` sans reclassifier artificiellement les 6 P1 ;
- obtenir un credential healthcheck sécurisé fourni par l'humain sans jamais l'afficher ;
- prouver `runtime.rateLimit.mode=redis|upstash`, `distributed=true`, `goLiveLarge=allowed` sur staging/production ;
- exécuter un test 429 réel sur `/api/internal/rate-limit-probe` en staging ou fenêtre production dédiée ;
- exécuter `scripts/maintenance/contact-leads-retention.ts` en dry-run contre une DB non production puis préparer validation humaine `--apply` ;
- conserver ClicToPay `DISABLED` ou ouvrir un lot paiement complet séparé ;
- confirmer BusinessConfig production : `database` ou fallback explicitement autorisé, sinon healthcheck dégradé ;
- relancer gates Node 20 et Playwright publics.

Contraintes :
- aucun secret affiché, aucun `.env`, aucune migration destructive, aucun déploiement sans demande explicite ;
- pas de test 429 bruyant sur production sans fenêtre dédiée ;
- pas de `--apply` ContactLead en production sans validation humaine ;
- verdict bêta élargie interdit tant que Redis/Upstash et 429 réel ne sont pas prouvés.
```

---

## Mise à jour Lot 4 — prompt recommandé suivant

Le prochain lot recommandé est un Lot 5 runtime staging/exploitation. Il doit partir de `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`, avec assessment token désormais bindé à un lead/cookie.

```md
Tu es le lead senior full-stack, CTO, responsable infra runtime, responsable RGPD mineurs, responsable paiement et garant go-live de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute Lot 5 — preuve runtime staging/production, exploitation ContactLead et décision ClicToPay.

Objectifs :
- maintenir `P0=0` sans maquiller les 6 P1 publics/paiement ;
- prouver Redis/Upstash sur staging/production via `/api/internal/health` authentifié sans afficher de secret ;
- exécuter un test 429 réel sur route publique non destructive ou staging dédié ;
- relancer Playwright public et `e2e/pages-public-bilan-assessment-token.spec.ts` après build ;
- valider un run `scripts/maintenance/contact-leads-retention.ts --dry-run`, puis préparer un runbook `--apply` validé humainement ;
- décider ClicToPay : désactivation contractuelle long terme ou lot d'intégration complet ;
- vérifier que `business_configs` ne masque pas une production non migrée ;
- régénérer `API_GUARD_INVENTORY.md` et `api-security-matrix.full.md`.

Contraintes :
- aucun secret affiché, aucun `.env`, aucune migration destructive, aucun déploiement sans demande explicite ;
- verdict interdit si Redis/Upstash reste non prouvé ou si Playwright assessment échoue après rebuild.
```

---

## Mise à jour Lot 3 — prompt recommandé suivant

Le prochain lot recommandé est un Lot 4 paiement/facturation/entitlements et preuve runtime finale. Il doit partir de `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`, avec `/api/assessments/submit` désormais protégé par token court.

```md
Tu es le lead senior full-stack, CTO, responsable paiement/facturation, responsable infra runtime, responsable RGPD mineurs, responsable QA et garant go-live de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute Lot 4 — Paiement/facturation/entitlements, purge leads et preuve runtime go-live.

Objectifs :
- maintenir `P0=0` ;
- ne pas réactiver ClicToPay sauf intégration complète : signature, idempotence, montant, devise, productCode, invoice reconciliation, entitlement activation, replay protection, audit log et tests E2E ;
- si ClicToPay reste désactivé, documenter commercialement le paiement manuel uniquement et conserver `init/webhook` sans succès ambigu ;
- prouver Redis/Upstash sur staging/production via `/api/internal/health` authentifié sans afficher de secret, puis réaliser un test 429 réel non destructif ;
- implémenter ou planifier de façon exécutable la purge/anonymisation `ContactLead` selon la politique Lot 3 ;
- vérifier que `/api/assessments/submit` token court reste opérationnel et que la route d'émission staff-only ne fuit aucun secret ;
- aligner paiement -> facture -> entitlement et pricing canonique.

Contraintes :
- aucun secret affiché, aucun `.env`, aucune migration destructive, aucun déploiement sans demande explicite ;
- aucune route P1 ne devient P2/OK sans code, tests et justification route par route ;
- aucune réponse publique/non staff ne contient `password`, `activationToken`, `activationUrl`, `tokenHash`, `localPath`, `pdfPath`, `filePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata` brute, `bankReference`, `rawWebhook`, `rawPayload` ou ID interne non nécessaire.

Commandes finales sous Node 20 :
`npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `node scripts/security/audit-api-guards.mjs`, `node scripts/go-live/generate-api-security-matrix.mjs`, `npm run audit:site-map`, `npm run check:no-hardcoded`, `npm run check:docs-archive`, `npm run check:bundle-weight`, smoke Playwright public ciblé.

Livrable : rapport Lot 4 avec preuve Redis/Upstash ou blocage, statut ClicToPay, statut entitlement/facture, purge leads, décision bêta contrôlée/élargie/go-live large.
```

---

## Mise à jour Lot 2 — prompt recommandé suivant

Le prochain lot recommandé est un Lot 3 runtime, RGPD mineurs et parcours pédagogiques publics. Il doit partir des décisions Lot 2 : `/api/bilan-gratuit` est en `lead_only`, ClicToPay webhook reste désactivé, et Redis/Upstash n'est pas prouvé en runtime réel.

```md
Tu es le lead senior full-stack, CTO, responsable RGPD mineurs, responsable infra runtime, responsable paiement et garant go-live de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute Lot 3 — Preuve runtime Redis/Upstash, tokens courts pédagogiques, RGPD mineurs et préparation paiement.

Objectifs :
- maintenir `P0=0` ;
- ne pas réactiver ClicToPay tant que webhook, idempotence, montant, devise, invoice et entitlement ne sont pas complets ;
- prouver Redis/Upstash en staging/production via `/api/internal/health` authentifié sans exposer de secret, puis réaliser un test 429 réel ;
- si Redis/Upstash n'est pas prouvé, laisser go-live large interdit ;
- transformer `/api/assessments/submit` en flux token signé court ou session autorisée si le résultat doit être rattaché à un élève ;
- statuer `/api/lamis/teacher-report` : public anonyme minimisé ou token/session ;
- conserver `/api/bilan-gratuit` en `lead_only` et compléter registre RGPD/minimisation/suppression lead ;
- mettre à jour politique confidentialité et registre traitements mineurs ;
- définir le plan ClicToPay : désactivation contractuelle durable ou implémentation complète.

Contraintes :
- aucun secret, aucun `.env`, aucune migration destructive, aucun déploiement ;
- aucune route publique sensible ne retourne `password`, `activationToken`, `activationUrl`, `tokenHash`, `localPath`, `filePath`, `pdfPath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata` brute, `bankReference`, `rawWebhook`, `rawPayload` ou ID interne non nécessaire ;
- toute décision "public" doit être justifiée par finalité, minimisation, consentement, rate limit et tests no-leak.

Commandes finales sous Node 20 :
`npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `node scripts/security/audit-api-guards.mjs`, `node scripts/go-live/generate-api-security-matrix.mjs`, `npm run audit:site-map`, `npm run check:no-hardcoded`, `npm run check:docs-archive`, `npm run check:bundle-weight`, smoke Playwright public ciblé.

Livrable : preuve runtime ou blocage, décisions token/session, registre RGPD mineurs, statut ClicToPay et décision bêta contrôlée/élargie/go-live large.
```

---

## Mise à jour Lot 1-quinquies — prompt recommandé suivant

Le prochain lot recommandé est un Lot 2 produit/RGPD et paiement public, après réduction sécurité API à `P0=0`, `P1=6`, `P2=143`, `OK=27`. Il doit arbitrer les P1 restants au lieu de les reclassifier artificiellement.

```md
Tu es le lead senior full-stack, CTO, responsable produit, RGPD mineurs, paiement, QA et go-live de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute le prochain lot — Arbitrage produit/RGPD des routes publiques P1 et préparation paiement.

Objectifs :
- maintenir `P0=0` ;
- traiter route par route les 6 P1 restants : `/api/payments/clictopay/webhook`, `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/lamis/teacher-report`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate` ;
- transformer `/api/bilan-gratuit` en mode `lead_only` pour campagnes ou assumer explicitement `account_activation` avec consentement RGPD ;
- décider si `/api/assessments/submit` et `/api/lamis/teacher-report` restent publics ou passent derrière token/session ;
- garder ClicToPay désactivé tant que webhook/idempotence/montant/devise/entitlements ne sont pas complets ;
- prouver Redis/Upstash sur staging/production via healthcheck authentifié ou garder go-live large interdit ;
- conserver tests no-leak/rate-limit et régénérer `docs/security/API_GUARD_INVENTORY.md` + `docs/go-live/api-security-matrix.full.md`.

Contraintes :
- aucun secret, aucun `.env`, aucune migration destructive, aucun déploiement ;
- aucune route P1 ne devient P2/OK sans code, test et décision produit documentée ;
- aucune réponse publique/non staff ne contient `password`, `activationToken`, `activationUrl`, `tokenHash`, `localPath`, `pdfPath`, `filePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata` brute, `bankReference`, `rawWebhook`, `rawPayload`.

Commandes finales sous Node 20 :
`npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `node scripts/security/audit-api-guards.mjs`, `node scripts/go-live/generate-api-security-matrix.mjs`, `npm run audit:site-map`, `npm run check:no-hardcoded`, `npm run check:docs-archive`, `npm run check:bundle-weight`, smoke Playwright public ciblé.

Livrable : décision route par route, P1 avant/après, preuve runtime Redis/Upstash ou blocage explicite, décision bêta contrôlée/élargie/go-live large.
```

---

## Mise à jour Lot 1-quater — prompt recommandé suivant

Le prochain lot recommandé est un Lot 1-quinquies ciblé sur les 12 P1 restants et la preuve runtime Redis/Upstash. Il doit partir de `P0=0`, `P1=12`, `P2=137`, `OK=27`.

```md
Tu es le lead senior full-stack, CTO, responsable sécurité API, responsable RGPD mineurs, responsable QA, responsable infra runtime et garant go-live de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute Lot 1-quinquies — Fermeture des 12 P1 restants et preuve runtime Redis/Upstash.

Objectifs :
- maintenir `P0=0` ;
- fermer ou justifier route par route les P1 restants : `/api/payments/clictopay/webhook`, `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/lamis/teacher-report`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate`, et les 6 routes admin P1 ;
- ne pas activer ClicToPay sauf intégration complète signature/idempotence/montant/devise/entitlement ;
- prouver Redis ou Upstash sur staging/production sans lire de secret, ou documenter le blocage go-live large ;
- ajouter tests no-leak/rate-limit/IDOR ou justification explicite pour chaque P1 restant ;
- régénérer `docs/security/API_GUARD_INVENTORY.md` et `docs/go-live/api-security-matrix.full.md`.

Contraintes :
- aucun secret, aucun `.env`, aucune migration destructive, aucun déploiement ;
- aucune route P1 ne devient P2/OK sans preuve code + test ou justification documentée ;
- `/api/bilan-gratuit` reste dette produit/RGPD tant que le mode lead-only n'est pas arbitré.

Commandes finales sous Node 20 :
`npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `node scripts/security/audit-api-guards.mjs`, `node scripts/go-live/generate-api-security-matrix.mjs`, `npm run audit:site-map`, `npm run check:no-hardcoded`, `npm run check:docs-archive`, `npm run check:bundle-weight`, smoke Playwright public ciblé.

Livrable : rapport Lot 1-quinquies avec P1 avant/après, preuve Redis/Upstash ou blocage, décision bêta contrôlée/élargie/go-live large.
```

---

## Mise à jour Lot 1-ter — prompt recommandé suivant

Le prochain lot recommandé est un Lot 1-quater ciblé sur les P1 restants et la preuve runtime du rate limiting distribué. Il doit partir de `P0=0`, `P1=37`, `P2=112`, `OK=27`.

```md
Tu es le lead senior full-stack, responsable sécurité API, RGPD mineurs, QA et go-live de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute Lot 1-quater — Fermeture P1 publics/stages/assistante/parent/student et preuve rate limiting distribué.

Objectifs :
- réduire les 37 P1 restants de `docs/go-live/api-security-matrix.full.md`, en priorité `/api/payments/clictopay/webhook`, `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/stages/[stageSlug]/inscrire`, `/api/assistante/quotes/pdf`, routes assistante crédits/subscriptions, routes parent subscriptions/children, routes student automatismes/survival/trajectory et routes coach notes/survival/trajectory ;
- ne pas activer ClicToPay : le webhook doit rester `501` ou être entièrement sécurisé avec signature, idempotence, montant/devise, productCode et absence de mutation non signée ;
- prouver ou bloquer le rate limiting distribué Redis/Upstash en runtime production/staging sans lire de secret ;
- ajouter Zod strict, rate limit, projections explicites et tests d'accès croisé pour chaque route traitée ;
- régénérer `docs/security/API_GUARD_INVENTORY.md` et `docs/go-live/api-security-matrix.full.md`.

Contraintes :
- aucun secret, aucun `.env`, aucune migration destructive, aucun déploiement ;
- aucune route P1 ne devient P2/OK sans test ou justification route par route ;
- aucune réponse publique/non staff ne contient `password`, `activationToken`, `activationUrl`, `tokenHash`, `localPath`, `pdfPath`, `filePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata` brute, `bankReference`, `rawWebhook`, `rawPayload`.

Commandes finales sous Node 20 :
`npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `node scripts/security/audit-api-guards.mjs`, `node scripts/go-live/generate-api-security-matrix.mjs`, `npm run audit:site-map`, `npm run check:no-hardcoded`, `npm run check:docs-archive`, `npm run check:bundle-weight`, smoke Playwright public ciblé.

Livrable : rapport Lot 1-quater avec P1 avant/après, tests, routes restantes, décision bêta contrôlée/élargie/go-live large.
```

---

## Mise à jour Lot 1-bis — prompt recommandé suivant

Le prochain lot recommandé est un Lot 1-ter ciblé P1 paiement/factures/bilans avant de basculer sur un lot produit. Il doit partir de `P0=0`, `P1=54`, `P2=95`, `OK=27`.

```md
Tu es le lead senior full-stack, responsable sécurité API, paiement/facturation, RGPD mineurs et QA de Nexus Réussite.

Travaille dans `nexus-project_v0`.

Exécute Lot 1-ter — Fermeture P1 paiement, factures, bilans/assessments et routes coach reports.

Objectifs :
- réduire les P1 de `docs/go-live/api-security-matrix.full.md`, en priorité `/api/admin/invoices`, `/api/payments/clictopay/*`, `/api/assessments/submit`, `/api/bilans*`, routes coach generate/regenerate et NPC documents ;
- ne jamais activer ClicToPay : garder 501 tant que signature, idempotence, montant/devise et entitlements ne sont pas complets ;
- ajouter Zod strict/projections explicites/tests IDOR pour chaque route traitée ;
- régénérer `docs/security/API_GUARD_INVENTORY.md` et `docs/go-live/api-security-matrix.full.md` ;
- produire `docs/go-live/13_LOT1TER_P1_SECURITY_CLOSURE.md`.

Contraintes :
- aucun secret, aucun `.env`, aucune migration destructive, aucun déploiement ;
- aucune route P1 ne devient OK sans test ;
- aucune réponse publique/non staff ne contient `password`, `activationToken`, `activationUrl`, `tokenHash`, `localPath`, `pdfPath`, `filePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata` brute.

Commandes finales sous Node 20 :
`npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `node scripts/security/audit-api-guards.mjs`, `node scripts/go-live/generate-api-security-matrix.mjs`, `npm run audit:site-map`, `npm run check:no-hardcoded`, `npm run check:docs-archive`, `npm run check:bundle-weight`, smoke Playwright public ciblé.
```

---

## Prompt Lot 1 — sécurité API, IDOR, rate limiting distribué

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 1 sécurité API.

Contraintes : ne modifie aucun `.env`, ne déploie pas, ne lis aucun secret. Commence par lire `AGENTS.md`, `docs/go-live/00_EXECUTIVE_STATE.md`, `02_P0_P1_BACKLOG.md`, `05_API_SECURITY_MATRIX.md` et `docs/security/API_GUARD_INVENTORY.md`.

Objectif : fermer les P0 API les plus risqués et prouver le rate limiting distribué ou documenter le blocage. Utilise `docs/go-live/api-security-matrix.full.md` comme matrice route par route, pas seulement l'inventaire brut.

Actions :
1. Traiter en premier le Top 20 Lot 1 : `/api/documents/[id]`, `/api/assistante/students/[studentId]/documents`, `/api/coach/students/[studentId]/documents`, `/api/npc/files/[...path]`, `/api/parent/bilans/[id]/pdf`, `/api/invoices/[id]/pdf`, `/api/invoices/[id]/receipt/pdf`, `/api/admin/invoices/[id]`, `/api/admin/invoices/[id]/send`, `/api/payments/clictopay/webhook`, `/api/assessments/submit`, `/api/bilan-gratuit`, routes coach report `[studentId]`.
2. Pour chaque route dynamique, vérifier auth, rôle, ownership, Zod, rate limit et données sensibles retournées.
3. Ajouter tests IDOR parent/élève/coach/assistante/admin avec ressource non propriétaire.
4. Ne pas refactorer massivement ; utiliser les helpers existants `lib/guards.ts`, `lib/rbac.ts`, `lib/access/*`.
5. Prouver ou bloquer le rate limiting distribué Redis/Upstash ; interdire fallback mémoire en production.
6. Régénérer `docs/security/API_GUARD_INVENTORY.md` et `docs/go-live/api-security-matrix.full.md`.
7. Mettre à jour `docs/go-live/05_API_SECURITY_MATRIX.md` avec les deltas.

Commandes : `npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `node scripts/security/audit-api-guards.mjs`.

Livrable final : routes corrigées, tests, risques restants, P0 encore ouverts.
```

## Prompt Lot 2 — pricing, offres, pages marketing, prérentrée août 2026

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 2 pricing/offres/conversion publique.

Lis `AGENTS.md`, `docs/go-live/06_BUSINESS_LOGIC_DECISIONS.md`, `08_MARKETING_CONTENT_CHECKLIST.md`, `data/pricing.canonical.json`, `lib/pricing.ts`.

Objectif : garantir que les pages publiques critiques sont cohérentes 2026/2027, sans prix hors canonique ni promesse excessive.

Actions : auditer `/`, `/offres`, `/recommandation`, `/bilan-gratuit`, `/stages`, `/plateforme-aria`, `/accompagnement-scolaire`, `/contact`, pages candidat libre/bac français. Corriger seulement les incohérences de contenu/pricing/CTA. Classer ou neutraliser reliquats activables avec montants obsolètes. Vérifier stage prérentrée août 2026.

Tests : `npm run check:no-hardcoded`, tests marketing, `npm run build`, smoke Playwright mobile si disponible.

Livrable : diff contenu, preuves pricing, risques restants.
```

## Prompt Lot 3 — CRM admissions, bilan gratuit, WhatsApp, tracking

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 3 CRM admissions.

Lis `AGENTS.md`, `docs/go-live/02_P0_P1_BACKLOG.md`, `08_MARKETING_CONTENT_CHECKLIST.md`, `app/bilan-gratuit/*`, `app/api/bilan-gratuit/route.ts`, `lib/crm/*`, `lib/whatsapp.ts`.

Objectif : transformer le bilan gratuit en tunnel lead bas-friction, traçable et conforme mineurs.

Actions : décider lead pur vs compte différé, ajouter source/UTM/referrer sans collecte excessive, vérifier consentement, anti-spam/rate-limit, emails internes, WhatsApp CTA. Ne pas demander de mot de passe en première intention.

Tests : formulaire, API validation, rate limit, email mock, no PII logs, build.

Livrable : parcours lead fiable et rapport de conformité.
```

## Prompt Lot 4 — paiement, facturation, entitlements

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 4 paiement/facturation/entitlements.

Lis `AGENTS.md`, `docs/go-live/02_P0_P1_BACKLOG.md`, `06_BUSINESS_LOGIC_DECISIONS.md`, `app/api/payments/*`, `lib/invoice/*`, `lib/entitlement/*`, `prisma/schema.prisma`.

Objectif : fiabiliser la source de vérité paiement -> facture -> entitlement et garder ClicToPay désactivé tant qu'il n'est pas complet.

Actions : aligner registre produit/pricing, idempotence, beneficiary, credits, PDF facture, accès parent/admin. Si ClicToPay non finalisé, le cacher clairement.

Tests : payments validate, invoice pdf, entitlement idempotence, ClicToPay 501 ou E2E complet, build.

Livrable : chaîne achat fiable et décisions restantes.
```

## Prompt Lot 5 — dashboards par rôle

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 5 dashboards.

Lis `AGENTS.md`, `docs/go-live/01_ACTION_PLAN.md`, `03_RELEASE_GATES.md`, `app/dashboard/**`, API parent/student/coach/assistante/admin.

Objectif : vérifier et corriger les workflows essentiels par rôle sans refonte visuelle massive.

Actions : smoke rôle par rôle, états vides, erreurs sobres, navigation, permissions, mobile. Prioriser parent, élève, coach, assistante, admin.

Tests : unit/API existants, Playwright login par rôle si fixtures disponibles, build.

Livrable : matrice dashboards, corrections, risques.
```

## Prompt Lot 6 — IA/RAG/NPC

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 6 IA/RAG/NPC.

Lis `AGENTS.md`, `docs/go-live/02_P0_P1_BACKLOG.md`, `lib/aria.ts`, `lib/rag-client.ts`, `docs/RAG_ARCHITECTURE.md`, `lib/npc/*`, `services/npc-worker/*`, `app/api/npc/*`.

Objectif : clarifier backend RAG canonique, feature flags ARIA, mode NPC, uploads et garde-fous pédagogiques.

Actions : aligner docs/code RAG, vérifier health, rendre `NPC_LLM_MODE` visible côté admin/coach si nécessaire, empêcher surpromesse stub, tester ownership fichiers NPC.

Tests : ARIA routes, RAG fallback, NPC uploads/files/submissions, build.

Livrable : IA exploitable en bêta contrôlée.
```

## Prompt Lot 7 — RGPD, logs, documents, mineurs

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 7 conformité données.

Lis `AGENTS.md`, `docs/go-live/02_P0_P1_BACKLOG.md`, `07_ENV_INFRA_CHECKLIST.md`, routes documents, pages légales, logger/serialize-error.

Objectif : minimiser et protéger données mineurs, documents, bilans, factures et logs.

Actions : consentement analytics, politique confidentialité, logs redaction, accès documents, rétention/suppression, no localPath leak, no PII in errors.

Tests : no-leak, documents IDOR, analytics consent, build.

Livrable : conformité minimale go-live et risques juridiques restants.
```

## Prompt Lot 8 — infra, backup, monitoring, release

```md
Tu travailles dans `nexus-project_v0`. Exécute le Lot 8 infra/release.

Lis `AGENTS.md`, `docs/go-live/03_RELEASE_GATES.md`, `07_ENV_INFRA_CHECKLIST.md`, `Dockerfile.prod`, `docker-compose.prod.yml`, `.github/workflows/ci.yml`, health routes.

Objectif : préparer la décision release avec preuves production, sans déployer sans demande explicite.

Actions : audit lecture seule production si autorisé, vérifier Docker/PM2/Nginx/SSL, backup/restore, monitoring, alerting, rollback, curls pages critiques.

Tests : health, smoke production, restore drill, bundle, build, Playwright.

Livrable : rapport release gate A/B/C/D et décision finale.
```
# Mise à jour Lot 1 — Prompt suivant recommandé

## Prompt Lot 1-bis — Fermeture P1 API restants

Tu travailles dans `nexus-project_v0`. Lot 1 a ramené `API_GUARD_INVENTORY.md` à `P0=0`, `P1=56`, `P2=93`, `OK=27`. Ne rouvre pas les P0 fermés sans preuve. Ta mission est de traiter les 20 P1 prioritaires listés dans `docs/go-live/api-security-matrix.full.md`, en commençant par sessions, documents admin/assistante, NPC documents, facturation admin, ClicToPay init/webhook, assessments submit et bilan gratuit.

Contraintes : ne lis aucun secret, ne modifie aucun `.env`, ne lance aucune migration destructive, ne déploie rien. Toute route corrigée doit avoir tests négatifs : non authentifié, mauvais rôle, ressource hors scope, payload invalide, champs sensibles absents. Régénère `docs/security/API_GUARD_INVENTORY.md` et `docs/go-live/api-security-matrix.full.md`, puis documente les P1 fermés et les réserves restantes.

## Prompt Lot 7 — preuve humaine runtime et release candidate finale

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 6 sont terminés avec réserves. N'ajoute pas de fonctionnalité large. Ta mission est d'obtenir les preuves humaines manquantes pour décider bêta élargie.

Préconditions humaines obligatoires :
- fournir `NEXUS_HEALTH_AUTH` dans le shell sans afficher sa valeur ;
- autoriser explicitement une fenêtre staging pour `/api/internal/rate-limit-probe` avec `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE=true` ;
- fournir une DB non production et `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB=true` si dry-run ContactLead doit être prouvé.

Actions :
- exécuter le healthcheck authentifié et vérifier `runtime.rateLimit.mode=redis|upstash`, `distributed=true`, `goLiveLarge=allowed`, `checks.redis.ok=true` ;
- exécuter un test 429 non destructif sur staging ;
- exécuter `scripts/maintenance/contact-leads-retention.ts` en dry-run DB non production ;
- rejouer les gates Node 20 et Playwright critiques ;
- mettre à jour `docs/go-live/_evidence/lot6-*` ou créer un Lot 7 de preuve runtime ;
- ne jamais afficher de secret, ne jamais modifier `.env`, ne jamais lancer `--apply` ContactLead.

Décision : bêta élargie reste interdite si Redis/Upstash ou 429 runtime ne sont pas prouvés.
```

## Prompt Lot 13 — exécution humaine contrôlée des commits

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 12 sont terminés avec réserves. Lot 12 a arbitré `docs/audits/audit-nexus-reussite.md` : il est exclu des commits standards sauf décision humaine explicite.

Objectif : exécuter les commits humains préparés par le runbook Lot 11, uniquement si le responsable valide le périmètre.

Préconditions :
- relire `docs/go-live/_evidence/lot11-human-commit-runbook.md` ;
- relire `docs/go-live/_evidence/lot12-human-review-decision-files.md` ;
- confirmer que `docs/audits/audit-nexus-reussite.md` reste exclu, ou fournir une décision humaine explicite ;
- vérifier staging Git vide avant chaque commit ;
- ne jamais inclure `.env*`, `rapport_audit_2_07_2026.md`, `test-results`, `playwright-report`, `.next`, `node_modules`.

Actions :
- exécuter les `git add -- ...` du runbook commit par commit ;
- vérifier `git diff --cached --name-only` après chaque staging ;
- relancer les tests recommandés par commit ;
- créer le commit humain si le staging correspond exactement au runbook ;
- ne pas créer de PR sans demande explicite ;
- garder les 6 P1 visibles.

Décision : bêta élargie reste interdite tant que Redis/Upstash et un vrai `429` runtime ne sont pas prouvés.
```

## Prompt Lot 14 — exécution humaine des commits du runbook

```md
Tu travailles dans `nexus-project_v0`. Les Lots 0 à 13 sont terminés avec réserves. Lot 13 indique `READY_TO_EXECUTE_MANUALLY`.

Objectif : exécuter manuellement les 9 commits du runbook Lot 11, sans push ni PR automatique.

Préconditions :
- relire `docs/go-live/_evidence/lot11-human-commit-runbook.md` ;
- relire `docs/go-live/_evidence/lot13-human-execution-checklist.md` ;
- vérifier `git diff --cached --name-only` vide ;
- confirmer que `docs/audits/audit-nexus-reussite.md` reste exclu sauf décision humaine explicite ;
- confirmer qu'aucun `.env*`, `rapport_audit_2_07_2026.md`, `test-results`, `playwright-report`, `.next`, `node_modules` n'est staged.

Actions :
- exécuter uniquement le bloc `git add -- ...` du commit courant ;
- vérifier `git diff --cached --name-only` ;
- relancer les tests recommandés du bloc ;
- committer uniquement si le staging correspond exactement au bloc ;
- répéter pour les 9 commits ;
- ne pas pousser, ne pas créer de PR, ne pas déployer.

Décision : bêta élargie et go-live large restent interdits tant que Redis/Upstash et un vrai `429` runtime ne sont pas prouvés.
```

## Prompt Lot 9 — commit humain RC et preuves staging

```md
Tu travailles dans `nexus-project_v0`. Lot 8 a produit un manifest RC propre et un plan de commits, sans commit.

Objectif : revue humaine puis commit par lots, uniquement si le responsable valide les fichiers.

Préconditions :
- relire `docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md` ;
- relire `docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md` ;
- décider explicitement du sort de `docs/audits/audit-nexus-reussite.md` ;
- ne jamais inclure `rapport_audit_2_07_2026.md` sans décision humaine explicite ;
- fournir `NEXUS_HEALTH_AUTH` et une fenêtre staging si les preuves runtime doivent être levées.

Actions :
- rejouer les gates Node 20 ;
- exécuter healthcheck Redis/Upstash authentifié si credential disponible ;
- exécuter `/api/internal/rate-limit-probe` sur staging si autorisé ;
- exécuter dry-run ContactLead contre DB non production si autorisé ;
- préparer les commits dans l'ordre du plan Lot 8 ;
- ne créer aucune PR sans demande explicite.

Décision : go-live large reste interdit tant que les 6 P1 ne sont pas acceptés humainement et que Redis/Upstash + 429 runtime ne sont pas prouvés.
```

## Prompt Lot 8 — preuve runtime humaine et préparation commit RC

```md
Tu travailles dans `nexus-project_v0`. Lot 7 a préparé la release candidate et audité les scripts, mais n'a pas levé les blocages runtime.

Objectif : exécuter uniquement les preuves humaines manquantes et préparer la mise en commit, sans ajouter de fonctionnalité.

Préconditions humaines :
- injecter `NEXUS_HEALTH_AUTH` dans le shell sans afficher sa valeur ;
- autoriser explicitement le test `/api/internal/rate-limit-probe` sur staging avec `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE=true` ;
- fournir une DB non production et `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB=true` pour dry-run ContactLead.

Actions :
- vérifier `/api/internal/health` authentifié : `mode=redis|upstash`, `distributed=true`, `goLiveLarge=allowed`, `checks.redis.ok=true` ;
- exécuter un vrai test `429` non destructif ;
- exécuter le dry-run DB ContactLead sans PII et sans `--apply` ;
- rejouer les gates Node 20 et Playwright critiques ;
- utiliser `docs/go-live/_evidence/lot7-release-candidate-file-manifest.md` et `docs/go-live/_evidence/lot7-release-candidate-commit-plan.md` pour préparer les commits, sans commit automatique ;
- garder les 6 P1 visibles sauf décision humaine documentée.

Décision : bêta élargie reste interdite si Redis/Upstash ou 429 runtime ne sont pas prouvés.
```

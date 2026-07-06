# Matrice de tests

## Mise à jour Lot 15 — untracked files regularization 2026-07-06

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/release-candidate-manifest-consistency.test.ts __tests__/scripts/release-candidate-git-add-dry-run-plan.test.ts __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | Valider les tests release régularisés | OK | 3 suites passées, 15 tests passés | Aucun | Obligatoire push review |
| `npm run check:docs-archive` | Vérifier que les rapports historiques exclus ne sont pas à la racine `docs/` | OK | OK | Aucun | Obligatoire push review |
| `npm run test:unit -- --runInBand __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | Vérifier le runbook après inclusion preuves | OK | 1 suite passée, 5 tests passés | Aucun | Obligatoire push review |

---

## Mise à jour Lot 14 — local commits 2026-07-06

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run typecheck` | Valider TypeScript après commits locaux | OK | `tsc --noEmit` OK | Aucun | Obligatoire push review |
| `npm run lint` | Valider lint après commits locaux | OK avec warnings | Next lint OK sous `--max-warnings 300` | Dette warnings existante | Obligatoire push review |
| `npm run test:unit -- --runInBand` | Valider suite unitaire complète | OK | 541 suites passées, 1 skipped ; 6531 tests passés, 4 skipped | Logs simulés attendus | Obligatoire push review |
| `npm run build` | Valider build production local | OK | Next build OK, 142 pages statiques générées | Charge les env sans afficher de valeurs | Obligatoire push review |
| `node scripts/security/audit-api-guards.mjs` | Régénérer inventaire API | OK | 178 routes | Statique uniquement | 0 P0 |
| `node scripts/go-live/generate-api-security-matrix.mjs` | Régénérer matrice API | OK | `P0=0`, `P1=6`, `P2=144`, `OK=28` | P1 maintenus | 0 P0, P1 visibles |
| `npm run audit:site-map` | Vérifier graphe de routes/liens | OK | 292 routes, 413 edges, 0 link finding | 13 public orphan entries documentées par l'audit | Obligatoire |
| `npm run check:no-hardcoded` | Vérifier prix/valeurs canoniques | OK | 0 valeur hardcodée hors sources canoniques | Aucun | Obligatoire |
| `npm run check:docs-archive` | Vérifier placement docs historiques | OK | Aucun audit/rapport historique à la racine `docs/` | Aucun | Obligatoire |
| `npm run check:bundle-weight` | Contrôler poids bundle | OK | Toutes les routes dans baseline + 5 kB | Aucun | Obligatoire |
| Playwright public ciblé | Smoke public homepage/offres/bilan | OK | 24 tests passés | Refresh passif Prisma non bloquant | Obligatoire |
| Playwright assessment token | Protéger accès direct assessment | OK | 1 test passé | Refresh passif Prisma non bloquant | Obligatoire |

---

## Mise à jour Lot 13 — final precommit 2026-07-06

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | Vérifier que le runbook humain reste exécutable avant commit réel | OK | 1 suite passée, 5 tests passés sous Node 20 | Ne remplace pas les preuves runtime Redis/Upstash, 429 et ContactLead DB | Obligatoire human execution |
| Runtime variables presence check | Tenter preuves assistées sans secret | PARTIEL | `NEXUS_HEALTH_AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED`, `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | Preuves non exécutées | Bloquant bêta élargie/go-live large |
| Audit Nexus status | Vérifier que l'audit Nexus n'entre pas dans les commits standards | OK documentaire | `PRESENT_UNTRACKED_IN_WORKTREE`, décision `EXCLUDE_FROM_STANDARD_COMMITS` | Décision humaine explicite requise pour inclusion | Obligatoire avant commit humain |

## Mise à jour Lot 11 — 2026-07-03

Tests ciblés ajoutés ou relancés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Runbook commit humain | `__tests__/scripts/release-candidate-human-commit-runbook.test.ts` | RED attendu avant génération du runbook, puis OK après génération |
| Scripts audit + manifeste + dry-run + runbook | `npm run test:unit -- --runInBand __tests__/scripts/security-audit-scripts-regression.test.ts __tests__/scripts/release-candidate-manifest-consistency.test.ts __tests__/scripts/release-candidate-git-add-dry-run-plan.test.ts __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | À exécuter comme gate finale Lot 11 |

Le test Lot 11 vérifie que chaque fichier `Include RC` du manifeste Lot 8 apparaît dans exactement un bloc de commit humain, qu'aucun fichier `Exclude` ou `Needs human review` n'apparaît dans les commits standards, que les commandes restent destinées à l'humain, et que les 6 P1 restent visibles.

---

## Mise à jour Lot 10 — 2026-07-03

Tests ciblés ajoutés ou relancés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Plan dry-run commit humain | `__tests__/scripts/release-candidate-git-add-dry-run-plan.test.ts` | RED attendu avant génération du plan, puis OK après génération |
| Scripts audit + manifeste + dry-run | `npm run test:unit -- --runInBand __tests__/scripts/security-audit-scripts-regression.test.ts __tests__/scripts/release-candidate-manifest-consistency.test.ts __tests__/scripts/release-candidate-git-add-dry-run-plan.test.ts` | À exécuter comme gate finale Lot 10 |

Le test Lot 10 vérifie que chaque fichier `Include RC` du manifeste Lot 8 apparaît dans exactement un bloc `git add --dry-run`, qu'aucun fichier `Exclude` ou `Needs human review` n'apparaît, que les commandes restent en dry-run, et que les 6 P1 restent visibles.

---

## Mise à jour Lot 5 — 2026-07-03

Tests ciblés ajoutés ou relancés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Rate-limit probe interne | `__tests__/api/internal.rate-limit-probe.test.ts` | OK, 401 policy, 200 metadata sûre, 429 local |
| ContactLead retention | `__tests__/scripts/contact-leads-retention.test.ts` | OK, dry-run par défaut et pas de PII ; dry-run DB local échoue faute de DB |
| ClicToPay disabled final | `__tests__/api/payments.clictopay.disabled-contract.test.ts`, `__tests__/api/payments.clictopay.feature-flag-consistency.test.ts`, `__tests__/ui/payment-methods.clictopay-disabled.test.tsx` | OK, `3` suites, `5` tests |
| BusinessConfig production gate | `__tests__/lib/business-config.production-gate.test.ts`, `__tests__/api/internal.business-config.health.test.ts`, `__tests__/lib/business-config.fallback.test.ts` | OK, `3` suites, `6` tests |

Résultat final Lot 5 sous Node 20 : typecheck OK, lint OK, full unit OK (`537` suites passées, `6507` tests passés), build OK, audit API OK (`178` routes), matrice OK (`P0=0`, `P1=6`, `P2=144`, `OK=28`), site-map OK, hardcoded OK, docs archive OK, bundle weight OK, smoke Playwright public OK sur port isolé `3012` (`24` tests passés), smoke Playwright assessment OK sur port isolé `3012` (`1` test passé).

Note : première tentative Playwright sur port `3002` bloquée par un autre projet local ; relance sur `3012` OK.

Réserve : Redis/Upstash production/staging non prouvé ; test 429 réel staging/production non exécuté faute d'environnement/authentifié.

---

## Mise à jour Lot 4 — 2026-07-03

Tests ciblés ajoutés ou renforcés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Token assessment binding | `__tests__/api/assessments.public-token.binding.test.ts`, `__tests__/api/assessments.submit.token-binding.test.ts`, `__tests__/app/bilan-gratuit.assessment-page-token.test.tsx` | OK ciblé, query params refusés sans cookie flow |
| Cookie flow bilan gratuit | `__tests__/api/bilan-gratuit.product-rgpd.test.ts` | OK ciblé, cookie HttpOnly posé, JSON sans ID/token |
| Rétention ContactLead | `__tests__/scripts/contact-leads-retention.test.ts` | OK ciblé, dry-run par défaut, `--apply` explicite |
| BusinessConfig production gate | `__tests__/lib/business-config.production-gate.test.ts`, `__tests__/api/internal.business-config.health.test.ts` | OK ciblé, prod table absente non autorisée = dégradé |
| ClicToPay flag consistency | `__tests__/api/payments.clictopay.feature-flag-consistency.test.ts` | OK ciblé, flag public actif + backend disabled = `503` |
| No-leak token binding | `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK ciblé, succès assessment lead-bound sans champs interdits |
| E2E assessment direct access | `e2e/pages-public-bilan-assessment-token.spec.ts` | OK final, accès direct avec query params redirigé/nettoyé, aucun email/token dans HTML |

Résultat ciblé Lot 4 : `11` suites passées, `53` tests passés.

Résultat final Lot 4 sous Node 20 : typecheck OK, lint OK, full unit OK (`536` suites passées, `6504` tests passés), build OK, audit API OK (`177` routes), matrice OK (`P0=0`, `P1=6`, `P2=144`, `OK=27`), site-map OK, hardcoded OK, docs archive OK, bundle weight OK, smoke Playwright public OK (`24` tests passés), smoke Playwright assessment OK (`1` test passé).

Réserve : Redis/Upstash production/staging non prouvé ; test 429 réel non exécuté faute d'environnement staging/authentifié.

---

## Mise à jour Lot 3 — 2026-07-03

Tests ciblés ajoutés ou renforcés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Token assessment public | `__tests__/lib/assessments/public-token.test.ts`, `__tests__/api/assessments.public-token.route.test.ts`, `__tests__/api/assessments.submit.token-security.test.ts` | OK ciblé, token absent/expiré/mal signé/mismatch rejeté |
| Assessment submit existant | `__tests__/api/assessments-submit.test.ts` | OK ciblé, succès aligné avec token court |
| Bilan gratuit RGPD | `__tests__/api/bilan-gratuit.rgpd-minimization.test.ts`, suites bilan existantes | OK ciblé, `studentBirthDate` refusé, lead only |
| ContactLead retention | `__tests__/lib/crm/contact-leads.retention.test.ts` | OK ciblé, conservation/SLA documentés |
| BusinessConfig drift | `__tests__/lib/business-config.fallback.test.ts`, `__tests__/api/internal.business-config.health.test.ts` | OK ciblé, fallback statique classé |
| ClicToPay disabled contract | `__tests__/api/payments.clictopay.disabled-contract.test.ts` | OK ciblé, webhook/init sans mutation |
| No-leak succès/erreurs | `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK ciblé, succès assessment sous token couvert |

Résultat ciblé Lot 3 : `14` suites passées, `99` tests passés.

Typecheck intermédiaire Lot 3 : premier passage ÉCHEC sur typage `searchParams` et tests, puis OK après correction.

Matrice API régénérée : `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`.

Réserve : Redis/Upstash production/staging non prouvé ; test 429 réel non exécuté faute d'environnement staging/authentifié et parce que le code Lot 3 n'est pas déployé.

---

## Mise à jour Lot 2 — 2026-07-03

Tests ciblés ajoutés ou renforcés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Bilan gratuit `lead_only` | `__tests__/api/bilan-gratuit.product-rgpd.test.ts`, `__tests__/api/bilan-gratuit.test.ts`, `__tests__/api/bilan-gratuit.security.test.ts` | OK ciblé, lead CRM sans compte inactif ni token |
| Stages inscription publique | `__tests__/api/stages.inscrire.product-rgpd.test.ts`, `__tests__/api/stages.inscrire.security.test.ts`, `__tests__/api/stages/inscriptions.test.ts` | OK ciblé, consentement obligatoire |
| ClicToPay webhook désactivé | `__tests__/api/payments.clictopay.webhook.disabled.test.ts`, suites webhook existantes | OK ciblé, `501` sans mutation |
| Student activation | `__tests__/api/student.activate.lifecycle-security.test.ts`, suites activation existantes | OK ciblé, token hashé/expiré/no-leak |
| No-leak succès/erreurs | `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK ciblé, chemins succès et erreurs des 6 P1 autant que mockable |
| Runtime Redis/Upstash | preuve locale + `curl` production sans secret | `memory` local observé, production non vérifiée car healthcheck `401` |

Résultat ciblé Lot 2 avant commandes finales : 16 suites passées, 99 tests passés.

Résultat final Lot 2 sous Node 20 : typecheck OK, lint OK, full unit OK (`522` suites passées, `6466` tests passés), build OK, audit API OK, matrice OK, site-map OK, hardcoded OK, docs archive OK, bundle weight OK, smoke Playwright public OK (`24` tests passés).

Réserve : Redis/Upstash staging/production non prouvé ; Playwright signale en webserver local une table `business_configs` absente pendant un refresh passif, sans échec smoke.

---

## Mise à jour Lot 1-quinquies — 2026-07-03

Tests ciblés ajoutés ou renforcés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| ClicToPay webhook | `__tests__/api/payments.clictopay.webhook.route.test.ts`, `__tests__/api/payments.clictopay.webhook.security.test.ts` | OK ciblé |
| Routes admin restantes | `admin.config`, `admin.directeur.stats`, `admin.recompute-ssn`, `admin.subscriptions`, `admin.test-email` | OK ciblé |
| Routes publiques sensibles | `assessments-submit`, `student.activate`, `stages.inscrire.security` | OK ciblé |
| No-leak | `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK ciblé, 20 réponses mockables |
| Rate limit runtime | `__tests__/lib/rate-limit.production-gate.test.ts`, `__tests__/api/internal.health.rate-limit.test.ts` | Couvert par lots précédents, runtime prod non prouvé |

Résultat ciblé Lot 1-quinquies : 11 suites passées, 96 tests passés ; puis tests admin rate-limit/no-leak : 3 suites passées, 37 tests passés.

Matrice API régénérée : `P0=0`, `P1=6`, `P2=143`, `OK=27`.

Réserve : Redis/Upstash staging/production non prouvé ; la commande production sans secret sur `/api/internal/health` retourne `401`.

---

## Mise à jour Lot 1-quater — 2026-07-02

Tests ciblés ajoutés ou renforcés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Rate limit runtime | `__tests__/lib/rate-limit.production-gate.test.ts`, `__tests__/api/internal.health.rate-limit.test.ts` | OK ciblé |
| Coach ownership | `__tests__/api/coach.trajectory.security.test.ts` | OK ciblé |
| Eleve diagnostic | `__tests__/api/eleve.bilan-diagnostic-maths-terminale.security.test.ts` | OK ciblé |
| Assistante | `assistant.credit-requests`, `assistant.students.credits`, `assistant.subscription-requests`, `assistant.subscriptions`, `assistante.quotes.pdf` | OK ciblé |
| Parent/activation | `parent.children.route`, `parent.children.activation.route` | OK ciblé |
| Stages confirm | `__tests__/api/stages/confirm.test.ts` | OK ciblé |
| No-leak | `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK ciblé, 12 routes mockables |

Résultat ciblé Lot 1-quater : 13 suites passées, 77 tests passés.

Résultat final Lot 1-quater sous Node 20 : typecheck OK, lint OK, full unit OK, build OK, audit API OK, matrice OK, site-map OK, hardcoded OK, docs archive OK, bundle weight OK, smoke Playwright public OK.

---

## Mise à jour Lot 1-ter — 2026-07-02

Tests ciblés ajoutés ou renforcés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Admin invoices | `__tests__/api/admin.invoices.route.test.ts` | OK ciblé |
| ClicToPay init | `__tests__/api/payments.clictopay.init.route.test.ts` | OK ciblé |
| Bilans | `__tests__/api/bilans.id.route.test.ts`, `__tests__/api/bilans.idor.test.ts`, `__tests__/api/bilans/generate.test.ts` | OK ciblé |
| NPC | `__tests__/api/npc.documents.route.test.ts`, `__tests__/api/npc.submissions.security.test.ts`, `__tests__/api/npc.generate.test.ts`, `__tests__/api/npc.uploads.route.test.ts` | OK ciblé |
| Coach reports | `__tests__/api/coach.generated-reports.route.test.ts`, `__tests__/api/coach.eaf-preparation-report.validate.test.ts`, `__tests__/api/coach.eaf-stage-regenerate.security.test.ts`, `__tests__/api/coach.bilan-diagnostic-maths-terminale.security.test.ts` | OK ciblé |
| No-leak | `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK ciblé, 9 routes mockables |

Résultat ciblé Lot 1-ter : 14 suites passées, 94 tests passés.

Les commandes finales complètes du lot restent consignées dans `docs/go-live/_evidence/lot1ter-command-log.md`.

---

## Mise à jour Lot 1-bis — 2026-07-02

Nouveaux tests/renforcements :

| Test | Objectif | Statut actuel | Critère go-live |
| --- | --- | --- | --- |
| `__tests__/scripts/audit-api-guards.classification.test.ts` | Empêcher faux reclassement P0 par heuristique | OK ciblé | Toute évolution du script conserve P0 pour public sensible non protégé |
| `__tests__/api/admin.documents.route.test.ts` | Upload staff sans `localPath`, MIME/taille, RBAC | OK ciblé | Aucun fichier invalide écrit, réponse projetée |
| `__tests__/api/bilan-gratuit.security.test.ts` | No enumeration, honeypot, rate limit, no token/IDs | OK ciblé | Route défendable en attendant décision Lot 3 |
| `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | Champs interdits absents des réponses mockables | OK ciblé | Couverture à élargir aux bilans/factures restantes |
| `__tests__/api/sessions.video.route.test.ts` | Zod strict, rate limit, ownership session | OK ciblé | Route P2, pas P1 |
| `__tests__/api/npc.files.route.test.ts` | Coach non assigné sans lecture disque | OK ciblé | Pas de lecture fichier avant ownership |
| `__tests__/api/npc.documents.route.test.ts` | Coach non assigné GET/POST/DELETE | OK ciblé | Pas de mutation/document hors périmètre |

Les commandes finales complètes restent obligatoires et sont consignées dans `docs/go-live/_evidence/lot1bis-command-log.md`.

---

## Tests unitaires

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand` | Valider logique unitaire/API mockée | OK | 516 suites passées, 1 ignorée ; 6425 tests passés, 4 ignorés | Logs console nombreux sur erreurs simulées | 0 échec, logs sensibles maîtrisés |
| `npm run typecheck` | TypeScript sans erreur | OK | `tsc --noEmit` OK | Aucun | Obligatoire |
| `npm run lint` | Qualité statique | OK avec warnings | Next lint OK, nombreux warnings | Dette `any`, unused vars, hooks | Seuil warning accepté ou réduit |

## Tests intégration DB

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand` | Couvrir routes avec Prisma mocké | PARTIEL | Tests DB simulés passent | Pas de DB réelle testée Lot 0 | Intégration DB dédiée sur env isolé |
| À définir | Valider migrations non destructives | NON EXÉCUTÉ | Migration destructive interdite Lot 0 | Pas d'accès DB décidé | Migration dry-run ou staging |

## Tests E2E

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | Smoke public ciblé | OK Lot 1-quater | 24 passés, 0 échoué sous Node 20 après build propre | Warning e2e DB locale `business_configs` absent à traiter | 0 échec ou décision QA explicite |
| `npx playwright test` | Suite navigateur complète | NON EXÉCUTÉ | Suite complète non lancée Lot 0 | Large périmètre avec parcours auth/DB ; à planifier Gate A/B | Obligatoire avant go-live large |

## Tests sécurité

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `node scripts/security/audit-api-guards.mjs` | Inventaire statique guards API | OK | 176 routes, 0 P0, 12 P1, 137 P2, 27 OK | Statique, pas preuve d'exploitation | 0 P0 avant go-live large |
| Tests no-leak existants | Logs/erreurs | PARTIEL | Plusieurs tests no-leak passent | Couverture logs runtime à compléter | Logs sans PII |

## Tests IDOR

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Tests unitaires existants `idor` | Accès croisé ciblé | PARTIEL | Des tests IDOR existent et passent | Inventaire signale encore P0 | Une preuve par route dynamique sensible |

## Tests pricing

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run check:no-hardcoded` | Montants hors canonique | OK | 0 valeur hardcodée selon script | Recherche manuelle trouve archives/reliquats | Script + audit archives |
| Tests pricing existants | Cohérence affichage | OK | Suites pricing passent | Registry entitlement séparé | Pricing -> entitlement aligné |
| `rg -n "TND\|DT\|dès [0-9]\|[0-9][0-9][0-9]\\s*TND\|[0-9][0-9][0-9]\\s*DT\|prix\|tarif\|montant" app components data lib content docs --glob '!docs/archive/**'` | Triage montants | PARTIEL | Reliquats classés dans `_evidence/hardcoded-pricing-triage.md` | Script officiel ne couvre pas toutes les zones | Aucun fichier activable avec prix obsolète avant campagne |

## Tests paiement

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Tests `payments.*` unitaires | Paiement manuel, validate, ClicToPay 501 | OK | Suites paiement passent | ClicToPay non activé | Carte off ou E2E complet |
| Tests contrat pricing -> entitlement | Crédits accordés | À créer | Écart Lot 0-bis confirmé 0/4/8 vs 4/8/16 | Risque sur-crédit | Obligatoire Lot 4 |
| À définir staging | Paiement bout-en-bout | NON EXÉCUTÉ | Aucun paiement réel Lot 0 | Pas de clés ClicToPay validées | Obligatoire avant carte |

## Tests email

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Tests mailer unitaires | Templates/erreurs SMTP | OK | Tests passent avec erreurs simulées | SMTP réel non vérifié | Envoi test production/staging |

## Tests documents

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Tests documents unitaires | Accès document et no-leak | PARTIEL | Tests passent | Inventaire classe routes documents P0/P1 | IDOR complet + logs redacted |

## Tests IA/RAG

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Tests ARIA/RAG unitaires | Fallbacks et API ARIA | OK partiel | Tests ARIA passent | RAG runtime non vérifié | Health RAG + ownership |

## Tests dashboards par rôle

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Tests API par rôle | Parent/élève/coach/assistante/admin | PARTIEL | Plusieurs tests passent | Pas de E2E complet par rôle | Smoke E2E rôle |

## Tests mobile

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Playwright mobile | Débordements et CTA | NON EXÉCUTÉ | Non couvert Lot 0 | Dev server/snapshots à lancer Lot QA | Obligatoire Gate A |
| Smoke public ciblé mobile partiel | Liens WhatsApp homepage | OK Lot 0-bis | Le test homepage vérifie des liens WhatsApp visibles desktop/mobile après scroll | Ne remplace pas audit mobile complet | Compléter par screenshots Gate A |

## Tests accessibilité

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| Axe/Playwright à définir | Contrastes, labels, zoom | NON EXÉCUTÉ | Non couvert Lot 0 | Outillage à confirmer | Obligatoire Gate C/D |

## Tests SEO

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run audit:site-map` | Routes/liens/sources | OK | 290 routes, 412 edges, 0 link finding, 13 orphan entries | Orphelins à qualifier | 0 lien critique cassé |

## Smoke tests production

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `curl -I https://nexusreussite.academy/...` | Vérifier prod réelle | NON EXÉCUTÉ | Lot 0 local uniquement | Production non consultée | Obligatoire avant campagne |

## Build et bundle

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run build` | Build production local | OK | 143 pages générées, assets standalone copiés | Lint sauté pendant build | Obligatoire |
| `npm run check:bundle-weight` | Poids routes publiques | OK | Toutes routes dans baseline + 5 kB | Dépend de `build-output.log` existant | Obligatoire Gate A |
# Mise à jour Lot 1 — 2026-07-02

Tests ciblés ajoutés ou renforcés :

| Domaine | Tests | Résultat ciblé |
| --- | --- | --- |
| Documents IDOR/no-leak | `__tests__/api/documents.id.route.test.ts`, `__tests__/api/documents-access.test.ts` | OK ciblé |
| Factures PDF ownership | `__tests__/lib/invoice/access-scope.test.ts`, `__tests__/api/invoices.pdf.route.test.ts`, `__tests__/api/invoices.receipt.pdf.route.test.ts` | OK ciblé |
| Rate limit public | `__tests__/api/student.activate.route.test.ts`, `__tests__/api/lamis.teacher-report.route.test.ts`, `__tests__/api/public-rate-limit.coverage.test.ts` | OK ciblé |
| Coach/stages déjà couverts | `__tests__/api/coach.sessions.report.route.test.ts`, `__tests__/api/stages.reservations.access.test.ts`, `__tests__/api/stages/stages-list.test.ts` | OK ciblé |

Les commandes finales complètes Lot 1 restent la source de vérité finale du verdict.

## Mise à jour Lot 6 — runtime et release candidate

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `curl ... /api/internal/health` avec `NEXUS_HEALTH_AUTH` | Prouver Redis/Upstash runtime | NON EXÉCUTÉ | `NEXUS_HEALTH_AUTH_ABSENT`; sans auth `401` | Credential absent | Obligatoire bêta élargie/go-live large |
| `/api/internal/rate-limit-probe` runtime | Prouver un vrai `429` staging/prod | NON EXÉCUTÉ | `AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED` | Fenêtre/credential absents | Obligatoire bêta élargie/go-live large |
| `npx tsx scripts/maintenance/contact-leads-retention.ts` | Dry-run DB ContactLead sans PII | NON EXÉCUTÉ | `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | DB non production absente | Obligatoire go-live large |
| `git diff --name-only \| rg '(^\|/)\\.env($\|\\.)'` | Vérifier absence modification `.env` | OK | aucune sortie | Aucun | Obligatoire release candidate |
| Gates finales Node 20 Lot 6 | Typecheck/lint/tests/build/audits/Playwright | OK | Typecheck OK, lint OK, unit `537` suites/`6507` tests, build OK, audit API `P0=0 P1=6`, Playwright `24+1` passed | Redis/429/DB runtime non prouvés hors local | Obligatoire verdict final |

## Mise à jour Lot 7 — release candidate audit

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/audit-api-guards.classification.test.ts __tests__/scripts/security-audit-scripts-regression.test.ts` | Vérifier que les scripts ne maquillent pas les risques | OK ciblé | `2` suites passées, `10` tests passés | Ne remplace pas les gates finales complètes | Obligatoire RC |
| Healthcheck avec `NEXUS_HEALTH_AUTH` | Prouver Redis/Upstash runtime | NON EXÉCUTÉ | `NEXUS_HEALTH_AUTH_ABSENT`; sans auth production `401` | Credential absent | Obligatoire bêta élargie/go-live large |
| `/api/internal/rate-limit-probe` runtime | Prouver vrai `429` staging/prod | NON EXÉCUTÉ | `RL_PROBE_NOT_ALLOWED` | Fenêtre/credential absents | Obligatoire bêta élargie/go-live large |
| `scripts/maintenance/contact-leads-retention.ts` contre DB non prod | Prouver dry-run DB sans PII | NON EXÉCUTÉ | `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | DB non production absente | Obligatoire go-live large |
| Gates finales Node 20 Lot 7 | Typecheck/lint/tests/build/audits/Playwright | OK | Typecheck OK, lint OK, unit `538` suites/`6510` tests, build OK, audit API `P0=0 P1=6`, Playwright `24+1` passed | Redis/429/DB runtime non prouvés hors local | Obligatoire RC |

## Mise à jour Lot 8 — release candidate cleanup

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/audit-api-guards.classification.test.ts __tests__/scripts/security-audit-scripts-regression.test.ts` | Vérifier les régressions scripts audit renforcées | OK ciblé | `2` suites passées, `16` tests passés | Ne remplace pas les gates finales complètes | Obligatoire RC |
| Runtime variables presence check | Tenter preuves assistées sans secret | PARTIEL | `NEXUS_HEALTH_AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED`, `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | Preuves non exécutées | Bloquant bêta élargie/go-live large |
| Manifest RC clean | Vérifier classification fichiers | OK documentaire | `283` entrées, `281` Include RC, `1` Exclude, `1` Needs human review | Revue humaine requise avant commit | Obligatoire RC |
| Gates finales Node 20 Lot 8 | Typecheck/lint/tests/build/audits/Playwright | OK | Typecheck OK, lint OK, unit `538` suites passées sur `539` (`6516` tests passés), build OK, audit API `P0=0 P1=6`, site-map OK, checks OK, Playwright `24+1` passed | Redis/429/DB runtime non prouvés hors local | Obligatoire RC |

## Mise à jour Lot 9 — release candidate manifest validation

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/security-audit-scripts-regression.test.ts __tests__/scripts/release-candidate-manifest-consistency.test.ts` | Vérifier que le manifeste Lot 8 et le plan de commits Lot 8 sont mécaniquement cohérents | OK ciblé | `2` suites passées, `14` tests passés | Ne remplace pas les gates finales complètes | Obligatoire RC |
| Runtime variables presence check | Tenter preuves assistées sans secret | PARTIEL | `NEXUS_HEALTH_AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED`, `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | Preuves non exécutées | Bloquant bêta élargie/go-live large |
| Gates finales Node 20 Lot 9 | Typecheck/lint/tests/build/audits/Playwright | OK | Typecheck OK, lint OK, unit `539` suites passées sur `540` (`6521` tests passés), build OK, audit API `P0=0 P1=6`, site-map OK, checks OK, Playwright `24+1` passed | Redis/429/DB runtime non prouvés hors local | Obligatoire RC |

## Mise à jour Lot 12 — décision audit Nexus

| Commande | Objectif | Statut actuel | Résultat observé | Blocage éventuel | Critère go-live |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | Vérifier que le runbook humain n'inclut pas de fichier exclu ou en revue humaine dans les commits standards | OK | 1 suite passée, 5 tests passés | Ne remplace pas les preuves runtime Redis/Upstash, 429 et ContactLead DB | Obligatoire human execution |
| Runtime variables presence check | Tenter preuves assistées sans secret | PARTIEL | `NEXUS_HEALTH_AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED`, `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | Preuves non exécutées | Bloquant bêta élargie/go-live large |
| Revue `docs/audits/audit-nexus-reussite.md` | Décider inclusion/exclusion audit humain | OK documentaire | `EXCLUDE_FROM_STANDARD_COMMITS` car `173 routes` et statut sécurité obsolète | Décision humaine requise pour inclusion historique ou réécriture | Obligatoire avant commit humain |

## Mise à jour Lot 16 — final diff et pre-push

| Commande | Objectif | Statut actuel | Resultat observe | Blocage eventuel | Critere go-live |
| --- | --- | --- | --- | --- | --- |
| `git diff --stat main...HEAD` | Resumer le diff a pousser | OK | `329 files changed, 21339 insertions(+), 1258 deletions(-)` avant commit documentaire Lot 16 | Revue humaine PR toujours requise | Obligatoire push review |
| `git status --short --untracked-files=all` | Verifier le worktree pre-push | OK | seuls `docs/audits/audit-nexus-reussite.md` et `rapport_audit_2_07_2026.md` non suivis | Exclusions a ne pas ajouter | Obligatoire push review |
| `npm run typecheck` | Gate pre-push minimale | OK | PASSED sous Node 20 | Aucun | Obligatoire push review |
| `npm run lint` | Gate pre-push minimale | OK | PASSED sous Node 20 avec warnings existants sous seuil | Warnings a traiter hors Lot 16 | Obligatoire push review |
| `npm run test:unit -- --runInBand __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | Verrou runbook humain | OK | PASSED, 1 suite, 5 tests | Aucun | Obligatoire push review |
| `npm run check:docs-archive` | Verifier archives docs | OK | PASSED | Aucun | Obligatoire push review |

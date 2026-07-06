# Matrice API sécurité

## Mise à jour Lot 14 — 2026-07-06

Lot 14 exécute les commits locaux et les gates finales sans requalifier les P1.

| Élément | Statut |
| --- | --- |
| Compteurs API | `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178` |
| 6 P1 | Toujours visibles |
| Commits locaux | 9 commits Lot 11 exécutés |
| Gates finales | Toutes passées |
| Staging Git | Vide après les 9 commits et les gates |
| Redis/Upstash | Non prouvé |
| 429 runtime | Non exécuté |
| ContactLead DB dry-run | Non exécuté |

Décision : `READY_FOR_PUSH_REVIEW`; bêta contrôlée possible avec réserves ; bêta élargie et go-live large bloqués.

---

## Mise à jour Lot 13 — 2026-07-06

Lot 13 ne modifie pas la matrice et ne requalifie aucun P1.

| Élément | Statut |
| --- | --- |
| Compteurs API | `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178` |
| 6 P1 | Toujours visibles |
| Runbook humain | Toujours valide, 1 suite / 5 tests passés |
| Audit Nexus | `PRESENT_UNTRACKED_IN_WORKTREE`, exclu des commits standards |
| Staging Git | Vide pendant le verrou pré-commit |
| Redis/Upstash | Non prouvé |
| 429 runtime | Non exécuté |
| ContactLead DB dry-run | Non exécuté |

Décision : `READY_TO_EXECUTE_MANUALLY`; bêta contrôlée possible avec réserves ; bêta élargie et go-live large bloqués.

---

## Mise à jour Lot 11 — 2026-07-03

Lot 11 ne requalifie aucune route et ne modifie pas le code métier. Il transforme uniquement le plan dry-run Lot 10 en runbook humain de commits.

| Élément | Statut |
| --- | --- |
| Compteurs API | `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178` |
| 6 P1 | Toujours visibles |
| Runbook humain | `docs/go-live/_evidence/lot11-human-commit-runbook.md` |
| Preuve runbook | `docs/go-live/_evidence/lot11-human-commit-runbook-proof.md` |
| Staging Git | Vide pendant la préparation |
| Redis/Upstash | Non prouvé |
| 429 runtime | Non exécuté |
| ContactLead DB dry-run | Non exécuté |

Décision : exécution humaine possible en suivant le runbook ; bêta contrôlée possible avec réserves ; bêta élargie et go-live large bloqués.

---

## Mise à jour Lot 10 — 2026-07-03

Lot 10 ne requalifie aucune route et ne modifie pas le code métier. Il prépare uniquement les commandes `git add --dry-run -- ...` par commit humain.

| Élément | Statut |
| --- | --- |
| Compteurs API | `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178` |
| 6 P1 | Toujours visibles |
| Plan dry-run | `docs/go-live/_evidence/lot10-git-add-dry-run-plan.md` |
| Preuve dry-run | `docs/go-live/_evidence/lot10-git-add-dry-run-proof.md` |
| Staging Git | Vide avant/après dry-runs |
| Redis/Upstash | Non prouvé |
| 429 runtime | Non exécuté |
| ContactLead DB dry-run | Non exécuté |

Décision : commit humain possible en suivant le plan, bêta contrôlée possible avec réserves ; bêta élargie et go-live large bloqués.

---

## Mise à jour Lot 9 — 2026-07-03

Lot 9 ne requalifie aucune route. Il ajoute une validation mécanique du manifeste RC et du plan de commits.

| Élément | Statut |
| --- | --- |
| Compteurs API | `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178` |
| 6 P1 | Toujours visibles |
| Test cohérence RC | `__tests__/scripts/release-candidate-manifest-consistency.test.ts` |
| Résultat ciblé | `2` suites passées, `14` tests passés avec la régression scripts |
| Redis/Upstash | Non prouvé |
| 429 runtime | Non exécuté |
| ContactLead DB dry-run | Non exécuté |

Décision : bêta contrôlée possible avec réserves ; bêta élargie et go-live large bloqués.

---

## Mise à jour Lot 5 — 2026-07-03

Lot 5 ajoute une route interne non destructive de probe rate-limit sans masquer les P1 :

| Route | Décision Lot 5 | Statut sécurité |
| --- | --- | --- |
| `/api/internal/rate-limit-probe` | Route interne protégée par `admin.dashboard`, preset `auth`, réponse minimale sans secret ; sert à tester un 429 sans frapper une route métier | OK statique, preuve runtime staging/production à exécuter |
| `/api/internal/health` | Healthcheck authentifié requis pour prouver Redis/Upstash ; production sans secret retourne `401` | Redis/Upstash non prouvé |
| `/api/payments/clictopay/webhook` | Maintenu `501/P1`, ClicToPay désactivé contractuellement | Paiement carte interdit |

Compteurs confirmés après régénération intermédiaire : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.

Réserve runtime : Redis/Upstash staging/production non prouvé ; test 429 réel staging/production non exécuté. Bêta élargie et go-live large interdits.

---

## Mise à jour Lot 4 — 2026-07-03

Lot 4 ne baisse pas artificiellement les P1. Il ferme l'angle mort du token assessment librement générable depuis `/bilan-gratuit/assessment`.

| Route | Décision Lot 4 | Statut sécurité |
| --- | --- | --- |
| `/api/assessments/submit` | Token `assessment_submit` lié à un lead via `binding=lead`, `leadEmailHash` et email assessment pseudonyme ; token staff-only toujours accepté pour émission contrôlée | Reste P1 par surface publique mineur |
| `/bilan-gratuit/assessment` | Ne génère plus de token depuis query params ; redirige les URL avec query params vers l'URL canonique ; exige cookie HttpOnly signé `nexus_assessment_flow` | Front public verrouillé |
| `/api/bilan-gratuit` | Pose le cookie de flux après lead_only, sans ID/token dans JSON | Reste P1 formulaire public mineur |
| `/api/payments/clictopay/init` | Fail-closed `503` si flag public ClicToPay activé alors que backend désactivé | Pas de succès ambigu |
| `/api/payments/clictopay/webhook` | Contrat désactivé inchangé : signature requise, `501`, aucune mutation | P1 tant que webhook incomplet |
| `/api/internal/health` | BusinessConfig distingue `database`, `static_fallback_allowed`, `static_fallback_unexpected` | P2 health protégé |

Preuves Lot 4 :

- `docs/go-live/18_LOT4_RUNTIME_PAYMENT_RETENTION_TOKEN_BINDING.md`
- `docs/go-live/_evidence/lot4-assessment-token-binding.md`
- `docs/go-live/_evidence/lot4-redis-upstash-runtime-proof.md`
- `docs/go-live/_evidence/lot4-contact-lead-retention-job.md`
- `docs/go-live/_evidence/lot4-clictopay-disabled-runbook.md`
- `docs/go-live/_evidence/lot4-business-config-production-gate.md`
- `docs/go-live/_evidence/lot4-no-leak-e2e-runtime-coverage.md`

Compteurs confirmés après régénération finale : `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`.

Réserve runtime : Redis/Upstash staging/production non prouvé ; bêta élargie et go-live large interdits.

---

## Mise à jour Lot 3 — 2026-07-03

Lot 3 ajoute un mécanisme de token signé court pour les assessments publics sans masquer les P1 restants.

| Route | Décision Lot 3 | Statut sécurité |
| --- | --- | --- |
| `/api/assessments/submit` | Token HMAC court obligatoire ; scope `assessment_submit`, `subject`, `grade`; rejet absent/expiré/mal signé/mismatch | Reste P1 par surface publique données pédagogiques mineur |
| `/api/assessments/public-token` | Nouvelle route d'émission contrôlée staff-only `ADMIN/ASSISTANTE`, Zod, rate limit | P2 |
| `/api/bilan-gratuit` | `lead_only` confirmé ; `studentBirthDate` refusé ; rétention/effacement documentés | Reste P1 par formulaire public mineur |
| `/api/payments/clictopay/webhook` | Désactivation contractuelle confirmée ; signature requise ; `501`; aucune mutation | P1 tant que paiement carte incomplet |
| `/api/internal/health` | Expose `runtime.businessConfig` et classe `business_configs` absent en `static_fallback` | P2, health protégé |

Preuves Lot 3 :

- `docs/go-live/17_LOT3_RUNTIME_RGPD_ASSESSMENT_TOKEN.md`
- `docs/go-live/_evidence/lot3-redis-upstash-runtime-proof.md`
- `docs/go-live/_evidence/lot3-assessments-public-token.md`
- `docs/go-live/_evidence/lot3-bilan-gratuit-rgpd-register.md`
- `docs/go-live/_evidence/lot3-contact-lead-retention-policy.md`
- `docs/go-live/_evidence/lot3-clictopay-disabled-contract.md`
- `docs/go-live/_evidence/lot3-business-configs-db-drift.md`
- `docs/go-live/_evidence/lot3-no-leak-success-error-runtime-coverage.md`

Compteurs après régénération :

| Priorité | Nombre |
| --- | ---: |
| P0 | 0 |
| P1 | 6 |
| P2 | 144 |
| OK | 27 |
| Total | 177 |

Réserve runtime : Redis/Upstash staging/production non prouvé ; go-live large interdit.

---

## Mise à jour Lot 2 — 2026-07-03

Les 6 P1 restants ont été arbitrés comme décisions produit/RGPD/paiement/runtime, pas comme simples anomalies de guards :

| Route | Décision Lot 2 | Statut sécurité |
| --- | --- | --- |
| `/api/payments/clictopay/webhook` | ClicToPay reste désactivé ; signature requise, réponse `501`, aucune mutation | P1 assumé tant que l'intégration paiement n'est pas complète |
| `/api/assessments/submit` | Route publique assumée uniquement pour assessment anonyme/minimisé ; token/session recommandé en prochain lot pédagogique | P1 assumé par surface publique mineurs |
| `/api/bilan-gratuit` | Passage en `lead_only` : lead CRM uniquement, aucun `User`, aucun compte parent/élève, aucun token | Dette produit/RGPD compte public fermée ; P1 possible par formulaire public sensible |
| `/api/lamis/teacher-report` | Route pédagogique publique maintenue avec payload borné/rate limit/no-leak ; token/session recommandé si usage nominatif | P1 assumé par surface publique |
| `/api/stages/[stageSlug]/inscrire` | Inscription publique maintenue ; consentement traitement et modalités stage obligatoires ; pas de compte ni ID interne en réponse | P1 assumé par conversion publique famille/mineur |
| `/api/student/activate` | Route publique par token maintenue ; token hashé, expiration, rate limit, no-leak testés | P1 assumé par cycle d'activation token |

Redis/Upstash runtime n'est pas prouvé en staging/production : `/api/internal/health` production répond `401` sans secret. Le mode local observé est `memory`, donc le go-live large reste interdit tant qu'un healthcheck authentifié ne prouve pas `redis` ou `upstash` et un test 429 réel.

Preuves Lot 2 :

- `docs/go-live/16_LOT2_PUBLIC_PRODUCT_RGPD_PAYMENT_DECISIONS.md`
- `docs/go-live/_evidence/lot2-rate-limit-runtime-decision.md`
- `docs/go-live/_evidence/lot2-bilan-gratuit-product-rgpd.md`
- `docs/go-live/_evidence/lot2-clictopay-payment-decision.md`
- `docs/go-live/_evidence/lot2-assessments-submit-decision.md`
- `docs/go-live/_evidence/lot2-lamis-teacher-report-decision.md`
- `docs/go-live/_evidence/lot2-stages-inscrire-product-rgpd.md`
- `docs/go-live/_evidence/lot2-student-activate-token-lifecycle.md`
- `docs/go-live/_evidence/lot2-sensitive-fields-success-error-coverage.md`

Compteurs après régénération :

| Priorité | Nombre |
| --- | ---: |
| P0 | 0 |
| P1 | 6 |
| P2 | 143 |
| OK | 27 |
| Total | 176 |

Les 6 P1 restent visibles car ils portent des décisions publiques/paiement/runtime non fermées par simple durcissement statique.

---

## Mise à jour Lot 1-quinquies — 2026-07-03

Inventaire et matrice régénérés après fermeture des P1 admin et durcissement des routes publiques restantes :

| Priorité | Nombre |
| --- | ---: |
| P0 | 0 |
| P1 | 6 |
| P2 | 143 |
| OK | 27 |
| Total | 176 |

Delta Lot 1-quinquies : `P1 -6`, `P2 +6`, `P0` maintenu à `0`.

Preuves :

- `docs/security/API_GUARD_INVENTORY.md`
- `docs/go-live/api-security-matrix.full.md`
- `docs/go-live/15_LOT1QUINQUIES_FINAL_P1_SECURITY_CLOSURE.md`
- `docs/go-live/_evidence/lot1quinquies-p1-before-after.md`
- `docs/go-live/_evidence/lot1quinquies-clictopay-webhook.md`
- `docs/go-live/_evidence/lot1quinquies-public-sensitive-routes.md`
- `docs/go-live/_evidence/lot1quinquies-admin-routes.md`
- `docs/go-live/_evidence/lot1quinquies-rate-limit-runtime-proof.md`

Routes passées P2 : `/api/admin/config`, `/api/admin/config/rollback`, `/api/admin/directeur/stats`, `/api/admin/recompute-ssn`, `/api/admin/subscriptions`, `/api/admin/test-email`.

Réserves : `/api/payments/clictopay/webhook` reste P1/501 ; les routes publiques sensibles `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/lamis/teacher-report`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate` restent P1 par surface publique ; `rate limiting` distribué production/staging non prouvé.

---

## Mise à jour Lot 1-quater — 2026-07-02

Inventaire et matrice régénérés après fermeture P1 publics/rôles :

| Priorité | Nombre |
| --- | ---: |
| P0 | 0 |
| P1 | 12 |
| P2 | 137 |
| OK | 27 |
| Total | 176 |

Delta Lot 1-quater : `P1 -25`, `P2 +25`, `P0` maintenu à `0`.

Preuves :

- `docs/security/API_GUARD_INVENTORY.md`
- `docs/go-live/api-security-matrix.full.md`
- `docs/go-live/14_LOT1QUATER_PUBLIC_ROLE_SECURITY_CLOSURE.md`
- `docs/go-live/_evidence/lot1quater-p1-before-after.md`
- `docs/go-live/_evidence/lot1quater-rate-limit-runtime-proof.md`
- `docs/go-live/_evidence/lot1quater-sensitive-fields-coverage.md`

Routes passées P2 : routes assistante restantes, parent subscriptions/children, student automatismes/survival/trajectory, coach notes/survival/trajectory, stage reservation confirm, bilan gratuit dismiss et programme STMG stage progress.

Réserves : `/api/payments/clictopay/webhook` reste P1/501 ; routes publiques sensibles restent P1 par design ; 6 routes admin restent P1 ; `rate limiting` distribué production/staging non prouvé.

---

## Mise à jour Lot 1-ter — 2026-07-02

Inventaire et matrice régénérés après fermeture P1 critiques :

| Priorité | Nombre |
| --- | ---: |
| P0 | 0 |
| P1 | 37 |
| P2 | 112 |
| OK | 27 |
| Total | 176 |

Delta Lot 1-ter : `P1 -17`, `P2 +17`, `P0` maintenu à `0`.

Preuves :

- `docs/security/API_GUARD_INVENTORY.md`
- `docs/go-live/api-security-matrix.full.md`
- `docs/go-live/13_LOT1TER_P1_SECURITY_CLOSURE.md`
- `docs/go-live/_evidence/lot1ter-p1-before-after.md`
- `docs/go-live/_evidence/lot1ter-payments-invoices.md`
- `docs/go-live/_evidence/lot1ter-bilans-assessments.md`
- `docs/go-live/_evidence/lot1ter-npc-documents.md`
- `docs/go-live/_evidence/lot1ter-coach-reports.md`

Routes passées P2 : `/api/admin/invoices`, `/api/payments/clictopay/init`, routes `bilans*`, routes NPC submissions/documents/uploads/generate, routes coach reports ciblées et `/api/sessions/cancel`.

Réserves : `/api/payments/clictopay/webhook` reste P1/501 ; `/api/bilan-gratuit` reste P1 produit/RGPD ; `rate limiting` distribué production non prouvé ; 37 P1 restent bloquants pour bêta élargie et go-live large.

---

## Mise à jour Lot 1-bis — 2026-07-02

Inventaire régénéré après contre-audit :

| Priorité | Nombre |
| --- | ---: |
| P0 | 0 |
| P1 | 54 |
| P2 | 95 |
| OK | 27 |
| Total | 176 |

Preuves :

- `docs/security/API_GUARD_INVENTORY.md`
- `docs/go-live/api-security-matrix.full.md`
- `docs/go-live/_evidence/lot1bis-p0-reclassification-audit.md`
- `docs/go-live/_evidence/lot1bis-audit-script-review.md`
- `docs/go-live/_evidence/lot1bis-p1-closure.md`

Corrections Lot 1-bis : `/api/sessions/video` et `/api/admin/documents` passent en P2 ; `/api/bilan-gratuit` reste P1 mais ne renvoie plus d’email-existence, d’IDs ou de token ; ClicToPay reste P1/501.

---

Inventaire source régénéré : `docs/security/API_GUARD_INVENTORY.md`.

Lecture statique seulement : le statut P0/P1 indique une priorité d'audit, pas une preuve d'exploitation. Les colonnes `Ownership requis`, `Zod` et `Rate limit` doivent être confirmées manuellement dans les lots sécurité.

## Synthèse Lot 0

| Niveau | Nombre |
| --- | ---: |
| P0 | 44 |
| P1 | 42 |
| P2 | 62 |
| OK | 28 |
| Total routes | 176 |

## Routes prioritaires

| Route | Méthodes | Domaine | Public/Auth | Rôle requis | Ownership requis | Zod | Rate limit | Données sensibles | Statut | Action |
| ----- | -------- | ------- | ----------- | ----------- | ---------------- | --- | ---------- | ----------------- | ------ | ------ |
| `/api/admin/invoices/[id]` | PATCH | Facturation | Auth | Admin/staff à confirmer | Oui | Oui | À vérifier | Facture, paiement | P0 | Audit IDOR + rôle explicite |
| `/api/admin/invoices/[id]/send` | POST | Facturation | Auth | Admin/staff | Oui | Oui | À vérifier | Facture, email | P0 | Audit envoi hors périmètre |
| `/api/invoices/[id]/pdf` | GET | Facturation | Auth | Parent/admin selon ressource | Oui | Non | À vérifier | PDF facture | P0 | Ownership strict + no-leak |
| `/api/invoices/[id]/receipt/pdf` | GET | Facturation | Auth | Parent/admin selon ressource | Oui | Oui | À vérifier | Reçu PDF | P0 | Ownership strict + token |
| `/api/documents/[id]` | GET | Documents | Auth | User/staff | Oui | Non | À vérifier | Document privé | P0 | Audit document owner/staff |
| `/api/student/documents/[id]/download` | GET | Documents | Auth | Élève | Oui | Non | À vérifier | Document élève | P2 | Confirmer logs et path |
| `/api/assistante/students/[studentId]/documents` | GET, POST | Documents | Auth | Assistante | Oui | Oui | À vérifier | Documents mineurs | P0 | Ownership assistante/périmètre |
| `/api/coach/students/[studentId]/documents` | GET, POST | Documents | Auth | Coach | Oui | Oui | À vérifier | Documents mineurs | P0 | Assignment actif obligatoire |
| `/api/npc/files/[...path]` | GET | NPC/documents | Auth | Rôle selon soumission | Oui | Non | À vérifier | Copies, exports | P0 | Traversal + DB match + tests |
| `/api/payments/clictopay/webhook` | POST | Paiement | Public webhook | Aucun | N/A | Non | À vérifier | Paiement | P0 | Signature obligatoire + idempotence |
| `/api/payments/clictopay/init` | POST | Paiement | Auth | Parent | Oui | Non | À vérifier | Paiement | P1 | Reste `501` ou finaliser |
| `/api/payments/validate` | POST | Paiement | Auth | Admin/assistante | Oui | Oui | À vérifier | Paiement, droits | P2 | Couvrir idempotence/ownership |
| `/api/bilan-gratuit` | POST | Lead/bilan | Public | Aucun | N/A | Oui | Oui async | Mineur/parent | P0 | Revoir création compte + anti-spam |
| `/api/contact` | POST | Lead | Public | Aucun | N/A | Via CRM schema | Oui async | Contact | OK | Ajouter UTM/referrer |
| `/api/stages/[stageSlug]/inscrire` | POST | Stages | Public | Aucun | N/A | Oui | Oui | Lead stage | P0 | Anti-spam renforcé + CSRF/CAPTCHA à décider |
| `/api/stages/[stageSlug]/reservations` | GET | Stages | Auth | Staff | Oui | Non | À vérifier | Réservations | P0 | Audit staff/ownership |
| `/api/stages/[stageSlug]/bilans` | GET, POST | Bilans stages | Auth | Staff/coach | Oui | Oui | À vérifier | Bilans mineurs | P0 | Audit IDOR |
| `/api/assessments/submit` | POST | Assessments | Public/technique | À vérifier | Oui | Oui | À vérifier | Réponses élève | P0 | Auth ou token signé |
| `/api/assessments/[id]/result` | GET | Assessments | Auth | Owner/staff | Oui | Non | À vérifier | Résultat pédagogique | P2 | Test IDOR |
| `/api/bilans/[id]` | GET, PUT, DELETE | Bilans | Auth | Owner/staff | Oui | Non | À vérifier | Bilan pédagogique | P1 | Test IDOR + Zod |
| `/api/parent/bilans/[id]/pdf` | GET | Bilans PDF | Auth | Parent | Oui | Non | À vérifier | PDF bilan | P0 | Parent owns child |
| `/api/coach/students/[studentId]/generated-reports/[reportId]/download` | GET | Coach/bilans | Auth | Coach | Oui | Non | À vérifier | Rapport pédagogique | P0 | Assignment actif + report owner |
| `/api/aria/chat` | POST | ARIA | Auth | Élève | Oui | Oui | À vérifier | Conversation IA | P2 | Feature + conversation owner |
| `/api/aria/conversations` | GET | ARIA | Auth | Élève | Oui | Non | À vérifier | Historique IA | P2 | Conversation scoped student |
| `/api/subscriptions/aria-addon` | POST | Abonnements | Public selon inventaire | À vérifier | Oui | Non | À vérifier | Droit produit | P0 | Auth obligatoire |
| `/api/student/activate` | GET, POST | Activation | Public | Aucun | Token | Oui | À vérifier | Compte mineur | P0 | Token, rate limit, expiration |
| `/api/student/automatismes/series/[id]` | GET | Élève | Auth | Élève | Oui | Non | À vérifier | Progression | P0 | Owner série/tentatives |
| `/api/coach/students/[studentId]/eaf-preparation-report` | GET, PUT | Coach | Auth | Coach | Oui | Oui | À vérifier | Rapport EAF | P0 | Assignment actif |
| `/api/coach/sessions/[sessionId]/report` | GET, POST | Coach/session | Auth | Coach | Oui | Oui | À vérifier | Rapport session | P0 | Session owner |

## Routes publiques sensibles

- `/api/bilan-gratuit`
- `/api/contact`
- `/api/newsletter`
- `/api/notify/email`
- `/api/stages/[stageSlug]/inscrire`
- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/public-documents/corrige-dnb-maths-2026`
- `/api/student/activate`

## Routes dynamiques `[id]` à ré-auditer manuellement

- Factures : `/api/admin/invoices/[id]`, `/api/invoices/[id]/pdf`, `/api/invoices/[id]/receipt/pdf`.
- Documents : `/api/documents/[id]`, `/api/student/documents/[id]/download`.
- Bilans/assessments : `/api/bilans/[id]`, `/api/assessments/[id]/*`, `/api/parent/bilans/[id]/pdf`.
- Coach : `/api/coach/students/[studentId]/**`, `/api/coach/sessions/[sessionId]/report`.
- Stages : `/api/stages/[stageSlug]/**`.
- NPC : `/api/npc/submissions/[submissionId]/**`, `/api/npc/files/[...path]`.

## Annexe

L'inventaire exhaustif généré par script est dans `docs/security/API_GUARD_INVENTORY.md`.

Une annexe de pilotage Lot 0-bis est générée dans `docs/go-live/api-security-matrix.full.md`.

## Addendum Lot 0-bis

- Générateur : `scripts/go-live/generate-api-security-matrix.mjs`.
- Résultat : 176 routes recensées dans une table exploitable avec colonnes `Priorité`, `Route`, `Méthodes`, `Domaine`, `Public/Auth`, `Rôle requis`, `Ownership requis`, guards détectés, Zod, rate limit, données sensibles et action lot suivant.
- Synthèse inchangée : 44 P0, 42 P1, 62 P2, 28 OK.
- Top 20 Lot 1 : documents, factures/PDF, webhook ClicToPay, assessments/bilans, routes coach `[studentId]`.
- Limite : la matrice reste statique ; `Rate limit détecté = Oui` prouve seulement un motif de code local, pas une protection distribuée runtime.

Commande de régénération :

```bash
node scripts/go-live/generate-api-security-matrix.mjs
```

## Mise à jour Lot 6 — 2026-07-03

La matrice complète reste la source opérationnelle : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178` au démarrage Lot 6.

Les 6 P1 ne sont pas requalifiés dans ce lot :

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

Décision : ces routes restent acceptables uniquement pour bêta contrôlée avec réserves, volume limité et monitoring. Bêta élargie interdite tant que Redis/Upstash runtime et un vrai `429` ne sont pas prouvés.

## Mise à jour Lot 7 — 2026-07-03

La matrice reste volontairement inchangée côté risque : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.

Audit release candidate :

- `scripts/security/audit-api-guards.mjs` audité : accepté comme triage statique avec tests de classification et régression.
- `scripts/go-live/generate-api-security-matrix.mjs` audité : accepté comme générateur documentaire depuis l'inventaire, sans reclassification indépendante vers `OK`.
- `scripts/check-bundle-weight.sh` audité : accepté, la correction couvre les routes Next dynamiques sans masquer une route absente.
- Les 6 P1 restent P1 dans l'inventaire et la matrice.

Preuves manquantes :

- Redis/Upstash staging/production : `NON PROUVÉ`.
- Test `429` runtime réel : `NON EXÉCUTÉ`.
- Dry-run DB ContactLead : `NON EXÉCUTÉ`.

Décision : bêta contrôlée possible avec réserves ; bêta élargie et go-live large restent interdits.

## Mise à jour Lot 8 — 2026-07-03

Lot 8 ne requalifie aucune route.

- Matrice attendue maintenue : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.
- Les 6 P1 publics/paiement restent visibles.
- Le manifeste RC propre classe tous les fichiers sans modifier la matrice.
- Les scripts d'audit restent acceptés avec régressions renforcées.

Décision : la matrice est prête pour revue humaine RC, mais bêta élargie et go-live large restent interdits sans preuve Redis/Upstash et `429` runtime.

## Mise à jour Lot 12 — 2026-07-03

Lot 12 ne modifie pas la matrice et ne requalifie aucun P1.

- État courant : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.
- Les 6 P1 restent visibles.
- `docs/audits/audit-nexus-reussite.md` est exclu des commits standards car il contient un compteur API historique (`173 routes`) et une formulation de sécurité incompatible avec les 6 P1 ouverts.

Décision : l'audit peut être inclus uniquement après décision humaine explicite comme historique/stale ou après réécriture.
# Mise à jour Lot 1 — 2026-07-02

La matrice complète a été régénérée depuis `docs/security/API_GUARD_INVENTORY.md`.

| Priorité | Nombre Lot 1 |
| --- | ---: |
| P0 | 0 |
| P1 | 56 |
| P2 | 93 |
| OK | 27 |
| Total | 176 |

Le Top 20 opérationnel pointe désormais vers les P1 restants dans `docs/go-live/api-security-matrix.full.md`. Les routes P0 historiques ne sont pas déclarées “go-live ready” par simple statique : leur fermeture est documentée dans `docs/go-live/11_LOT1_SECURITY_CLOSURE.md`.

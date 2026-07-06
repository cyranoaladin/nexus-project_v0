# Lot 11 — Runbook humain de commits

Ce runbook transforme le plan Lot 10 en instructions humaines. Les commandes ci-dessous sont a executer par un humain uniquement. Codex ne les a pas executees.

- Aucun staging reel effectue par Codex pendant ce lot.
- Aucun commit execute par Codex pendant ce lot.
- Aucune creation de PR par Codex pendant ce lot.
- Le fichier en decision humaine `docs/audits/audit-nexus-reussite.md` reste hors commits standards.

## Commit 1 — chore(go-live): update security inventory and matrices

### Objectif

Versionner les inventaires et scripts de génération nécessaires au suivi RC.

### Fichiers concernés

- `docs/go-live/api-security-matrix.full.md`
- `docs/security/API_GUARD_INVENTORY.md`
- `scripts/check-bundle-weight.sh`
- `scripts/go-live/generate-api-security-matrix.mjs`
- `scripts/security/audit-api-guards.mjs`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "docs/go-live/api-security-matrix.full.md" \
  "docs/security/API_GUARD_INVENTORY.md" \
  "scripts/check-bundle-weight.sh" \
  "scripts/go-live/generate-api-security-matrix.mjs" \
  "scripts/security/audit-api-guards.mjs"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "chore(go-live): update security inventory and matrices"
```

### Tests recommandés avant ce commit

`node scripts/security/audit-api-guards.mjs`, `node scripts/go-live/generate-api-security-matrix.mjs`, `npm run check:bundle-weight`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Revue code standard requise ; ne pas inclure de fichiers exclus ou en décision humaine.

## Commit 2 — fix(api-security): close admin and role guard gaps

### Objectif

Regrouper les durcissements API, guards, ownership et projections hors flux publics/paiement.

### Fichiers concernés

- `app/api/admin/config/rollback/route.ts`
- `app/api/admin/config/route.ts`
- `app/api/admin/directeur/stats/route.ts`
- `app/api/admin/documents/route.ts`
- `app/api/admin/invoices/route.ts`
- `app/api/admin/recompute-ssn/route.ts`
- `app/api/admin/subscriptions/route.ts`
- `app/api/admin/test-email/route.ts`
- `app/api/assistante/credit-requests/route.ts`
- `app/api/assistante/quotes/pdf/route.ts`
- `app/api/assistante/students/credits/route.ts`
- `app/api/assistante/subscription-requests/route.ts`
- `app/api/assistante/subscriptions/route.ts`
- `app/api/bilans/[id]/export/route.ts`
- `app/api/bilans/[id]/route.ts`
- `app/api/bilans/generate/route.ts`
- `app/api/bilans/route.ts`
- `app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts`
- `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts`
- `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts`
- `app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts`
- `app/api/coach/students/[studentId]/documents/route.ts`
- `app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts`
- `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts`
- `app/api/coach/students/[studentId]/notes/route.ts`
- `app/api/coach/students/[studentId]/survival-mode/route.ts`
- `app/api/coach/trajectory/route.ts`
- `app/api/documents/[id]/route.ts`
- `app/api/eleve/bilan-diagnostic-maths-terminale/route.ts`
- `app/api/invoices/[id]/pdf/route.ts`
- `app/api/invoices/[id]/receipt/pdf/route.ts`
- `app/api/lamis/teacher-report/route.ts`
- `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts`
- `app/api/npc/submissions/[submissionId]/documents/route.ts`
- `app/api/npc/submissions/[submissionId]/generate/route.ts`
- `app/api/npc/submissions/route.ts`
- `app/api/npc/uploads/route.ts`
- `app/api/parent/children/route.ts`
- `app/api/parent/subscription-requests/route.ts`
- `app/api/parent/subscriptions/route.ts`
- `app/api/programme/maths-1ere-stmg/stage-progress/route.ts`
- `app/api/sessions/cancel/route.ts`
- `app/api/sessions/video/route.ts`
- `app/api/stages/[stageSlug]/inscrire/route.ts`
- `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts`
- `app/api/stages/[stageSlug]/route.ts`
- `app/api/student/activate/route.ts`
- `app/api/student/automatismes/attempts/route.ts`
- `app/api/student/automatismes/check-answer/route.ts`
- `app/api/student/automatismes/series/[id]/route.ts`
- `app/api/student/documents/[id]/download/route.ts`
- `app/api/student/nexus-index/route.ts`
- `app/api/student/survival/phrases/[phraseId]/copied/route.ts`
- `app/api/student/survival/progress/route.ts`
- `app/api/student/survival/qcm/attempt/route.ts`
- `app/api/student/survival/reflexes/[reflexId]/attempt/route.ts`
- `app/api/student/trajectory/route.ts`
- `lib/invoice/index.ts`
- `lib/invoice/not-found.ts`
- `lib/stages/inscription-schema.ts`
- `lib/validations.ts`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "app/api/admin/config/rollback/route.ts" \
  "app/api/admin/config/route.ts" \
  "app/api/admin/directeur/stats/route.ts" \
  "app/api/admin/documents/route.ts" \
  "app/api/admin/invoices/route.ts" \
  "app/api/admin/recompute-ssn/route.ts" \
  "app/api/admin/subscriptions/route.ts" \
  "app/api/admin/test-email/route.ts" \
  "app/api/assistante/credit-requests/route.ts" \
  "app/api/assistante/quotes/pdf/route.ts" \
  "app/api/assistante/students/credits/route.ts" \
  "app/api/assistante/subscription-requests/route.ts" \
  "app/api/assistante/subscriptions/route.ts" \
  "app/api/bilans/[id]/export/route.ts" \
  "app/api/bilans/[id]/route.ts" \
  "app/api/bilans/generate/route.ts" \
  "app/api/bilans/route.ts" \
  "app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts" \
  "app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts" \
  "app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts" \
  "app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts" \
  "app/api/coach/students/[studentId]/documents/route.ts" \
  "app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts" \
  "app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts" \
  "app/api/coach/students/[studentId]/notes/route.ts" \
  "app/api/coach/students/[studentId]/survival-mode/route.ts" \
  "app/api/coach/trajectory/route.ts" \
  "app/api/documents/[id]/route.ts" \
  "app/api/eleve/bilan-diagnostic-maths-terminale/route.ts" \
  "app/api/invoices/[id]/pdf/route.ts" \
  "app/api/invoices/[id]/receipt/pdf/route.ts" \
  "app/api/lamis/teacher-report/route.ts" \
  "app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts" \
  "app/api/npc/submissions/[submissionId]/documents/route.ts" \
  "app/api/npc/submissions/[submissionId]/generate/route.ts" \
  "app/api/npc/submissions/route.ts" \
  "app/api/npc/uploads/route.ts" \
  "app/api/parent/children/route.ts" \
  "app/api/parent/subscription-requests/route.ts" \
  "app/api/parent/subscriptions/route.ts" \
  "app/api/programme/maths-1ere-stmg/stage-progress/route.ts" \
  "app/api/sessions/cancel/route.ts" \
  "app/api/sessions/video/route.ts" \
  "app/api/stages/[stageSlug]/inscrire/route.ts" \
  "app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts" \
  "app/api/stages/[stageSlug]/route.ts" \
  "app/api/student/activate/route.ts" \
  "app/api/student/automatismes/attempts/route.ts" \
  "app/api/student/automatismes/check-answer/route.ts" \
  "app/api/student/automatismes/series/[id]/route.ts" \
  "app/api/student/documents/[id]/download/route.ts" \
  "app/api/student/nexus-index/route.ts" \
  "app/api/student/survival/phrases/[phraseId]/copied/route.ts" \
  "app/api/student/survival/progress/route.ts" \
  "app/api/student/survival/qcm/attempt/route.ts" \
  "app/api/student/survival/reflexes/[reflexId]/attempt/route.ts" \
  "app/api/student/trajectory/route.ts" \
  "lib/invoice/index.ts" \
  "lib/invoice/not-found.ts" \
  "lib/stages/inscription-schema.ts" \
  "lib/validations.ts"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "fix(api-security): close admin and role guard gaps"
```

### Tests recommandés avant ce commit

`npm run test:unit -- --runInBand __tests__/api/admin.config.route.test.ts __tests__/api/admin.documents.route.test.ts __tests__/api/bilans.id.route.test.ts`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Revue code standard requise ; ne pas inclure de fichiers exclus ou en décision humaine.

## Commit 3 — fix(public-funnel): lead-only bilan and assessment token binding

### Objectif

Regrouper le passage bilan lead-only et le binding du token assessment au flux autorisé.

### Fichiers concernés

- `app/api/assessments/public-token/route.ts`
- `app/api/assessments/submit/route.ts`
- `app/api/assessments/submit/types.ts`
- `app/api/bilan-gratuit/dismiss/route.ts`
- `app/api/bilan-gratuit/route.ts`
- `app/bilan-gratuit/assessment/AssessmentClient.tsx`
- `app/bilan-gratuit/assessment/page.tsx`
- `app/layout.tsx`
- `components/assessments/AssessmentRunner.tsx`
- `components/stages/StageInscriptionForm.tsx`
- `lib/assessments/public-token.ts`
- `lib/crm/contact-leads.ts`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "app/api/assessments/public-token/route.ts" \
  "app/api/assessments/submit/route.ts" \
  "app/api/assessments/submit/types.ts" \
  "app/api/bilan-gratuit/dismiss/route.ts" \
  "app/api/bilan-gratuit/route.ts" \
  "app/bilan-gratuit/assessment/AssessmentClient.tsx" \
  "app/bilan-gratuit/assessment/page.tsx" \
  "app/layout.tsx" \
  "components/assessments/AssessmentRunner.tsx" \
  "components/stages/StageInscriptionForm.tsx" \
  "lib/assessments/public-token.ts" \
  "lib/crm/contact-leads.ts"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "fix(public-funnel): lead-only bilan and assessment token binding"
```

### Tests recommandés avant ce commit

`npm run test:unit -- --runInBand __tests__/api/bilan-gratuit.product-rgpd.test.ts __tests__/api/assessments.submit.token-binding.test.ts __tests__/app/bilan-gratuit.assessment-page-token.test.tsx`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Flux public critique mineurs ; relancer tests token, bilan et Playwright assessment avant commit humain.

## Commit 4 — fix(runtime): rate-limit probe and business-config gate

### Objectif

Regrouper les garde-fous runtime : healthcheck, rate-limit probe et BusinessConfig.

### Fichiers concernés

- `app/api/internal/health/route.ts`
- `app/api/internal/rate-limit-probe/route.ts`
- `lib/config/snapshot.ts`
- `lib/rate-limit/index.ts`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "app/api/internal/health/route.ts" \
  "app/api/internal/rate-limit-probe/route.ts" \
  "lib/config/snapshot.ts" \
  "lib/rate-limit/index.ts"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "fix(runtime): rate-limit probe and business-config gate"
```

### Tests recommandés avant ce commit

`npm run test:unit -- --runInBand __tests__/api/internal.rate-limit-probe.test.ts __tests__/api/internal.business-config.health.test.ts __tests__/lib/rate-limit.production-gate.test.ts`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Preuves Redis/Upstash externes encore absentes ; ne pas lever les réserves runtime.

## Commit 5 — fix(payments): keep clictopay disabled and fail closed

### Objectif

Maintenir ClicToPay désactivé et fail-closed côté API/UI.

### Fichiers concernés

- `app/api/payments/clictopay/init/route.ts`
- `app/api/payments/clictopay/webhook/route.ts`
- `components/marketing/PaymentMethodsNote.tsx`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "app/api/payments/clictopay/init/route.ts" \
  "app/api/payments/clictopay/webhook/route.ts" \
  "components/marketing/PaymentMethodsNote.tsx"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "fix(payments): keep clictopay disabled and fail closed"
```

### Tests recommandés avant ce commit

`npm run test:unit -- --runInBand __tests__/api/payments.clictopay.disabled-contract.test.ts __tests__/api/payments.clictopay.feature-flag-consistency.test.ts __tests__/ui/payment-methods.clictopay-disabled.test.tsx`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Paiement carte doit rester désactivé ; vérifier ClicToPay disabled avant commit humain.

## Commit 6 — chore(maintenance): add contact-lead retention dry-run

### Objectif

Ajouter le script de rétention ContactLead en dry-run par défaut.

### Fichiers concernés

- `scripts/maintenance/contact-leads-retention.ts`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "scripts/maintenance/contact-leads-retention.ts"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "chore(maintenance): add contact-lead retention dry-run"
```

### Tests recommandés avant ce commit

`npm run test:unit -- --runInBand __tests__/scripts/contact-leads-retention.test.ts __tests__/lib/crm/contact-leads.retention.test.ts`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Revue code standard requise ; ne pas inclure de fichiers exclus ou en décision humaine.

## Commit 7 — test(security): add no-leak, idor, token and audit regressions

### Objectif

Ajouter les tests unitaires de non-régression sécurité, no-leak, IDOR, tokens et scripts.

### Fichiers concernés

- `__tests__/api/admin.config.route.test.ts`
- `__tests__/api/admin.directeur.stats.route.test.ts`
- `__tests__/api/admin.documents.route.test.ts`
- `__tests__/api/admin.invoices.route.test.ts`
- `__tests__/api/admin.recompute-ssn.route.test.ts`
- `__tests__/api/admin.subscriptions.route.test.ts`
- `__tests__/api/admin.test-email.route.test.ts`
- `__tests__/api/assessments-rbac.test.ts`
- `__tests__/api/assessments-submit.test.ts`
- `__tests__/api/assessments.public-token.binding.test.ts`
- `__tests__/api/assessments.public-token.route.test.ts`
- `__tests__/api/assessments.submit.token-binding.test.ts`
- `__tests__/api/assessments.submit.token-security.test.ts`
- `__tests__/api/assistant.credit-requests.route.test.ts`
- `__tests__/api/assistant.students.credits.route.test.ts`
- `__tests__/api/assistant.subscription-requests.route.test.ts`
- `__tests__/api/assistant.subscriptions.route.test.ts`
- `__tests__/api/assistante.quotes.pdf.route.test.ts`
- `__tests__/api/bilan-gratuit.product-rgpd.test.ts`
- `__tests__/api/bilan-gratuit.rgpd-minimization.test.ts`
- `__tests__/api/bilan-gratuit.security.test.ts`
- `__tests__/api/bilan-gratuit.test.ts`
- `__tests__/api/bilans.id.route.test.ts`
- `__tests__/api/bilans.idor.test.ts`
- `__tests__/api/bilans/crud.test.ts`
- `__tests__/api/bilans/generate.test.ts`
- `__tests__/api/coach.bilan-diagnostic-maths-terminale.security.test.ts`
- `__tests__/api/coach.eaf-preparation-report.validate.test.ts`
- `__tests__/api/coach.eaf-stage-regenerate.security.test.ts`
- `__tests__/api/coach.generated-reports.route.test.ts`
- `__tests__/api/coach.trajectory.security.test.ts`
- `__tests__/api/documents-access.test.ts`
- `__tests__/api/documents.id.route.test.ts`
- `__tests__/api/eleve.bilan-diagnostic-maths-terminale.security.test.ts`
- `__tests__/api/internal.business-config.health.test.ts`
- `__tests__/api/internal.health.rate-limit.test.ts`
- `__tests__/api/internal.rate-limit-probe.test.ts`
- `__tests__/api/invoices.pdf.route.test.ts`
- `__tests__/api/invoices.receipt.pdf.route.test.ts`
- `__tests__/api/lamis.teacher-report.route.test.ts`
- `__tests__/api/npc.documents.route.test.ts`
- `__tests__/api/npc.files.route.test.ts`
- `__tests__/api/npc.generate.test.ts`
- `__tests__/api/npc.submissions.security.test.ts`
- `__tests__/api/npc.uploads.route.test.ts`
- `__tests__/api/parent.children.activation.route.test.ts`
- `__tests__/api/parent.children.route.test.ts`
- `__tests__/api/parent.subscription-requests.route.test.ts`
- `__tests__/api/parent.subscriptions.route.test.ts`
- `__tests__/api/payments.clictopay.disabled-contract.test.ts`
- `__tests__/api/payments.clictopay.feature-flag-consistency.test.ts`
- `__tests__/api/payments.clictopay.init.route.test.ts`
- `__tests__/api/payments.clictopay.webhook.disabled.test.ts`
- `__tests__/api/payments.clictopay.webhook.route.test.ts`
- `__tests__/api/payments.clictopay.webhook.security.test.ts`
- `__tests__/api/programme.maths-1ere-stmg.stage-progress.test.ts`
- `__tests__/api/public-rate-limit.coverage.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`
- `__tests__/api/sessions.cancel.route.test.ts`
- `__tests__/api/sessions.video.route.test.ts`
- `__tests__/api/stages.inscrire.product-rgpd.test.ts`
- `__tests__/api/stages.inscrire.security.test.ts`
- `__tests__/api/stages/confirm.test.ts`
- `__tests__/api/stages/inscriptions.test.ts`
- `__tests__/api/student.activate.lifecycle-security.test.ts`
- `__tests__/api/student.activate.route.test.ts`
- `__tests__/app/bilan-gratuit.assessment-page-token.test.tsx`
- `__tests__/components/offer-detail-dialog.test.tsx`
- `__tests__/components/offres-page.test.tsx`
- `__tests__/lib/assessments/public-token.test.ts`
- `__tests__/lib/bilan-gratuit-form.test.tsx`
- `__tests__/lib/business-config.fallback.test.ts`
- `__tests__/lib/business-config.production-gate.test.ts`
- `__tests__/lib/crm/contact-leads.retention.test.ts`
- `__tests__/lib/invoice/access-scope.test.ts`
- `__tests__/lib/rate-limit.production-gate.test.ts`
- `__tests__/lib/validations.test.ts`
- `__tests__/scripts/audit-api-guards.classification.test.ts`
- `__tests__/scripts/contact-leads-retention.test.ts`
- `__tests__/scripts/security-audit-scripts-regression.test.ts`
- `__tests__/ui/payment-methods.clictopay-disabled.test.tsx`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "__tests__/api/admin.config.route.test.ts" \
  "__tests__/api/admin.directeur.stats.route.test.ts" \
  "__tests__/api/admin.documents.route.test.ts" \
  "__tests__/api/admin.invoices.route.test.ts" \
  "__tests__/api/admin.recompute-ssn.route.test.ts" \
  "__tests__/api/admin.subscriptions.route.test.ts" \
  "__tests__/api/admin.test-email.route.test.ts" \
  "__tests__/api/assessments-rbac.test.ts" \
  "__tests__/api/assessments-submit.test.ts" \
  "__tests__/api/assessments.public-token.binding.test.ts" \
  "__tests__/api/assessments.public-token.route.test.ts" \
  "__tests__/api/assessments.submit.token-binding.test.ts" \
  "__tests__/api/assessments.submit.token-security.test.ts" \
  "__tests__/api/assistant.credit-requests.route.test.ts" \
  "__tests__/api/assistant.students.credits.route.test.ts" \
  "__tests__/api/assistant.subscription-requests.route.test.ts" \
  "__tests__/api/assistant.subscriptions.route.test.ts" \
  "__tests__/api/assistante.quotes.pdf.route.test.ts" \
  "__tests__/api/bilan-gratuit.product-rgpd.test.ts" \
  "__tests__/api/bilan-gratuit.rgpd-minimization.test.ts" \
  "__tests__/api/bilan-gratuit.security.test.ts" \
  "__tests__/api/bilan-gratuit.test.ts" \
  "__tests__/api/bilans.id.route.test.ts" \
  "__tests__/api/bilans.idor.test.ts" \
  "__tests__/api/bilans/crud.test.ts" \
  "__tests__/api/bilans/generate.test.ts" \
  "__tests__/api/coach.bilan-diagnostic-maths-terminale.security.test.ts" \
  "__tests__/api/coach.eaf-preparation-report.validate.test.ts" \
  "__tests__/api/coach.eaf-stage-regenerate.security.test.ts" \
  "__tests__/api/coach.generated-reports.route.test.ts" \
  "__tests__/api/coach.trajectory.security.test.ts" \
  "__tests__/api/documents-access.test.ts" \
  "__tests__/api/documents.id.route.test.ts" \
  "__tests__/api/eleve.bilan-diagnostic-maths-terminale.security.test.ts" \
  "__tests__/api/internal.business-config.health.test.ts" \
  "__tests__/api/internal.health.rate-limit.test.ts" \
  "__tests__/api/internal.rate-limit-probe.test.ts" \
  "__tests__/api/invoices.pdf.route.test.ts" \
  "__tests__/api/invoices.receipt.pdf.route.test.ts" \
  "__tests__/api/lamis.teacher-report.route.test.ts" \
  "__tests__/api/npc.documents.route.test.ts" \
  "__tests__/api/npc.files.route.test.ts" \
  "__tests__/api/npc.generate.test.ts" \
  "__tests__/api/npc.submissions.security.test.ts" \
  "__tests__/api/npc.uploads.route.test.ts" \
  "__tests__/api/parent.children.activation.route.test.ts" \
  "__tests__/api/parent.children.route.test.ts" \
  "__tests__/api/parent.subscription-requests.route.test.ts" \
  "__tests__/api/parent.subscriptions.route.test.ts" \
  "__tests__/api/payments.clictopay.disabled-contract.test.ts" \
  "__tests__/api/payments.clictopay.feature-flag-consistency.test.ts" \
  "__tests__/api/payments.clictopay.init.route.test.ts" \
  "__tests__/api/payments.clictopay.webhook.disabled.test.ts" \
  "__tests__/api/payments.clictopay.webhook.route.test.ts" \
  "__tests__/api/payments.clictopay.webhook.security.test.ts" \
  "__tests__/api/programme.maths-1ere-stmg.stage-progress.test.ts" \
  "__tests__/api/public-rate-limit.coverage.test.ts" \
  "__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts" \
  "__tests__/api/sessions.cancel.route.test.ts" \
  "__tests__/api/sessions.video.route.test.ts" \
  "__tests__/api/stages.inscrire.product-rgpd.test.ts" \
  "__tests__/api/stages.inscrire.security.test.ts" \
  "__tests__/api/stages/confirm.test.ts" \
  "__tests__/api/stages/inscriptions.test.ts" \
  "__tests__/api/student.activate.lifecycle-security.test.ts" \
  "__tests__/api/student.activate.route.test.ts" \
  "__tests__/app/bilan-gratuit.assessment-page-token.test.tsx" \
  "__tests__/components/offer-detail-dialog.test.tsx" \
  "__tests__/components/offres-page.test.tsx" \
  "__tests__/lib/assessments/public-token.test.ts" \
  "__tests__/lib/bilan-gratuit-form.test.tsx" \
  "__tests__/lib/business-config.fallback.test.ts" \
  "__tests__/lib/business-config.production-gate.test.ts" \
  "__tests__/lib/crm/contact-leads.retention.test.ts" \
  "__tests__/lib/invoice/access-scope.test.ts" \
  "__tests__/lib/rate-limit.production-gate.test.ts" \
  "__tests__/lib/validations.test.ts" \
  "__tests__/scripts/audit-api-guards.classification.test.ts" \
  "__tests__/scripts/contact-leads-retention.test.ts" \
  "__tests__/scripts/security-audit-scripts-regression.test.ts" \
  "__tests__/ui/payment-methods.clictopay-disabled.test.tsx"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "test(security): add no-leak, idor, token and audit regressions"
```

### Tests recommandés avant ce commit

`npm run test:unit -- --runInBand`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Risque faible, mais les tests doivent rester verts isolément et dans la suite ciblée.

## Commit 8 — test(e2e): protect public assessment route

### Objectif

Ajouter et ajuster les smokes E2E publics liés au tunnel assessment.

### Fichiers concernés

- `e2e/pages-public-bilan-assessment-token.spec.ts`
- `e2e/pages-public-bilan-gratuit.spec.ts`
- `e2e/pages-public-homepage.spec.ts`
- `e2e/pages-public-offres.spec.ts`
- `playwright.config.ts`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "e2e/pages-public-bilan-assessment-token.spec.ts" \
  "e2e/pages-public-bilan-gratuit.spec.ts" \
  "e2e/pages-public-homepage.spec.ts" \
  "e2e/pages-public-offres.spec.ts" \
  "playwright.config.ts"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "test(e2e): protect public assessment route"
```

### Tests recommandés avant ce commit

`PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium`

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Risque faible, mais les tests doivent rester verts isolément et dans la suite ciblée.

## Commit 9 — docs(go-live): add evidence and go-no-go registers

### Objectif

Versionner les documents go-live et preuves de décision RC.

### Fichiers concernés

- `docs/go-live/00_EXECUTIVE_STATE.md`
- `docs/go-live/01_ACTION_PLAN.md`
- `docs/go-live/02_P0_P1_BACKLOG.md`
- `docs/go-live/03_RELEASE_GATES.md`
- `docs/go-live/04_TEST_MATRIX.md`
- `docs/go-live/05_API_SECURITY_MATRIX.md`
- `docs/go-live/06_BUSINESS_LOGIC_DECISIONS.md`
- `docs/go-live/07_ENV_INFRA_CHECKLIST.md`
- `docs/go-live/08_MARKETING_CONTENT_CHECKLIST.md`
- `docs/go-live/09_CODEX_NEXT_LOT_PROMPTS.md`
- `docs/go-live/10_LOT0_ACCEPTANCE.md`
- `docs/go-live/11_LOT1_SECURITY_CLOSURE.md`
- `docs/go-live/12_LOT1BIS_SECURITY_VERIFICATION.md`
- `docs/go-live/13_LOT1TER_P1_SECURITY_CLOSURE.md`
- `docs/go-live/14_LOT1QUATER_PUBLIC_ROLE_SECURITY_CLOSURE.md`
- `docs/go-live/15_LOT1QUINQUIES_FINAL_P1_SECURITY_CLOSURE.md`
- `docs/go-live/16_LOT2_PUBLIC_PRODUCT_RGPD_PAYMENT_DECISIONS.md`
- `docs/go-live/17_LOT3_RUNTIME_RGPD_ASSESSMENT_TOKEN.md`
- `docs/go-live/18_LOT4_RUNTIME_PAYMENT_RETENTION_TOKEN_BINDING.md`
- `docs/go-live/19_LOT5_RUNTIME_EXPLOITATION_GO_NO_GO.md`
- `docs/go-live/20_LOT6_STAGING_RELEASE_CANDIDATE_GO_NO_GO.md`
- `docs/go-live/21_LOT7_RELEASE_CANDIDATE_SECURITY_AUDIT.md`
- `docs/go-live/22_LOT8_RELEASE_CANDIDATE_CLEANUP.md`
- `docs/go-live/_evidence/entitlement-pricing-delta.md`
- `docs/go-live/_evidence/hardcoded-pricing-triage.md`
- `docs/go-live/_evidence/lot0-command-log.md`
- `docs/go-live/_evidence/lot1-api-route-triage.md`
- `docs/go-live/_evidence/lot1-command-log.md`
- `docs/go-live/_evidence/lot1-idor-tests.md`
- `docs/go-live/_evidence/lot1-rate-limit-runtime.md`
- `docs/go-live/_evidence/lot1bis-audit-script-review.md`
- `docs/go-live/_evidence/lot1bis-command-log.md`
- `docs/go-live/_evidence/lot1bis-p0-reclassification-audit.md`
- `docs/go-live/_evidence/lot1bis-p1-closure.md`
- `docs/go-live/_evidence/lot1bis-rate-limit-production-gate.md`
- `docs/go-live/_evidence/lot1quater-assistante.md`
- `docs/go-live/_evidence/lot1quater-coach.md`
- `docs/go-live/_evidence/lot1quater-command-log.md`
- `docs/go-live/_evidence/lot1quater-p1-before-after.md`
- `docs/go-live/_evidence/lot1quater-parent-student.md`
- `docs/go-live/_evidence/lot1quater-public-routes.md`
- `docs/go-live/_evidence/lot1quater-rate-limit-runtime-proof.md`
- `docs/go-live/_evidence/lot1quater-sensitive-fields-coverage.md`
- `docs/go-live/_evidence/lot1quater-stages.md`
- `docs/go-live/_evidence/lot1quinquies-admin-routes.md`
- `docs/go-live/_evidence/lot1quinquies-clictopay-webhook.md`
- `docs/go-live/_evidence/lot1quinquies-command-log.md`
- `docs/go-live/_evidence/lot1quinquies-p1-before-after.md`
- `docs/go-live/_evidence/lot1quinquies-public-sensitive-routes.md`
- `docs/go-live/_evidence/lot1quinquies-rate-limit-runtime-proof.md`
- `docs/go-live/_evidence/lot1quinquies-sensitive-fields-coverage.md`
- `docs/go-live/_evidence/lot1ter-bilans-assessments.md`
- `docs/go-live/_evidence/lot1ter-coach-reports.md`
- `docs/go-live/_evidence/lot1ter-command-log.md`
- `docs/go-live/_evidence/lot1ter-npc-documents.md`
- `docs/go-live/_evidence/lot1ter-p1-before-after.md`
- `docs/go-live/_evidence/lot1ter-payments-invoices.md`
- `docs/go-live/_evidence/lot1ter-sensitive-fields-coverage.md`
- `docs/go-live/_evidence/lot2-assessments-submit-decision.md`
- `docs/go-live/_evidence/lot2-bilan-gratuit-product-rgpd.md`
- `docs/go-live/_evidence/lot2-clictopay-payment-decision.md`
- `docs/go-live/_evidence/lot2-lamis-teacher-report-decision.md`
- `docs/go-live/_evidence/lot2-public-product-rgpd-command-log.md`
- `docs/go-live/_evidence/lot2-rate-limit-runtime-decision.md`
- `docs/go-live/_evidence/lot2-sensitive-fields-success-error-coverage.md`
- `docs/go-live/_evidence/lot2-stages-inscrire-product-rgpd.md`
- `docs/go-live/_evidence/lot2-student-activate-token-lifecycle.md`
- `docs/go-live/_evidence/lot3-assessments-public-token.md`
- `docs/go-live/_evidence/lot3-bilan-gratuit-rgpd-register.md`
- `docs/go-live/_evidence/lot3-business-configs-db-drift.md`
- `docs/go-live/_evidence/lot3-clictopay-disabled-contract.md`
- `docs/go-live/_evidence/lot3-contact-lead-retention-policy.md`
- `docs/go-live/_evidence/lot3-no-leak-success-error-runtime-coverage.md`
- `docs/go-live/_evidence/lot3-redis-upstash-runtime-proof.md`
- `docs/go-live/_evidence/lot3-runtime-rgpd-assessment-command-log.md`
- `docs/go-live/_evidence/lot4-assessment-token-binding.md`
- `docs/go-live/_evidence/lot4-business-config-production-gate.md`
- `docs/go-live/_evidence/lot4-clictopay-disabled-runbook.md`
- `docs/go-live/_evidence/lot4-contact-lead-retention-job.md`
- `docs/go-live/_evidence/lot4-no-leak-e2e-runtime-coverage.md`
- `docs/go-live/_evidence/lot4-redis-upstash-runtime-proof.md`
- `docs/go-live/_evidence/lot4-token-runtime-payment-command-log.md`
- `docs/go-live/_evidence/lot5-business-config-runtime-decision.md`
- `docs/go-live/_evidence/lot5-clictopay-final-disabled-decision.md`
- `docs/go-live/_evidence/lot5-contact-lead-retention-dry-run.md`
- `docs/go-live/_evidence/lot5-p1-go-no-go-register.md`
- `docs/go-live/_evidence/lot5-public-e2e-critical-paths.md`
- `docs/go-live/_evidence/lot5-rate-limit-429-proof.md`
- `docs/go-live/_evidence/lot5-redis-upstash-authenticated-healthcheck.md`
- `docs/go-live/_evidence/lot5-runtime-exploitation-command-log.md`
- `docs/go-live/_evidence/lot6-contact-lead-retention-db-dry-run.md`
- `docs/go-live/_evidence/lot6-final-go-no-go-register.md`
- `docs/go-live/_evidence/lot6-rate-limit-429-runtime-proof.md`
- `docs/go-live/_evidence/lot6-redis-upstash-authenticated-proof.md`
- `docs/go-live/_evidence/lot6-release-candidate-worktree-audit.md`
- `docs/go-live/_evidence/lot6-staging-release-candidate-command-log.md`
- `docs/go-live/_evidence/lot7-final-decision-register.md`
- `docs/go-live/_evidence/lot7-release-candidate-audit-command-log.md`
- `docs/go-live/_evidence/lot7-release-candidate-commit-plan.md`
- `docs/go-live/_evidence/lot7-release-candidate-file-manifest.md`
- `docs/go-live/_evidence/lot7-runtime-human-assisted-proof.md`
- `docs/go-live/_evidence/lot7-security-scripts-audit.md`
- `docs/go-live/_evidence/lot8-final-release-candidate-register.md`
- `docs/go-live/_evidence/lot8-release-candidate-clean-manifest-command-log.md`
- `docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md`
- `docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md`
- `docs/go-live/_evidence/lot8-runtime-proof-status.md`
- `docs/go-live/_evidence/lot8-security-scripts-regression-audit.md`
- `docs/go-live/_evidence/playwright-public-smoke-triage.md`

### Commande de staging à exécuter par l’humain

```bash
git add -- \
  "docs/go-live/00_EXECUTIVE_STATE.md" \
  "docs/go-live/01_ACTION_PLAN.md" \
  "docs/go-live/02_P0_P1_BACKLOG.md" \
  "docs/go-live/03_RELEASE_GATES.md" \
  "docs/go-live/04_TEST_MATRIX.md" \
  "docs/go-live/05_API_SECURITY_MATRIX.md" \
  "docs/go-live/06_BUSINESS_LOGIC_DECISIONS.md" \
  "docs/go-live/07_ENV_INFRA_CHECKLIST.md" \
  "docs/go-live/08_MARKETING_CONTENT_CHECKLIST.md" \
  "docs/go-live/09_CODEX_NEXT_LOT_PROMPTS.md" \
  "docs/go-live/10_LOT0_ACCEPTANCE.md" \
  "docs/go-live/11_LOT1_SECURITY_CLOSURE.md" \
  "docs/go-live/12_LOT1BIS_SECURITY_VERIFICATION.md" \
  "docs/go-live/13_LOT1TER_P1_SECURITY_CLOSURE.md" \
  "docs/go-live/14_LOT1QUATER_PUBLIC_ROLE_SECURITY_CLOSURE.md" \
  "docs/go-live/15_LOT1QUINQUIES_FINAL_P1_SECURITY_CLOSURE.md" \
  "docs/go-live/16_LOT2_PUBLIC_PRODUCT_RGPD_PAYMENT_DECISIONS.md" \
  "docs/go-live/17_LOT3_RUNTIME_RGPD_ASSESSMENT_TOKEN.md" \
  "docs/go-live/18_LOT4_RUNTIME_PAYMENT_RETENTION_TOKEN_BINDING.md" \
  "docs/go-live/19_LOT5_RUNTIME_EXPLOITATION_GO_NO_GO.md" \
  "docs/go-live/20_LOT6_STAGING_RELEASE_CANDIDATE_GO_NO_GO.md" \
  "docs/go-live/21_LOT7_RELEASE_CANDIDATE_SECURITY_AUDIT.md" \
  "docs/go-live/22_LOT8_RELEASE_CANDIDATE_CLEANUP.md" \
  "docs/go-live/_evidence/entitlement-pricing-delta.md" \
  "docs/go-live/_evidence/hardcoded-pricing-triage.md" \
  "docs/go-live/_evidence/lot0-command-log.md" \
  "docs/go-live/_evidence/lot1-api-route-triage.md" \
  "docs/go-live/_evidence/lot1-command-log.md" \
  "docs/go-live/_evidence/lot1-idor-tests.md" \
  "docs/go-live/_evidence/lot1-rate-limit-runtime.md" \
  "docs/go-live/_evidence/lot1bis-audit-script-review.md" \
  "docs/go-live/_evidence/lot1bis-command-log.md" \
  "docs/go-live/_evidence/lot1bis-p0-reclassification-audit.md" \
  "docs/go-live/_evidence/lot1bis-p1-closure.md" \
  "docs/go-live/_evidence/lot1bis-rate-limit-production-gate.md" \
  "docs/go-live/_evidence/lot1quater-assistante.md" \
  "docs/go-live/_evidence/lot1quater-coach.md" \
  "docs/go-live/_evidence/lot1quater-command-log.md" \
  "docs/go-live/_evidence/lot1quater-p1-before-after.md" \
  "docs/go-live/_evidence/lot1quater-parent-student.md" \
  "docs/go-live/_evidence/lot1quater-public-routes.md" \
  "docs/go-live/_evidence/lot1quater-rate-limit-runtime-proof.md" \
  "docs/go-live/_evidence/lot1quater-sensitive-fields-coverage.md" \
  "docs/go-live/_evidence/lot1quater-stages.md" \
  "docs/go-live/_evidence/lot1quinquies-admin-routes.md" \
  "docs/go-live/_evidence/lot1quinquies-clictopay-webhook.md" \
  "docs/go-live/_evidence/lot1quinquies-command-log.md" \
  "docs/go-live/_evidence/lot1quinquies-p1-before-after.md" \
  "docs/go-live/_evidence/lot1quinquies-public-sensitive-routes.md" \
  "docs/go-live/_evidence/lot1quinquies-rate-limit-runtime-proof.md" \
  "docs/go-live/_evidence/lot1quinquies-sensitive-fields-coverage.md" \
  "docs/go-live/_evidence/lot1ter-bilans-assessments.md" \
  "docs/go-live/_evidence/lot1ter-coach-reports.md" \
  "docs/go-live/_evidence/lot1ter-command-log.md" \
  "docs/go-live/_evidence/lot1ter-npc-documents.md" \
  "docs/go-live/_evidence/lot1ter-p1-before-after.md" \
  "docs/go-live/_evidence/lot1ter-payments-invoices.md" \
  "docs/go-live/_evidence/lot1ter-sensitive-fields-coverage.md" \
  "docs/go-live/_evidence/lot2-assessments-submit-decision.md" \
  "docs/go-live/_evidence/lot2-bilan-gratuit-product-rgpd.md" \
  "docs/go-live/_evidence/lot2-clictopay-payment-decision.md" \
  "docs/go-live/_evidence/lot2-lamis-teacher-report-decision.md" \
  "docs/go-live/_evidence/lot2-public-product-rgpd-command-log.md" \
  "docs/go-live/_evidence/lot2-rate-limit-runtime-decision.md" \
  "docs/go-live/_evidence/lot2-sensitive-fields-success-error-coverage.md" \
  "docs/go-live/_evidence/lot2-stages-inscrire-product-rgpd.md" \
  "docs/go-live/_evidence/lot2-student-activate-token-lifecycle.md" \
  "docs/go-live/_evidence/lot3-assessments-public-token.md" \
  "docs/go-live/_evidence/lot3-bilan-gratuit-rgpd-register.md" \
  "docs/go-live/_evidence/lot3-business-configs-db-drift.md" \
  "docs/go-live/_evidence/lot3-clictopay-disabled-contract.md" \
  "docs/go-live/_evidence/lot3-contact-lead-retention-policy.md" \
  "docs/go-live/_evidence/lot3-no-leak-success-error-runtime-coverage.md" \
  "docs/go-live/_evidence/lot3-redis-upstash-runtime-proof.md" \
  "docs/go-live/_evidence/lot3-runtime-rgpd-assessment-command-log.md" \
  "docs/go-live/_evidence/lot4-assessment-token-binding.md" \
  "docs/go-live/_evidence/lot4-business-config-production-gate.md" \
  "docs/go-live/_evidence/lot4-clictopay-disabled-runbook.md" \
  "docs/go-live/_evidence/lot4-contact-lead-retention-job.md" \
  "docs/go-live/_evidence/lot4-no-leak-e2e-runtime-coverage.md" \
  "docs/go-live/_evidence/lot4-redis-upstash-runtime-proof.md" \
  "docs/go-live/_evidence/lot4-token-runtime-payment-command-log.md" \
  "docs/go-live/_evidence/lot5-business-config-runtime-decision.md" \
  "docs/go-live/_evidence/lot5-clictopay-final-disabled-decision.md" \
  "docs/go-live/_evidence/lot5-contact-lead-retention-dry-run.md" \
  "docs/go-live/_evidence/lot5-p1-go-no-go-register.md" \
  "docs/go-live/_evidence/lot5-public-e2e-critical-paths.md" \
  "docs/go-live/_evidence/lot5-rate-limit-429-proof.md" \
  "docs/go-live/_evidence/lot5-redis-upstash-authenticated-healthcheck.md" \
  "docs/go-live/_evidence/lot5-runtime-exploitation-command-log.md" \
  "docs/go-live/_evidence/lot6-contact-lead-retention-db-dry-run.md" \
  "docs/go-live/_evidence/lot6-final-go-no-go-register.md" \
  "docs/go-live/_evidence/lot6-rate-limit-429-runtime-proof.md" \
  "docs/go-live/_evidence/lot6-redis-upstash-authenticated-proof.md" \
  "docs/go-live/_evidence/lot6-release-candidate-worktree-audit.md" \
  "docs/go-live/_evidence/lot6-staging-release-candidate-command-log.md" \
  "docs/go-live/_evidence/lot7-final-decision-register.md" \
  "docs/go-live/_evidence/lot7-release-candidate-audit-command-log.md" \
  "docs/go-live/_evidence/lot7-release-candidate-commit-plan.md" \
  "docs/go-live/_evidence/lot7-release-candidate-file-manifest.md" \
  "docs/go-live/_evidence/lot7-runtime-human-assisted-proof.md" \
  "docs/go-live/_evidence/lot7-security-scripts-audit.md" \
  "docs/go-live/_evidence/lot8-final-release-candidate-register.md" \
  "docs/go-live/_evidence/lot8-release-candidate-clean-manifest-command-log.md" \
  "docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md" \
  "docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md" \
  "docs/go-live/_evidence/lot8-runtime-proof-status.md" \
  "docs/go-live/_evidence/lot8-security-scripts-regression-audit.md" \
  "docs/go-live/_evidence/playwright-public-smoke-triage.md"
```

### Commande de vérification du staging

```bash
git diff --cached --name-only
```

### Commande de commit à exécuter par l’humain

```bash
git commit -m "docs(go-live): add evidence and go-no-go registers"
```

### Tests recommandés avant ce commit

`npm run check:docs-archive` + relecture docs go-live

### Vérifications après ce commit

- Relancer `git status --short --untracked-files=all`.
- Vérifier que le staging est vide après le commit humain.
- Vérifier que les 6 P1 restent visibles dans la matrice API.

### Risques à accepter

Volume documentaire important ; revue humaine recommandée avant commit.

## Décision humaine requise

| Fichier | Statut | Décision actuelle | Options | Recommandation |
|---|---|---|---|---|
| `docs/audits/audit-nexus-reussite.md` | Needs human review | Non inclus dans les commits standards | Inclure / Exclure / Reporter | Reporter tant que non valide humainement |

Ce fichier ne doit etre ajoute a aucun commit standard sans decision humaine explicite.

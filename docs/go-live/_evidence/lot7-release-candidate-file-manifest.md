# Lot 7 — Manifest release candidate

Source : `git status --porcelain=v1 -uall` après gates finales Lot 7. Ce manifeste classe chaque entrée modifiée ou non suivie sans supprimer de fichier.

| Fichier | État Git | Groupe | Inclure RC | Justification | Risque |
|---|---|---|---:|---|---|
| `__tests__/api/admin.config.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/admin.directeur.stats.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/admin.documents.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/admin.invoices.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/admin.recompute-ssn.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/admin.subscriptions.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/admin.test-email.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assessments-rbac.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assessments-submit.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assistant.credit-requests.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assistant.students.credits.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assistant.subscription-requests.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assistant.subscriptions.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assistante.quotes.pdf.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilan-gratuit.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilans.id.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilans.idor.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilans/crud.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilans/generate.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/coach.eaf-preparation-report.validate.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/coach.generated-reports.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/documents-access.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/documents.id.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/invoices.pdf.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/invoices.receipt.pdf.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/npc.documents.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/npc.files.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/npc.generate.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/npc.uploads.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/parent.children.activation.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/parent.children.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/parent.subscription-requests.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/parent.subscriptions.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/payments.clictopay.init.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/payments.clictopay.webhook.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/programme.maths-1ere-stmg.stage-progress.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/public-rate-limit.coverage.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/sessions.cancel.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/sessions.video.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/stages.inscrire.security.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/stages/confirm.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/stages/inscriptions.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/student.activate.route.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/components/offer-detail-dialog.test.tsx` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/components/offres-page.test.tsx` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/bilan-gratuit-form.test.tsx` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/validations.test.ts` | `M` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `app/api/admin/config/rollback/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/admin/config/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/admin/directeur/stats/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/admin/documents/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/admin/invoices/route.ts` | `M` | API security | Oui | Facturation/projections/ownership | Revue humaine standard |
| `app/api/admin/recompute-ssn/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/admin/subscriptions/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/admin/test-email/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/assessments/submit/route.ts` | `M` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `app/api/assessments/submit/types.ts` | `M` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `app/api/assistante/credit-requests/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/assistante/quotes/pdf/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/assistante/students/credits/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/assistante/subscription-requests/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/assistante/subscriptions/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/bilan-gratuit/dismiss/route.ts` | `M` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `app/api/bilan-gratuit/route.ts` | `M` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `app/api/bilans/[id]/export/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/bilans/[id]/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/bilans/generate/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/bilans/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/students/[studentId]/documents/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/students/[studentId]/notes/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/students/[studentId]/survival-mode/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/coach/trajectory/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/documents/[id]/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/eleve/bilan-diagnostic-maths-terminale/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/internal/health/route.ts` | `M` | Rate limit runtime | Oui | Health/runtime gates | Preuve runtime encore absente |
| `app/api/invoices/[id]/pdf/route.ts` | `M` | API security | Oui | Facturation/projections/ownership | Revue humaine standard |
| `app/api/invoices/[id]/receipt/pdf/route.ts` | `M` | API security | Oui | Facturation/projections/ownership | Revue humaine standard |
| `app/api/lamis/teacher-report/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/npc/submissions/[submissionId]/documents/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/npc/submissions/[submissionId]/generate/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/npc/submissions/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/npc/uploads/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/parent/children/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/parent/subscription-requests/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/parent/subscriptions/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/payments/clictopay/init/route.ts` | `M` | ClicToPay disabled | Oui | Contrat paiement carte désactivé | Ne pas réactiver paiement carte |
| `app/api/payments/clictopay/webhook/route.ts` | `M` | ClicToPay disabled | Oui | Contrat paiement carte désactivé | Ne pas réactiver paiement carte |
| `app/api/programme/maths-1ere-stmg/stage-progress/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/sessions/cancel/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/sessions/video/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/stages/[stageSlug]/inscrire/route.ts` | `M` | API security | Oui | Stages publics/staff | Revue humaine standard |
| `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts` | `M` | API security | Oui | Stages publics/staff | Revue humaine standard |
| `app/api/stages/[stageSlug]/route.ts` | `M` | API security | Oui | Stages publics/staff | Revue humaine standard |
| `app/api/student/activate/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/automatismes/attempts/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/automatismes/check-answer/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/automatismes/series/[id]/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/documents/[id]/download/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/nexus-index/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/survival/phrases/[phraseId]/copied/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/survival/progress/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/survival/qcm/attempt/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/survival/reflexes/[reflexId]/attempt/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/api/student/trajectory/route.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `app/bilan-gratuit/assessment/page.tsx` | `M` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `app/layout.tsx` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `components/assessments/AssessmentRunner.tsx` | `M` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `components/marketing/PaymentMethodsNote.tsx` | `M` | ClicToPay disabled | Oui | Contrat paiement carte désactivé | Ne pas réactiver paiement carte |
| `components/stages/StageInscriptionForm.tsx` | `M` | API security | Oui | Stages publics/staff | Revue humaine standard |
| `docs/security/API_GUARD_INVENTORY.md` | `M` | Docs go-live | Oui | Inventaire/matrice sécurité | Revue humaine standard |
| `e2e/pages-public-bilan-gratuit.spec.ts` | `M` | Tests E2E | Oui | Smoke public et assessment | Revue humaine standard |
| `e2e/pages-public-homepage.spec.ts` | `M` | Tests E2E | Oui | Smoke public et assessment | Revue humaine standard |
| `e2e/pages-public-offres.spec.ts` | `M` | Tests E2E | Oui | Smoke public et assessment | Revue humaine standard |
| `lib/config/snapshot.ts` | `M` | Rate limit runtime | Oui | Health/runtime gates | Preuve runtime encore absente |
| `lib/crm/contact-leads.ts` | `M` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `lib/invoice/index.ts` | `M` | API security | Oui | Facturation/projections/ownership | Revue humaine standard |
| `lib/invoice/not-found.ts` | `M` | API security | Oui | Facturation/projections/ownership | Revue humaine standard |
| `lib/rate-limit/index.ts` | `M` | Rate limit runtime | Oui | Health/runtime gates | Preuve runtime encore absente |
| `lib/stages/inscription-schema.ts` | `M` | API security | Oui | Stages publics/staff | Revue humaine standard |
| `lib/validations.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `playwright.config.ts` | `M` | API security | Oui | Code produit testé dans les lots sécurité | Revue humaine standard |
| `scripts/check-bundle-weight.sh` | `M` | Scripts audit | Oui | Correction nécessaire pour routes dynamiques Next | Risque de classification, mitigé par tests |
| `scripts/security/audit-api-guards.mjs` | `M` | Scripts audit | Oui | Script audité et couvert par regression | Risque de classification, mitigé par tests |
| `__tests__/api/assessments.public-token.binding.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assessments.public-token.route.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assessments.submit.token-binding.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/assessments.submit.token-security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilan-gratuit.product-rgpd.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilan-gratuit.rgpd-minimization.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/bilan-gratuit.security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/coach.bilan-diagnostic-maths-terminale.security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/coach.eaf-stage-regenerate.security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/coach.trajectory.security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/eleve.bilan-diagnostic-maths-terminale.security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/internal.business-config.health.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/internal.health.rate-limit.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/internal.rate-limit-probe.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/lamis.teacher-report.route.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/npc.submissions.security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/payments.clictopay.disabled-contract.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/payments.clictopay.feature-flag-consistency.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/payments.clictopay.webhook.disabled.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/payments.clictopay.webhook.security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/stages.inscrire.product-rgpd.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/api/student.activate.lifecycle-security.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/app/bilan-gratuit.assessment-page-token.test.tsx` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/assessments/public-token.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/business-config.fallback.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/business-config.production-gate.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/crm/contact-leads.retention.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/invoice/access-scope.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/lib/rate-limit.production-gate.test.ts` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `__tests__/scripts/audit-api-guards.classification.test.ts` | `??` | Scripts audit | Oui | Tests de non-régression scripts | Risque de classification, mitigé par tests |
| `__tests__/scripts/contact-leads-retention.test.ts` | `??` | Scripts audit | Oui | Tests de non-régression scripts | Risque de classification, mitigé par tests |
| `__tests__/scripts/security-audit-scripts-regression.test.ts` | `??` | Scripts audit | Oui | Tests de non-régression scripts | Risque de classification, mitigé par tests |
| `__tests__/ui/payment-methods.clictopay-disabled.test.tsx` | `??` | Tests unitaires | Oui | Couverture sécurité/régression | Revue humaine standard |
| `app/api/assessments/public-token/route.ts` | `??` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `app/api/internal/rate-limit-probe/route.ts` | `??` | Rate limit runtime | Oui | Health/runtime gates | Preuve runtime encore absente |
| `app/bilan-gratuit/assessment/AssessmentClient.tsx` | `??` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `docs/audits/audit-nexus-reussite.md` | `??` | À exclure | Non | Document audit secondaire à valider humainement avant inclusion | Exclure de la RC ou valider humainement |
| `docs/go-live/00_EXECUTIVE_STATE.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/01_ACTION_PLAN.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/02_P0_P1_BACKLOG.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/03_RELEASE_GATES.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/04_TEST_MATRIX.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/05_API_SECURITY_MATRIX.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/06_BUSINESS_LOGIC_DECISIONS.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/07_ENV_INFRA_CHECKLIST.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/08_MARKETING_CONTENT_CHECKLIST.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/09_CODEX_NEXT_LOT_PROMPTS.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/10_LOT0_ACCEPTANCE.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/11_LOT1_SECURITY_CLOSURE.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/12_LOT1BIS_SECURITY_VERIFICATION.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/13_LOT1TER_P1_SECURITY_CLOSURE.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/14_LOT1QUATER_PUBLIC_ROLE_SECURITY_CLOSURE.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/15_LOT1QUINQUIES_FINAL_P1_SECURITY_CLOSURE.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/16_LOT2_PUBLIC_PRODUCT_RGPD_PAYMENT_DECISIONS.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/17_LOT3_RUNTIME_RGPD_ASSESSMENT_TOKEN.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/18_LOT4_RUNTIME_PAYMENT_RETENTION_TOKEN_BINDING.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/19_LOT5_RUNTIME_EXPLOITATION_GO_NO_GO.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/20_LOT6_STAGING_RELEASE_CANDIDATE_GO_NO_GO.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/21_LOT7_RELEASE_CANDIDATE_SECURITY_AUDIT.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `docs/go-live/_evidence/entitlement-pricing-delta.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/hardcoded-pricing-triage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot0-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1-api-route-triage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1-idor-tests.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1-rate-limit-runtime.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1bis-audit-script-review.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1bis-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1bis-p0-reclassification-audit.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1bis-p1-closure.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1bis-rate-limit-production-gate.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-assistante.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-coach.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-p1-before-after.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-parent-student.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-public-routes.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-rate-limit-runtime-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-sensitive-fields-coverage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quater-stages.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quinquies-admin-routes.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quinquies-clictopay-webhook.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quinquies-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quinquies-p1-before-after.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quinquies-public-sensitive-routes.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quinquies-rate-limit-runtime-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1quinquies-sensitive-fields-coverage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1ter-bilans-assessments.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1ter-coach-reports.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1ter-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1ter-npc-documents.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1ter-p1-before-after.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1ter-payments-invoices.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot1ter-sensitive-fields-coverage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-assessments-submit-decision.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-bilan-gratuit-product-rgpd.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-clictopay-payment-decision.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-lamis-teacher-report-decision.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-public-product-rgpd-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-rate-limit-runtime-decision.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-sensitive-fields-success-error-coverage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-stages-inscrire-product-rgpd.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot2-student-activate-token-lifecycle.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-assessments-public-token.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-bilan-gratuit-rgpd-register.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-business-configs-db-drift.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-clictopay-disabled-contract.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-contact-lead-retention-policy.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-no-leak-success-error-runtime-coverage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-redis-upstash-runtime-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot3-runtime-rgpd-assessment-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot4-assessment-token-binding.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot4-business-config-production-gate.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot4-clictopay-disabled-runbook.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot4-contact-lead-retention-job.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot4-no-leak-e2e-runtime-coverage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot4-redis-upstash-runtime-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot4-token-runtime-payment-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-business-config-runtime-decision.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-clictopay-final-disabled-decision.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-contact-lead-retention-dry-run.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-p1-go-no-go-register.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-public-e2e-critical-paths.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-rate-limit-429-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-redis-upstash-authenticated-healthcheck.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot5-runtime-exploitation-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot6-contact-lead-retention-db-dry-run.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot6-final-go-no-go-register.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot6-rate-limit-429-runtime-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot6-redis-upstash-authenticated-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot6-release-candidate-worktree-audit.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot6-staging-release-candidate-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot7-final-decision-register.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot7-release-candidate-audit-command-log.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot7-release-candidate-commit-plan.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot7-release-candidate-file-manifest.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot7-runtime-human-assisted-proof.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/lot7-security-scripts-audit.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/_evidence/playwright-public-smoke-triage.md` | `??` | Docs evidence | Oui | Preuve go-live utilisée par la RC | Volume documentaire élevé |
| `docs/go-live/api-security-matrix.full.md` | `??` | Docs go-live | Oui | Documentation go-live structurante | Revue humaine standard |
| `e2e/pages-public-bilan-assessment-token.spec.ts` | `??` | Tests E2E | Oui | Smoke public et assessment | Revue humaine standard |
| `lib/assessments/public-token.ts` | `??` | Public funnel | Oui | Flux lead_only et token assessment | Flux conversion/RGPD critique |
| `rapport_audit_2_07_2026.md` | `??` | À exclure | Non | Rapport racine non suivi explicitement exclu | Exclure de la RC ou valider humainement |
| `scripts/go-live/generate-api-security-matrix.mjs` | `??` | Scripts audit | Oui | Script audité et couvert par regression | Risque de classification, mitigé par tests |
| `scripts/maintenance/contact-leads-retention.ts` | `??` | Scripts maintenance | Oui | Retention ContactLead dry-run | Revue humaine standard |

## Synthèse
- À exclure : 2
- API security : 64
- ClicToPay disabled : 3
- Docs evidence : 80
- Docs go-live : 24
- Public funnel : 10
- Rate limit runtime : 4
- Scripts audit : 6
- Scripts maintenance : 1
- Tests E2E : 4
- Tests unitaires : 78

## Exclusions explicites

- `.env*` : jamais inclus.
- `rapport_audit_2_07_2026.md` : non suivi, exclu sauf décision humaine explicite.
- `test-results/`, `playwright-report/`, `.next/`, `node_modules/` : jamais inclus.
- `docs/audits/audit-nexus-reussite.md` : exclu par défaut, à valider humainement si nécessaire.

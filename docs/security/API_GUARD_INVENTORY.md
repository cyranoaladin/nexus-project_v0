# Inventaire initial des guards API

Généré le : 2026-07-09T08:52:07.479Z

Lecture statique uniquement. La colonne `Ownership explicit` signale des indices de filtrage propriétaire dans le fichier; elle ne remplace pas un audit manuel IDOR.

## Synthèse

- P0 : 0
- P1 : 2
- P2 : 143
- PUBLIC : 4
- OK : 27
- Total routes : 176

## 20 routes à auditer en priorité

| Route | Methods | Risk | Notes |
|---|---|---|---|
| `app/api/payments/clictopay/init/route.ts` | POST | P1 | finance; guard manuel |
| `app/api/payments/clictopay/webhook/route.ts` | POST | P1 | finance |
| `app/api/admin/activities/route.ts` | GET | P2 | staff/admin |
| `app/api/admin/analytics/route.ts` | GET | P2 | staff/admin |
| `app/api/admin/config/history/route.ts` | GET | P2 | staff/admin |
| `app/api/admin/config/rollback/route.ts` | POST | P2 | staff/admin |
| `app/api/admin/config/route.ts` | GET, PATCH | P2 | staff/admin |
| `app/api/admin/dashboard/route.ts` | GET | P2 | staff/admin |
| `app/api/admin/directeur/stats/route.ts` | GET | P2 | staff/admin |
| `app/api/admin/documents/route.ts` | POST | P2 | staff/admin; documents/PII |
| `app/api/admin/invoices/[id]/route.ts` | PATCH | P2 | staff/admin; finance; guard manuel |
| `app/api/admin/invoices/[id]/send/route.ts` | POST | P2 | staff/admin; finance; guard manuel |
| `app/api/admin/invoices/route.ts` | POST, GET | P2 | staff/admin; finance; guard manuel |
| `app/api/admin/recompute-ssn/route.ts` | POST | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/coaches/route.ts` | GET, POST, DELETE | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/route.ts` | GET, PATCH, DELETE | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts` | PATCH, DELETE | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/sessions/route.ts` | GET, POST | P2 | staff/admin |
| `app/api/admin/stages/route.ts` | GET, POST | P2 | staff/admin |
| `app/api/admin/subscriptions/route.ts` | GET, PUT | P2 | staff/admin |

## Inventaire complet

| Route | Methods | Dynamic param | Auth guard | Role guard | Feature guard | Zod | Ownership explicit | Risk | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `app/api/admin/activities/route.ts` | GET | no | yes | yes | no | no | no | P2 | staff/admin |
| `app/api/admin/analytics/route.ts` | GET | no | yes | yes | no | no | no | P2 | staff/admin |
| `app/api/admin/config/history/route.ts` | GET | no | yes | yes | no | no | no | P2 | staff/admin |
| `app/api/admin/config/rollback/route.ts` | POST | no | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/config/route.ts` | GET, PATCH | no | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/dashboard/route.ts` | GET | no | yes | yes | no | no | no | P2 | staff/admin |
| `app/api/admin/directeur/stats/route.ts` | GET | no | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/documents/route.ts` | POST | no | yes | yes | no | yes | yes | P2 | staff/admin; documents/PII |
| `app/api/admin/invoices/[id]/route.ts` | PATCH | yes | yes | yes | no | yes | no | P2 | staff/admin; finance; guard manuel |
| `app/api/admin/invoices/[id]/send/route.ts` | POST | yes | yes | yes | no | yes | no | P2 | staff/admin; finance; guard manuel |
| `app/api/admin/invoices/route.ts` | POST, GET | no | yes | yes | no | yes | no | P2 | staff/admin; finance; guard manuel |
| `app/api/admin/recompute-ssn/route.ts` | POST | no | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/coaches/route.ts` | GET, POST, DELETE | yes | yes | yes | no | yes | yes | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/route.ts` | GET, PATCH, DELETE | yes | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts` | PATCH, DELETE | yes | yes | yes | no | yes | yes | P2 | staff/admin |
| `app/api/admin/stages/[stageId]/sessions/route.ts` | GET, POST | yes | yes | yes | no | yes | yes | P2 | staff/admin |
| `app/api/admin/stages/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/subscriptions/route.ts` | GET, PUT | no | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/test-email/route.ts` | POST, GET | no | yes | yes | no | yes | no | P2 | staff/admin; guard manuel |
| `app/api/admin/users/route.ts` | GET, POST, PATCH, DELETE | no | yes | yes | no | yes | no | P2 | staff/admin |
| `app/api/admin/users/search/route.ts` | GET | no | yes | yes | no | no | no | P2 | staff/admin |
| `app/api/analytics/event/route.ts` | POST | no | no | no | no | no | no | OK | - |
| `app/api/aria/chat/route.ts` | POST | no | yes | yes | yes | yes | yes | P2 | ARIA |
| `app/api/aria/conversations/route.ts` | GET | no | yes | yes | no | no | yes | P2 | ARIA; guard manuel |
| `app/api/aria/feedback/route.ts` | POST | no | yes | yes | no | yes | yes | P2 | ARIA; guard manuel |
| `app/api/assessments/[id]/export/route.ts` | GET | yes | yes | no | no | no | yes | P2 | pédagogique sensible; guard manuel |
| `app/api/assessments/[id]/result/route.ts` | GET | yes | yes | no | no | no | yes | P2 | pédagogique sensible; guard manuel |
| `app/api/assessments/[id]/status/route.ts` | GET | yes | yes | no | no | yes | yes | P2 | pédagogique sensible; guard manuel |
| `app/api/assessments/predict/route.ts` | POST | no | yes | yes | no | yes | yes | P2 | pédagogique sensible; guard manuel |
| `app/api/assessments/submit/route.ts` | POST | no | no | no | no | yes | no | PUBLIC | pédagogique sensible; Soumission QCM publique via token signé x-assessment-public-token |
| `app/api/assessments/test/route.ts` | GET | no | yes | yes | no | no | no | P2 | pédagogique sensible; guard manuel |
| `app/api/assistante/activate-student/route.ts` | POST | no | yes | yes | no | yes | no | P2 | assistante; guard manuel |
| `app/api/assistante/assignments/[id]/route.ts` | GET, PATCH | yes | yes | yes | no | yes | no | P2 | assistante |
| `app/api/assistante/assignments/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | assistante |
| `app/api/assistante/coaches/manage/[id]/route.ts` | PUT, DELETE | yes | yes | yes | no | yes | no | P2 | assistante; guard manuel |
| `app/api/assistante/coaches/manage/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | assistante; guard manuel |
| `app/api/assistante/coaches/route.ts` | GET | no | yes | yes | no | no | no | P2 | assistante |
| `app/api/assistante/credit-requests/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | assistante; guard manuel |
| `app/api/assistante/dashboard/route.ts` | GET | no | yes | yes | no | no | no | P2 | assistante; guard manuel |
| `app/api/assistante/planning/route.ts` | GET | no | yes | yes | no | no | no | P2 | assistante |
| `app/api/assistante/quotes/pdf/route.ts` | POST | no | yes | yes | no | yes | no | P2 | assistante |
| `app/api/assistante/sessions/route.ts` | POST | no | yes | yes | no | yes | no | P2 | assistante |
| `app/api/assistante/stages/route.ts` | GET | no | yes | yes | no | no | no | P2 | assistante |
| `app/api/assistante/students/[studentId]/documents/route.ts` | GET, POST | yes | yes | yes | no | yes | no | P2 | assistante; documents/PII |
| `app/api/assistante/students/[studentId]/route.ts` | GET | yes | yes | yes | no | no | no | P2 | assistante |
| `app/api/assistante/students/credits/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | assistante; guard manuel |
| `app/api/assistante/students/route.ts` | GET, POST | no | yes | yes | no | yes | yes | P2 | assistante |
| `app/api/assistante/subscription-requests/route.ts` | GET, PATCH | no | yes | yes | no | yes | no | P2 | assistante; guard manuel |
| `app/api/assistante/subscriptions/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | assistante; guard manuel |
| `app/api/auth/[...nextauth]/route.ts` | - | yes | no | no | no | no | no | OK | - |
| `app/api/auth/resend-activation/route.ts` | POST | no | no | no | no | yes | no | OK | - |
| `app/api/auth/reset-password/route.ts` | POST | no | no | no | no | yes | yes | OK | - |
| `app/api/bilan-gratuit/dismiss/route.ts` | POST | no | yes | yes | no | yes | no | P2 | pédagogique sensible |
| `app/api/bilan-gratuit/route.ts` | POST | no | no | yes | no | yes | no | PUBLIC | pédagogique sensible; Formulaire public de bilan stratégique gratuit — Zod + rate-limit + honeypot |
| `app/api/bilan-gratuit/status/route.ts` | GET | no | yes | no | no | no | yes | P2 | pédagogique sensible; guard manuel |
| `app/api/bilan-pallier2-maths/retry/route.ts` | POST | no | yes | yes | no | yes | no | P2 | pédagogique sensible |
| `app/api/bilan-pallier2-maths/route.ts` | POST, GET | no | yes | yes | no | yes | no | P2 | pédagogique sensible |
| `app/api/bilans/[id]/export/route.ts` | GET, POST | yes | yes | yes | no | yes | yes | P2 | pédagogique sensible |
| `app/api/bilans/[id]/route.ts` | GET, PUT, DELETE | yes | yes | yes | no | yes | yes | P2 | pédagogique sensible |
| `app/api/bilans/generate/route.ts` | POST, GET | no | yes | yes | no | yes | yes | P2 | pédagogique sensible |
| `app/api/bilans/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | pédagogique sensible |
| `app/api/coach/dashboard/route.ts` | GET | no | yes | yes | no | no | no | P2 | coach; guard manuel |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts` | GET, POST, PATCH | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/eaf-stage-printemps/students/route.ts` | GET | no | yes | yes | no | no | no | P2 | coach |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | coach |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | coach |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts` | GET, POST, PATCH | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/maths-premiere-stage-printemps/students/route.ts` | GET | no | yes | yes | no | no | no | P2 | coach |
| `app/api/coach/nsi-pratique-2026/students/[studentId]/progress/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | coach |
| `app/api/coach/nsi-pratique-2026/students/route.ts` | GET | no | yes | yes | no | no | no | P2 | coach |
| `app/api/coach/sessions/[sessionId]/report/route.ts` | POST, GET | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible; guard manuel |
| `app/api/coach/stages/route.ts` | GET | no | yes | yes | no | no | no | P2 | coach |
| `app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts` | GET, PATCH | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/students/[studentId]/documents/route.ts` | GET, POST | yes | yes | yes | no | yes | yes | P2 | coach; documents/PII |
| `app/api/coach/students/[studentId]/dossier/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | coach; guard manuel |
| `app/api/coach/students/[studentId]/eaf-preparation-report/route.ts` | GET, PUT | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/generate/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/students/[studentId]/generated-reports/route.ts` | GET, POST | yes | yes | yes | no | yes | yes | P2 | coach; pédagogique sensible |
| `app/api/coach/students/[studentId]/notes/route.ts` | GET, POST | yes | yes | yes | no | yes | yes | P2 | coach; guard manuel |
| `app/api/coach/students/[studentId]/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | coach |
| `app/api/coach/students/[studentId]/survival-mode/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | coach; guard manuel |
| `app/api/coach/students/eam-summary/route.ts` | GET | no | yes | yes | no | no | yes | P2 | coach; guard manuel |
| `app/api/coach/students/route.ts` | GET | no | yes | yes | no | no | no | P2 | coach |
| `app/api/coach/trajectory/route.ts` | POST | no | yes | yes | no | yes | no | P2 | coach; guard manuel |
| `app/api/coaches/availability/route.ts` | POST, GET, DELETE | no | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/coaches/available/route.ts` | GET | no | yes | yes | no | no | no | P2 | guard manuel |
| `app/api/contact/route.ts` | POST | no | no | no | no | no | no | OK | - |
| `app/api/diagnostics/definitions/route.ts` | GET | no | no | no | no | no | no | OK | - |
| `app/api/documents/[id]/download/route.ts` | GET | yes | yes | yes | no | yes | yes | P2 | documents/PII; guard manuel |
| `app/api/documents/[id]/route.ts` | GET | yes | yes | yes | no | yes | yes | P2 | documents/PII; guard manuel |
| `app/api/eam/progress/route.ts` | GET, POST | no | yes | no | no | yes | no | OK | guard manuel |
| `app/api/eleve/bilan-diagnostic-maths-terminale/route.ts` | GET, POST | no | yes | yes | no | yes | yes | P2 | pédagogique sensible |
| `app/api/eleve/nsi-pratique-2026/progress/route.ts` | GET, PUT | no | yes | yes | no | no | yes | OK | - |
| `app/api/eleve/questionnaire-eaf-stage-printemps/route.ts` | GET, POST | no | yes | yes | no | yes | yes | P2 | - |
| `app/api/eleve/questionnaire-maths-premiere-stage-printemps/route.ts` | GET, POST | no | yes | yes | no | yes | yes | P2 | - |
| `app/api/eleve/stages/route.ts` | GET | no | yes | yes | no | no | yes | P2 | - |
| `app/api/health/route.ts` | GET | no | no | no | no | no | no | OK | - |
| `app/api/internal/health/route.ts` | GET | no | yes | yes | no | no | no | OK | - |
| `app/api/invoices/[id]/pdf/route.ts` | GET | yes | yes | no | no | no | yes | P2 | finance; guard manuel |
| `app/api/invoices/[id]/receipt/pdf/route.ts` | GET | yes | yes | no | no | yes | yes | P2 | finance; guard manuel |
| `app/api/lamis/attempt/route.ts` | POST | no | no | no | no | no | no | OK | - |
| `app/api/lamis/exercises/route.ts` | - | no | no | no | no | no | no | OK | - |
| `app/api/lamis/export/route.ts` | POST | no | no | no | no | no | no | OK | - |
| `app/api/lamis/progress/route.ts` | POST | no | no | no | no | no | no | OK | - |
| `app/api/me/next-step/route.ts` | GET | no | yes | no | no | no | no | OK | guard manuel |
| `app/api/messages/conversations/route.ts` | GET | no | yes | no | no | no | no | OK | guard manuel |
| `app/api/messages/send/route.ts` | POST | no | yes | yes | no | yes | no | OK | guard manuel |
| `app/api/newsletter/route.ts` | POST | no | no | no | no | no | no | OK | - |
| `app/api/notifications/route.ts` | GET, PATCH | no | yes | no | no | no | yes | OK | guard manuel |
| `app/api/notify/email/route.ts` | POST | no | no | no | no | yes | no | OK | - |
| `app/api/npc/files/[...path]/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | guard manuel |
| `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts` | PATCH, DELETE | yes | yes | yes | no | yes | yes | P2 | documents/PII; pédagogique sensible; guard manuel |
| `app/api/npc/submissions/[submissionId]/documents/route.ts` | GET, POST | yes | yes | yes | no | yes | yes | P2 | documents/PII; pédagogique sensible; guard manuel |
| `app/api/npc/submissions/[submissionId]/generate/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | pédagogique sensible; guard manuel |
| `app/api/npc/submissions/route.ts` | POST, GET | no | yes | yes | no | yes | yes | P2 | pédagogique sensible; guard manuel |
| `app/api/npc/uploads/route.ts` | POST | no | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/parent/bilans/[id]/pdf/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | pédagogique sensible |
| `app/api/parent/children/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/parent/credit-request/route.ts` | POST | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/parent/dashboard/route.ts` | GET | no | yes | yes | no | no | yes | P2 | guard manuel |
| `app/api/parent/stages/route.ts` | GET | no | yes | yes | no | no | yes | P2 | - |
| `app/api/parent/subscription-requests/route.ts` | POST, GET | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/parent/subscriptions/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/payments/bank-transfer/confirm/route.ts` | POST | no | yes | yes | no | yes | yes | P2 | finance; guard manuel |
| `app/api/payments/check-pending/route.ts` | GET | no | yes | yes | no | no | yes | P2 | finance; guard manuel |
| `app/api/payments/clictopay/init/route.ts` | POST | no | yes | no | no | no | no | P1 | finance; guard manuel |
| `app/api/payments/clictopay/webhook/route.ts` | POST | no | no | no | no | no | no | P1 | finance |
| `app/api/payments/pending/route.ts` | GET | no | yes | yes | no | no | no | P2 | finance; guard manuel |
| `app/api/payments/validate/route.ts` | POST | no | yes | yes | no | yes | no | P2 | finance; guard manuel |
| `app/api/programme/maths-1ere/progress/route.ts` | POST, GET | no | yes | no | no | no | no | OK | guard manuel |
| `app/api/programme/maths-1ere/rag/route.ts` | POST | no | yes | no | no | yes | no | OK | guard manuel |
| `app/api/programme/maths-1ere-stmg/progress/route.ts` | POST, GET | no | yes | no | no | no | no | OK | guard manuel |
| `app/api/programme/maths-1ere-stmg/rag/route.ts` | POST | no | yes | no | no | yes | no | OK | guard manuel |
| `app/api/programme/maths-1ere-stmg/stage-progress/route.ts` | GET, POST | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/programme/maths-terminale/progress/route.ts` | POST, GET | no | yes | no | no | no | no | OK | guard manuel |
| `app/api/public-documents/corrige-dnb-maths-2026/route.ts` | GET | no | no | no | no | no | no | P2 | - |
| `app/api/reservation/route.ts` | POST, GET, PATCH | no | yes | no | no | yes | no | OK | guard manuel |
| `app/api/reservation/verify/route.ts` | POST | no | no | no | no | no | no | OK | - |
| `app/api/sessions/book/route.ts` | POST | no | yes | yes | yes | yes | no | P2 | - |
| `app/api/sessions/cancel/route.ts` | POST | no | yes | yes | no | yes | no | P2 | - |
| `app/api/sessions/video/route.ts` | POST | no | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/stages/[stageSlug]/bilans/route.ts` | GET, POST | yes | yes | yes | no | yes | yes | P2 | pédagogique sensible |
| `app/api/stages/[stageSlug]/inscrire/route.ts` | POST | yes | no | no | no | yes | no | PUBLIC | Formulaire public d'inscription aux stages — Zod + rate-limit |
| `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | - |
| `app/api/stages/[stageSlug]/reservations/route.ts` | GET | yes | yes | yes | no | no | no | P2 | - |
| `app/api/stages/[stageSlug]/route.ts` | GET | yes | no | no | no | yes | no | P2 | - |
| `app/api/stages/route.ts` | GET | no | no | no | no | yes | no | P2 | - |
| `app/api/student/activate/route.ts` | GET, POST | no | no | no | no | yes | no | PUBLIC | Lien d'activation élève via token unique hashé — Zod + rate-limit auth |
| `app/api/student/automatismes/attempts/[id]/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | guard manuel |
| `app/api/student/automatismes/attempts/route.ts` | POST, GET | no | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/student/automatismes/check-answer/route.ts` | POST | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/student/automatismes/series/[id]/route.ts` | GET | yes | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/student/automatismes/series/route.ts` | GET | no | yes | yes | no | no | no | P2 | guard manuel |
| `app/api/student/bilans/[publicShareId]/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | pédagogique sensible |
| `app/api/student/credits/route.ts` | GET | no | yes | yes | no | no | no | P2 | - |
| `app/api/student/dashboard/route.ts` | GET | no | yes | yes | no | no | no | P2 | - |
| `app/api/student/documents/[id]/download/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | documents/PII |
| `app/api/student/documents/route.ts` | GET | no | yes | yes | no | no | yes | P2 | documents/PII; guard manuel |
| `app/api/student/nexus-index/route.ts` | GET | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/student/resources/official/[slug]/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | - |
| `app/api/student/resources/route.ts` | GET | no | yes | yes | no | no | no | P2 | guard manuel |
| `app/api/student/sessions/route.ts` | GET | no | yes | yes | no | no | no | P2 | - |
| `app/api/student/stages/route.ts` | GET | no | yes | yes | no | no | yes | P2 | - |
| `app/api/student/survival/phrases/[phraseId]/copied/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/student/survival/progress/route.ts` | GET, POST | no | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/student/survival/qcm/attempt/route.ts` | POST | no | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/student/survival/reflexes/[reflexId]/attempt/route.ts` | POST | yes | yes | yes | no | yes | yes | P2 | guard manuel |
| `app/api/student/survival/ritual/route.ts` | GET | no | yes | yes | no | no | yes | P2 | guard manuel |
| `app/api/student/trajectory/route.ts` | GET | no | yes | yes | no | yes | no | P2 | guard manuel |
| `app/api/students/[studentId]/badges/route.ts` | GET | yes | yes | yes | no | no | yes | P2 | guard manuel |
| `app/api/subscriptions/aria-addon/route.ts` | POST | no | no | no | no | no | no | P2 | ARIA |
| `app/api/subscriptions/change/route.ts` | POST | no | no | no | no | no | no | P2 | - |

## Prochaines étapes

- Revoir manuellement toutes les routes P0 dynamiques ou manipulant données personnelles, documents, factures, bilans, conversations et sessions.
- Ajouter des tests IDOR pour chaque route `[id]` qui retourne ou modifie une ressource propriétaire.
- Remplacer les guards manuels hétérogènes par des helpers RBAC/ownership explicites.

# Route Diff Report

Generated: 2026-02-22T12:12:56.687Z

## Counts

- Pages detectees: 73
- API routes detectees: 80
- Routes documentees (NAVIGATION_MAP): 67
- Routes non documentees dans le code: 90
- Routes documentees absentes du code: 1
- Routes pages non referencees dans les specs E2E (heuristique): 44

## Routes Documentees Absentes Du Code

- `/programme/*`

## Routes Du Code Non Documentees

- `/admin/directeur`
- `/admin/stages/fevrier-2026`
- `/api/admin/activities`
- `/api/admin/analytics`
- `/api/admin/dashboard`
- `/api/admin/directeur/stats`
- `/api/admin/documents`
- `/api/admin/invoices`
- `/api/admin/invoices/[id]`
- `/api/admin/invoices/[id]/send`
- `/api/admin/recompute-ssn`
- `/api/admin/subscriptions`
- `/api/admin/test-email`
- `/api/admin/users`
- `/api/admin/users/search`
- `/api/analytics/event`
- `/api/aria/conversations`
- `/api/aria/feedback`
- `/api/assessments/[id]/export`
- `/api/assessments/[id]/result`
- `/api/assessments/[id]/status`
- `/api/assessments/predict`
- `/api/assessments/submit`
- `/api/assessments/test`
- `/api/assistant/activate-student`
- `/api/assistant/coaches`
- `/api/assistant/coaches/[id]`
- `/api/assistant/credit-requests`
- `/api/assistant/dashboard`
- `/api/assistant/students/credits`
- `/api/assistant/subscription-requests`
- `/api/assistant/subscriptions`
- `/api/auth/[...nextauth]`
- `/api/bilan-pallier2-maths`
- `/api/bilan-pallier2-maths/retry`
- `/api/coach/dashboard`
- `/api/coach/sessions/[sessionId]/report`
- `/api/coaches/availability`
- `/api/coaches/available`
- `/api/diagnostics/definitions`
- `/api/documents/[id]`
- `/api/health`
- `/api/invoices/[id]/pdf`
- `/api/invoices/[id]/receipt/pdf`
- `/api/me/next-step`
- `/api/messages/conversations`
- `/api/messages/send`
- `/api/notifications`
- `/api/notify/email`
- `/api/parent/children`
- `/api/parent/credit-request`
- `/api/parent/dashboard`
- `/api/parent/subscription-requests`
- `/api/parent/subscriptions`
- `/api/payments/bank-transfer/confirm`
- `/api/payments/check-pending`
- `/api/payments/clictopay/init`
- `/api/payments/clictopay/webhook`
- `/api/payments/pending`
- `/api/payments/validate`
- `/api/programme/maths-1ere/progress`
- `/api/reservation/verify`
- `/api/sessions/book`
- `/api/sessions/cancel`
- `/api/sessions/video`
- `/api/student/activate`
- `/api/student/credits`
- `/api/student/dashboard`
- `/api/student/documents`
- `/api/student/nexus-index`
- `/api/student/resources`
- `/api/student/sessions`
- `/api/student/trajectory`
- `/api/students/[studentId]/badges`
- `/api/subscriptions/aria-addon`
- `/api/subscriptions/change`
- `/assessments/[id]/processing`
- `/assessments/[id]/result`
- `/bilan-gratuit/assessment`
- `/bilan-pallier2-maths`
- `/bilan-pallier2-maths/confirmation`
- `/bilan-pallier2-maths/dashboard`
- `/bilan-pallier2-maths/resultat/[id]`
- `/dashboard/parent/paiement/confirmation`
- `/maths-1ere`
- `/session/video`
- `/stages/dashboard-excellence`
- `/stages/fevrier-2026/bilan/[reservationId]`
- `/studio`
- `/test`

## Routes Pages Potentiellement Manquantes Dans Les Tests E2E

- `/access-required` (public) — `app/access-required/page.tsx`
- `/admin/directeur` (public) — `app/admin/directeur/page.tsx`
- `/admin/stages/fevrier-2026` (public) — `app/admin/stages/fevrier-2026/page.tsx`
- `/assessments/[id]/processing` (public) — `app/assessments/[id]/processing/page.tsx`
- `/assessments/[id]/result` (public) — `app/assessments/[id]/result/page.tsx`
- `/auth/activate` (auth) — `app/auth/activate/page.tsx`
- `/bilan-gratuit/assessment` (public) — `app/bilan-gratuit/assessment/page.tsx`
- `/bilan-gratuit/confirmation` (public) — `app/bilan-gratuit/confirmation/page.tsx`
- `/bilan-pallier2-maths/confirmation` (public) — `app/bilan-pallier2-maths/confirmation/page.tsx`
- `/bilan-pallier2-maths/resultat/[id]` (public) — `app/bilan-pallier2-maths/resultat/[id]/page.tsx`
- `/dashboard/admin/activities` (dashboard) — `app/dashboard/admin/activities/page.tsx`
- `/dashboard/admin/analytics` (dashboard) — `app/dashboard/admin/analytics/page.tsx`
- `/dashboard/admin/documents` (dashboard) — `app/(dashboard)/dashboard/admin/documents/page.tsx`
- `/dashboard/admin/facturation` (dashboard) — `app/dashboard/admin/facturation/page.tsx`
- `/dashboard/admin/subscriptions` (dashboard) — `app/dashboard/admin/subscriptions/page.tsx`
- `/dashboard/admin/tests` (dashboard) — `app/dashboard/admin/tests/page.tsx`
- `/dashboard/admin/users` (dashboard) — `app/dashboard/admin/users/page.tsx`
- `/dashboard/assistante` (dashboard) — `app/dashboard/assistante/page.tsx`
- `/dashboard/assistante/coaches` (dashboard) — `app/dashboard/assistante/coaches/page.tsx`
- `/dashboard/assistante/credit-requests` (dashboard) — `app/dashboard/assistante/credit-requests/page.tsx`
- `/dashboard/assistante/credits` (dashboard) — `app/dashboard/assistante/credits/page.tsx`
- `/dashboard/assistante/docs` (dashboard) — `app/dashboard/assistante/docs/page.tsx`
- `/dashboard/assistante/paiements` (dashboard) — `app/dashboard/assistante/paiements/page.tsx`
- `/dashboard/assistante/students` (dashboard) — `app/dashboard/assistante/students/page.tsx`
- `/dashboard/assistante/subscription-requests` (dashboard) — `app/dashboard/assistante/subscription-requests/page.tsx`
- `/dashboard/assistante/subscriptions` (dashboard) — `app/dashboard/assistante/subscriptions/page.tsx`
- `/dashboard/coach/availability` (dashboard) — `app/dashboard/coach/availability/page.tsx`
- `/dashboard/coach/sessions` (dashboard) — `app/dashboard/coach/sessions/page.tsx`
- `/dashboard/coach/students` (dashboard) — `app/dashboard/coach/students/page.tsx`
- `/dashboard/eleve/mes-sessions` (dashboard) — `app/dashboard/eleve/mes-sessions/page.tsx`
- `/dashboard/eleve/ressources` (dashboard) — `app/dashboard/eleve/ressources/page.tsx`
- `/dashboard/eleve/sessions` (dashboard) — `app/dashboard/eleve/sessions/page.tsx`
- `/dashboard/parent/abonnements` (dashboard) — `app/dashboard/parent/abonnements/page.tsx`
- `/dashboard/parent/children` (dashboard) — `app/dashboard/parent/children/page.tsx`
- `/dashboard/parent/paiement` (dashboard) — `app/dashboard/parent/paiement/page.tsx`
- `/dashboard/parent/paiement/confirmation` (dashboard) — `app/dashboard/parent/paiement/confirmation/page.tsx`
- `/dashboard/parent/ressources` (dashboard) — `app/(dashboard)/dashboard/parent/ressources/page.tsx`
- `/dashboard/trajectoire` (dashboard) — `app/dashboard/trajectoire/page.tsx`
- `/maths-1ere` (public) — `app/maths-1ere/page.tsx`
- `/session/video` (public) — `app/session/video/page.tsx`
- `/stages/dashboard-excellence` (public) — `app/stages/dashboard-excellence/page.tsx`
- `/stages/fevrier-2026/bilan/[reservationId]` (public) — `app/stages/fevrier-2026/bilan/[reservationId]/page.tsx`
- `/stages/fevrier-2026/diagnostic` (public) — `app/stages/fevrier-2026/diagnostic/page.tsx`
- `/test` (public) — `app/test/page.tsx`

## Notes

- Lignes NAVIGATION_MAP lues: 440.
- Les routes contractuelles sont explicitées dans `scripts/generate-route-inventory.mjs` (source: NAVIGATION_MAP.md).
- La detection de couverture E2E est basee sur la presence textuelle des routes dans les specs.
- Les patterns dynamiques (`[id]`) et wildcards (`*`) necessitent des tests parametrés dedies.

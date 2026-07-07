# Annexe matrice API sécurité complète

Source : `docs/security/API_GUARD_INVENTORY.md`.
Généré le : 2026-07-07T13:14:25.009Z.

Lecture statique uniquement : `Auth guard détecté`, `Role guard détecté`, `Zod détecté` et `Ownership requis` sont des indices de pilotage. `À vérifier` signifie qu’aucune preuve suffisante n’a été établie dans ce lot.

## Synthèse

| Priorité | Nombre |
| --- | ---: |
| P0 | 0 |
| P1 | 6 |
| P2 | 143 |
| OK | 27 |
| Total | 176 |

## Top 20 à corriger en priorité (P1)

| Priorité | Route | Domaine | Risque dominant | Action Lot suivant |
| --- | --- | --- | --- | --- |
| P1 | `/api/payments/clictopay/webhook` | Paiement | Facture/paiement | Durcir avant bêta élargie |
| P1 | `/api/assessments/submit` | Bilans/assessments | Données pédagogiques mineur | Durcir avant bêta élargie |
| P1 | `/api/bilan-gratuit` | Bilans/assessments | Données pédagogiques mineur | Durcir avant bêta élargie |
| P1 | `/api/bilan-gratuit/dismiss` | Bilans/assessments | Données pédagogiques mineur | Durcir avant bêta élargie |
| P1 | `/api/stages/[stageSlug]/inscrire` | Stages | Réservation/session | Durcir avant bêta élargie |
| P1 | `/api/student/activate` | Élève | PII/utilisateur | Durcir avant bêta élargie |

## Matrice route par route

| Priorité | Route | Méthodes | Domaine | Public/Auth | Rôle requis | Ownership requis | Auth guard détecté | Role guard détecté | Zod détecté | Rate limit détecté | Données sensibles | Action Lot suivant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | `/api/admin/activities` | GET | Admin | Auth | Admin/staff | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/analytics` | GET | Admin | Auth | Admin/staff | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/config/history` | GET | Admin | Auth | Admin/staff | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/config/rollback` | POST | Admin | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/config` | GET, PATCH | Admin | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/dashboard` | GET | Admin | Auth | Admin/staff | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/directeur/stats` | GET | Admin | Auth | Admin/staff | Oui | Oui | Oui | Oui | Oui | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/documents` | POST | Documents | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | Document/fichier, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/invoices/[id]` | PATCH | Facturation | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | Facture/paiement, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/invoices/[id]/send` | POST | Facturation | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | Facture/paiement, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/invoices` | POST, GET | Facturation | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | Facture/paiement, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/recompute-ssn` | POST | Admin | Auth | Admin/staff | Oui | Oui | Oui | Oui | Oui | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/stages/[stageId]/coaches` | GET, POST, DELETE | Stages | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/admin/stages/[stageId]` | GET, PATCH, DELETE | Stages | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/admin/stages/[stageId]/sessions/[sessionId]` | PATCH, DELETE | Stages | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/admin/stages/[stageId]/sessions` | GET, POST | Stages | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/admin/stages` | GET, POST | Stages | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/admin/subscriptions` | GET, PUT | Admin | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/test-email` | POST, GET | Admin | Auth | Admin/staff | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/users` | GET, POST, PATCH, DELETE | Admin | Auth | Admin/staff | Oui | Oui | Oui | Oui | Oui | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/admin/users/search` | GET | Admin | Auth | Admin/staff | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| OK | `/api/analytics/event` | POST | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| P2 | `/api/aria/chat` | POST | ARIA/RAG | Auth | Élève/abonné à vérifier | Oui | Oui | Oui | Oui | Non | Conversation IA | Suivi qualité P2 |
| P2 | `/api/aria/conversations` | GET | ARIA/RAG | Auth | Élève/abonné à vérifier | Oui | Oui | Oui | Non | Non | Conversation IA | Suivi qualité P2 |
| P2 | `/api/aria/feedback` | POST | ARIA/RAG | Auth | Élève/abonné à vérifier | Oui | Oui | Oui | Oui | Non | Conversation IA | Suivi qualité P2 |
| P2 | `/api/assessments/[id]/export` | GET | Bilans/assessments | Auth | À vérifier | Oui | Oui | Non | Non | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/assessments/[id]/result` | GET | Bilans/assessments | Auth | À vérifier | Oui | Oui | Non | Non | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/assessments/[id]/status` | GET | Bilans/assessments | Auth | À vérifier | Oui | Oui | Non | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/assessments/predict` | POST | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P1 | `/api/assessments/submit` | POST | Bilans/assessments | Public | N/A | N/A | Non | Non | Oui | Oui | Données pédagogiques mineur | Durcir avant bêta élargie |
| P2 | `/api/assessments/test` | GET | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/assistante/activate-student` | POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/assignments/[id]` | GET, PATCH | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/assignments` | GET, POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/coaches/manage/[id]` | PUT, DELETE | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/coaches/manage` | GET, POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/coaches` | GET | Assistante | Auth | Assistante | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/credit-requests` | GET, POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/dashboard` | GET | Assistante | Auth | Assistante | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/planning` | GET | Assistante | Auth | Assistante | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/quotes/pdf` | POST | Documents | Auth | Assistante | Oui | Oui | Oui | Oui | Oui | Document/fichier, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/sessions` | POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/assistante/stages` | GET | Stages | Auth | Assistante | Oui | Oui | Oui | Non | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/assistante/students/[studentId]/documents` | GET, POST | Documents | Auth | Assistante | Oui | Oui | Oui | Oui | Non | Document/fichier, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/students/[studentId]` | GET | Assistante | Auth | Assistante | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/students/credits` | GET, POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/students` | GET, POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/subscription-requests` | GET, PATCH | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/assistante/subscriptions` | GET, POST | Assistante | Auth | Assistante | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| OK | `/api/auth/[...nextauth]` | - | Auth | Public/À vérifier | N/A | Oui | Non | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/auth/resend-activation` | POST | Auth | Public/À vérifier | N/A | N/A | Non | Non | Oui | Oui | À vérifier | Maintenir tests de non-régression |
| OK | `/api/auth/reset-password` | POST | Auth | Public/À vérifier | N/A | N/A | Non | Non | Oui | Oui | À vérifier | Maintenir tests de non-régression |
| P1 | `/api/bilan-gratuit/dismiss` | POST | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | Données pédagogiques mineur | Durcir avant bêta élargie |
| P1 | `/api/bilan-gratuit` | POST | Bilans/assessments | Public | Rôle détecté, à qualifier | N/A | Non | Oui | Oui | Oui | Données pédagogiques mineur | Durcir avant bêta élargie |
| P2 | `/api/bilan-gratuit/status` | GET | Bilans/assessments | Auth | À vérifier | Oui | Oui | Non | Non | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/bilan-pallier2-maths/retry` | POST | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/bilan-pallier2-maths` | POST, GET | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Oui | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/bilans/[id]/export` | GET, POST | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/bilans/[id]` | GET, PUT, DELETE | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/bilans/generate` | POST, GET | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/bilans` | GET, POST | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/coach/dashboard` | GET | Coach | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate` | POST | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/eaf-stage-printemps/students/[studentId]/report` | GET, POST, PATCH | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/eaf-stage-printemps/students` | GET | Stages | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent` | POST | Stages | Auth | Coach | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student` | POST | Stages | Auth | Coach | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/maths-premiere-stage-printemps/students/[studentId]/report` | GET, POST, PATCH | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/maths-premiere-stage-printemps/students` | GET | Stages | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/nsi-pratique-2026/students/[studentId]/progress` | GET | Coach | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/nsi-pratique-2026/students` | GET | Coach | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/sessions/[sessionId]/report` | POST, GET | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/stages` | GET | Stages | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale` | GET, PATCH | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/documents` | GET, POST | Documents | Auth | Coach | Oui | Oui | Oui | Oui | Non | Document/fichier, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/dossier` | GET | Coach | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/eaf-preparation-report` | GET, PUT | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/eaf-preparation-report/validate` | POST | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/generated-reports/[reportId]/download` | GET | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Non | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/generated-reports/[reportId]/generate` | POST | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate` | POST | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/generated-reports` | GET, POST | Bilans/assessments | Auth | Coach | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/notes` | GET, POST | Coach | Auth | Coach | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]` | GET | Coach | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/[studentId]/survival-mode` | POST | Coach | Auth | Coach | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students/eam-summary` | GET | Coach | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/students` | GET | Coach | Auth | Coach | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coach/trajectory` | POST | Coach | Auth | Coach | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coaches/availability` | POST, GET, DELETE | Coach | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/coaches/available` | GET | Coach | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| OK | `/api/contact` | POST | Leads/messages | Public | N/A | N/A | Non | Non | Non | Oui | Lead/contact | Maintenir tests de non-régression |
| OK | `/api/diagnostics/definitions` | GET | Bilans/assessments | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | Données pédagogiques mineur | Maintenir tests de non-régression |
| P2 | `/api/documents/[id]` | GET | Documents | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Document/fichier | Suivi qualité P2 |
| OK | `/api/eam/progress` | GET, POST | Autre | Auth | À vérifier | À vérifier | Oui | Non | Oui | Non | À vérifier | Maintenir tests de non-régression |
| P2 | `/api/eleve/bilan-diagnostic-maths-terminale` | GET, POST | Bilans/assessments | Auth | Élève | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| OK | `/api/eleve/nsi-pratique-2026/progress` | GET, PUT | Élève | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur | Maintenir tests de non-régression |
| P2 | `/api/eleve/questionnaire-eaf-stage-printemps` | GET, POST | Stages | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/eleve/questionnaire-maths-premiere-stage-printemps` | GET, POST | Stages | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/eleve/stages` | GET | Stages | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| OK | `/api/health` | GET | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/internal/health` | GET | Autre | Auth | Rôle détecté, à qualifier | À vérifier | Oui | Oui | Non | Non | À vérifier | Maintenir tests de non-régression |
| P2 | `/api/invoices/[id]/pdf` | GET | Facturation | Auth | À vérifier | Oui | Oui | Non | Non | Non | Facture/paiement, Document/fichier | Suivi qualité P2 |
| P2 | `/api/invoices/[id]/receipt/pdf` | GET | Facturation | Auth | À vérifier | Oui | Oui | Non | Oui | Non | Facture/paiement, Document/fichier | Suivi qualité P2 |
| OK | `/api/lamis/attempt` | POST | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/lamis/exercises` | - | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/lamis/export` | POST | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/lamis/progress` | POST | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| P2 | `/api/lamis/teacher-report` | POST, GET | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Oui | Données pédagogiques mineur | Suivi qualité P2 |
| OK | `/api/me/next-step` | GET | Autre | Auth | À vérifier | À vérifier | Oui | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/messages/conversations` | GET | Autre | Auth | À vérifier | Oui | Oui | Non | Non | Non | Conversation IA | Maintenir tests de non-régression |
| OK | `/api/messages/send` | POST | Autre | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Conversation IA | Maintenir tests de non-régression |
| OK | `/api/newsletter` | POST | Leads/messages | Public | N/A | N/A | Non | Non | Non | Oui | Lead/contact | Maintenir tests de non-régression |
| OK | `/api/notifications` | GET, PATCH | Autre | Auth | À vérifier | À vérifier | Oui | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/notify/email` | POST | Leads/messages | Public | N/A | N/A | Non | Non | Oui | Oui | Lead/contact | Maintenir tests de non-régression |
| P2 | `/api/npc/files/[...path]` | GET | Documents | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | Document/fichier | Suivi qualité P2 |
| P2 | `/api/npc/submissions/[submissionId]/documents/[documentId]` | PATCH, DELETE | Documents | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Document/fichier, Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/npc/submissions/[submissionId]/documents` | GET, POST | Documents | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Document/fichier, Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/npc/submissions/[submissionId]/generate` | POST | NPC | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/npc/submissions` | POST, GET | NPC | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur | Suivi qualité P2 |
| P2 | `/api/npc/uploads` | POST | NPC | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Document/fichier | Suivi qualité P2 |
| P2 | `/api/parent/bilans/[id]/pdf` | GET | Documents | Auth | Parent | Oui | Oui | Oui | Non | Non | Document/fichier, Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/parent/children` | GET, POST | Parent | Auth | Parent | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/parent/credit-request` | POST | Parent | Auth | Parent | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/parent/dashboard` | GET | Parent | Auth | Parent | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/parent/stages` | GET | Stages | Auth | Parent | Oui | Oui | Oui | Non | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/parent/subscription-requests` | POST, GET | Parent | Auth | Parent | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/parent/subscriptions` | GET, POST | Parent | Auth | Parent | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/payments/bank-transfer/confirm` | POST | Paiement | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Facture/paiement | Suivi qualité P2 |
| P2 | `/api/payments/check-pending` | GET | Paiement | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | Facture/paiement | Suivi qualité P2 |
| P2 | `/api/payments/clictopay/init` | POST | Paiement | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Facture/paiement | Suivi qualité P2 |
| P1 | `/api/payments/clictopay/webhook` | POST | Paiement | Public webhook | N/A | N/A | Non | Non | Non | Non | Facture/paiement | Durcir avant bêta élargie |
| P2 | `/api/payments/pending` | GET | Paiement | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | Facture/paiement | Suivi qualité P2 |
| P2 | `/api/payments/validate` | POST | Paiement | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Facture/paiement | Suivi qualité P2 |
| OK | `/api/programme/maths-1ere/progress` | POST, GET | Autre | Auth | À vérifier | À vérifier | Oui | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/programme/maths-1ere/rag` | POST | ARIA/RAG | Auth | À vérifier | À vérifier | Oui | Non | Oui | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/programme/maths-1ere-stmg/progress` | POST, GET | Autre | Auth | À vérifier | À vérifier | Oui | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| OK | `/api/programme/maths-1ere-stmg/rag` | POST | ARIA/RAG | Auth | À vérifier | À vérifier | Oui | Non | Oui | Non | À vérifier | Maintenir tests de non-régression |
| P2 | `/api/programme/maths-1ere-stmg/stage-progress` | GET, POST | Stages | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Réservation/session | Suivi qualité P2 |
| OK | `/api/programme/maths-terminale/progress` | POST, GET | Autre | Auth | À vérifier | À vérifier | Oui | Non | Non | Non | À vérifier | Maintenir tests de non-régression |
| P2 | `/api/public-documents/corrige-dnb-maths-2026` | GET | Documents | Public | N/A | N/A | Non | Non | Non | Non | Document/fichier | Suivi qualité P2 |
| OK | `/api/reservation` | POST, GET, PATCH | Autre | Auth | À vérifier | Oui | Oui | Non | Oui | Oui | Réservation/session | Maintenir tests de non-régression |
| OK | `/api/reservation/verify` | POST | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | Réservation/session | Maintenir tests de non-régression |
| P2 | `/api/sessions/book` | POST | Autre | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Oui | Réservation/session | Suivi qualité P2 |
| P2 | `/api/sessions/cancel` | POST | Autre | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Oui | Réservation/session | Suivi qualité P2 |
| P2 | `/api/sessions/video` | POST | Autre | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Oui | Réservation/session | Suivi qualité P2 |
| P2 | `/api/stages/[stageSlug]/bilans` | GET, POST | Bilans/assessments | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Données pédagogiques mineur, Réservation/session | Suivi qualité P2 |
| P1 | `/api/stages/[stageSlug]/inscrire` | POST | Stages | Public | N/A | Oui | Non | Non | Oui | Oui | Réservation/session | Durcir avant bêta élargie |
| P2 | `/api/stages/[stageSlug]/reservations/[reservationId]/confirm` | POST | Stages | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Oui | Non | Réservation/session | Suivi qualité P2 |
| P2 | `/api/stages/[stageSlug]/reservations` | GET | Stages | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | Réservation/session | Suivi qualité P2 |
| P2 | `/api/stages/[stageSlug]` | GET | Stages | Public/À vérifier | N/A | Oui | Non | Non | Oui | Non | Réservation/session | Suivi qualité P2 |
| P2 | `/api/stages` | GET | Stages | Public/À vérifier | N/A | N/A | Non | Non | Oui | Non | Réservation/session | Suivi qualité P2 |
| P1 | `/api/student/activate` | GET, POST | Élève | Public | N/A | N/A | Non | Non | Oui | Oui | PII/utilisateur | Durcir avant bêta élargie |
| P2 | `/api/student/automatismes/attempts/[id]` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/automatismes/attempts` | POST, GET | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/automatismes/check-answer` | POST | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/automatismes/series/[id]` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/automatismes/series` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/bilans/[publicShareId]` | GET | Bilans/assessments | Auth | Élève | Oui | Oui | Oui | Non | Non | Données pédagogiques mineur, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/credits` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Oui | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/dashboard` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/documents/[id]/download` | GET | Documents | Auth | Élève | Oui | Oui | Oui | Non | Non | Document/fichier, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/documents` | GET | Documents | Auth | Élève | Oui | Oui | Oui | Non | Non | Document/fichier, PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/nexus-index` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/resources/official/[slug]` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/resources` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/sessions` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Oui | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/student/stages` | GET | Stages | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur, Réservation/session | Suivi qualité P2 |
| P2 | `/api/student/survival/phrases/[phraseId]/copied` | POST | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/survival/progress` | GET, POST | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/survival/qcm/attempt` | POST | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/survival/reflexes/[reflexId]/attempt` | POST | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/survival/ritual` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/student/trajectory` | GET | Élève | Auth | Élève | Oui | Oui | Oui | Oui | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/students/[studentId]/badges` | GET | Élève | Auth | Rôle détecté, à qualifier | Oui | Oui | Oui | Non | Non | PII/utilisateur | Suivi qualité P2 |
| P2 | `/api/subscriptions/aria-addon` | POST | ARIA/RAG | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | Conversation IA | Suivi qualité P2 |
| P2 | `/api/subscriptions/change` | POST | Autre | Public/À vérifier | N/A | N/A | Non | Non | Non | Non | À vérifier | Suivi qualité P2 |

## Limites

- Les guards détectés proviennent de motifs statiques ; ils ne prouvent pas l’absence d’IDOR.
- Le rate limiting est détecté par motifs de code locaux ; une protection middleware, reverse proxy ou provider externe reste `À vérifier` sans preuve runtime.
- Les routes `OK` ne sont pas déclarées go-live ready ; elles sont seulement moins prioritaires dans l’inventaire statique.

# Site Map

Genere: 2026-06-24T18:22:56.414Z

Routes detectees: 288 (113 pages, 175 route handlers).

## Marketing public

| Chemin | Type | Rendu | Server/client | Acces/role | Finalite | Sources donnees | Fichier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| / | page | statique | server | public | Accueil marketing et orientation conversion | - | app/page.tsx |
| /access-required | page | dynamique | server | public | Page publique ou applicative | - | app/access-required/page.tsx |
| /accompagnement-scolaire | page | statique | client | public | Page publique ou applicative | - | app/accompagnement-scolaire/page.tsx |
| /bilan-gratuit | page | dynamique | server | public | Tunnel public de demande de bilan | - | app/bilan-gratuit/page.tsx |
| /bilan-gratuit/assessment | page | statique | client | public | Page publique ou applicative | - | app/bilan-gratuit/assessment/page.tsx |
| /bilan-gratuit/confirmation | page | statique | server | public | Page publique ou applicative | legal | app/bilan-gratuit/confirmation/page.tsx |
| /bilan-pallier2-maths | page | statique | client | public | Page publique ou applicative | api fetch | app/bilan-pallier2-maths/page.tsx |
| /bilan-pallier2-maths/confirmation | page | statique | client | public | Page publique ou applicative | legal | app/bilan-pallier2-maths/confirmation/page.tsx |
| /bilan-pallier2-maths/dashboard | page | statique | client | public | Espace applicatif par role | api fetch | app/bilan-pallier2-maths/dashboard/page.tsx |
| /bilan-pallier2-maths/resultat/[id] | page | dynamique | client | public | Page publique ou applicative | api fetch | app/bilan-pallier2-maths/resultat/[id]/page.tsx |
| /candidat-libre-bac-francais | page | statique | server | public | Landing SEO | content marketing | app/candidat-libre-bac-francais/page.tsx |
| /conditions | page | statique | server | public | Legal et conformite | - | app/conditions/page.tsx |
| /conditions-generales | page | statique | server | public | Legal et conformite | legal, cgv-policy | app/conditions-generales/page.tsx |
| /contact | page | statique | client | public | Page publique ou applicative | legal, api fetch | app/contact/page.tsx |
| /corrige_dnb_maths_2026 | page | statique | server | public | Page publique ou applicative | metadataBase | app/corrige_dnb_maths_2026/page.tsx |
| /dashboard/trajectoire | page | statique probable | server | public | Espace applicatif par role | - | app/dashboard/trajectoire/page.tsx |
| /equipe | page | statique | client | public | Page publique ou applicative | group-rules | app/equipe/page.tsx |
| /famille | page | statique | server | public | Page publique ou applicative | pricing canonical | app/famille/page.tsx |
| /grand-oral | page | statique | server | public | Landing SEO | content marketing | app/grand-oral/page.tsx |
| /lamis | page | statique | server | public | Page publique ou applicative | - | app/lamis/page.tsx |
| /maths-1ere | page | statique | server | public | Page publique ou applicative | - | app/maths-1ere/page.tsx |
| /mentions-legales | page | statique | server | public | Legal et conformite | legal, cgv-policy | app/mentions-legales/page.tsx |
| /notre-centre | page | statique | client | public | Page publique ou applicative | legal | app/notre-centre/page.tsx |
| /offres | page | statique | client | public | Catalogue offres et tarifs | pricing canonical | app/offres/page.tsx |
| /plateforme-aria | page | statique | client | public | Page publique ou applicative | - | app/plateforme-aria/page.tsx |
| /politique-confidentialite | page | statique | server | public | Legal et conformite | legal | app/politique-confidentialite/page.tsx |
| /preparation-bac-francais-tunis | page | statique | server | public | Landing SEO | content marketing | app/preparation-bac-francais-tunis/page.tsx |
| /programme/maths-1ere | page | statique probable | server | public | Page publique ou applicative | - | app/programme/maths-1ere/page.tsx |
| /programme/maths-1ere-stmg | page | statique | server | public | Page publique ou applicative | - | app/programme/maths-1ere-stmg/page.tsx |
| /programme/maths-terminale | page | statique probable | server | public | Page publique ou applicative | prisma/db | app/programme/maths-terminale/page.tsx |
| /recommandation | page | statique | server | public | Selecteur de formule | - | app/recommandation/page.tsx |
| /ressources | page | statique | server | public | Page publique ou applicative | - | app/ressources/page.tsx |
| /reussir-eaf | page | statique | server | public | Landing SEO | content marketing | app/reussir-eaf/page.tsx |
| /stages | page | statique | server | public | Presentation stages et intensifs | - | app/stages/page.tsx |
| /stages/[stageSlug] | page | dynamique | server | public | Page publique ou applicative | legal | app/stages/[stageSlug]/page.tsx |
| /stages/[stageSlug]/inscription | page | dynamique | server | public | Page publique ou applicative | - | app/stages/[stageSlug]/inscription/page.tsx |

## Auth et parcours publics techniques

| Chemin | Type | Rendu | Server/client | Acces/role | Finalite | Sources donnees | Fichier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /admin/directeur | page | statique | client | auth admin/directeur | Page publique ou applicative | api fetch | app/admin/directeur/page.tsx |
| /assessments/[id]/processing | page | dynamique | client | auth/session | Page publique ou applicative | api fetch | app/assessments/[id]/processing/page.tsx |
| /assessments/[id]/result | page | dynamique | client | auth/session | Page publique ou applicative | api fetch | app/assessments/[id]/result/page.tsx |
| /auth/activate | page | statique | client | public auth | Authentification et recuperation compte | next-auth/session, api fetch | app/auth/activate/page.tsx |
| /auth/mot-de-passe-oublie | page | statique | client | public auth | Authentification et recuperation compte | api fetch | app/auth/mot-de-passe-oublie/page.tsx |
| /auth/reset-password | page | statique | client | public auth | Authentification et recuperation compte | api fetch | app/auth/reset-password/page.tsx |
| /auth/signin | page | dynamique | server | public auth | Authentification et recuperation compte | - | app/auth/signin/page.tsx |
| /session/video | page | statique | client | auth/session | Page publique ou applicative | next-auth/session, api fetch | app/session/video/page.tsx |

## Dashboards

| Chemin | Type | Rendu | Server/client | Acces/role | Finalite | Sources donnees | Fichier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /dashboard | page | statique probable | server | auth routeur role | Espace applicatif par role | - | app/dashboard/page.tsx |
| /dashboard/admin | page | statique probable | client | auth admin/directeur | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/admin/page.tsx |
| /dashboard/admin/activities | page | statique probable | client | auth admin/directeur | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/admin/activities/page.tsx |
| /dashboard/admin/analytics | page | statique probable | client | auth admin/directeur | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/admin/analytics/page.tsx |
| /dashboard/admin/documents | page | statique probable | server | auth admin/directeur | Espace applicatif par role | - | app/dashboard/admin/documents/page.tsx |
| /dashboard/admin/facturation | page | statique probable | client | auth admin/directeur | Espace applicatif par role | cgv-policy, api fetch | app/dashboard/admin/facturation/page.tsx |
| /dashboard/admin/stages | page | statique probable | client | auth admin/directeur | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/admin/stages/page.tsx |
| /dashboard/admin/subscriptions | page | statique probable | client | auth admin/directeur | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/admin/subscriptions/page.tsx |
| /dashboard/admin/tests | page | statique probable | client | auth admin/directeur | Espace applicatif par role | cgv-policy, next-auth/session, api fetch | app/dashboard/admin/tests/page.tsx |
| /dashboard/admin/users | page | statique probable | client | auth admin/directeur | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/admin/users/page.tsx |
| /dashboard/assistante | page | statique probable | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/page.tsx |
| /dashboard/assistante/assignments | page | dynamique | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/assignments/page.tsx |
| /dashboard/assistante/coaches | page | statique probable | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/coaches/page.tsx |
| /dashboard/assistante/credit-requests | page | statique probable | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/credit-requests/page.tsx |
| /dashboard/assistante/credits | page | dynamique | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/credits/page.tsx |
| /dashboard/assistante/devis | page | statique probable | server | auth assistante | Espace applicatif par role | - | app/dashboard/assistante/devis/page.tsx |
| /dashboard/assistante/docs | page | dynamique | server | auth assistante | Espace applicatif par role | - | app/dashboard/assistante/docs/page.tsx |
| /dashboard/assistante/facturation | page | statique probable | server | auth assistante | Espace applicatif par role | - | app/dashboard/assistante/facturation/page.tsx |
| /dashboard/assistante/paiements | page | statique probable | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/paiements/page.tsx |
| /dashboard/assistante/planning | page | statique probable | server | auth assistante | Espace applicatif par role | - | app/dashboard/assistante/planning/page.tsx |
| /dashboard/assistante/stages | page | statique probable | client | auth assistante | Espace applicatif par role | api fetch | app/dashboard/assistante/stages/page.tsx |
| /dashboard/assistante/stages/planning | page | statique probable | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/stages/planning/page.tsx |
| /dashboard/assistante/students | page | statique probable | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/students/page.tsx |
| /dashboard/assistante/students/[studentId] | page | dynamique | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/students/[studentId]/page.tsx |
| /dashboard/assistante/subscription-requests | page | dynamique | server | auth assistante | Espace applicatif par role | - | app/dashboard/assistante/subscription-requests/page.tsx |
| /dashboard/assistante/subscriptions | page | dynamique | client | auth assistante | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/assistante/subscriptions/page.tsx |
| /dashboard/coach | page | statique probable | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/page.tsx |
| /dashboard/coach/availability | page | statique probable | client | auth coach | Espace applicatif par role | next-auth/session | app/dashboard/coach/availability/page.tsx |
| /dashboard/coach/eaf-stage-printemps | page | statique probable | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/eaf-stage-printemps/page.tsx |
| /dashboard/coach/eaf-stage-printemps/[studentId] | page | dynamique | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/eaf-stage-printemps/[studentId]/page.tsx |
| /dashboard/coach/eleve/[studentId] | page | dynamique | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/eleve/[studentId]/page.tsx |
| /dashboard/coach/maths-premiere-stage-printemps | page | statique probable | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/maths-premiere-stage-printemps/page.tsx |
| /dashboard/coach/maths-premiere-stage-printemps/[studentId] | page | dynamique | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/maths-premiere-stage-printemps/[studentId]/page.tsx |
| /dashboard/coach/npc | page | statique probable | server | auth coach | Espace applicatif par role | prisma/db | app/dashboard/coach/npc/page.tsx |
| /dashboard/coach/npc/reports/[reportId] | page | dynamique | server | auth coach | Espace applicatif par role | prisma/db | app/dashboard/coach/npc/reports/[reportId]/page.tsx |
| /dashboard/coach/npc/submissions/[submissionId]/upload | page | dynamique | server | auth coach | Espace applicatif par role | prisma/db | app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx |
| /dashboard/coach/nsi-pratique-2026 | page | statique probable | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/nsi-pratique-2026/page.tsx |
| /dashboard/coach/nsi-pratique-2026/[studentId] | page | dynamique | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/nsi-pratique-2026/[studentId]/page.tsx |
| /dashboard/coach/sessions | page | statique probable | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/sessions/page.tsx |
| /dashboard/coach/stages | page | statique probable | client | auth coach | Espace applicatif par role | api fetch | app/dashboard/coach/stages/page.tsx |
| /dashboard/coach/stages/[stageSlug]/bilan/[studentId] | page | dynamique | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/stages/[stageSlug]/bilan/[studentId]/page.tsx |
| /dashboard/coach/students | page | statique probable | client | auth coach | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/coach/students/page.tsx |
| /dashboard/eleve | page | statique probable | client | auth eleve | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/eleve/page.tsx |
| /dashboard/eleve/automatismes | page | statique probable | client | auth eleve | Espace applicatif par role | - | app/dashboard/eleve/automatismes/page.tsx |
| /dashboard/eleve/bilans/[publicShareId] | page | dynamique | client | auth eleve | Espace applicatif par role | api fetch | app/dashboard/eleve/bilans/[publicShareId]/page.tsx |
| /dashboard/eleve/documents | page | statique probable | client | auth eleve | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/eleve/documents/page.tsx |
| /dashboard/eleve/eam | page | statique probable | client | auth eleve | Espace applicatif par role | next-auth/session | app/dashboard/eleve/eam/page.tsx |
| /dashboard/eleve/npc | page | statique probable | server | auth eleve | Espace applicatif par role | prisma/db | app/dashboard/eleve/npc/page.tsx |
| /dashboard/eleve/nsi-pratique-2026 | page | statique probable | client | auth eleve | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/eleve/nsi-pratique-2026/page.tsx |
| /dashboard/eleve/programme/[subject] | page | dynamique | server | auth eleve | Espace applicatif par role | prisma/db | app/dashboard/eleve/programme/[subject]/page.tsx |
| /dashboard/eleve/programme/maths | page | statique probable | server | auth eleve | Espace applicatif par role | prisma/db | app/dashboard/eleve/programme/maths/page.tsx |
| /dashboard/eleve/questionnaires/eaf-stage-printemps | page | statique probable | client | auth eleve | Espace applicatif par role | api fetch | app/dashboard/eleve/questionnaires/eaf-stage-printemps/page.tsx |
| /dashboard/eleve/questionnaires/maths-premiere-stage-printemps | page | statique probable | client | auth eleve | Espace applicatif par role | api fetch | app/dashboard/eleve/questionnaires/maths-premiere-stage-printemps/page.tsx |
| /dashboard/eleve/ressources | page | statique probable | server | auth eleve | Espace applicatif par role | - | app/dashboard/eleve/ressources/page.tsx |
| /dashboard/eleve/sessions | page | statique probable | server | auth eleve | Espace applicatif par role | - | app/dashboard/eleve/sessions/page.tsx |
| /dashboard/eleve/stage-eam-stmg | page | statique probable | server | auth eleve | Espace applicatif par role | prisma/db | app/dashboard/eleve/stage-eam-stmg/page.tsx |
| /dashboard/eleve/stage-eam-stmg/diagnostic | page | statique probable | server | auth eleve | Espace applicatif par role | prisma/db | app/dashboard/eleve/stage-eam-stmg/diagnostic/page.tsx |
| /dashboard/eleve/stage-eam-stmg/livret | page | statique probable | server | auth eleve | Espace applicatif par role | prisma/db | app/dashboard/eleve/stage-eam-stmg/livret/page.tsx |
| /dashboard/eleve/stages | page | statique probable | client | auth eleve | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/eleve/stages/page.tsx |
| /dashboard/parent | page | statique probable | client | auth parent | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/parent/page.tsx |
| /dashboard/parent/abonnements | page | statique probable | client | auth parent | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/parent/abonnements/page.tsx |
| /dashboard/parent/children | page | statique probable | server | auth parent | Espace applicatif par role | - | app/dashboard/parent/children/page.tsx |
| /dashboard/parent/enfant/[studentId] | page | dynamique | client | auth parent | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/parent/enfant/[studentId]/page.tsx |
| /dashboard/parent/factures | page | dynamique | server | auth parent | Espace applicatif par role | prisma/db | app/dashboard/parent/factures/page.tsx |
| /dashboard/parent/npc | page | statique probable | server | auth parent | Espace applicatif par role | prisma/db | app/dashboard/parent/npc/page.tsx |
| /dashboard/parent/paiement | page | dynamique | client | auth parent | Espace applicatif par role | legal, cgv-policy, next-auth/session, api fetch | app/dashboard/parent/paiement/page.tsx |
| /dashboard/parent/paiement/confirmation | page | statique probable | client | auth parent | Espace applicatif par role | legal | app/dashboard/parent/paiement/confirmation/page.tsx |
| /dashboard/parent/ressources | page | statique probable | server | auth parent | Espace applicatif par role | prisma/db | app/dashboard/parent/ressources/page.tsx |
| /dashboard/parent/stages | page | statique probable | client | auth parent | Espace applicatif par role | next-auth/session, api fetch | app/dashboard/parent/stages/page.tsx |
| /dashboard/trajectoire | page | statique probable | server | public | Espace applicatif par role | - | app/dashboard/trajectoire/page.tsx |

## API

| Chemin | Type | Rendu | Server/client | Acces/role | Finalite | Sources donnees | Fichier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /api/admin/activities | api | route handler | server | api admin | Endpoint admin/activities | prisma/db | app/api/admin/activities/route.ts |
| /api/admin/analytics | api | route handler | server | api admin | Endpoint admin/analytics | prisma/db | app/api/admin/analytics/route.ts |
| /api/admin/dashboard | api | route handler | server | api admin | Endpoint admin/dashboard | prisma/db | app/api/admin/dashboard/route.ts |
| /api/admin/directeur/stats | api | route handler | server | api admin | Endpoint admin/directeur/stats | prisma/db | app/api/admin/directeur/stats/route.ts |
| /api/admin/documents | api | route handler | server | api admin | Endpoint admin/documents | prisma/db | app/api/admin/documents/route.ts |
| /api/admin/invoices | api | route handler | server | api admin | Endpoint admin/invoices | legal, prisma/db | app/api/admin/invoices/route.ts |
| /api/admin/invoices/[id] | api | route handler | server | api admin | Endpoint admin/invoices/[id] | prisma/db | app/api/admin/invoices/[id]/route.ts |
| /api/admin/invoices/[id]/send | api | route handler | server | api admin | Endpoint admin/invoices/[id]/send | prisma/db | app/api/admin/invoices/[id]/send/route.ts |
| /api/admin/recompute-ssn | api | route handler | server | api admin | Endpoint admin/recompute-ssn | - | app/api/admin/recompute-ssn/route.ts |
| /api/admin/stages | api | route handler | server | api admin | Endpoint admin/stages | prisma/db | app/api/admin/stages/route.ts |
| /api/admin/stages/[stageId] | api | route handler | server | api admin | Endpoint admin/stages/[stageId] | prisma/db | app/api/admin/stages/[stageId]/route.ts |
| /api/admin/stages/[stageId]/coaches | api | route handler | server | api admin | Endpoint admin/stages/[stageId]/coaches | prisma/db | app/api/admin/stages/[stageId]/coaches/route.ts |
| /api/admin/stages/[stageId]/sessions | api | route handler | server | api admin | Endpoint admin/stages/[stageId]/sessions | prisma/db | app/api/admin/stages/[stageId]/sessions/route.ts |
| /api/admin/stages/[stageId]/sessions/[sessionId] | api | route handler | server | api admin | Endpoint admin/stages/[stageId]/sessions/[sessionId] | prisma/db | app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts |
| /api/admin/subscriptions | api | route handler | server | api admin | Endpoint admin/subscriptions | prisma/db | app/api/admin/subscriptions/route.ts |
| /api/admin/test-email | api | route handler | server | api admin | Endpoint admin/test-email | - | app/api/admin/test-email/route.ts |
| /api/admin/users | api | route handler | server | api admin | Endpoint admin/users | prisma/db | app/api/admin/users/route.ts |
| /api/admin/users/search | api | route handler | server | api admin | Endpoint admin/users/search | prisma/db | app/api/admin/users/search/route.ts |
| /api/analytics/event | api | route handler | server | api publique/technique | Endpoint analytics/event | - | app/api/analytics/event/route.ts |
| /api/aria/chat | api | route handler | server | api authentifiee | Endpoint aria/chat | prisma/db | app/api/aria/chat/route.ts |
| /api/aria/conversations | api | route handler | server | api authentifiee | Endpoint aria/conversations | prisma/db | app/api/aria/conversations/route.ts |
| /api/aria/feedback | api | route handler | server | api authentifiee | Endpoint aria/feedback | prisma/db | app/api/aria/feedback/route.ts |
| /api/assessments/[id]/export | api | route handler | server | api authentifiee | Endpoint assessments/[id]/export | prisma/db | app/api/assessments/[id]/export/route.ts |
| /api/assessments/[id]/result | api | route handler | server | api authentifiee | Endpoint assessments/[id]/result | metadataBase, prisma/db | app/api/assessments/[id]/result/route.ts |
| /api/assessments/[id]/status | api | route handler | server | api authentifiee | Endpoint assessments/[id]/status | prisma/db | app/api/assessments/[id]/status/route.ts |
| /api/assessments/predict | api | route handler | server | api authentifiee | Endpoint assessments/predict | prisma/db | app/api/assessments/predict/route.ts |
| /api/assessments/submit | api | route handler | server | api publique/technique | Endpoint assessments/submit | metadataBase, prisma/db | app/api/assessments/submit/route.ts |
| /api/assessments/test | api | route handler | server | api authentifiee | Endpoint assessments/test | prisma/db | app/api/assessments/test/route.ts |
| /api/assistante/activate-student | api | route handler | server | api assistante | Endpoint assistante/activate-student | - | app/api/assistante/activate-student/route.ts |
| /api/assistante/assignments | api | route handler | server | api assistante | Endpoint assistante/assignments | prisma/db | app/api/assistante/assignments/route.ts |
| /api/assistante/assignments/[id] | api | route handler | server | api assistante | Endpoint assistante/assignments/[id] | prisma/db | app/api/assistante/assignments/[id]/route.ts |
| /api/assistante/coaches | api | route handler | server | api assistante | Endpoint assistante/coaches | prisma/db | app/api/assistante/coaches/route.ts |
| /api/assistante/coaches/manage | api | route handler | server | api assistante | Endpoint assistante/coaches/manage | prisma/db | app/api/assistante/coaches/manage/route.ts |
| /api/assistante/coaches/manage/[id] | api | route handler | server | api assistante | Endpoint assistante/coaches/manage/[id] | prisma/db | app/api/assistante/coaches/manage/[id]/route.ts |
| /api/assistante/credit-requests | api | route handler | server | api assistante | Endpoint assistante/credit-requests | prisma/db | app/api/assistante/credit-requests/route.ts |
| /api/assistante/dashboard | api | route handler | server | api assistante | Endpoint assistante/dashboard | prisma/db | app/api/assistante/dashboard/route.ts |
| /api/assistante/planning | api | route handler | server | api assistante | Endpoint assistante/planning | prisma/db | app/api/assistante/planning/route.ts |
| /api/assistante/quotes/pdf | api | route handler | server | api assistante | Endpoint assistante/quotes/pdf | - | app/api/assistante/quotes/pdf/route.ts |
| /api/assistante/sessions | api | route handler | server | api assistante | Endpoint assistante/sessions | prisma/db | app/api/assistante/sessions/route.ts |
| /api/assistante/stages | api | route handler | server | api assistante | Endpoint assistante/stages | prisma/db | app/api/assistante/stages/route.ts |
| /api/assistante/students | api | route handler | server | api assistante | Endpoint assistante/students | legal, prisma/db | app/api/assistante/students/route.ts |
| /api/assistante/students/[studentId] | api | route handler | server | api assistante | Endpoint assistante/students/[studentId] | prisma/db | app/api/assistante/students/[studentId]/route.ts |
| /api/assistante/students/[studentId]/documents | api | route handler | server | api assistante | Endpoint assistante/students/[studentId]/documents | prisma/db | app/api/assistante/students/[studentId]/documents/route.ts |
| /api/assistante/students/credits | api | route handler | server | api assistante | Endpoint assistante/students/credits | prisma/db | app/api/assistante/students/credits/route.ts |
| /api/assistante/subscription-requests | api | route handler | server | api assistante | Endpoint assistante/subscription-requests | prisma/db | app/api/assistante/subscription-requests/route.ts |
| /api/assistante/subscriptions | api | route handler | server | api assistante | Endpoint assistante/subscriptions | prisma/db | app/api/assistante/subscriptions/route.ts |
| /api/auth/[...nextauth] | api | route handler | server | api auth | Endpoint auth/[...nextauth] | - | app/api/auth/[...nextauth]/route.ts |
| /api/auth/resend-activation | api | route handler | server | api auth | Endpoint auth/resend-activation | legal, prisma/db | app/api/auth/resend-activation/route.ts |
| /api/auth/reset-password | api | route handler | server | api auth | Endpoint auth/reset-password | prisma/db | app/api/auth/reset-password/route.ts |
| /api/bilan-gratuit | api | route handler | server | api publique/technique | Endpoint bilan-gratuit | prisma/db | app/api/bilan-gratuit/route.ts |
| /api/bilan-gratuit/dismiss | api | route handler | server | api authentifiee | Endpoint bilan-gratuit/dismiss | prisma/db | app/api/bilan-gratuit/dismiss/route.ts |
| /api/bilan-gratuit/status | api | route handler | server | api authentifiee | Endpoint bilan-gratuit/status | prisma/db | app/api/bilan-gratuit/status/route.ts |
| /api/bilan-pallier2-maths | api | route handler | server | api authentifiee | Endpoint bilan-pallier2-maths | prisma/db | app/api/bilan-pallier2-maths/route.ts |
| /api/bilan-pallier2-maths/retry | api | route handler | server | api authentifiee | Endpoint bilan-pallier2-maths/retry | prisma/db | app/api/bilan-pallier2-maths/retry/route.ts |
| /api/bilans | api | route handler | server | api authentifiee | Endpoint bilans | prisma/db | app/api/bilans/route.ts |
| /api/bilans/[id] | api | route handler | server | api authentifiee | Endpoint bilans/[id] | prisma/db | app/api/bilans/[id]/route.ts |
| /api/bilans/[id]/export | api | route handler | server | api authentifiee | Endpoint bilans/[id]/export | prisma/db | app/api/bilans/[id]/export/route.ts |
| /api/bilans/generate | api | route handler | server | api authentifiee | Endpoint bilans/generate | prisma/db | app/api/bilans/generate/route.ts |
| /api/coach/dashboard | api | route handler | server | api coach | Endpoint coach/dashboard | prisma/db | app/api/coach/dashboard/route.ts |
| /api/coach/eaf-stage-printemps/students | api | route handler | server | api coach | Endpoint coach/eaf-stage-printemps/students | prisma/db | app/api/coach/eaf-stage-printemps/students/route.ts |
| /api/coach/eaf-stage-printemps/students/[studentId]/report | api | route handler | server | api coach | Endpoint coach/eaf-stage-printemps/students/[studentId]/report | prisma/db | app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts |
| /api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate | api | route handler | server | api coach | Endpoint coach/eaf-stage-printemps/students/[studentId]/report/regenerate | prisma/db | app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts |
| /api/coach/maths-premiere-stage-printemps/students | api | route handler | server | api coach | Endpoint coach/maths-premiere-stage-printemps/students | prisma/db | app/api/coach/maths-premiere-stage-printemps/students/route.ts |
| /api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent | api | route handler | server | api coach | Endpoint coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent | prisma/db | app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts |
| /api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student | api | route handler | server | api coach | Endpoint coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student | prisma/db | app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts |
| /api/coach/maths-premiere-stage-printemps/students/[studentId]/report | api | route handler | server | api coach | Endpoint coach/maths-premiere-stage-printemps/students/[studentId]/report | prisma/db | app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts |
| /api/coach/nsi-pratique-2026/students | api | route handler | server | api coach | Endpoint coach/nsi-pratique-2026/students | prisma/db | app/api/coach/nsi-pratique-2026/students/route.ts |
| /api/coach/nsi-pratique-2026/students/[studentId]/progress | api | route handler | server | api coach | Endpoint coach/nsi-pratique-2026/students/[studentId]/progress | prisma/db | app/api/coach/nsi-pratique-2026/students/[studentId]/progress/route.ts |
| /api/coach/sessions/[sessionId]/report | api | route handler | server | api coach | Endpoint coach/sessions/[sessionId]/report | prisma/db | app/api/coach/sessions/[sessionId]/report/route.ts |
| /api/coach/stages | api | route handler | server | api coach | Endpoint coach/stages | prisma/db | app/api/coach/stages/route.ts |
| /api/coach/students | api | route handler | server | api coach | Endpoint coach/students | - | app/api/coach/students/route.ts |
| /api/coach/students/[studentId] | api | route handler | server | api coach | Endpoint coach/students/[studentId] | prisma/db | app/api/coach/students/[studentId]/route.ts |
| /api/coach/students/[studentId]/bilan-diagnostic-maths-terminale | api | route handler | server | api coach | Endpoint coach/students/[studentId]/bilan-diagnostic-maths-terminale | prisma/db | app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts |
| /api/coach/students/[studentId]/documents | api | route handler | server | api coach | Endpoint coach/students/[studentId]/documents | prisma/db | app/api/coach/students/[studentId]/documents/route.ts |
| /api/coach/students/[studentId]/dossier | api | route handler | server | api coach | Endpoint coach/students/[studentId]/dossier | prisma/db | app/api/coach/students/[studentId]/dossier/route.ts |
| /api/coach/students/[studentId]/eaf-preparation-report | api | route handler | server | api coach | Endpoint coach/students/[studentId]/eaf-preparation-report | prisma/db | app/api/coach/students/[studentId]/eaf-preparation-report/route.ts |
| /api/coach/students/[studentId]/eaf-preparation-report/validate | api | route handler | server | api coach | Endpoint coach/students/[studentId]/eaf-preparation-report/validate | prisma/db | app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts |
| /api/coach/students/[studentId]/generated-reports | api | route handler | server | api coach | Endpoint coach/students/[studentId]/generated-reports | prisma/db | app/api/coach/students/[studentId]/generated-reports/route.ts |
| /api/coach/students/[studentId]/generated-reports/[reportId]/download | api | route handler | server | api coach | Endpoint coach/students/[studentId]/generated-reports/[reportId]/download | prisma/db | app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts |
| /api/coach/students/[studentId]/generated-reports/[reportId]/generate | api | route handler | server | api coach | Endpoint coach/students/[studentId]/generated-reports/[reportId]/generate | - | app/api/coach/students/[studentId]/generated-reports/[reportId]/generate/route.ts |
| /api/coach/students/[studentId]/generated-reports/[reportId]/regenerate | api | route handler | server | api coach | Endpoint coach/students/[studentId]/generated-reports/[reportId]/regenerate | - | app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts |
| /api/coach/students/[studentId]/notes | api | route handler | server | api coach | Endpoint coach/students/[studentId]/notes | prisma/db | app/api/coach/students/[studentId]/notes/route.ts |
| /api/coach/students/[studentId]/survival-mode | api | route handler | server | api coach | Endpoint coach/students/[studentId]/survival-mode | prisma/db | app/api/coach/students/[studentId]/survival-mode/route.ts |
| /api/coach/students/eam-summary | api | route handler | server | api coach | Endpoint coach/students/eam-summary | prisma/db | app/api/coach/students/eam-summary/route.ts |
| /api/coach/trajectory | api | route handler | server | api coach | Endpoint coach/trajectory | prisma/db | app/api/coach/trajectory/route.ts |
| /api/coaches/availability | api | route handler | server | api authentifiee | Endpoint coaches/availability | prisma/db | app/api/coaches/availability/route.ts |
| /api/coaches/available | api | route handler | server | api authentifiee | Endpoint coaches/available | prisma/db | app/api/coaches/available/route.ts |
| /api/contact | api | route handler | server | api publique/technique | Endpoint contact | - | app/api/contact/route.ts |
| /api/diagnostics/definitions | api | route handler | server | api publique/technique | Endpoint diagnostics/definitions | - | app/api/diagnostics/definitions/route.ts |
| /api/documents/[id] | api | route handler | server | api authentifiee | Endpoint documents/[id] | prisma/db | app/api/documents/[id]/route.ts |
| /api/eam/progress | api | route handler | server | api publique/technique | Endpoint eam/progress | prisma/db | app/api/eam/progress/route.ts |
| /api/eleve/bilan-diagnostic-maths-terminale | api | route handler | server | api eleve | Endpoint eleve/bilan-diagnostic-maths-terminale | prisma/db | app/api/eleve/bilan-diagnostic-maths-terminale/route.ts |
| /api/eleve/nsi-pratique-2026/progress | api | route handler | server | api eleve | Endpoint eleve/nsi-pratique-2026/progress | prisma/db | app/api/eleve/nsi-pratique-2026/progress/route.ts |
| /api/eleve/questionnaire-eaf-stage-printemps | api | route handler | server | api eleve | Endpoint eleve/questionnaire-eaf-stage-printemps | prisma/db | app/api/eleve/questionnaire-eaf-stage-printemps/route.ts |
| /api/eleve/questionnaire-maths-premiere-stage-printemps | api | route handler | server | api eleve | Endpoint eleve/questionnaire-maths-premiere-stage-printemps | prisma/db | app/api/eleve/questionnaire-maths-premiere-stage-printemps/route.ts |
| /api/eleve/stages | api | route handler | server | api eleve | Endpoint eleve/stages | prisma/db | app/api/eleve/stages/route.ts |
| /api/health | api | route handler | server | api publique/technique | Endpoint health | prisma/db | app/api/health/route.ts |
| /api/internal/health | api | route handler | server | interne | Endpoint internal/health | prisma/db | app/api/internal/health/route.ts |
| /api/invoices/[id]/pdf | api | route handler | server | api authentifiee | Endpoint invoices/[id]/pdf | prisma/db | app/api/invoices/[id]/pdf/route.ts |
| /api/invoices/[id]/receipt/pdf | api | route handler | server | api authentifiee | Endpoint invoices/[id]/receipt/pdf | metadataBase, prisma/db | app/api/invoices/[id]/receipt/pdf/route.ts |
| /api/lamis/attempt | api | route handler | server | api publique/technique | Endpoint lamis/attempt | - | app/api/lamis/attempt/route.ts |
| /api/lamis/exercises | api | route handler | server | api publique/technique | Endpoint lamis/exercises | - | app/api/lamis/exercises/route.ts |
| /api/lamis/export | api | route handler | server | api publique/technique | Endpoint lamis/export | - | app/api/lamis/export/route.ts |
| /api/lamis/progress | api | route handler | server | api publique/technique | Endpoint lamis/progress | - | app/api/lamis/progress/route.ts |
| /api/lamis/teacher-report | api | route handler | server | api publique/technique | Endpoint lamis/teacher-report | - | app/api/lamis/teacher-report/route.ts |
| /api/me/next-step | api | route handler | server | api authentifiee | Endpoint me/next-step | - | app/api/me/next-step/route.ts |
| /api/messages/conversations | api | route handler | server | api authentifiee | Endpoint messages/conversations | prisma/db | app/api/messages/conversations/route.ts |
| /api/messages/send | api | route handler | server | api authentifiee | Endpoint messages/send | prisma/db | app/api/messages/send/route.ts |
| /api/newsletter | api | route handler | server | api publique/technique | Endpoint newsletter | - | app/api/newsletter/route.ts |
| /api/notifications | api | route handler | server | api authentifiee | Endpoint notifications | prisma/db | app/api/notifications/route.ts |
| /api/notify/email | api | route handler | server | api publique/technique | Endpoint notify/email | legal | app/api/notify/email/route.ts |
| /api/npc/files/[...path] | api | route handler | server | api authentifiee | Endpoint npc/files/[...path] | prisma/db | app/api/npc/files/[...path]/route.ts |
| /api/npc/submissions | api | route handler | server | api authentifiee | Endpoint npc/submissions | prisma/db | app/api/npc/submissions/route.ts |
| /api/npc/submissions/[submissionId]/documents | api | route handler | server | api authentifiee | Endpoint npc/submissions/[submissionId]/documents | pricing canonical, prisma/db | app/api/npc/submissions/[submissionId]/documents/route.ts |
| /api/npc/submissions/[submissionId]/documents/[documentId] | api | route handler | server | api authentifiee | Endpoint npc/submissions/[submissionId]/documents/[documentId] | prisma/db | app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts |
| /api/npc/submissions/[submissionId]/generate | api | route handler | server | api authentifiee | Endpoint npc/submissions/[submissionId]/generate | prisma/db | app/api/npc/submissions/[submissionId]/generate/route.ts |
| /api/npc/uploads | api | route handler | server | api authentifiee | Endpoint npc/uploads | prisma/db | app/api/npc/uploads/route.ts |
| /api/parent/bilans/[id]/pdf | api | route handler | server | api parent | Endpoint parent/bilans/[id]/pdf | prisma/db | app/api/parent/bilans/[id]/pdf/route.ts |
| /api/parent/children | api | route handler | server | api parent | Endpoint parent/children | prisma/db | app/api/parent/children/route.ts |
| /api/parent/credit-request | api | route handler | server | api parent | Endpoint parent/credit-request | prisma/db | app/api/parent/credit-request/route.ts |
| /api/parent/dashboard | api | route handler | server | api parent | Endpoint parent/dashboard | prisma/db | app/api/parent/dashboard/route.ts |
| /api/parent/stages | api | route handler | server | api parent | Endpoint parent/stages | prisma/db | app/api/parent/stages/route.ts |
| /api/parent/subscription-requests | api | route handler | server | api parent | Endpoint parent/subscription-requests | prisma/db | app/api/parent/subscription-requests/route.ts |
| /api/parent/subscriptions | api | route handler | server | api parent | Endpoint parent/subscriptions | prisma/db | app/api/parent/subscriptions/route.ts |
| /api/payments/bank-transfer/confirm | api | route handler | server | api authentifiee | Endpoint payments/bank-transfer/confirm | prisma/db | app/api/payments/bank-transfer/confirm/route.ts |
| /api/payments/check-pending | api | route handler | server | api authentifiee | Endpoint payments/check-pending | prisma/db | app/api/payments/check-pending/route.ts |
| /api/payments/clictopay/init | api | route handler | server | api publique/technique | Endpoint payments/clictopay/init | - | app/api/payments/clictopay/init/route.ts |
| /api/payments/clictopay/webhook | api | route handler | server | api publique/technique | Endpoint payments/clictopay/webhook | - | app/api/payments/clictopay/webhook/route.ts |
| /api/payments/pending | api | route handler | server | api authentifiee | Endpoint payments/pending | prisma/db | app/api/payments/pending/route.ts |
| /api/payments/validate | api | route handler | server | api authentifiee | Endpoint payments/validate | metadataBase, prisma/db | app/api/payments/validate/route.ts |
| /api/programme/maths-1ere-stmg/progress | api | route handler | server | api publique/technique | Endpoint programme/maths-1ere-stmg/progress | prisma/db | app/api/programme/maths-1ere-stmg/progress/route.ts |
| /api/programme/maths-1ere-stmg/rag | api | route handler | server | api publique/technique | Endpoint programme/maths-1ere-stmg/rag | metadataBase | app/api/programme/maths-1ere-stmg/rag/route.ts |
| /api/programme/maths-1ere-stmg/stage-progress | api | route handler | server | api publique/technique | Endpoint programme/maths-1ere-stmg/stage-progress | prisma/db | app/api/programme/maths-1ere-stmg/stage-progress/route.ts |
| /api/programme/maths-1ere/progress | api | route handler | server | api publique/technique | Endpoint programme/maths-1ere/progress | prisma/db | app/api/programme/maths-1ere/progress/route.ts |
| /api/programme/maths-1ere/rag | api | route handler | server | api publique/technique | Endpoint programme/maths-1ere/rag | metadataBase | app/api/programme/maths-1ere/rag/route.ts |
| /api/programme/maths-terminale/progress | api | route handler | server | api publique/technique | Endpoint programme/maths-terminale/progress | prisma/db | app/api/programme/maths-terminale/progress/route.ts |
| /api/public-documents/corrige-dnb-maths-2026 | api | route handler | server | api publique/technique | Endpoint public-documents/corrige-dnb-maths-2026 | - | app/api/public-documents/corrige-dnb-maths-2026/route.ts |
| /api/reservation | api | route handler | server | api publique/technique | Endpoint reservation | prisma/db | app/api/reservation/route.ts |
| /api/reservation/verify | api | route handler | server | api publique/technique | Endpoint reservation/verify | prisma/db | app/api/reservation/verify/route.ts |
| /api/sessions/book | api | route handler | server | api authentifiee | Endpoint sessions/book | prisma/db | app/api/sessions/book/route.ts |
| /api/sessions/cancel | api | route handler | server | api authentifiee | Endpoint sessions/cancel | prisma/db | app/api/sessions/cancel/route.ts |
| /api/sessions/video | api | route handler | server | api authentifiee | Endpoint sessions/video | prisma/db | app/api/sessions/video/route.ts |
| /api/stages | api | route handler | server | api publique/technique | Endpoint stages | - | app/api/stages/route.ts |
| /api/stages/[stageSlug] | api | route handler | server | api publique/technique | Endpoint stages/[stageSlug] | - | app/api/stages/[stageSlug]/route.ts |
| /api/stages/[stageSlug]/bilans | api | route handler | server | api authentifiee | Endpoint stages/[stageSlug]/bilans | prisma/db | app/api/stages/[stageSlug]/bilans/route.ts |
| /api/stages/[stageSlug]/inscrire | api | route handler | server | api publique/technique | Endpoint stages/[stageSlug]/inscrire | prisma/db | app/api/stages/[stageSlug]/inscrire/route.ts |
| /api/stages/[stageSlug]/reservations | api | route handler | server | api authentifiee | Endpoint stages/[stageSlug]/reservations | prisma/db | app/api/stages/[stageSlug]/reservations/route.ts |
| /api/stages/[stageSlug]/reservations/[reservationId]/confirm | api | route handler | server | api authentifiee | Endpoint stages/[stageSlug]/reservations/[reservationId]/confirm | prisma/db | app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts |
| /api/student/activate | api | route handler | server | api publique/technique | Endpoint student/activate | - | app/api/student/activate/route.ts |
| /api/student/automatismes/attempts | api | route handler | server | api authentifiee | Endpoint student/automatismes/attempts | prisma/db | app/api/student/automatismes/attempts/route.ts |
| /api/student/automatismes/attempts/[id] | api | route handler | server | api authentifiee | Endpoint student/automatismes/attempts/[id] | prisma/db | app/api/student/automatismes/attempts/[id]/route.ts |
| /api/student/automatismes/check-answer | api | route handler | server | api authentifiee | Endpoint student/automatismes/check-answer | - | app/api/student/automatismes/check-answer/route.ts |
| /api/student/automatismes/series | api | route handler | server | api authentifiee | Endpoint student/automatismes/series | prisma/db | app/api/student/automatismes/series/route.ts |
| /api/student/automatismes/series/[id] | api | route handler | server | api authentifiee | Endpoint student/automatismes/series/[id] | - | app/api/student/automatismes/series/[id]/route.ts |
| /api/student/bilans/[publicShareId] | api | route handler | server | api authentifiee | Endpoint student/bilans/[publicShareId] | metadataBase, prisma/db | app/api/student/bilans/[publicShareId]/route.ts |
| /api/student/credits | api | route handler | server | api authentifiee | Endpoint student/credits | prisma/db | app/api/student/credits/route.ts |
| /api/student/dashboard | api | route handler | server | api authentifiee | Endpoint student/dashboard | - | app/api/student/dashboard/route.ts |
| /api/student/documents | api | route handler | server | api authentifiee | Endpoint student/documents | prisma/db | app/api/student/documents/route.ts |
| /api/student/documents/[id]/download | api | route handler | server | api authentifiee | Endpoint student/documents/[id]/download | prisma/db | app/api/student/documents/[id]/download/route.ts |
| /api/student/nexus-index | api | route handler | server | api authentifiee | Endpoint student/nexus-index | - | app/api/student/nexus-index/route.ts |
| /api/student/resources | api | route handler | server | api authentifiee | Endpoint student/resources | - | app/api/student/resources/route.ts |
| /api/student/resources/official/[slug] | api | route handler | server | api authentifiee | Endpoint student/resources/official/[slug] | prisma/db | app/api/student/resources/official/[slug]/route.ts |
| /api/student/sessions | api | route handler | server | api authentifiee | Endpoint student/sessions | prisma/db | app/api/student/sessions/route.ts |
| /api/student/stages | api | route handler | server | api authentifiee | Endpoint student/stages | prisma/db | app/api/student/stages/route.ts |
| /api/student/survival/phrases/[phraseId]/copied | api | route handler | server | api authentifiee | Endpoint student/survival/phrases/[phraseId]/copied | prisma/db | app/api/student/survival/phrases/[phraseId]/copied/route.ts |
| /api/student/survival/progress | api | route handler | server | api authentifiee | Endpoint student/survival/progress | prisma/db | app/api/student/survival/progress/route.ts |
| /api/student/survival/qcm/attempt | api | route handler | server | api authentifiee | Endpoint student/survival/qcm/attempt | prisma/db | app/api/student/survival/qcm/attempt/route.ts |
| /api/student/survival/reflexes/[reflexId]/attempt | api | route handler | server | api authentifiee | Endpoint student/survival/reflexes/[reflexId]/attempt | prisma/db | app/api/student/survival/reflexes/[reflexId]/attempt/route.ts |
| /api/student/survival/ritual | api | route handler | server | api authentifiee | Endpoint student/survival/ritual | prisma/db | app/api/student/survival/ritual/route.ts |
| /api/student/trajectory | api | route handler | server | api authentifiee | Endpoint student/trajectory | - | app/api/student/trajectory/route.ts |
| /api/students/[studentId]/badges | api | route handler | server | api authentifiee | Endpoint students/[studentId]/badges | prisma/db | app/api/students/[studentId]/badges/route.ts |
| /api/subscriptions/aria-addon | api | route handler | server | api publique/technique | Endpoint subscriptions/aria-addon | - | app/api/subscriptions/aria-addon/route.ts |
| /api/subscriptions/change | api | route handler | server | api publique/technique | Endpoint subscriptions/change | - | app/api/subscriptions/change/route.ts |
| /dashboard/assistante/devis/app | api | route handler | server | auth assistante | Endpoint /dashboard/assistante/devis/app | - | app/dashboard/assistante/devis/app/route.ts |
| /dashboard/assistante/devis/assets/[file] | api | route handler | server | auth assistante | Endpoint /dashboard/assistante/devis/assets/[file] | - | app/dashboard/assistante/devis/assets/[file]/route.ts |

## Liens morts / ancres a verifier

| Origine | Cible | Canal | Fichier | Diagnostic |
| --- | --- | --- | --- | --- |
| /dashboard/coach/npc | /auth/login | redirect | app/dashboard/coach/npc/page.tsx | route absente (/auth/login) |
| /dashboard/coach/npc/reports/[reportId] | /auth/login | redirect | app/dashboard/coach/npc/reports/[reportId]/page.tsx | route absente (/auth/login) |
| /dashboard/coach/npc/submissions/[submissionId]/upload | /auth/login | redirect | app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx | route absente (/auth/login) |
| /dashboard/eleve/npc | /auth/login | redirect | app/dashboard/eleve/npc/page.tsx | route absente (/auth/login) |
| /dashboard/eleve/ressources | /dashboard/eleve#resources | redirect | app/dashboard/eleve/ressources/page.tsx | ancre absente #resources (/dashboard/eleve#resources) |
| /dashboard/parent/npc | /auth/login | redirect | app/dashboard/parent/npc/page.tsx | route absente (/auth/login) |
| /dashboard/trajectoire | /dashboard/eleve#trajectory | redirect | app/dashboard/trajectoire/page.tsx | ancre absente #trajectory (/dashboard/eleve#trajectory) |
| /stages | #reservation | CTA | app/stages/_components/StagesHeader.tsx | ancre absente #reservation (/stages#reservation) |
| shared | /dashboard/eleve#aria | nav | components/navigation/navigation-config.ts | ancre absente #aria (/dashboard/eleve#aria) |
| shared | /dashboard/eleve#programme-maths | nav | components/navigation/navigation-config.ts | ancre absente #programme-maths (/dashboard/eleve#programme-maths) |
| shared | /dashboard/eleve#resources | nav | components/navigation/navigation-config.ts | ancre absente #resources (/dashboard/eleve#resources) |
| shared | /dashboard/eleve#survival | contextuel | lib/dashboard/student-payload.ts | ancre absente #survival (/dashboard/eleve#survival) |
| shared | #contact | contextuel | components/sections/korrigo-showcase.tsx | ancre absente #contact (/#contact) |
| shared | #etablissements | contextuel | components/sections/problem-solution-section.tsx | ancre absente #etablissements (/#etablissements) |
| shared | #formation_tech | contextuel | components/sections/problem-solution-section.tsx | ancre absente #formation_tech (/#formation_tech) |
| shared | #methodologie | contextuel | components/sections/home-hero.tsx | ancre absente #methodologie (/#methodologie) |
| shared | #parents_eleves | contextuel | components/sections/problem-solution-section.tsx | ancre absente #parents_eleves (/#parents_eleves) |

## Orphelines publiques

| Route | Entrants | Sitemap | Classement | Justification |
| --- | --- | --- | --- | --- |
| /access-required | 0 | non | a relier ou noindex | Page technique d’acces requis, hors sitemap; verifier si elle doit rester publique. |
| /bilan-gratuit/assessment | 0 | non | a relier ou noindex | Ancien tunnel assessment hors sitemap; clarifier son entree ou son retrait. |
| /bilan-pallier2-maths/confirmation | 0 | non | a relier ou noindex | Confirmation technique hors sitemap; entree indirecte via formulaire, a documenter/noindex. |
| /candidat-libre-bac-francais | 1 | oui | SEO-landing volontaire | Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations. |
| /conditions | 0 | non | alias redirect | Alias applicatif vers /conditions-generales; aucun lien interne ne devrait viser l’alias. |
| /corrige_dnb_maths_2026 | 0 | oui | a relier ou renommer | Route snake_case au sitemap, aucun lien entrant public stable detecte; decision Shark requise. |
| /grand-oral | 1 | oui | SEO-landing volontaire | Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations. |
| /maths-1ere | 0 | non | alias redirect | Alias applicatif vers /programme/maths-1ere; aucun lien interne ne devrait viser l’alias. |
| /notre-centre | 2 | oui | a relier | Page publique sitemappee mais seulement contextuelle; verifier son role vs /contact. |
| /preparation-bac-francais-tunis | 2 | oui | SEO-landing volontaire | Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations. |
| /programme/maths-1ere-stmg | 0 | non | a relier ou noindex | Page programme publique hors sitemap sans maillage detecte. |
| /programme/maths-terminale | 0 | non | a relier ou noindex | Page programme publique hors sitemap sans maillage detecte. |
| /ressources | 1 | oui | a relier | Page publique sitemappee, faible maillage observe; clarifier hub ressources ou retrait. |
| /reussir-eaf | 1 | oui | SEO-landing volontaire | Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations. |

## Routes publiques surveillees

| Route | Entrants | Sitemap | Statut |
| --- | --- | --- | --- |
| /notre-centre | 2 | oui | a relier |
| /ressources | 1 | oui | a relier |
| /accompagnement-scolaire | 3 | oui | reliee |
| /plateforme-aria | 4 | oui | reliee |
| /grand-oral | 1 | oui | SEO-landing volontaire |
| /reussir-eaf | 1 | oui | SEO-landing volontaire |
| /candidat-libre-bac-francais | 1 | oui | SEO-landing volontaire |
| /preparation-bac-francais-tunis | 2 | oui | SEO-landing volontaire |
| /corrige_dnb_maths_2026 | 0 | oui | a relier ou renommer |

## Alias et redirects

| Source | Destination | Type | Fichier |
| --- | --- | --- | --- |
| /academies-hiver | /stages | 301 permanent | next.config.mjs |
| /admin/directeur | /dashboard | 307 temporaire | app/admin/directeur/page.tsx |
| /admin/directeur | /dashboard | 307 temporaire | app/admin/directeur/page.tsx |
| /assessments/[id]/processing | / | 307 temporaire | app/assessments/[id]/processing/page.tsx |
| /assessments/[id]/result | / | 307 temporaire | app/assessments/[id]/result/page.tsx |
| /assessments/[id]/result | /dashboard | 307 temporaire | app/assessments/[id]/result/page.tsx |
| /auth/activate | /auth/signin | 307 temporaire | app/auth/activate/page.tsx |
| /auth/activate | /auth/signin?activated=true | 307 temporaire | app/auth/activate/page.tsx |
| /auth/activate | /auth/signin?activated=true | 307 temporaire | app/auth/activate/page.tsx |
| /auth/activate | /dashboard/eleve/stages | 307 temporaire | app/auth/activate/page.tsx |
| /bilan-gratuit | /bilan-gratuit/confirmation | 307 temporaire | app/bilan-gratuit/BilanStrategiqueClient.tsx |
| /catalogue-nexus-reussite-2026-2027.html | /offres | 301 permanent | next.config.mjs |
| /conditions | /conditions-generales | 307 temporaire | app/conditions/page.tsx |
| /confidentialite.html | /politique-confidentialite | 301 permanent | next.config.mjs |
| /dashboard | /auth/signin | 307 temporaire | app/dashboard/page.tsx |
| /dashboard | /auth/signin | 307 temporaire | app/dashboard/page.tsx |
| /dashboard | /dashboard/admin | 307 temporaire | app/dashboard/page.tsx |
| /dashboard | /dashboard/assistante | 307 temporaire | app/dashboard/page.tsx |
| /dashboard | /dashboard/coach | 307 temporaire | app/dashboard/page.tsx |
| /dashboard | /dashboard/eleve | 307 temporaire | app/dashboard/page.tsx |
| /dashboard | /dashboard/parent | 307 temporaire | app/dashboard/page.tsx |
| /dashboard/admin | /auth/signin | 307 temporaire | app/dashboard/admin/page.tsx |
| /dashboard/admin/activities | /auth/signin | 307 temporaire | app/dashboard/admin/activities/page.tsx |
| /dashboard/admin/analytics | /auth/signin | 307 temporaire | app/dashboard/admin/analytics/page.tsx |
| /dashboard/admin/documents | /dashboard | 307 temporaire | app/dashboard/admin/documents/page.tsx |
| /dashboard/admin/stages | /auth/signin | 307 temporaire | app/dashboard/admin/stages/page.tsx |
| /dashboard/admin/subscriptions | /auth/signin | 307 temporaire | app/dashboard/admin/subscriptions/page.tsx |
| /dashboard/admin/users | /auth/signin | 307 temporaire | app/dashboard/admin/users/page.tsx |
| /dashboard/assistante | /auth/signin | 307 temporaire | app/dashboard/assistante/page.tsx |
| /dashboard/assistante/assignments | /auth/signin | 307 temporaire | app/dashboard/assistante/assignments/page.tsx |
| /dashboard/assistante/assignments | /dashboard | 307 temporaire | app/dashboard/assistante/assignments/page.tsx |
| /dashboard/assistante/assignments | /dashboard/assistante/assignments | 307 temporaire | app/dashboard/assistante/assignments/page.tsx |
| /dashboard/assistante/coaches | /auth/signin | 307 temporaire | app/dashboard/assistante/coaches/page.tsx |
| /dashboard/assistante/credit-requests | /auth/signin | 307 temporaire | app/dashboard/assistante/credit-requests/page.tsx |
| /dashboard/assistante/credits | /auth/signin | 307 temporaire | app/dashboard/assistante/credits/page.tsx |
| /dashboard/assistante/devis | /auth/signin?callbackUrl=/dashboard/assistante/devis | 307 temporaire | app/dashboard/assistante/devis/page.tsx |
| /dashboard/assistante/devis | /dashboard | 307 temporaire | app/dashboard/assistante/devis/page.tsx |
| /dashboard/assistante/docs | /auth/signin | 307 temporaire | app/dashboard/assistante/docs/page.tsx |
| /dashboard/assistante/docs | /dashboard | 307 temporaire | app/dashboard/assistante/docs/page.tsx |
| /dashboard/assistante/facturation | /auth/signin | 307 temporaire | app/dashboard/assistante/facturation/page.tsx |
| /dashboard/assistante/paiements | /auth/signin | 307 temporaire | app/dashboard/assistante/paiements/page.tsx |
| /dashboard/assistante/stages/planning | /auth/signin | 307 temporaire | app/dashboard/assistante/stages/planning/page.tsx |
| /dashboard/assistante/stages/planning | /dashboard | 307 temporaire | app/dashboard/assistante/stages/planning/page.tsx |
| /dashboard/assistante/students | /auth/signin | 307 temporaire | app/dashboard/assistante/students/page.tsx |
| /dashboard/assistante/students/[studentId] | /auth/signin | 307 temporaire | app/dashboard/assistante/students/[studentId]/page.tsx |
| /dashboard/assistante/subscriptions | /auth/signin | 307 temporaire | app/dashboard/assistante/subscriptions/page.tsx |
| /dashboard/assistante/subscriptions | /dashboard/assistante/subscriptions | 307 temporaire | app/dashboard/assistante/subscriptions/page.tsx |
| /dashboard/coach | /auth/signin | 307 temporaire | app/dashboard/coach/page.tsx |
| /dashboard/coach | /dashboard/coach/eaf-stage-printemps | 307 temporaire | app/dashboard/coach/page.tsx |
| /dashboard/coach | /dashboard/coach/maths-premiere-stage-printemps | 307 temporaire | app/dashboard/coach/page.tsx |
| /dashboard/coach/availability | /auth/signin | 307 temporaire | app/dashboard/coach/availability/page.tsx |
| /dashboard/coach/eaf-stage-printemps | /auth/signin | 307 temporaire | app/dashboard/coach/eaf-stage-printemps/page.tsx |
| /dashboard/coach/eaf-stage-printemps/[studentId] | /auth/signin | 307 temporaire | app/dashboard/coach/eaf-stage-printemps/[studentId]/page.tsx |
| /dashboard/coach/eaf-stage-printemps/[studentId] | /dashboard/coach/eaf-stage-printemps | 307 temporaire | app/dashboard/coach/eaf-stage-printemps/[studentId]/page.tsx |
| /dashboard/coach/eleve/[studentId] | /auth/signin | 307 temporaire | app/dashboard/coach/eleve/[studentId]/page.tsx |
| /dashboard/coach/eleve/[studentId] | /dashboard/coach | 307 temporaire | app/dashboard/coach/eleve/[studentId]/page.tsx |
| /dashboard/coach/maths-premiere-stage-printemps | /auth/signin | 307 temporaire | app/dashboard/coach/maths-premiere-stage-printemps/page.tsx |
| /dashboard/coach/maths-premiere-stage-printemps/[studentId] | /auth/signin | 307 temporaire | app/dashboard/coach/maths-premiere-stage-printemps/[studentId]/page.tsx |
| /dashboard/coach/maths-premiere-stage-printemps/[studentId] | /dashboard/coach/maths-premiere-stage-printemps | 307 temporaire | app/dashboard/coach/maths-premiere-stage-printemps/[studentId]/page.tsx |
| /dashboard/coach/npc | /auth/login | 307 temporaire | app/dashboard/coach/npc/page.tsx |
| /dashboard/coach/npc | /dashboard | 307 temporaire | app/dashboard/coach/npc/page.tsx |
| /dashboard/coach/npc/reports/[reportId] | /auth/login | 307 temporaire | app/dashboard/coach/npc/reports/[reportId]/page.tsx |
| /dashboard/coach/npc/reports/[reportId] | /dashboard | 307 temporaire | app/dashboard/coach/npc/reports/[reportId]/page.tsx |
| /dashboard/coach/npc/reports/[reportId] | /dashboard/coach/npc | 307 temporaire | app/dashboard/coach/npc/reports/[reportId]/page.tsx |
| /dashboard/coach/npc/reports/[reportId] | /dashboard/coach/npc | 307 temporaire | app/dashboard/coach/npc/reports/[reportId]/page.tsx |
| /dashboard/coach/npc/submissions/[submissionId]/upload | /auth/login | 307 temporaire | app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx |
| /dashboard/coach/npc/submissions/[submissionId]/upload | /dashboard | 307 temporaire | app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx |
| /dashboard/coach/npc/submissions/[submissionId]/upload | /dashboard/coach/npc | 307 temporaire | app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx |
| /dashboard/coach/npc/submissions/[submissionId]/upload | /dashboard/coach/npc | 307 temporaire | app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx |
| /dashboard/coach/nsi-pratique-2026 | /auth/signin | 307 temporaire | app/dashboard/coach/nsi-pratique-2026/page.tsx |
| /dashboard/coach/nsi-pratique-2026/[studentId] | /auth/signin | 307 temporaire | app/dashboard/coach/nsi-pratique-2026/[studentId]/page.tsx |
| /dashboard/coach/sessions | /auth/signin | 307 temporaire | app/dashboard/coach/sessions/page.tsx |
| /dashboard/coach/stages/[stageSlug]/bilan/[studentId] | /auth/signin | 307 temporaire | app/dashboard/coach/stages/[stageSlug]/bilan/[studentId]/page.tsx |
| /dashboard/coach/stages/[stageSlug]/bilan/[studentId] | /dashboard | 307 temporaire | app/dashboard/coach/stages/[stageSlug]/bilan/[studentId]/page.tsx |
| /dashboard/coach/students | /auth/signin | 307 temporaire | app/dashboard/coach/students/page.tsx |
| /dashboard/eleve | /auth/signin | 307 temporaire | app/dashboard/eleve/page.tsx |
| /dashboard/eleve/automatismes | /auth/signin?callbackUrl=/dashboard/eleve/automatismes | 307 temporaire | app/dashboard/eleve/automatismes/layout.tsx |
| /dashboard/eleve/automatismes | /dashboard | 307 temporaire | app/dashboard/eleve/automatismes/layout.tsx |
| /dashboard/eleve/automatismes | /dashboard/eleve | 307 temporaire | app/dashboard/eleve/automatismes/page.tsx |
| /dashboard/eleve/bilans/[publicShareId] | /auth/signin | 307 temporaire | app/dashboard/eleve/bilans/[publicShareId]/page.tsx |
| /dashboard/eleve/documents | /auth/signin | 307 temporaire | app/dashboard/eleve/documents/page.tsx |
| /dashboard/eleve/documents | /dashboard | 307 temporaire | app/dashboard/eleve/documents/page.tsx |
| /dashboard/eleve/eam | /auth/signin?callbackUrl=/dashboard/eleve/eam | 307 temporaire | app/dashboard/eleve/eam/page.tsx |
| /dashboard/eleve/npc | /auth/login | 307 temporaire | app/dashboard/eleve/npc/page.tsx |
| /dashboard/eleve/npc | /dashboard | 307 temporaire | app/dashboard/eleve/npc/page.tsx |
| /dashboard/eleve/nsi-pratique-2026 | /auth/signin | 307 temporaire | app/dashboard/eleve/nsi-pratique-2026/page.tsx |
| /dashboard/eleve/programme/[subject] | /auth/signin?callbackUrl=/dashboard/eleve | 307 temporaire | app/dashboard/eleve/programme/[subject]/page.tsx |
| /dashboard/eleve/programme/[subject] | /dashboard | 307 temporaire | app/dashboard/eleve/programme/[subject]/page.tsx |
| /dashboard/eleve/programme/[subject] | /dashboard/eleve | 307 temporaire | app/dashboard/eleve/programme/[subject]/page.tsx |
| /dashboard/eleve/programme/maths | /auth/signin?callbackUrl=/dashboard/eleve/programme/maths | 307 temporaire | app/dashboard/eleve/programme/maths/page.tsx |
| /dashboard/eleve/programme/maths | /dashboard | 307 temporaire | app/dashboard/eleve/programme/maths/page.tsx |
| /dashboard/eleve/programme/maths | /dashboard/eleve | 307 temporaire | app/dashboard/eleve/programme/maths/page.tsx |
| /dashboard/eleve/ressources | /dashboard/eleve#resources | 307 temporaire | app/dashboard/eleve/ressources/page.tsx |
| /dashboard/eleve/sessions | /dashboard/eleve#sessions | 307 temporaire | app/dashboard/eleve/sessions/page.tsx |
| /dashboard/eleve/stage-eam-stmg | /auth/signin?callbackUrl=/dashboard/eleve/stage-eam-stmg | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/page.tsx |
| /dashboard/eleve/stage-eam-stmg | /dashboard | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/page.tsx |
| /dashboard/eleve/stage-eam-stmg | /dashboard/eleve | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/page.tsx |
| /dashboard/eleve/stage-eam-stmg/diagnostic | /auth/signin?callbackUrl=/dashboard/eleve/stage-eam-stmg/diagnostic | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/diagnostic/page.tsx |
| /dashboard/eleve/stage-eam-stmg/diagnostic | /dashboard | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/diagnostic/page.tsx |
| /dashboard/eleve/stage-eam-stmg/diagnostic | /dashboard/eleve | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/diagnostic/page.tsx |
| /dashboard/eleve/stage-eam-stmg/livret | /auth/signin?callbackUrl=/dashboard/eleve/stage-eam-stmg/livret | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/livret/page.tsx |
| /dashboard/eleve/stage-eam-stmg/livret | /dashboard | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/livret/page.tsx |
| /dashboard/eleve/stage-eam-stmg/livret | /dashboard/eleve | 307 temporaire | app/dashboard/eleve/stage-eam-stmg/livret/page.tsx |
| /dashboard/eleve/stages | /auth/signin | 307 temporaire | app/dashboard/eleve/stages/page.tsx |
| /dashboard/parent | /auth/signin | 307 temporaire | app/dashboard/parent/page.tsx |
| /dashboard/parent/abonnements | /auth/signin | 307 temporaire | app/dashboard/parent/abonnements/page.tsx |
| /dashboard/parent/children | /dashboard/parent | 307 temporaire | app/dashboard/parent/children/page.tsx |
| /dashboard/parent/enfant/[studentId] | /auth/signin | 307 temporaire | app/dashboard/parent/enfant/[studentId]/page.tsx |
| /dashboard/parent/enfant/[studentId] | /dashboard/parent | 307 temporaire | app/dashboard/parent/enfant/[studentId]/page.tsx |
| /dashboard/parent/factures | /auth/signin | 307 temporaire | app/dashboard/parent/factures/page.tsx |
| /dashboard/parent/factures | /dashboard | 307 temporaire | app/dashboard/parent/factures/page.tsx |
| /dashboard/parent/npc | /auth/login | 307 temporaire | app/dashboard/parent/npc/page.tsx |
| /dashboard/parent/npc | /dashboard/parent | 307 temporaire | app/dashboard/parent/npc/page.tsx |
| /dashboard/parent/paiement | /auth/signin | 307 temporaire | app/dashboard/parent/paiement/page.tsx |
| /dashboard/parent/paiement | /dashboard/parent/abonnements | 307 temporaire | app/dashboard/parent/paiement/page.tsx |
| /dashboard/parent/ressources | /auth/signin | 307 temporaire | app/dashboard/parent/ressources/page.tsx |
| /dashboard/parent/stages | /auth/signin | 307 temporaire | app/dashboard/parent/stages/page.tsx |
| /dashboard/trajectoire | /dashboard/eleve#trajectory | 307 temporaire | app/dashboard/trajectoire/page.tsx |
| /education | /accompagnement-scolaire | 301 permanent | next.config.mjs |
| /inscription | /bilan-gratuit | 307 temporaire | next.config.mjs |
| /maths-1ere | /programme/maths-1ere | 307 temporaire | app/maths-1ere/page.tsx |
| /mentions-legales.html | /mentions-legales | 301 permanent | next.config.mjs |
| /nexus_selecteur.html | /recommandation | 301 permanent | next.config.mjs |
| /plateforme | /plateforme-aria | 301 permanent | next.config.mjs |
| /programme/maths-1ere | /dashboard/eleve/programme/maths | 307 temporaire | app/programme/maths-1ere/page.tsx |
| /programme/maths-1ere | /offres | 307 temporaire | app/programme/maths-1ere/page.tsx |
| /programme/maths-1ere-stmg | /dashboard/eleve/programme/maths | 307 temporaire | app/programme/maths-1ere-stmg/page.tsx |
| /questionnaire | /bilan-gratuit | 307 temporaire | next.config.mjs |
| /session/video | /auth/signin | 307 temporaire | app/session/video/page.tsx |
| /tarifs | /offres | 307 temporaire | next.config.mjs |

## Sitemap / routes / noindex

- Routes sitemap statiques detectees: /, /accompagnement-scolaire, /bilan-gratuit, /candidat-libre-bac-francais, /conditions-generales, /contact, /corrige_dnb_maths_2026, /equipe, /famille, /grand-oral, /mentions-legales, /notre-centre, /offres, /plateforme-aria, /politique-confidentialite, /preparation-bac-francais-tunis, /programme/maths-1ere, /recommandation, /ressources, /reussir-eaf, /stages, /stages/[dynamic], /stages/[dynamic]/inscription
- Routes privees au sitemap: aucune
- Entrees sitemap sans route statique locale: aucune
- Pages publiques hors sitemap: /access-required, /bilan-gratuit/assessment, /bilan-gratuit/confirmation, /bilan-pallier2-maths, /bilan-pallier2-maths/confirmation, /bilan-pallier2-maths/dashboard, /conditions, /dashboard/trajectoire, /lamis, /maths-1ere, /programme/maths-1ere-stmg, /programme/maths-terminale
- Pages privees sans metadata noindex locale: /admin/directeur, /assessments/[id]/processing, /assessments/[id]/result, /dashboard, /dashboard/admin, /dashboard/admin/activities, /dashboard/admin/analytics, /dashboard/admin/documents, /dashboard/admin/facturation, /dashboard/admin/stages, /dashboard/admin/subscriptions, /dashboard/admin/tests, /dashboard/admin/users, /dashboard/assistante, /dashboard/assistante/assignments, /dashboard/assistante/coaches, /dashboard/assistante/credit-requests, /dashboard/assistante/credits, /dashboard/assistante/docs, /dashboard/assistante/facturation, /dashboard/assistante/paiements, /dashboard/assistante/planning, /dashboard/assistante/stages, /dashboard/assistante/stages/planning, /dashboard/assistante/students, /dashboard/assistante/students/[studentId], /dashboard/assistante/subscription-requests, /dashboard/assistante/subscriptions, /dashboard/coach, /dashboard/coach/availability, /dashboard/coach/eaf-stage-printemps, /dashboard/coach/eaf-stage-printemps/[studentId], /dashboard/coach/eleve/[studentId], /dashboard/coach/maths-premiere-stage-printemps, /dashboard/coach/maths-premiere-stage-printemps/[studentId], /dashboard/coach/npc, /dashboard/coach/npc/reports/[reportId], /dashboard/coach/npc/submissions/[submissionId]/upload, /dashboard/coach/nsi-pratique-2026, /dashboard/coach/nsi-pratique-2026/[studentId], /dashboard/coach/sessions, /dashboard/coach/stages, /dashboard/coach/stages/[stageSlug]/bilan/[studentId], /dashboard/coach/students, /dashboard/eleve, /dashboard/eleve/automatismes, /dashboard/eleve/bilans/[publicShareId], /dashboard/eleve/documents, /dashboard/eleve/eam, /dashboard/eleve/npc, /dashboard/eleve/nsi-pratique-2026, /dashboard/eleve/programme/[subject], /dashboard/eleve/programme/maths, /dashboard/eleve/questionnaires/eaf-stage-printemps, /dashboard/eleve/questionnaires/maths-premiere-stage-printemps, /dashboard/eleve/ressources, /dashboard/eleve/sessions, /dashboard/eleve/stage-eam-stmg, /dashboard/eleve/stage-eam-stmg/diagnostic, /dashboard/eleve/stage-eam-stmg/livret, /dashboard/eleve/stages, /dashboard/parent, /dashboard/parent/abonnements, /dashboard/parent/children, /dashboard/parent/enfant/[studentId], /dashboard/parent/factures, /dashboard/parent/npc, /dashboard/parent/paiement, /dashboard/parent/paiement/confirmation, /dashboard/parent/ressources, /dashboard/parent/stages, /session/video

## Frontieres server/client publiques

| Route | Fichier | Statut |
| --- | --- | --- |
| /accompagnement-scolaire | app/accompagnement-scolaire/page.tsx | candidate server component |
| /bilan-gratuit/assessment | app/bilan-gratuit/assessment/page.tsx | justifiee par interactivite actuelle |
| /bilan-pallier2-maths | app/bilan-pallier2-maths/page.tsx | justifiee par interactivite actuelle |
| /bilan-pallier2-maths/confirmation | app/bilan-pallier2-maths/confirmation/page.tsx | justifiee par interactivite actuelle |
| /bilan-pallier2-maths/dashboard | app/bilan-pallier2-maths/dashboard/page.tsx | justifiee par interactivite actuelle |
| /bilan-pallier2-maths/resultat/[id] | app/bilan-pallier2-maths/resultat/[id]/page.tsx | justifiee par interactivite actuelle |
| /contact | app/contact/page.tsx | justifiee par interactivite actuelle |
| /equipe | app/equipe/page.tsx | justifiee par interactivite actuelle |
| /notre-centre | app/notre-centre/page.tsx | candidate server component |
| /offres | app/offres/page.tsx | priorite audit: page SEO majeure en client, candidate a repasser server par extraction des interactions |
| /plateforme-aria | app/plateforme-aria/page.tsx | candidate server component |

## Cohérence métier

- Offres/produits canonical couverts par /offres: oui, ancres construites depuis les ids canonical.
- Parcours accueil -> offres -> bilan -> paiement: /:present, /offres:present, /bilan-gratuit:present, /api/payments/clictopay/init:present.
- Dashboards par role: admin:9, assistante:18, coach:16, parent:10, eleve:17, directeur:1.
- Vocabulaire gammes legacy: couvert par brand-trust-guard; Odyssée/Cortex/Académies/Studio Flex restent interdits hors allowlist.

## Hygiene source

- ROADMAP.md present au root (non suivi si git status le confirme); a classer avant prochain lot.
- edition_id hors canonical/tests: app/offres/page.tsx, lib/pricing.ts.

## Anomalies prioritaires

### P1 nav

- 17 lien(s)/ancre(s) internes a verifier (voir section liens morts).

### P2 incoherence

- /corrige_dnb_maths_2026 est snake_case, au sitemap et a relier/renommer/retirer sur decision Shark.
- /offres est une page publique SEO en "use client"; extraction server recommandee avant optimisation SEO/perf.
- 72 page(s) privees sans metadata noindex locale; robots.txt les bloque mais le noindex explicite reste a harmoniser.

### P3 hygiene

- edition_id hors canonical limite a: app/offres/page.tsx, lib/pricing.ts.
- ROADMAP.md present au root (non suivi si git status le confirme); a classer avant prochain lot.
- Decisions Shark ouvertes: charte cible, Carte Nexus, tutoiement eleve, sort des orphelines.

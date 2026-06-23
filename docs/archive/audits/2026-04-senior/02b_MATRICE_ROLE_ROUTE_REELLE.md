# Matrice rôle × route réelle — AXE 2

> Source de vérité : `middleware.ts` (pages) + `lib/guards.ts` + gardes inline (API).
> Date : 2026-04-19. ✓ = accès autorisé. ✗ = bloqué (code indiqué). ⚠ = accès page mais API bloquée.

---

## Pages protégées

| Route | non-auth | ELEVE | PARENT | COACH | ASSISTANTE | ADMIN | Mode d'échec | Preuve |
|-------|----------|-------|--------|-------|-----------|-------|-------------|--------|
| `/dashboard` | ✗ → signin | ✓ | ✓ | ✓ | ✓ | ✓ | redirect `/auth/signin?callbackUrl=` | `middleware.ts` L21-25 |
| `/dashboard/eleve` | ✗ → signin | ✓ | ✗ → `/dashboard/parent` | ✗ → `/dashboard/coach` | ✗ → `/dashboard/assistante` | ✗ → `/dashboard/admin` | redirect vers `rolePrefixMap[role]` | `middleware.ts` L48-50 |
| `/dashboard/parent` | ✗ → signin | ✗ | ✓ | ✗ | ✗ | ✗ | idem | idem |
| `/dashboard/coach` | ✗ → signin | ✗ | ✗ | ✓ | ✗ | ✗ | idem | idem |
| `/dashboard/assistante` | ✗ → signin | ✗ | ✗ | ✗ | ✓ | ✗ | idem | idem |
| `/dashboard/admin` | ✗ → signin | ✗ | ✗ | ✗ | ✗ | ✓ | idem | idem |
| `/dashboard/trajectoire` | ✗ → signin | ✓ | ✓ | ⚠ API 403 | ✓ | ✓ | redirect signin / API 403 COACH | `middleware.ts` L46 + `trajectory/route.ts` L34 |
| `/admin/directeur` | ✗ → signin | ✗ → `/dashboard/eleve` | ✗ → `/dashboard/parent` | ✗ → `/dashboard/coach` | ✗ → `/dashboard/assistante` | ✓ | redirect `rolePrefixMap[role]` | `middleware.ts` L38-41 |
| `/admin/stages/fevrier-2026` | ✗ → signin | ✗ | ✗ | ✗ | ✗ | ✓ | idem | idem |

---

## API routes — admin

| Endpoint | Méthodes | ELEVE | PARENT | COACH | ASSISTANTE | ADMIN | Garde | Conforme `lib/guards.ts` |
|----------|---------|-------|--------|-------|-----------|-------|-------|------------------------|
| `/api/admin/dashboard` | GET | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | ✓ oui |
| `/api/admin/analytics` | GET | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | ✓ oui |
| `/api/admin/activities` | GET | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | ✓ oui |
| `/api/admin/users` | GET/POST/PATCH/DELETE | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | ✓ oui |
| `/api/admin/users/search` | GET | 403 | 403 | 403 | ✓ | ✓ | `requireAnyRole([ADMIN,ASSISTANTE])` | ✓ oui |
| `/api/admin/subscriptions` | GET | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | ✓ oui |
| `/api/admin/stages` | GET | 403 | 403 | 403 | ✓ | ✓ | `requireAnyRole` (à confirmer) | à vérifier |
| `/api/admin/test-email` | POST | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | ✓ oui |
| `/api/admin/recompute-ssn` | POST | 403 | 403 | 403 | 403 | ✓ | inline ADMIN | **✗ non** |
| `/api/admin/directeur/stats` | GET | 403 | 403 | 403 | 403 | ✓ | inline ADMIN | **✗ non** |
| `/api/admin/invoices` | GET/POST | 403 | 403 | 403 | ✓ | ✓ | inline ADMIN+ASSISTANTE | **✗ non** |
| `/api/admin/invoices/[id]` | PATCH | 403 | 403 | 403 | ✓ | ✓ | inline `canPerformStatusAction()` | **✗ non** |
| `/api/admin/invoices/[id]/send` | POST | 403 | 403 | 403 | ✓ | ✓ | inline `canPerformStatusAction()` | **✗ non** |

---

## API routes — étudiant/trajectoire

| Endpoint | ELEVE | PARENT | COACH | ASSISTANTE | ADMIN | Garde | Note |
|----------|-------|--------|-------|-----------|-------|-------|------|
| `/api/student/trajectory` | ✓ (propre) | ✓ (enfant) | **403** | ✓ (studentId requis) | ✓ (studentId requis) | inline allowlist | COACH non prévu |
| `/api/student/dashboard` | ✓ | à vérifier | 403 | à vérifier | à vérifier | à vérifier | — |
| `/api/student/sessions` | ✓ | 403 | 403 | à vérifier | à vérifier | à vérifier | — |
| `/api/student/credits` | ✓ | 403 | 403 | à vérifier | à vérifier | à vérifier | — |

---

## Résumé des anomalies RBAC de surface

| # | Anomalie | Sévérité | Route(s) concernée(s) |
|---|----------|---------|----------------------|
| 1 | COACH accède à `/dashboard/trajectoire` mais reçoit API 403 | P1 | `middleware.ts` L46 + `trajectory/route.ts` L34 |
| 2 | 6 routes API admin utilisent inline `auth()` sans `requireRole` typé | P1 | invoices*, recompute-ssn, directeur/stats, trajectory |
| 3 | `app/dashboard/page.tsx` double la logique de dispatch du middleware | P2 | `middleware.ts` L29-51 + `dashboard/page.tsx` L21-38 |
| 4 | `backLink` de `/dashboard/trajectoire` incorrect pour ADMIN/ASSISTANTE/COACH | P2 | `dashboard/trajectoire/page.tsx` L90 |
| 5 | `/admin/directeur` hors layout dashboard, retour pointe vers `/dashboard` générique | P2 | `admin/directeur/page.tsx` L355 |
| 6 | 3 endpoints `/api/admin/invoices*` sans tests de couverture | P2 | `docs/31_RBAC_MATRICE.md` section audit P0 |

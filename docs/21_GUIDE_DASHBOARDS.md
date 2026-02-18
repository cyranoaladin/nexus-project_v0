# Guide Dashboards

## Vue d’ensemble
```mermaid
flowchart LR
  D[/dashboard] --> P[/dashboard/parent]
  D --> E[/dashboard/eleve]
  D --> C[/dashboard/coach]
  D --> A[/dashboard/assistante]
  D --> AD[/dashboard/admin]
```

Preuves code:
- `app/dashboard/page.tsx` (switch rôle)
- `middleware.ts` (`roleRouteMap`)

## Parent
- Page: `/dashboard/parent`.
- Widgets: agenda enfant, progression, abonnement/facturation, réservation.
- APIs consommées: `/api/parent/dashboard`, `/api/sessions/book`, `/api/parent/subscriptions`, `/api/payments/*`.
- Restriction: redirection si `session.user.role !== 'PARENT'`.

Preuves code:
- `app/dashboard/parent/page.tsx`
- `app/api/parent/dashboard/route.ts`

## Élève
- Page: `/dashboard/eleve`.
- Widgets: sessions récentes, crédits, ARIA, accès ressources (`/dashboard/eleve/ressources`).
- APIs consommées: `/api/student/dashboard`, `/api/student/resources`, `/api/student/sessions`, `/api/aria/*`.
- Restriction: rôle `ELEVE` requis.

Preuves code:
- `app/dashboard/eleve/page.tsx`
- `app/api/student/dashboard/route.ts`
- `app/api/student/resources/route.ts`

## Coach
- Page: `/dashboard/coach`.
- Widgets: planning du jour, élèves, disponibilité, soumission rapport.
- APIs: `/api/coach/dashboard`, `/api/coaches/availability`, `/api/coach/sessions/[sessionId]/report`.

Preuves code:
- `app/dashboard/coach/page.tsx`
- `app/api/coach/dashboard/route.ts`

## Assistante
- Page: `/dashboard/assistante` + sous-pages opérationnelles.
- Page docs interne read-only: `/dashboard/assistante/docs` (également accessible par `ADMIN`).
- Widgets: tâches urgentes, demandes abonnement/crédits, gestion sessions.
- APIs: `/api/assistant/dashboard`, `/api/assistant/subscription-requests`, `/api/assistant/credit-requests`, `/api/assistant/subscriptions`.

Preuves code:
- `app/dashboard/assistante/page.tsx`
- `app/api/assistant/dashboard/route.ts`
- `app/dashboard/assistante/docs/page.tsx`

## Admin
- Page: `/dashboard/admin` + `/dashboard/admin/*`.
- Widgets: KPI utilisateurs/revenus/sessions, outils admin (users/subscriptions/analytics/tests/facturation).
- APIs sensibles: `/api/admin/*`.

Preuves code:
- `app/dashboard/admin/page.tsx`
- `app/api/admin/dashboard/route.ts`

## RBAC dashboard (règles runtime)
```mermaid
flowchart TD
  X[/dashboard/*] --> Y{token ?}
  Y -->|non| Z[/auth/signin]
  Y -->|oui| R{rolePrefixMap}
  R -->|ok| OK[autorisé]
  R -->|mauvais dashboard| REDIR[redirect vers dashboard du rôle]
  R -->|ADMIN| OVERRIDE[accès cross-dashboard]
```

Preuves code:
- `middleware.ts` (`authorized`, `rolePrefixMap`, override ADMIN)

> **ATTENTION**
> Les protections UI (`useSession`) existent, mais l’autorité finale reste côté API + middleware.

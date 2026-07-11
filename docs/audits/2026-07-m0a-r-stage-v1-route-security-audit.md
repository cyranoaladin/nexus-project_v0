# M0A-R — Audit de sécurité des routes Stage V1

> Date : 2026-07-11
> Branche : `feat/pre-rentree-2026-m0a-review`
> SHA base : `0d2206fe9`

## Résumé

30 routes Stage V1 identifiées et classifiées. Aucun P0 de sécurité dans le périmètre.

## Classification

| # | Route | Méthodes | Public | Guard | Zod | Scope | IDOR | Statut |
|---|-------|----------|--------|-------|-----|-------|------|--------|
| 1 | `/api/stages` | GET | Oui | Aucun | Oui | — | None | PUBLIC_BY_DESIGN |
| 2 | `/api/stages/[slug]` | GET | Oui | Aucun | Oui | — | None | PUBLIC_BY_DESIGN |
| 3 | `/api/stages/[slug]/inscrire` | POST | Oui | Rate limit | Oui | Email duplicate | Low | PUBLIC_BY_DESIGN |
| 4 | `/api/admin/stages` | GET, POST | Non | requireAnyRole(ADMIN, ASSISTANTE) | Oui | Admin-only | None | VERIFIED |
| 5 | `/api/admin/stages/[id]` | GET, PATCH, DELETE | Non | requireRole(ADMIN) | Oui | Admin-only | None | VERIFIED |
| 6 | `/api/admin/stages/[id]/coaches` | GET, POST, DELETE | Non | requireRole(ADMIN) | Oui | Admin-only | None | VERIFIED |
| 7 | `/api/admin/stages/[id]/sessions` | GET, POST | Non | requireAnyRole | Oui | Admin/Assistante | None | VERIFIED |
| 8 | `/api/admin/stages/[id]/sessions/[sessionId]` | PATCH, DELETE | Non | requireAnyRole | Oui | Admin/Assistante | None | VERIFIED |
| 9 | `/api/stages/[slug]/reservations` | GET | Non | requireAnyRole(ADMIN, ASSISTANTE) | Non | Staff-only | Low | VERIFIED_WITH_LIMITATION |
| 10 | `/api/stages/[slug]/reservations/[id]/confirm` | POST | Non | requireAnyRole | Oui | Reservation ID | Medium | VERIFIED_WITH_LIMITATION |
| 11 | `/api/stages/[slug]/bilans` | GET, POST | Non | requireAnyRole(COACH, ADMIN, ASSISTANTE) | Oui | stageCoach vérifié | Medium | VERIFIED_WITH_LIMITATION |
| 12 | `/api/reservation` | POST, GET, PATCH | Mixte | Rate limit (POST) / session (GET/PATCH) | Oui | Email+academyId | Low | VERIFIED_WITH_LIMITATION |
| 13 | `/api/reservation/verify` | POST | Oui | Aucun | Basique | — | None | PUBLIC_BY_DESIGN |
| 14 | `/api/student/stages` | GET | Non | requireRole(ELEVE) | Non | Email-scoped | Low | VERIFIED |
| 15 | `/api/student/sessions` | GET | Non | requireRole(ELEVE) | Non | userId-scoped | Low | VERIFIED |
| 16 | `/api/parent/stages` | GET | Non | requireRole(PARENT) | Non | Children email-scoped | Low | VERIFIED |
| 17 | `/api/coach/stages` | GET | Non | requireRole(COACH) | Non | Assignment-scoped | Medium | VERIFIED_WITH_LIMITATION |
| 18 | `/api/coach/eaf-stage-printemps/students` | GET | Non | requireRole(COACH) | Non | Assignment-scoped | Low | VERIFIED |
| 19 | `/api/coach/eaf-stage-printemps/students/[id]/report` | GET, POST, PATCH | Non | requireRole(COACH) | Oui | Assignment vérifié | Low | VERIFIED |
| 20 | `/api/coach/maths-premiere-stage-printemps/students` | GET | Non | requireRole(COACH) | Non | Assignment-scoped | Low | VERIFIED |
| 21 | `/api/assistante/stages` | GET | Non | requireAnyRole(ADMIN, ASSISTANTE) | Non | Staff-only | None | VERIFIED |
| 22 | `/api/eleve/stages` | GET | Non | requireRole(ELEVE) | Non | userId-scoped | Low | VERIFIED |
| 23 | `/api/sessions/book` | POST | Non | requireAnyRole(PARENT, ELEVE) | Oui | Parent→children / Self | Medium | VERIFIED_WITH_LIMITATION |
| 24 | `/api/sessions/cancel` | POST | Non | requireAnyRole | Oui | Ownership check | Low | VERIFIED |
| 25 | `/api/sessions/video` | POST | Non | Session + Rate limit | Oui | Multi-role participant | Low | VERIFIED |
| 26 | `/api/bilans` | GET, POST | Non | requireAnyRole | Oui | Coach own / Admin all | Medium | VERIFIED |
| 27 | `/api/bilans/[id]` | GET, PUT, DELETE | Non | requireAnyRole | Oui | buildBilanRead/WriteWhere | Low | VERIFIED |
| 28 | `/api/bilans/[id]/export` | GET, POST | Non | requireAnyRole | Oui | buildBilanRead/WriteWhere | Low | VERIFIED |
| 29 | `/api/bilans/generate` | POST, GET | Non | requireAnyRole | Oui | buildBilanWrite/ReadWhere | Low | VERIFIED |
| 30 | `/api/coach/sessions/[sessionId]/report` | GET, POST | Non | Session check | Oui | Coach ID verified | Low | VERIFIED |

## Limitations documentées (VERIFIED_WITH_LIMITATION)

| Route | Limitation | Risque | Phase cible |
|-------|-----------|--------|-------------|
| #9 Reservations GET | Pas de Zod sur GET | P2 — staff-only | POST-MERGE-CHORES `audit-per-method-guards` |
| #10 Confirm | Création de comptes via reservation ID | P2 — IDs non devinables (CUID) | M3 relation vérifiée |
| #11 Stage bilans | Coach voit tous les bilans du stage | P2 — design V1, assignment vérifié | V2 per-student ACL |
| #12 Reservation | PII dans Telegram (sanitized) | P2 — Telegram existant | Lot observabilité |
| #17 Coach stages | Coach voit tous les élèves du stage | P2 — design V1, assignment vérifié | V2 cohort scoping |
| #23 Session book | Parent→children via parentId | P2 — parentId vérifié en V1 | M3 relation M:N |

## Routes publiques

4 routes publiques (#1, #2, #3, #13) avec validation et/ou rate limit. Aucune n'expose de PII.

## Finance

Aucune route Stage V1 n'expose de données financières au coach ou à l'élève. ✅

## Conclusion

- 0 route sensible non classée
- 0 P0 dans le périmètre Stage V1
- 6 limitations documentées (toutes P2, avec gate ou phase cible)
- Aucune régression V1 requise

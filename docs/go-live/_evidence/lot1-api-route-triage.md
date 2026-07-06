# Lot 1 — Triage routes API

Date locale : 2026-07-02.

## Synthèse avant/après

| Source | P0 | P1 | P2 | OK | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lot 0-bis | 44 | 42 | 62 | 28 | 176 |
| Lot 1 après régénération | 0 | 56 | 93 | 27 | 176 |

## P0 fermés par correction de code

- Documents : `/api/documents/[id]`, `/api/coach/students/[studentId]/documents`, `/api/student/documents/[id]/download`.
- Factures PDF : `/api/invoices/[id]/pdf`, `/api/invoices/[id]/receipt/pdf`.
- Activation élève : `/api/student/activate`.
- Lamis teacher report : `/api/lamis/teacher-report`.

## P0 requalifiés par preuve existante

- Routes coach avec assignation : `assertCoachCanAccessStudent`, contrôle `sessionBooking.coachId`, contrôle stage coach.
- Routes stage staff-only : `requireAnyRole(['ADMIN', 'ASSISTANTE'])`.
- ClicToPay webhook : `501` tant que non configuré, signature HMAC si secret présent.
- Documents publics fixes : PDF public statique, sans donnée mineur propriétaire.

## P1 prioritaires restants

La liste exploitable est dans `docs/go-live/api-security-matrix.full.md`, section `Top 20 à corriger en priorité (P1)`.

## Limites

La matrice reste une lecture statique. Les P1 ne sont pas déclarés go-live ready ; ils sont seulement sortis du niveau P0 après preuve de guard, requalification de domaine ou correction ciblée.

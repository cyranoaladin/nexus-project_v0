# P0-004 Lot 2B — Admin users / Assistante students-coaches

Date : 2026-05-28

Ce document cadre le prochain sous-lot P0-004 après le déploiement production du Lot 2A. Il ne contient aucune correction applicative.

## Verdict de cadrage

Le Lot 2B doit auditer et corriger les routes capables d'exposer ou modifier des comptes, rôles, activations, données mineurs, relations parent/enfant, profils coachs et affectations. Le go-live large reste non autorisé tant que ce lot et les lots P0-004 restants ne sont pas triés.

## Tableau préparatoire

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership attendu | Risque | Priorité |
|---|---|---|---|---|---|---|---|
| Admin users | `app/api/admin/users/route.ts` | À confirmer | Comptes, rôles, statuts, activation | À lire | Admin-only strict | Escalade rôle, modification compte | P0-A |
| Admin users search | `app/api/admin/users/search/route.ts` | À confirmer | Recherche utilisateurs, PII | À lire | Admin-only strict | Énumération comptes/PII | P0-A |
| Assistante students | `app/api/assistante/students/route.ts` | À confirmer | Liste élèves, parents, progression | À lire | ADMIN/ASSISTANTE uniquement | Fuite données mineurs | P0-A |
| Assistante student detail | `app/api/assistante/students/[studentId]/route.ts` | À confirmer | Dossier élève, parent/enfant | À lire | ADMIN/ASSISTANTE uniquement; `studentId` réel vérifié | IDOR données mineurs | P0-A |
| Assistante student documents | `app/api/assistante/students/[studentId]/documents/route.ts` | À confirmer | Documents élève | À lire | ADMIN/ASSISTANTE uniquement; autorisation avant accès disque | Fuite document | P0-A |
| Student activation | `app/api/assistante/activate-student/route.ts` | À confirmer | Activation compte élève | À lire | ADMIN/ASSISTANTE uniquement; statut élève vérifié | Activation abusive | P0-A |
| Assistante coaches | `app/api/assistante/coaches/route.ts` | À confirmer | Profils coachs, disponibilité | À lire | ADMIN/ASSISTANTE uniquement | Fuite données staff | P1 |
| Coach management | `app/api/assistante/coaches/manage/route.ts` | À confirmer | Création/modification coach | À lire | ADMIN/ASSISTANTE selon policy; payload validé | Mutation staff non autorisée | P0-B |
| Coach management detail | `app/api/assistante/coaches/manage/[id]/route.ts` | À confirmer | Profil coach ciblé | À lire | ADMIN/ASSISTANTE selon policy; `id` vérifié | IDOR coach/staff | P0-B |
| Assignments | `app/api/assistante/assignments/route.ts` | À confirmer | Affectations coach-élève | À lire | ADMIN/ASSISTANTE uniquement; student/coach valides | Affectation abusive | P0-A |
| Assignment detail | `app/api/assistante/assignments/[id]/route.ts` | À confirmer | Affectation ciblée | À lire | ADMIN/ASSISTANTE uniquement; `id` vérifié | IDOR affectation | P0-A |
| Credits residual | `app/api/assistante/students/credits/route.ts` | GET déjà Lot 2A, POST déjà Lot 2A | Transactions crédits élèves | Corrigé Lot 2A pour surface financière | Relecture Lot 2B seulement si contrat staff/élève impacte dossiers | Mutation financière | P0-B |

## Tests attendus

- Admin users : parent, élève, coach et assistante refusés si la route est admin-only; admin autorisé.
- Admin users search : non-admin refusé; recherche ne retourne pas de secrets ni tokens.
- Assistante students : parent/élève/coach refusés; assistante/admin autorisés.
- Student detail/documents : `studentId` inexistant ou non autorisé ne fuit pas de PII; aucun accès disque avant autorisation.
- Activation : non-staff refusé; activation idempotente ou refus contrôlé; aucun token brut loggué.
- Coaches/manage : non-staff refusé; payload validé; aucun changement rôle non prévu.
- Assignments : coach/student doivent exister; affectation non dupliquée ou idempotente; non-staff refusé.

## Prochaines étapes

1. Lire manuellement chaque route du tableau.
2. Ajouter au moins un test négatif RBAC/IDOR par groupe P0-A/P0-B.
3. Corriger route par route sans refonte globale.
4. Régénérer `docs/security/API_GUARD_INVENTORY.md`.
5. Mettre à jour `docs/security/SECURITY_HARDENING_PLAN.md`.

## Hors périmètre Lot 2B

- NPC reports/submissions/documents.
- Messages/conversations.
- Assessments submit/test.
- CSP/CORS/Jitsi.
- Monitoring, backup/restore, runtime minimal.

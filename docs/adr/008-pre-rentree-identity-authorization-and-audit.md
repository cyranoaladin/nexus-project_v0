# ADR 008 — identité, autorisation et audit Pré-rentrée V2

## Statut

Proposé pour implémentation. `GATE-SEC-BASE-001` est `DESIGN_BASELINE_DEFINED`, non implémenté. Date : 11 juillet 2026.

## Contexte

V1 rattache `Student` à un seul `ParentProfile` et certains parcours Stage utilisent l'email. La V2 doit prendre en charge plusieurs responsables/enfants, limiter le coach à ses cohortes, séparer les rôles staff et tracer les décisions sans exposer de PII.

## Décision

1. Ajouter `PreRentreeGuardianRelationship` M:N, versionnée dans le temps, vérifiée, avec droits et audit. `Student.parentId` reste V1 ; aucune écriture duale.
2. Ne créer aucun compte définitif à la demande publique et ne fusionner aucune identité sur simple égalité email/téléphone.
3. Conserver `UserRole` actuel et ajouter des `PreRentreeStaffGrant` par édition pour assistant administratif, responsable pédagogique, finance et admin.
4. Centraliser RBAC+ABAC : rôle + relation vérifiée/active ou affectation coach active + portée édition + état + permission.
5. Filtrer la portée dans la requête et répondre 404 hors portée ; un ID opaque ne vaut pas autorisation.
6. Écrire audit append-only minimisé et outbox atomique avec la mutation. Documents via audience/portée, chemin canonique et URL signée/streaming.
7. DTO coach/élève excluent structurellement la finance ; les exports exigent permission et audit.

## Options rejetées

- Email/téléphone comme propriété : non vérifié et mutable.
- Dupliquer un parent par enfant : fragmentation d'identité.
- Étendre seulement `UserRole` global : portée trop large et séparation des responsabilités insuffisante.
- Réutiliser `BusinessConfigAudit` ou `NpcAuditLog` : portée et schéma insuffisants.
- Masquer des champs uniquement dans l'UI : API/IDOR restent exposés.

## Conséquences

Les politiques et query scopes deviennent des dépendances obligatoires de toutes les routes V2. Les changements de relation/affectation invalident immédiatement les caches privés. L'audit/outbox ajoutent du stockage et des workers, compensés par traçabilité/idempotence.

## Sécurité et rollback

Fail-closed, CSRF sur cookie, webhook signé/secret obligatoire, PII minimisée. Si le socle ne peut être prouvé, les flags API/public/dashboards V2 restent off. Rollback : révoquer/ignorer les grants V2 et conserver relations/audit ; V1 continue via ses relations historiques.

Le backfill M3 classe le FK explicite `Student.parentId` comme candidat legacy, avec statut `PENDING_VERIFICATION` et droits vides. Il ne crée jamais une relation `VERIFIED`, un compte ou une fusion par email/téléphone sans revue humaine auditée.

Références : [audit sécurité](../audits/2026-07-pre-rentree-security-baseline.md), [autorisation](../specs/pre-rentree-2026-authorization-matrix.md), [rétention](../specs/pre-rentree-2026-data-classification-retention.md).

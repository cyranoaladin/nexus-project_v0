# PR #337 — cartographie du périmètre

> Mesures prises sur `4a0dfb6e6…` ; les commits de clôture suivants (test logout, préflight, docs) s'y ajoutent sans changer la répartition par domaine.

Mesuré le 2026-10-05 sur `4a0dfb6e6121070c8dda626aed9f3ffd6e3df102` contre `origin/main` = `5ffd4dd8e`
(merge-base identique : la branche n'est pas en retard sur main, aucune fusion dans la plage).

- 216 commits, 0 merge ; 665 fichiers (352 ajoutés, 313 modifiés, **0 supprimé**) ; +54 199 / −4 391.
- Types de commits : 128 fix, 50 test, 24 docs, 7 security, 4 feat, 2 ci, 1 refactor.
- Poids : 162 fichiers de docs/audits = +34 948 lignes (≈ 65 % des ajouts) ; 247 fichiers de tests = +11 519.
  Le code applicatif et d'infrastructure pèse donc environ 8 000 lignes nettes, pas 54 000.

Nomenclature des lots de clôture : A frontière Core-v2 · B E2E Auth Chromium et dialogue admin ·
C dépendances/lockfile/extraneous/politique OSV · D confidentialité des logs.

## Par domaine (un fichier peut compter dans plusieurs lignes)

| Domaine | Fichiers | + / − | Risque | Remarques |
|---|---|---|---|---|
| Finance / paiements / factures / devis | 91 | +3 049 / −750 | **Élevé** | Autorité financière des factures, délégations, audits, file d'e-mails de facture (migrations 20261004*). Droits financiers familiaux = arbitrage humain encore ouvert. |
| Planning / réservations / stages | 99 | +4 104 / −602 | Élevé | Conflits de coach en session de stage, audits d'annulation et de décision. Migrations 20261005*. |
| Notifications / e-mail / WhatsApp | 42 | +2 075 / −81 | Moyen-élevé | Outbox, hand-off d'e-mail de compte (Core v2 0024/0025). Aucun envoi réel dans les tests (SMTP local, Mailpit). |
| Documents privés / stockage / PDF | 28 | +641 / −298 | Moyen-élevé | `DOCUMENT_STORAGE_ROOT`, sonde de santé du stockage. |
| Core v2 | 37 | +1 014 / −183 | Élevé | Vérification d'appartenance au foyer (migration 0023), authority CORE_V2. |
| Authentification / sessions / garde | 15 | +335 / −77 | **Élevé** | `middleware.ts`, `lib/guards.ts`, `session-revocation`, changement de mot de passe, reset. |
| Sécurité (lib/security, scripts, politiques) | 9 | +167 / −28 | Élevé | Dont lot C (politique OSV, exceptions npm) et lot D (`pino-log-privacy`). |
| Routes admin / assistante / staff | 10 | +197 / −259 | Moyen-élevé | Config admin (+rollback), factures, sessions de stage, coachs, séries de planning. |
| ARIA | 15 | +280 / −154 | Moyen | Invariants d'admission aux ateliers (migration). Les lanes ARIA sont couvertes par la CI. |
| Logs / observabilité (lot D) | 14 | +374 / −105 | Moyen | Redaction par liste blanche ; réduit volontairement le détail des logs d'erreur. |
| Workflows GitHub | 3 | +210 / −53 | **Élevé** | `ci.yml`, `flake-qualification.yml`, `container-images.json`. |
| Production / config | — | — | **Élevé** | `docker-compose.prod.yml`, `Dockerfile.e2e`, `docker-compose.e2e.yml`, `next.config.mjs`, `.env.example`, `.env.production.example`, `package.json`, `package-lock.json`. Aucun script de déploiement/rollback modifié (`scripts/release|deploy|rollback` : 0 fichier). |
| Dashboards / pages | 8 | +67 / −35 | Faible | |
| Tests (`__tests__`, `e2e`) | 247 | +11 519 / −770 | — | Cf. couverture CI. |
| Docs / audits | 162 | +34 948 / −2 | Faible | Preuves et rapports ; aucun effet runtime. |

## Prisma, migrations, schéma

13 migrations, **toutes additives (statut A)**, aucune suppression de colonne ou de table :

- Legacy : `20261003194000_aria_workshop_admission_invariants` (trigger avec UPDATE), `20261003211500_account_security_events`,
  `20261004170000_invoice_financial_authority`, `20261004183000_invoice_email_queue_evidence`, `20261004190000_subscription_request_owner`,
  `20261004200000_invoice_status_audit`, `20261004203000_invoice_creation_audit`, `20261004214500_stage_reservation_decision_audit`,
  `20261005010000_session_booking_cancellation_audit`, `20261005014000_stage_session_coach_conflicts`.
- Core v2 : `0023_core_v2_household_membership_verification`, `0024_core_v2_account_email_handoff`, `0025_core_v2_account_email_payload_fail_closed`.
- Seules instructions « sensibles » : remplacement de contraintes CHECK (`DROP CONSTRAINT` puis recréation : invoice_financial_audit_action,
  core_v2_job_outbox_payload_check) et un UPDATE de compteur dans un trigger. Aucun `DELETE`, `TRUNCATE`, `SET NOT NULL`, changement de type ni renommage.
- Schéma : `prisma/schema.prisma` +123, `core-v2/prisma/schema.prisma` +17 (nouveaux modèles `AccountSecurityEvent`, `StageReservationDecisionAudit`,
  `InvoiceFinancialDelegation`, `InvoiceFinancialAccessAudit`, `SessionBookingCancellationAudit`, énumération de vérification des foyers ;
  clés étrangères en `onDelete: Restrict`).
- **Gate production non levé** : `prisma migrate deploy` échoue en production sur l'historique actuel (3 migrations annulées, cf. mémoire projet).
  Les 13 migrations n'ont été qualifiées que sur bases vides ou jetables, pas sur un ancien schéma représentatif.

## Effets par axe

- **Données** : tables d'audit et colonnes ajoutées ; aucune donnée existante supprimée ni réécrite par migration.
- **Auth / RBAC** : durcissement (révocation de session, vérification d'appartenance au foyer, refus d'édition générique des comptes famille). Risque de régression de connexion → couvert par les lanes E2E Auth, pas par une qualification de production.
- **Finance** : introduit un payeur et des délégations de droits financiers. Règle métier à arbitrer par un humain avant ouverture.
- **ARIA** : invariants d'admission ; pas de changement de fournisseur de modèle dans ce périmètre.
- **Planning / réservations** : détection de conflits de coach par session ; audits d'annulation.

## Éléments probablement hors périmètre go-live (à faire confirmer en revue)

Le cahier de gel de #337 limite la PR aux lots A–D. Le reste (finance, planning, notifications, documents, Core v2, ARIA) est hérité de
la récupération et représente l'essentiel du risque de revue. À signaler tel quel au relecteur : tout changement non nécessaire à l'ouverture
doit être identifié par lui ; je n'ai pas découpé ni réécrit l'historique.

## Règles de fusion sur main (lues le 2026-10-05)

1 approbation requise ; approbations périmées au push ; approbation du dernier pusher refusée ; résolution des conversations requise ;
fusion par merge uniquement ; checks requis : Lint, TypeScript Type Check, Unit Tests, Production Build, Real DB Integration, E2E Tests,
Documents, Dependency Integrity, Security Scan, CI Success, GitGuardian Security Checks ; branche à jour avec main (politique stricte).
Pas de code owner exigé (`require_code_owner_review: false`).

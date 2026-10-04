# Matrice fonctionnelle et sources de vérité

Base d’intégration : `5ffd4dd8e1fb91b0eea42398670a260402660699`. Inventaire revalidé le 4 octobre 2026 sur les services de la branche de reprise, y compris le lot familial local non commité. La qualification locale publiée concerne `1e2d0a5c745479ef11e58edef575e390af6583d1` et ne couvre pas les modifications ultérieures. Aucune ligne n’est QUALIFIÉ PRODUCTION. Tests cités ci-dessous = présents dans le dépôt, sauf exécution explicitement liée à un SHA dans `ci-remediation.md`.

| # | Capability | Routes/services | Autorité | État et preuve restante |
|---|---|---|---|---|
| 1 | Connexion/session | auth.ts; lib/auth/credentials-authorize.ts; lib/core-v2/auth/authority.ts | User / sessionVersion | Auth authority, suspension, password-reset tests |
| 2 | Cycle utilisateur | lib/core-v2/services/account.ts; staff-account.ts; app/api/v2/staff/accounts | User / Invitation | Invitation one-use, bootstrap concurrency |
| 3 | Récupération mot de passe | app/api/auth/reset-password; app/api/v2/auth/password-reset | PasswordResetToken | Expiration/replay/session invalidation |
| 4 | Email/téléphone | lib/auth/parent-phone.ts; email-trust.ts | ParentPhoneChallenge | Possession/attempt limit |
| 5 | Rôles/permissions | lib/core-v2/rbac.ts; http/staff-route.ts; lib/rbac.ts | Actor / ownership | Cross-role / direct API denials |
| 6 | Dashboard direction/admin | app/dashboard/admin; app/dashboard/assistante | Core read models | Freshness and allowed actions |
| 7 | Dashboard coach | app/api/v2/coach/me; app/dashboard/coach | Coach assignment | Out-of-assignment denial |
| 8 | Dashboard parent | app/dashboard/parent; lib/core-v2/queries/parent.ts | HouseholdParent + V1 billing | Cross-household denial |
| 9 | Dashboard élève | app/dashboard/eleve; app/api/v2/student | Student / enrollment | Own-only scope |
| 10 | Familles/rattachements | lib/core-v2/services/household.ts; prisma/schema.prisma | V2 HouseholdParent + Student.householdId ; V1 Student.parentId (ParentStudentLink = consentement bilan seulement) | PARTIEL : vérification/révocation locale en qualification ; autorité interstores à fermer |
| 11 | Parcours académiques | lib/core-v2/services/enrollment.ts | AcademicYear / courseKey enrollments | Historical roster and normalized combinations |
| 12 | Coachs/disponibilité | lib/core-v2/services/coach.ts | CoachProfile / capability / assignment | Capabilities/history/conflicts |
| 13 | Sites/salles | prisma/schema.prisma; core-v2/prisma/schema.prisma | location string only | ABSENT : aucun modèle gouverné Site/Room dans les deux schémas ; capacité/équipement/conflit salle non garantis |
| 14 | Planning/calendriers | lib/core-v2/services/planning.ts; lib/planning | PlanningSeries / SessionBooking | SQL exclusions coach/student; room constraints missing |
| 15 | Rendez-vous | app/api/reservation; lib/session-booking.ts | V1 SessionBooking | State/eligibility/ownership |
| 16 | Séances/réservations/présences | app/api/v2/staff/bookings; V1 stages/sessions | Booking / Session | PARTIEL : atelier capacité/idempotence/outbox et snapshots PG testés (34/34) ; wait-list et parcours complet à qualifier |
| 17 | Annulation/report/crédits | lib/core-v2/services/planning.ts; V1 credits APIs | Booking + historique CreditTransaction | PARTIEL : annulation/report à qualifier ; crédits commerciaux retirés, ne pas réintroduire les anciens forfaits ; historique soumis à décision staff explicite |
| 18 | Offres/forfaits/inscriptions | lib/pricing.ts; data/pricing.canonical.json | Versioned catalogue / Subscription | Current main pricing retained |
| 19 | Paiements/rapprochements | app/api/payments; lib/payments.ts | V1 Payment | Signatures/replay/sandbox; V2 not billing authority |
| 20 | Factures/PDF | lib/invoice; app/api/invoices | V1 Invoice/Item/Sequence/AccessToken | Atomic sequence/private storage/download |
| 21 | Ressources | lib/aria/manifests/resource-registry.ts | Resource registry / version / grants | Governance/publication/download |
| 22 | Conversation ARIA | lib/core-v2/aria; app/api/v2/aria | Conversation / Turn / Message / Citation | Idempotence/cancel/recovery/provider failure |
| 23 | RAG/provenance | lib/aria/rag.ts; scripts/aria/check-runtime-manifest.ts | Versioned manifest derived from registry | Runtime external proof required only if enabled |
| 24 | Notifications in-app | app/api/notifications | V1 Notification | Scope and read state |
| 25 | Invitations téléphone | lib/auth/parent-phone.ts; V2 account services | Challenge / Invitation | Normalization/one-use/revoke |
| 26 | WhatsApp | lib/whatsapp/meta-provider.ts; outbox; webhook | Provider status / outbox | Official API, allowlist, real error statuses |
| 27 | Email | lib/email; invitation/reset/invoice services | Provider/outbox | Sandbox delivery/rebound/retry |
| 28 | Formulaires/prospects | app/api/contact; family-requests; bilan | Lead / FamilyRequest | Validation/consent/idempotence/rate limit |
| 29 | Contenu site | app/api/admin/config; rollback | Canonical business config / history | Permissions/audit/rollback |
| 30 | Paramètres métier | lib/core-v2/config.ts; lib/config; lib/pricing.ts | Explicit configuration | No invented commercial/retention policy |
| 31 | Audit/sauvegardes/exploitation | lib/core-v2/audit.ts; JobOutbox; DEPLOY_RUNBOOK.md | Audit append-only / private operational proofs | Restore/TLS/alerts/runbook gates not proven |

## Frontières

Core-v1 et Core-v2 coexistent sous une autorité d'authentification de rollout
explicite. Billing reste Core-v1 selon le runbook de migration. Core-v2 n'est pas
une nouvelle autorité financière. Les lectures ARIA passent par les contrats et
API natives V2, jamais par une récupération des anciens proxies Python.
Le planning Core fonctionne sans retrieval/provider IA. Le registre de ressources
est canonique, les chunks/index sont dérivés ; staging RAG non qualifié ici.

## Invariants observés

- Core-v2 schéma : FK et Restrict sur historique académique ; unicité enrollment.
- Migration planning 0007 : exclusions SQL coach/élève, transactions de service.
- Bootstrap : verrou advisory transactionnel, désormais API SQL paramétrée ;
  deux connexions indépendantes donnent un seul administrateur (test réel).
- Parent V2 : identité serveur → membership household, pas household client ;
  le lot local ajoute VERIFIED/révocation à ce membership. La co-visibilité du foyer est l’ADR accepté ; aucun droit par enfant n’est déduit du consentement bilans.
- ARIA : turn lifecycle/idempotency/citations/recovery, à requalifier sur DB.

## Risques bloquants et arbitrages

P1 : gestion gouvernée salles/sites absente, planning salle non garanti ; vérification familiale et coexistence d’autorisation V1/V2 non qualifiées. Ne pas
annoncer ces capacités comme livrées par V2. Ne pas backfiller des droits depuis
un simple homonyme ; un roster/provenance d'ownership approuvé est requis.
TLS compromis historique : la validité du certificat servi ne démontre pas
révocation de l'ancienne clé. Runbook privé, backup restauré et rétention
approuvée manquent pour promotion. Aucune politique inventée.

## Threat model ciblé

Actifs : comptes staff, mineurs/familles, planning/présence, factures, documents
privés, conversations. Frontières : navigateur/API, auth V1/V2, DB, jobs,
stockage, webhook/provider, IA/RAG. Preuves nécessaires : IDOR direct, rôles
croisés, session révoquée, replay, concurrence, upload/path/SSRF, redaction,
signature webhook, fail-closed documentaire et quotas des appels coûteux.
Aucune absence de vulnérabilité n'est inférée du seul build.

## Écarts confirmés pendant la qualification locale

| Priorité | Capability | Constat vérifié dans le code | Preuve / action restante |
| --- | --- | --- | --- |
| P0 qualification | 5/10 | Le lien V1 `ParentStudentLink` représente le consentement aux bilans ; un nouveau consentement est permis après retrait. Le membership V2 reste au niveau foyer. | Séparer autorisation familiale administrativement révocable et consentement ; tests négatifs directs et courses requis. Aucun exploit production exécuté. |
| P1 | 13 | Aucun modèle Site/Room dans les deux schémas inspectés ; `location` est une chaîne libre. | Modèle, permissions, capacités et exclusions salle à ajouter sans inventer les salles exploitées. |
| P1 corrigé localement | 16 | Admission atelier sérialisée, gardes SQL et révision MVCC ; intention email transactionnelle. | 34/34 tests réels, dont SQL direct/RR ; migration additive vide/ancien schéma/interruption/relance. Reste : qualification complète sur SHA et production. |
| P1 | 19 | ClicToPay init/webhook répondent explicitement 501 ; effets webhook non implémentés. | Contrat prestataire officiel approuvé et sandbox nécessaires ; conserver le mode désactivé, aucun faux paiement. |
| P1 intégrité | 19 | `Payment.amount`, transaction provider et `Subscription.monthlyPrice` historiques sont Float. | Migration additive vers unité mineure/decimal et rapprochement ; aucune erreur financière réelle revendiquée. |
| P0 qualification | 20 | Accès facture encore fondé sur relations historiques et alternative email fiable. | Tester les bénéficiaires, ownership et accès directs ; ne pas confondre une facture propre au parent et un document privé d'un enfant. |

Le planning coach/élève et ses exceptions ont des tests PostgreSQL verts locaux ;
ils ne prouvent pas les conflits de salles absents du schéma. Les 81 E2E verts
couvrent les fichiers sélectionnés, pas toutes les capabilities du mandat.
Aucune ligne de cette matrice n'est `QUALIFIÉ PRODUCTION` à ce stade.

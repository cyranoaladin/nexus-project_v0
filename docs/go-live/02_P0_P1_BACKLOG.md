# Backlog P0/P1 go-live

## Mise à jour Lot 13 — 2026-07-06

- Inventaire inchangé : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.
- Les 6 P1 restent visibles et non requalifiés.
- Runbook humain Lot 11 relancé sous Node 20 : `1` suite passée, `5` tests passés.
- `docs/audits/audit-nexus-reussite.md` reste `PRESENT_UNTRACKED_IN_WORKTREE` et `EXCLUDE_FROM_STANDARD_COMMITS`.
- Staging Git resté vide ; aucun `git add` réel, aucun commit, aucun push, aucune PR.
- Décision : `READY_TO_EXECUTE_MANUALLY`, `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`, `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED`.

Blocages maintenus :

1. Redis/Upstash staging/production non prouvé.
2. Test `429` runtime réel non exécuté.
3. ContactLead dry-run DB non production non exécuté.
4. ClicToPay disabled.

---

## Mise à jour Lot 11 — 2026-07-03

- Inventaire inchangé : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.
- Les 6 P1 restent visibles et non requalifiés : ClicToPay webhook, assessment submit, bilan gratuit, Lamis teacher report, stage inscription, student activation.
- Runbook humain créé : `docs/go-live/_evidence/lot11-human-commit-runbook.md`.
- Preuve mécanique : `281` fichiers `Include RC` couverts exactement une fois, aucun `Exclude`, aucun `Needs human review` dans les commits standards.
- Aucun `git add` réel, aucun commit, aucune PR.
- Décision : `READY_FOR_HUMAN_EXECUTION`, `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`, `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED`.

---

## Mise à jour Lot 10 — 2026-07-03

- Inventaire inchangé : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.
- Les 6 P1 restent visibles et non requalifiés : ClicToPay webhook, assessment submit, bilan gratuit, Lamis teacher report, stage inscription, student activation.
- Plan `git add --dry-run` créé : `docs/go-live/_evidence/lot10-git-add-dry-run-plan.md`.
- Preuve mécanique : `281` fichiers `Include RC` couverts exactement une fois, aucun `Exclude`, aucun `Needs human review`, aucun `.env`, aucun `rapport_audit_2_07_2026.md`.
- Staging Git vide avant/après dry-runs ; aucun `git add` réel, aucun commit, aucune PR.
- Décision : `READY_FOR_HUMAN_COMMIT`, `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`, `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED`.

---

## Mise à jour Lot 9 — 2026-07-03

- Inventaire inchangé : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.
- Les 6 P1 restent visibles : ClicToPay webhook, assessment submit, bilan gratuit, Lamis teacher report, stage inscription, student activation.
- Validation mécanique ajoutée : `__tests__/scripts/release-candidate-manifest-consistency.test.ts`.
- Résultat ciblé : `2` suites passées, `14` tests passés avec la régression scripts.
- Manifeste Lot 8 et plan de commits Lot 8 cohérents : `281` fichiers `Include RC` couverts exactement une fois, aucun `Exclude` ni `Needs human review` inclus.
- Décision : `RC_READY_FOR_HUMAN_REVIEW`, `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`, `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED`.

---

## Mise à jour Lot 5 — 2026-07-03

- Inventaire après ajout de la probe interne : `P0=0`, `P1=6`, `P2=144`, `OK=28`, total `178`.
- Les 6 P1 restent inchangés : ClicToPay webhook, assessment submit, bilan gratuit, Lamis teacher report, stage inscription, student activation.
- `/api/internal/rate-limit-probe` ajouté pour test 429 non destructif ; route protégée et classée OK statique.
- Redis/Upstash non prouvé : `NEXUS_HEALTH_AUTH_ABSENT`, production sans secret `401`, local `memory/blocked`.
- Test 429 local route probe : OK ; test 429 staging/production : non exécuté, procédure documentée et bloquante.
- ContactLead retention : dry-run DB local échoue faute de DB disponible ; tests fixtures OK ; `--apply` production interdit sans validation humaine.
- ClicToPay : décision finale `DISABLED`, paiement manuel uniquement, carte publique non disponible.
- Registre go/no-go des 6 P1 créé : bêta contrôlée possible avec réserves, bêta élargie interdite, go-live large interdit.

---

## Mise à jour Lot 4 — 2026-07-03

- Inventaire attendu après régénération : `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`.
- Les 6 P1 restent visibles par décision : ClicToPay webhook, assessment submit, bilan gratuit, Lamis teacher report, stage inscription, student activation.
- Angle mort token assessment libre fermé : `/bilan-gratuit/assessment` exige un cookie HttpOnly signé issu de `/api/bilan-gratuit` et redirige toute URL avec query params vers l'URL canonique avant rendu.
- `/api/assessments/submit` vérifie maintenant un token `binding=lead` avec `leadEmailHash` et email assessment pseudonyme, ou un token staff-only contrôlé.
- Purge/anonymisation `ContactLead` : script dry-run/apply ajouté, application production à valider.
- `business_configs` : fallback inattendu en production devient dégradé.
- ClicToPay : flag public actif + backend désactivé échoue en `503`, pas de succès ambigu.
- Redis/Upstash reste non prouvé : bêta élargie et go-live large interdits.

---

## Mise à jour Lot 3 — 2026-07-03

- Inventaire API régénéré : `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`.
- `/api/assessments/submit` exige désormais un token signé court HMAC, TTL 15 minutes, scope `assessment_submit`, `subject`, `grade`.
- Nouvelle route staff-only `/api/assessments/public-token`, classée `P2`, pour émission contrôlée de token.
- `/api/bilan-gratuit` reste `lead_only` et refuse maintenant `studentBirthDate` ; registre RGPD, rétention et suppression sont documentés.
- `ContactLead` a une politique de rétention proposée (`365` jours) et SLA d'effacement (`30` jours), avec dédoublonnage email/source des leads `NEW`.
- `business_configs` absent est classé comme fallback statique optionnel ; healthcheck interne expose `runtime.businessConfig`.
- ClicToPay reste désactivé contractuellement ; webhook `501`, signature obligatoire, aucune mutation.
- Redis/Upstash production/staging reste non prouvé : healthcheck production sans secret retourne `401`, mode local `memory` bloqué.
- Le prochain backlog prioritaire reste runtime/paiement : prouver Redis/Upstash, finaliser ou désactiver durablement ClicToPay, implémenter purge/anonymisation leads.

---

## Mise à jour Lot 2 — 2026-07-03

- Les 6 P1 restants ne sont plus des angles morts : chaque route a une décision produit/RGPD/paiement/runtime documentée.
- `/api/bilan-gratuit` est transformée en `lead_only` : création de lead CRM seulement, aucune création de `User`, `ParentProfile`, `Student`, token d'activation ou email d'activation. Le risque "création de comptes depuis formulaire public sans consentement explicite" est fermé dans le code.
- `/api/stages/[stageSlug]/inscrire` reste publique par décision conversion, avec consentement traitement et modalités stage obligatoires avant écriture CRM.
- `/api/payments/clictopay/webhook` reste `501/P1` : signature obligatoire, aucune mutation Prisma, aucun succès ambigu. Carte bancaire indisponible tant que l'intégration n'est pas complète.
- `/api/assessments/submit` et `/api/lamis/teacher-report` restent publiques et minimisées ; elles doivent passer derrière token/session si elles collectent des données nominatives ou produisent un résultat rattaché à un élève.
- `/api/student/activate` reste publique par token, avec lifecycle hash/expiration/no-replay testé.
- Redis/Upstash staging/production reste non prouvé : go-live large interdit.
- Le prochain backlog prioritaire bascule vers Lot 3 : runtime Redis/Upstash, token court pour assessments publics, finalisation ClicToPay ou désactivation contractuelle, et registre RGPD mineurs.

---

## Mise à jour Lot 1-quinquies — 2026-07-03

- Inventaire API régénéré : `P0=0`, `P1=6`, `P2=143`, `OK=27`.
- 6 P1 admin ont été fermés par corrections de code/tests : config, rollback, directeur stats, recompute SSN, subscriptions, test-email.
- ClicToPay webhook reste `501/P1` : signature obligatoire, aucun succès ambigu, aucune mutation.
- Les P1 restants sont publics sensibles ou activation par token : `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/lamis/teacher-report`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate`.
- Le test no-leak couvre désormais 20 réponses mockables, dont les 12 P1 de départ ou leurs réponses de validation.
- `rate limiting` distribué production/staging non prouvé : `/api/internal/health` production répond `401` sans secret, donc go-live large reste interdit.
- `/api/bilan-gratuit` reste dette produit/RGPD : route sans fuite en sortie, mais création de comptes inactifs.

---

## Mise à jour Lot 1-quater — 2026-07-02

- Inventaire API régénéré : `P0=0`, `P1=12`, `P2=137`, `OK=27`.
- 25 P1 ont été fermés par corrections de code/tests, principalement assistante, parent, student/eleve, coach et stages confirm.
- Le test global no-leak couvre désormais 12 routes mockables.
- Le healthcheck interne expose explicitement le mode rate limiting et bloque `memory` pour go-live large.
- Restent bloquants bêta élargie/go-live large : ClicToPay webhook `501/P1`, routes publiques sensibles (`assessments/submit`, `bilan-gratuit`, `lamis/teacher-report`, `stages inscrire`, `student activate`), 6 routes admin P1, rate limiting distribué production non prouvé.
- `/api/bilan-gratuit` reste une dette produit/RGPD : sortie durcie, mais création de comptes inactifs.

---

## Mise à jour Lot 1-ter — 2026-07-02

- Inventaire API régénéré : `P0=0`, `P1=37`, `P2=112`, `OK=27`.
- 17 P1 ont été fermés par corrections de code/tests : admin invoices, ClicToPay init, bilans, NPC submissions/documents/uploads/generate, sessions cancel et routes coach reports ciblées.
- ClicToPay reste non actif : `init` est durci et retourne toujours `501`, `webhook` reste P1/501.
- Restent bloquants bêta élargie/go-live large : ClicToPay webhook, `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/stages/[stageSlug]/inscrire`, `/api/assistante/quotes/pdf`, P1 assistante/parent/student/coach restants, rate limiting distribué production.
- Le backlog prioritaire suivant doit traiter les P1 publics/stages/assistante/parent/student et prouver le mode Redis/Upstash en production ou staging.

---

## Mise à jour Lot 1-bis — 2026-07-02

- Inventaire API régénéré : `P0=0`, `P1=54`, `P2=95`, `OK=27`.
- `P0-001` est accepté avec réserves côté inventaire statique : les requalifications P0 sont contre-auditées dans `docs/go-live/_evidence/lot1bis-p0-reclassification-audit.md`.
- Deux P1 fermés : `/api/sessions/video`, `/api/admin/documents`.
- Restent bloquants bêta élargie/go-live large : ClicToPay, `/api/admin/invoices`, `/api/assessments/submit`, `/api/bilan-gratuit` décision produit/RGPD, `/api/bilans*`, routes coach generate/regenerate, NPC documents, rate limiting distribué production.
- Le rate limiting distribué reste P0 runtime pour go-live large tant que production n’est pas vérifiée.

---

## P0-001 — Auditer et fermer les P0 API ownership/IDOR

- Sévérité : P0
- Domaine : Sécurité API
- Preuve : `docs/security/API_GUARD_INVENTORY.md` généré le 2026-07-02 : 176 routes, 44 P0.
- Fichiers concernés : `app/api/**/route.ts`, `lib/rbac.ts`, `lib/guards.ts`, `lib/access/*`.
- Risque : accès croisé à documents, factures, bilans, élèves, coachs ou paiements.
- Action attendue : audit manuel des routes P0, ownership explicite, tests IDOR.
- Tests attendus : tests 401/403/404 par rôle et ressource, `node scripts/security/audit-api-guards.mjs`.
- Critère d’acceptation : 0 route P0 ouverte, chaque route dynamique sensible a un test d'accès croisé.
- Owner suggéré : Lead backend sécurité.
- Statut : Accepté avec réserves après Lot 1-bis pour l’inventaire statique (`P0=0`). Reste bloquant fonctionnel sur 54 P1 avant bêta élargie.

## P0-002 — Prouver le rate limiting distribué en production

- Sévérité : P0
- Domaine : Sécurité runtime
- Preuve : `lib/rate-limit/index.ts` supporte Redis/Upstash mais fallback mémoire possible ; `app/api/internal/health/route.ts` marque Redis KO si mode mémoire.
- Fichiers concernés : `lib/rate-limit/*`, `docker-compose.prod.yml`, env production.
- Risque : spam formulaires et brute force non bloqués sur multi-instance.
- Action attendue : config Redis/Upstash, test 429, alerte si mémoire en production.
- Tests attendus : test 429 distribué, healthcheck interne, simulation multi-process.
- Critère d’acceptation : production indique `redis` ou `upstash`, jamais `memory`.
- Owner suggéré : DevOps / backend.
- Statut : Ouvert.

## P0-003 — Maintenir ClicToPay désactivé ou finaliser intégration complète

- Sévérité : P0
- Domaine : Paiement
- Preuve : `app/api/payments/clictopay/init/route.ts` et `webhook/route.ts` retournent `501 CLICTOPAY_NOT_CONFIGURED`.
- Fichiers concernés : `app/api/payments/clictopay/*`, `app/dashboard/parent/paiement/*`.
- Risque : promesse de paiement carte non tenue ou paiement non réconcilié.
- Action attendue : conserver le masquage public ajouté en Lot 0-bis, ou implémenter init/webhook/idempotence.
- Tests attendus : tests init, webhook signature, paiement réussi/échoué, double webhook.
- Critère d’acceptation : carte soit absente du parcours public, soit validée bout-en-bout.
- Owner suggéré : Backend paiement.
- Statut : Ouvert côté paiement ; exposition publique masquée en Lot 0-bis.

## P0-004 — Canoniser paiement -> facture -> entitlement

- Sévérité : P0
- Domaine : Paiement / droits produit
- Preuve : `app/api/payments/validate/route.ts` active `activateEntitlements`, mais conserve activation legacy `Subscription` et `CreditTransaction`.
- Fichiers concernés : `lib/entitlement/*`, `app/api/payments/validate/route.ts`, `prisma/schema.prisma`.
- Risque : droits doublés, crédits incohérents, paiement sans entitlement ou entitlement sans facture.
- Action attendue : documenter la source de vérité, aligner projections legacy et tests d'idempotence.
- Tests attendus : `__tests__/api/payments.validate.entitlement.route.test.ts`, tests crédits, tests facture PDF.
- Critère d’acceptation : `InvoiceItem.productCode` + paiement payé déclenchent les droits, legacy seulement projection.
- Owner suggéré : Backend billing.
- Statut : Ouvert.

## P0-005 — Aligner registre produit entitlement et pricing canonique

- Sévérité : P0
- Domaine : Business logic
- Preuve : `data/pricing.canonical.json` expose les plans opérationnels 150/450/750 avec crédits 0/4/8, alors que `lib/entitlement/types.ts` accorde 4/8/16 sur les abonnements.
- Fichiers concernés : `data/pricing.canonical.json`, `lib/entitlement/types.ts`, `lib/operational-catalog*`.
- Risque : droits accordés incohérents avec l'offre vendue.
- Action attendue : définir mapping canonique et tests contractuels pricing -> entitlement.
- Tests attendus : test registre produit vs pricing, test activation crédits.
- Critère d’acceptation : aucun crédit accordé hors décision métier validée.
- Owner suggéré : Produit + backend.
- Statut : Ouvert.

## P0-006 — RGPD mineurs et consentement analytics

- Sévérité : P0
- Domaine : RGPD / mineurs
- Preuve : Lot 0 montrait GA chargé directement ; Lot 0-bis désactive GA par défaut via `NEXT_PUBLIC_ENABLE_GOOGLE_ANALYTICS`, mais aucune CMP/consent mode complète n'existe.
- Fichiers concernés : `app/layout.tsx`, `app/politique-confidentialite/page.tsx`, `app/bilan-gratuit/*`, `app/api/analytics/event/route.ts`.
- Risque : collecte non consentie, traitement mineurs insuffisamment cadré.
- Action attendue : CMP/consent mode, registre traitements, minimisation, preuve de consentement.
- Tests attendus : tracking absent avant consentement, politique à jour, logs no-PII.
- Critère d’acceptation : aucun script analytics non essentiel avant consentement.
- Owner suggéré : Produit légal + frontend.
- Statut : Ouvert ; script GA public verrouillé par défaut en Lot 0-bis.

## P0-016 — Clarifier `/bilan-gratuit` lead-only vs création de compte

- Sévérité : P0
- Domaine : Conversion / RGPD mineurs
- Preuve : Lot 2 a transformé `app/api/bilan-gratuit/route.ts` en lead CRM uniquement ; Lot 3 retire/refuse `studentBirthDate` et documente registre/rétention dans `docs/go-live/_evidence/lot3-bilan-gratuit-rgpd-register.md`.
- Fichiers concernés : `app/bilan-gratuit/*`, `app/api/bilan-gratuit/route.ts`, `lib/validations.ts`, `lib/crm/contact-leads.ts`.
- Risque : formulaire public mineur encore sensible et dépendant du rate limiting distribué pour campagne large.
- Action attendue : conserver `lead_only`, valider la politique de confidentialité et implémenter purge/anonymisation `ContactLead` avant go-live large.
- Tests attendus : soumission lead sans compte, consentement, email interne, rate limit, aucune PII en logs, refus `studentBirthDate`.
- Critère d'acceptation : comportement API aligné avec la promesse affichée, minimisation documentée, purge opérationnelle.
- Owner suggéré : Produit + backend CRM.
- Statut : Fermé côté ambiguïté création compte ; réserve RGPD/runtime ouverte pour purge et Redis/Upstash.

## P0-007 — Documents et fichiers sensibles

- Sévérité : P0
- Domaine : Documents / PII
- Preuve : routes documents classées P0/P1 dans `API_GUARD_INVENTORY.md`; `app/api/documents/[id]/route.ts` lit des chemins locaux privés.
- Fichiers concernés : `app/api/documents/*`, `app/api/student/documents/*`, `app/api/npc/files/*`, `storage/*`.
- Risque : fuite de PDF, factures, bilans ou copies.
- Action attendue : audit IDOR, stockage hors webroot, headers, logs sans chemin local, politique suppression.
- Tests attendus : parent/élève/coach croisés, document inexistant, path traversal, no-leak.
- Critère d’acceptation : accès document strictement propriétaire ou staff autorisé.
- Owner suggéré : Backend sécurité.
- Statut : Ouvert.

## P0-008 — Backup / restore DB et fichiers

- Sévérité : P0
- Domaine : Infra
- Preuve : audit racine exige backup/restore ; aucune commande production n'a été exécutée Lot 0.
- Fichiers concernés : `docker-compose.prod.yml`, volumes DB, storage documents/factures.
- Risque : perte de données familles, factures, bilans.
- Action attendue : stratégie backup, chiffrement, test restore, RPO/RTO.
- Tests attendus : restore sur environnement isolé, checksum fichiers.
- Critère d’acceptation : restauration validée et documentée.
- Owner suggéré : DevOps.
- Statut : Ouvert.

## P0-009 — Monitoring, alerting et healthchecks

- Sévérité : P0
- Domaine : Observabilité
- Preuve : `app/api/health/route.ts` existe ; `app/api/internal/health/route.ts` vérifie DB/SMTP/RAG/Redis/NPC mais nécessite validation runtime.
- Fichiers concernés : `app/api/health/route.ts`, `app/api/internal/health/route.ts`, infra monitoring.
- Risque : panne silencieuse, SMTP/RAG/Redis dégradés non détectés.
- Action attendue : sondes, alertes, logs centralisés, synthetic checks pages critiques.
- Tests attendus : health 200/503, alerte de test, restart app.
- Critère d’acceptation : alerte vérifiée pour DB/RAG/Redis/SMTP/app down.
- Owner suggéré : DevOps.
- Statut : Ouvert.

## P0-010 — Runtime minimal production

- Sévérité : P0
- Domaine : Production
- Preuve : `Dockerfile.prod`, `docker-compose.prod.yml`, `next.config.mjs` existent ; production réelle non vérifiée en Lot 0.
- Fichiers concernés : Docker, Nginx, PM2/Docker, SSL, headers.
- Risque : port exposé, mauvais mode Node, secrets mal injectés, rollback non prêt.
- Action attendue : état initial prod lecture seule, choix Docker/PM2, port localhost, headers, rollback.
- Tests attendus : curls production, `docker compose ps` ou PM2, SSL labs interne, headers.
- Critère d’acceptation : runbook prod signé, rollback testé.
- Owner suggéré : CTO / DevOps.
- Statut : Ouvert.

## P0-011 — Logs sans PII excessive

- Sévérité : P0
- Domaine : Sécurité / conformité
- Preuve : plusieurs routes loggent des erreurs sérialisées ; tests unitaires montrent des chemins d'erreur API/DB/SMTP. `app/api/documents/[id]/route.ts` loggue un `localPath` en cas de fichier manquant.
- Fichiers concernés : `lib/utils/serialize-error.ts`, `lib/logger*`, routes documents, paiements, bilans, ARIA.
- Risque : PII, chemins locaux ou données pédagogiques dans logs.
- Action attendue : redaction centralisée, interdiction chemin local/email/téléphone en logs applicatifs.
- Tests attendus : no-leak logs, snapshot redaction.
- Critère d’acceptation : logs opérationnels sans PII ni chemins locaux sensibles.
- Owner suggéré : Backend sécurité.
- Statut : Ouvert.

## P0-012 — Backend RAG canonique et santé IA

- Sévérité : P0
- Domaine : IA/RAG
- Preuve : `lib/rag-client.ts` indique ChromaDB canonical ; docs/code doivent être alignés par environnement.
- Fichiers concernés : `lib/rag-client.ts`, `docs/RAG_ARCHITECTURE.md`, `app/api/aria/*`.
- Risque : IA indisponible ou source documentaire non maîtrisée.
- Action attendue : fixer URL par environnement, healthcheck RAG, fallback clair.
- Tests attendus : RAG health, ARIA chat sans fuite inter-élève, timeout.
- Critère d’acceptation : backend RAG unique, sain, monitoré.
- Owner suggéré : IA/backend.
- Statut : Ouvert.

## P0-013 — NPC en mode stub explicite

- Sévérité : P0
- Domaine : IA/NPC
- Preuve : `lib/npc/config.ts` définit `NPC_LLM_MODE` par défaut à `stub`; `services/npc-worker/processors/ai-service.ts` retourne des fallbacks en stub.
- Fichiers concernés : `lib/npc/*`, `services/npc-worker/*`, `app/api/npc/*`, dashboards NPC.
- Risque : présenter un diagnostic IA live alors qu'il est simulé.
- Action attendue : afficher état runtime, interdire promesse live si `stub`, config env obligatoire.
- Tests attendus : worker `stub/off/live`, dashboard flag, upload/file IDOR.
- Critère d’acceptation : aucun utilisateur ne confond stub et diagnostic IA réel.
- Owner suggéré : IA/produit.
- Statut : Ouvert.

## P0-014 — Canonicaliser Session / SessionBooking

- Sévérité : P0
- Domaine : Données / planning
- Preuve : `prisma/schema.prisma` contient `model Session` et `model SessionBooking`; de nombreux services utilisent `SessionBooking`.
- Fichiers concernés : `prisma/schema.prisma`, `lib/session-booking.ts`, `app/api/sessions/*`, dashboards planning.
- Risque : planning incohérent, crédits remboursés sur mauvais modèle, ownership coach ambigu.
- Action attendue : décider source canonique et migrer lectures/écritures critiques.
- Tests attendus : booking, cancel, conflict, coach/student ownership.
- Critère d’acceptation : un modèle canonique documenté, l'autre projection/legacy.
- Owner suggéré : Backend planning.
- Statut : Ouvert.

## P0-015 — Canonicaliser Diagnostic / Assessment / StageBilan / Bilan

- Sévérité : P0
- Domaine : Données pédagogiques
- Preuve : `prisma/schema.prisma` contient les quatre modèles, avec `Bilan` documenté comme modèle canonique consolidateur.
- Fichiers concernés : `prisma/schema.prisma`, `lib/bilan/*`, `app/api/bilans/*`, `app/api/assessments/*`, stages.
- Risque : bilan parent/élève incohérent, droits d'accès dispersés, exports incomplets.
- Action attendue : définir `Bilan` comme canonical ou maintenir coexistence formelle avec adapters.
- Tests attendus : génération, export, accès parent/coach/élève, migration non destructive.
- Critère d’acceptation : un chemin canonique pour lire et servir un bilan.
- Owner suggéré : Backend pédagogique.
- Statut : Ouvert.

## P1-001 — Durcir lint et build gate

- Sévérité : P1
- Domaine : Qualité
- Preuve : `npm run lint` OK avec nombreux warnings ; `next.config.mjs` ignore le lint pendant build.
- Fichiers concernés : `next.config.mjs`, fichiers listés par lint.
- Risque : dette type safety masquant régressions.
- Action attendue : réduire warnings et retirer ignore build quand réaliste.
- Tests attendus : lint strict progressif.
- Critère d’acceptation : seuil warnings abaissé et suivi CI.
- Owner suggéré : Front/backend.
- Statut : Ouvert.

## P1-002 — Finaliser tunnel bilan gratuit bas-friction

- Sévérité : P1
- Domaine : Conversion / CRM
- Preuve : UI sans mot de passe, mais `app/api/bilan-gratuit/route.ts` crée des comptes parent/élève inactifs.
- Fichiers concernés : `app/bilan-gratuit/*`, `app/api/bilan-gratuit/route.ts`, `lib/crm/*`.
- Risque : friction implicite, activation prématurée, CRM incomplet.
- Action attendue : décider lead pur vs compte différé, ajouter UTM/source/referrer.
- Tests attendus : formulaire, email, CRM, consentement, anti-spam.
- Critère d’acceptation : lead reçu sans création de compte agressive ou décision assumée.
- Owner suggéré : Produit + backend.
- Statut : Reclassé P0-016 pour campagne paid ; reste P1 pour polish CRM/UTM après décision.

## P1-003 — Nettoyer reliquats marketing et archives activables

- Sévérité : P1
- Domaine : Marketing contenu
- Preuve : recherche manuelle trouve des montants dans `data/Nexus_Reussite_Accueil.html` et `components/ui/specialized-packs.tsx`.
- Fichiers concernés : archives HTML, composants UI anciens, pages non prioritaires.
- Risque : réactivation d'une page avec prix obsolètes.
- Action attendue : classer archive ou migrer vers pricing canonique.
- Tests attendus : `npm run check:no-hardcoded`, recherche `TND`.
- Critère d’acceptation : aucune source non archive activable avec montant hardcodé.
- Owner suggéré : Front produit.
- Statut : Ouvert.

## P1-004 — Vérifier promesse groupes réduits partout

- Sévérité : P1
- Domaine : Marketing / juridique
- Preuve : `data/pricing.canonical.json` indique `group_max` 5 ; pages critiques inspectées utilisent ce repère.
- Fichiers concernés : pages publiques, contenu SEO, composants marketing.
- Risque : promesse contradictoire ou non tenue.
- Action attendue : smoke contenu et test invariant.
- Tests attendus : guard marketing `group_max`.
- Critère d’acceptation : toute mention du groupe max dérive du canonique.
- Owner suggéré : Produit/front.
- Statut : Ouvert.

## P1-005 — Valider production réelle avant campagne

- Sévérité : P1
- Domaine : Go-live marketing
- Preuve : Lot 0 n'a pas interrogé production ; commandes HTTP production non exécutées.
- Fichiers concernés : runbook production.
- Risque : local OK mais prod cassée.
- Action attendue : curls production, screenshot mobile, formulaire test.
- Tests attendus : smoke public production et monitoring.
- Critère d’acceptation : pages critiques 200, H1, CTA, pas de débordement mobile.
- Owner suggéré : QA/DevOps.
- Statut : Ouvert.

## P1-006 — Trier les échecs Playwright publics Lot 0

- Sévérité : P1
- Domaine : QA publique / conversion
- Preuve : Lot 0 reproduit `18 passés, 4 échoués`; Lot 0-bis identifie un serveur Playwright stale avec chunks `_next/static` 404 pour `/bilan-gratuit` et un test WhatsApp trop couplé au nombre exact de liens ; relance finale Node 20 : `24 passed`.
- Fichiers concernés : `e2e/pages-public-bilan-gratuit.spec.ts`, `e2e/pages-public-homepage.spec.ts`, `app/bilan-gratuit/*`, `app/HomePageClient.tsx`.
- Risque : parcours lead non validé ou tests obsolètes masquant une régression UX.
- Action attendue : déterminer si les tests sont obsolètes ou si les messages validation/CTA ont régressé, puis corriger.
- Tests attendus : relance du smoke public ciblé et, ensuite, `npx playwright test` selon périmètre Gate A.
- Critère d’acceptation : smoke public critique vert ou échecs explicitement acceptés par décision QA.
- Owner suggéré : Front QA.
- Statut : Fermé Lot 0-bis. Preuve : `docs/go-live/_evidence/playwright-public-smoke-triage.md`, smoke ciblé Node 20 `24 passed`.

## P1-007 — Aligner Node local et validations Node 20

- Sévérité : P1
- Domaine : QA / CI
- Preuve : `node -v` local par défaut `v22.21.0`, `.github/workflows/ci.yml` et `Dockerfile.prod` ciblent Node 20 ; `nvm use 20.20.0` disponible.
- Fichiers concernés : `.github/workflows/ci.yml`, `Dockerfile.prod`, `package.json`, docs QA.
- Risque : build local Node 22 vert mais CI/Docker Node 20 différent.
- Action attendue : documenter Node 20 comme runtime de validation, ajouter `.nvmrc`/`engines` si décidé.
- Tests attendus : typecheck/build/Playwright sous Node 20.
- Critère d’acceptation : CI et local utilisent le même runtime ou l'écart est assumé.
- Owner suggéré : DevEx / DevOps.
- Statut : Ouvert.
# Mise à jour Lot 1 — 2026-07-02

L’inventaire API régénéré après Lot 1 indique `P0=0`, `P1=56`, `P2=93`, `OK=27` sur 176 routes. Les anciens P0 API documents/factures/activation/teacher-report ont été corrigés ou requalifiés avec preuves dans :

- `docs/go-live/11_LOT1_SECURITY_CLOSURE.md`
- `docs/go-live/_evidence/lot1-api-route-triage.md`
- `docs/go-live/_evidence/lot1-idor-tests.md`
- `docs/go-live/_evidence/lot1-rate-limit-runtime.md`

Les P1 restants deviennent le backlog bloquant bêta élargie. Aucun go-live large n’est autorisé tant que le rate limiting distribué production n’est pas prouvé et que les P1 documents/factures/bilans/paiements listés dans `api-security-matrix.full.md` ne sont pas fermés.

# Mise à jour Lot 6 — 2026-07-03

Lot 6 maintient `P0=0` et ne requalifie aucun des 6 P1 publics/paiement restants. Les réserves prioritaires deviennent des preuves d'exploitation, pas de nouvelles fonctionnalités locales :

- Redis/Upstash staging/production : NON PROUVÉ (`NEXUS_HEALTH_AUTH_ABSENT`).
- Test 429 runtime : NON EXÉCUTÉ (`AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED`).
- ContactLead dry-run DB non production : NON EXÉCUTÉ (`DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`).
- ClicToPay : `DISABLED`, paiement carte interdit.
- Worktree release candidate : audité, aucun diff `.env`, rapport racine non suivi à exclure.

Décision backlog : bêta contrôlée possible avec réserves et volume limité ; bêta élargie et go-live large restent bloqués.

# Mise à jour Lot 7 — 2026-07-03

Lot 7 ne ferme aucun P1 et ne requalifie aucune route. L'objectif est release candidate/audit :

- P0 maintenu à `0`.
- P1 maintenus à `6`.
- Scripts d'audit sécurité acceptés avec tests de non-régression : `__tests__/scripts/audit-api-guards.classification.test.ts` et `__tests__/scripts/security-audit-scripts-regression.test.ts`.
- Worktree : `269` entrées initiales, manifeste RC créé dans `docs/go-live/_evidence/lot7-release-candidate-file-manifest.md`.
- Plan de commits proposé sans exécution dans `docs/go-live/_evidence/lot7-release-candidate-commit-plan.md`.
- Runtime humain assisté : credentials absents, preuves Redis/429/DB non exécutées.

Backlog bloquant restant :

1. Prouver Redis/Upstash via healthcheck authentifié.
2. Prouver un `429` runtime réel sur staging/fenêtre autorisée.
3. Exécuter dry-run DB ContactLead non production sans PII.
4. Obtenir décision humaine formelle sur les 6 P1 publics/paiement.

Décision : `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`; `BETA_ELARGIE_BLOCKED`; `GO_LIVE_LARGE_BLOCKED`.

# Mise à jour Lot 8 — 2026-07-03

Lot 8 a nettoyé la préparation release candidate sans fermer de P1 :

- `P0=0` maintenu.
- `P1=6` maintenus.
- Manifest RC propre : `docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md`.
- Plan de commits propre : `docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md`.
- `rapport_audit_2_07_2026.md` reste exclu.
- `docs/audits/audit-nexus-reussite.md` reste en revue humaine.
- Aucun `.env` modifié.

Décision backlog : `RC_READY_FOR_HUMAN_REVIEW`, mais `BETA_ELARGIE_BLOCKED` et `GO_LIVE_LARGE_BLOCKED`.

# Mise à jour Lot 12 — 2026-07-03

Lot 12 ne requalifie aucune route.

- `P0=0` maintenu.
- `P1=6` maintenus et visibles dans `docs/go-live/api-security-matrix.full.md`.
- `docs/audits/audit-nexus-reussite.md` existe mais reste exclu des commits standards : il mentionne `173 routes API` et une sécurité "sans trou", contradictoires avec la RC actuelle `178` routes / `6` P1.
- Le runbook humain reste `READY_FOR_HUMAN_EXECUTION`.

Blocages maintenus :

1. Redis/Upstash staging/production non prouvé.
2. Test `429` runtime réel non exécuté.
3. ContactLead dry-run DB non production non exécuté.
4. Décision humaine toujours requise si l'audit Nexus doit être inclus comme historique ou réécrit.

Décision : `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`; `BETA_ELARGIE_BLOCKED`; `GO_LIVE_LARGE_BLOCKED`.

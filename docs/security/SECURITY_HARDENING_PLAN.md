# Plan de durcissement sécurité Nexus Réussite

Mis à jour le : 2026-05-28

## Résumé exécutif

Le périmètre cockpit EAM/NSI/Automatismes peut rester en bêta contrôlée, mais le go-live commercial large doit rester conditionné à la fermeture des P0 infra et API ci-dessous.

Les audits réalisés sont non destructifs. Aucun secret n'a été affiché; les fichiers `.env` ont été inspectés uniquement par noms de variables.

## Périmètre audité

- Production : `/var/www/nexus-project_v0`
- Domaine : `https://nexusreussite.academy`
- Nginx : `/etc/nginx/sites-enabled/nexusreussite.academy`
- Application : Next.js via PM2 sur port `3001`
- API : 164 routes `app/api/**/route.ts`
- ARIA : `app/api/aria/chat/route.ts`, `app/api/aria/conversations/route.ts`, `app/api/aria/feedback/route.ts`, `lib/aria.ts`

## État initial

| Élément | Résultat |
|---|---|
| Serveur | `korrigo` |
| Utilisateur audit | `root` |
| Répertoire prod | `/var/www/nexus-project_v0` |
| Branche prod | `main` |
| HEAD prod | `a4a8e88b` |
| Git prod | propre au moment de l'audit initial |
| Node prod | `v20.20.0` |
| npm prod | `10.8.2` |
| Docker Compose prod | `v5.1.0` |
| Clone local | `main` à `a4a8e88b2` |
| Git local | modification préexistante : `prisma/schema.prisma` |

Commandes utilisées : `pwd`, `hostname`, `date -Is`, `whoami`, `git rev-parse --abbrev-ref HEAD`, `git rev-parse --short HEAD`, `git status --short`, `node -v`, `npm -v`, `docker ps`, `docker compose version`.

## P0 — Bloquants avant go-live large

### P0-001 — Webroot / dotfiles / artefacts sensibles

- Priorité : P0
- Risque : présence de `.env`, `.git`, `.next/standalone/.env`, `.next/standalone/.git`, `docker-compose.prod.yml` et `prisma/schema.prisma` dans le répertoire applicatif de production. Même si Nginx proxifie correctement aujourd'hui, un mauvais `root` ou une règle Nginx future pourrait exposer secrets, historique Git ou schéma DB.
- Preuve :
  - Commande : `ls` contrôlé dans `/var/www/nexus-project_v0` par noms uniquement.
  - Résultat : `.env` présent, `.git` présent, `.github` présent, `.next/standalone/.env` présent, `.next/standalone/.git` présent.
  - Commande : `nginx -T | grep -nE 'server_name|root |alias |proxy_pass|location|try_files|deny all|\\.git|\\.env|3001'`.
  - Résultat : le vhost Nexus proxifie vers `http://127.0.0.1:3001`; aucun `root /var/www/nexus-project_v0` observé.
  - Commande : `curl -skI` sur `/.env`, `/.git/config`, `/.next/standalone/.env`, `/docker-compose.prod.yml`, `/prisma/schema.prisma`.
  - Résultat : HTTP `404` pour tous les chemins testés, sans contenu sensible affiché.
- Action :
  1. Ajouter une défense Nginx explicite dans le vhost Nexus :
     ```nginx
     location ~ /\.(?!well-known) {
         deny all;
         return 404;
     }
     location ~* \.(env|sql|sh|py|prisma|log|dump|bak|backup)$ {
         deny all;
         return 404;
     }
     location ~ ^/(tests|scripts|packages|prisma|docs|src|coverage|node_modules)/ {
         deny all;
         return 404;
     }
     ```
  2. Planifier une migration de déploiement vers un artefact runtime minimal, hors dépôt Git complet.
  3. Après migration runtime, retirer secrets et `.git` du répertoire servi ou proxifié.
- Validation :
  - `nginx -t`
  - `curl -skI` sur les chemins sensibles : 403 ou 404 uniquement.
  - `curl -I https://nexusreussite.academy/` : 200.
  - 2026-05-28 : `/.env`, `/.git/config`, `/.next/standalone/.env`, `/docker-compose.prod.yml`, `/prisma/schema.prisma`, `/docs/00_INDEX.md` et `/scripts/security/audit-api-guards.mjs` répondent tous `HTTP/2 404` via Nginx.
  - 2026-05-28 : un asset réel `/_next/static/chunks/1667-e1552476365e08c8.js` répond `HTTP/2 200`.
- Backup :
  - `/root/nexus-backups/p0-001-20260528223857/nexusreussite.academy.before`
  - `/root/nexus-backups/p0-001-20260528223857/nginx-T-before.txt`
- Rollback :
  - Restaurer `/root/nexus-backups/p0-001-20260528223857/nexusreussite.academy.before` vers `/etc/nginx/sites-enabled/nexusreussite.academy`, exécuter `nginx -t`, puis `systemctl reload nginx`.
- Statut : corrigé côté Nginx le 2026-05-28. Risque résiduel accepté temporairement : les artefacts sensibles existent encore physiquement dans `/var/www/nexus-project_v0`; la migration vers un artefact runtime minimal reste à planifier hors P0 infra immédiat.
- Propriétaire proposé : DevOps.

### P0-002 — Port applicatif 3001 bind sur toutes interfaces

- Priorité : P0
- Risque : `ss` montre PM2 en écoute sur `0.0.0.0:3001`. UFW bloque actuellement le port, mais le bind reste trop large et deviendrait exposé si la règle firewall changeait.
- Preuve :
  - Commande : `ss -ltnp | grep -E ':3001|:3000|:80|:443'`
  - Résultat : `0.0.0.0:3001` par `PM2`.
  - Commande : `ufw status verbose`
  - Résultat : `3001/tcp DENY IN` en IPv4 et IPv6.
  - Commande : `curl http://nexusreussite.academy:3001/api/health` depuis extérieur avec timeout court.
  - Résultat : timeout/échec de connexion.
- Action :
  - Configurer le process applicatif pour écouter sur `127.0.0.1:3001`.
  - Si Docker Compose redevient la source de vérité, remplacer `3001:3000` par `127.0.0.1:3001:3000`.
- Validation :
  - `ss -ltnp` doit montrer `127.0.0.1:3001`.
  - `curl -sI http://127.0.0.1:3001/api/health` doit rester 200.
  - Le domaine public doit rester 200 via Nginx.
  - 2026-05-28 : `ss -ltnp` montre `127.0.0.1:3001` et ne montre plus `0.0.0.0:3001` ni `:::3001`.
  - 2026-05-28 : `/api/health` local répond `200`, `/` public répond `200`, `/dashboard/eleve` sans auth répond `307`, `POST /api/aria/chat` sans auth répond `401`, `/api/eam/progress` sans auth répond `401`.
- Backup :
  - `/root/nexus-backups/p0-002-20260528223728/ecosystem.config.js`
  - `/root/nexus-backups/p0-002-20260528223728/ecosystem.config.standalone.js`
  - `/root/nexus-backups/p0-002-20260528223728/pm2-jlist-before.json`
  - `/root/nexus-backups/p0-002-20260528223728/pm2-describe-before.txt`
  - `/root/nexus-backups/p0-002-20260528223728/ss-before.txt`
- Rollback :
  - Restaurer l'ancien `ecosystem.config.js`, exécuter `pm2 startOrReload ecosystem.config.js --env production --update-env`, puis vérifier `pm2 status`, `ss -ltnp` et `curl -sI https://nexusreussite.academy/`.
- Statut : corrigé le 2026-05-28 par `e9ea6d64 fix(security): bind production PM2 app to localhost`.
- Propriétaire proposé : DevOps.

### P0-003 — ARIA conversationId IDOR

- Priorité : P0
- Risque : avant correction, `app/api/aria/chat/route.ts` chargeait l'historique via `conversationId` seul; `lib/aria.ts` réutilisait aussi une conversation par `id` seul. Un élève pouvait potentiellement injecter ou lire le contexte ARIA d'une conversation appartenant à un autre élève si l'identifiant était connu.
- Preuve :
  - Commande : `rg -n "conversationId|ariaConversation|ariaMessage" app/api/aria lib/aria.ts`
  - Résultat : accès non contraints identifiés dans `chat/route.ts` et `lib/aria.ts`.
- Action réalisée :
  - `app/api/aria/chat/route.ts` valide maintenant `conversationId` avec `{ id, studentId: student.id }` avant de charger l'historique ou d'écrire.
  - `lib/aria.ts` utilise `findFirst({ id, studentId })` et refuse un `conversationId` inconnu/non propriétaire.
  - Tests ajoutés/adaptés pour vérifier le refus IDOR.
- Validation :
  - `npm test -- --runInBand __tests__/api/aria.chat.route.test.ts __tests__/lib/aria.coverage.test.ts __tests__/lib/aria.test.ts __tests__/lib/aria.complete.test.ts`
  - Résultat : 4 suites, 29 tests passés.
- Rollback :
  - Revert du commit applicatif si régression, puis reload PM2 uniquement après build OK.
- Statut : corrigé côté code, à déployer après typecheck/build final.
- Propriétaire proposé : Backend.

### P0-004 — Routes API dynamiques et données sensibles

- Priorité : P0
- Risque : l'inventaire statique classe plusieurs routes dynamiques sensibles comme P0 faute d'indice explicite d'auth/ownership dans le fichier.
- Preuve :
  - Commande : `node scripts/security/audit-api-guards.mjs`
  - Résultat : 164 routes scannées; 48 P0, 38 P1, 56 P2, 22 OK.
  - Fichier : `docs/security/API_GUARD_INVENTORY.md`
- Action :
  - Auditer manuellement les 48 P0, en priorité documents, factures, assessments, sessions, bilans, reports/submissions.
  - Ajouter un test IDOR par route `[id]` propriétaire.
- Validation :
  - Matrice route/méthode/guard/ownership mise à jour.
  - Tests IDOR verts pour chaque ressource propriétaire.
- Rollback : non applicable pour l'inventaire; chaque patch route doit avoir son propre rollback Git.
- Statut : inventaire initial produit; Lot 1 corrigé, testé et déployé en production le 2026-05-28 au commit `1f37eeb0e`. Les routes documents et factures critiques du lot ont été auditées et confirmées par tests existants, mais restent classées P0 par l'inventaire statique lorsque le script ne détecte pas leurs guards manuels. P0-004 global reste ouvert tant que le Lot 2 n'est pas traité.
- Propriétaire proposé : Backend sécurité.

#### P0-004 Lot 1 — API IDOR routes propriétaires

| Groupe | Statut | Action | Test attendu | Risque résiduel |
|---|---|---|---|---|
| Documents | Audité, tests existants OK | `app/api/documents/[id]` lit le fichier seulement après owner/staff; `student/documents` est scoped élève; `coach/students/[studentId]/documents` vérifie l'assignation coach. | `__tests__/api/documents.id.route.test.ts`, `__tests__/api/student.documents.download.test.ts` | Le modèle `DocumentVisibilityScope` n'est pas encore centralisé pour un helper unique multi-rôle. |
| Factures | Audité, tests existants OK | Admin routes staff-only; endpoints PDF/receipt utilisent token ou scope parent par email via `buildInvoiceScopeWhere`. | `__tests__/api/admin.invoices.id.route.test.ts`, `__tests__/api/admin.invoices.send.route.test.ts`, `__tests__/api/invoices.pdf.route.test.ts`, `__tests__/api/invoices.receipt.pdf.route.test.ts` | Relation parent/facture reste basée sur `customerEmail`; un futur modèle bénéficiaire explicite serait plus robuste. |
| Bilans/Assessments | Corrigé | Ajout d'ownership sur `assessments/[id]/result`, `status`, `export`; ajout d'ownership et sanitization sur `bilans/[id]` et `bilans/[id]/export`. | `__tests__/api/assessments.*.route.test.ts`, `__tests__/api/bilans.id.route.test.ts` | `assessments/submit` et `assessments/test` restent à auditer hors Lot 1. |
| Coach-students | Audité, tests existants OK | Les routes coach lues dans ce lot utilisent `assertCoachCanAccessStudent` ou un check participant/session. | `__tests__/api/coach.sessions.report.route.test.ts` et tests coach-student existants | Le fallback session legacy dans `isCoachAssignedToStudent` doit être revu en Lot 2. |
| Sessions | Corrigé | `sessions/book` interdit désormais à un élève de réserver pour un autre `studentId`; cancel/video restent scoped participant/staff. | `__tests__/api/sessions.book.route.test.ts`, `__tests__/api/sessions.cancel.route.test.ts`, `__tests__/api/sessions.video.route.test.ts` | Les routes parent sessions additionnelles restent à balayer en Lot 2 si présentes. |
| Stages reservations | Corrigé partiellement | Confirmation staff-only conservée; la réservation confirmée est maintenant contrainte au `stageSlug` de l'URL. | `__tests__/api/stages/confirm.test.ts` | Les routes admin stages dynamiques restent dans le prochain lot P0/P1 selon exposition. |

#### Déploiement production Lot 1 — 2026-05-28

- Commit déployé : `1f37eeb0e fix(security): enforce API ownership checks lot 1`.
- Commit précédent production : `5c1f6c031 docs(security): close P0 infrastructure hardening`.
- Backup pré-déploiement : `/root/nexus-backups/p0-004-lot1-deploy-20260528233125`.
- Validation serveur avant reload :
  - `npm run typecheck` : OK.
  - Tests ciblés API sécurité : 7 suites, 57 tests OK sur serveur.
  - `npm run build` : OK.
- Validation production après reload :
  - PM2 `nexus-prod` : online.
  - Port applicatif : `127.0.0.1:3001`.
  - `site` : 200.
  - `dashboard_no_auth` : 307.
  - `api_health` : 200.
  - `aria_no_auth` : 401.
  - `assessment_result_no_auth`, `assessment_status_no_auth`, `assessment_export_no_auth` : 401.
  - `sessions_book_no_auth` : 401.
  - `/.env`, `/.git/config`, `/.next/standalone/.env`, `/docker-compose.prod.yml`, `/prisma/schema.prisma` : 404.
- Rollback documenté : retour Git au commit `5c1f6c031`, rebuild, puis `pm2 startOrReload ecosystem.config.js --env production --update-env`.
- Décision : bêta contrôlée maintenue; go-live large toujours non autorisé tant que P0-004 global reste ouvert.

#### P0-004 Lot 2A — Payments / Webhooks / Subscriptions

- Statut : corrigé, testé et déployé en production le 2026-05-28 UTC (serveur : 2026-05-29 00:xx +02).
- Commit déployé : `e3c07144b fix(security): enforce payment and subscription ownership`.
- Backup pré-déploiement : `/root/nexus-backups/p0-004-lot2a-deploy-20260529001813`.
- Routes :
  - `app/api/payments/bank-transfer/confirm/route.ts`
  - `app/api/payments/validate/route.ts`
  - `app/api/payments/clictopay/webhook/route.ts`
  - `app/api/parent/credit-request/route.ts`
  - `app/api/parent/subscriptions/route.ts`
  - `app/api/parent/subscription-requests/route.ts`
  - `app/api/assistante/credit-requests/route.ts`
  - `app/api/assistante/students/credits/route.ts`
  - `app/api/assistante/subscriptions/route.ts`
- Corrections :
  - prix et descriptions paiement résolus côté serveur via catalogue;
  - ownership parent/enfant ajouté pour déclaration de virement avec `studentId`;
  - validation paiement staff atomique sur `status=PENDING`;
  - approbations crédits/abonnements staff rendues idempotentes par update conditionnel;
  - montants/types crédits bornés;
  - webhook ClicToPay confirmé non product-ready (`501`) et signature invalide testée (`401` si secret configuré).
- Tests :
  - Serveur production : `npm run typecheck` OK.
  - Serveur production : 17 suites ciblées Lot 2A, 98 tests OK.
  - Serveur production : `npm run build` OK.
  - Local avant déploiement : `npm run typecheck` OK.
  - `npm run test:unit -- --runInBand` : 443 suites, 5888 tests OK.
  - `npm run test:integration -- --runInBand` : non relancé, DB test `127.0.0.1:5435` indisponible.
- Validation production :
  - PM2 `nexus-prod` online après reload applicatif contrôlé.
  - Port applicatif maintenu sur `127.0.0.1:3001`, sans retour à `0.0.0.0:3001`.
  - Smoke public : `/`, `/offres`, `/stages` en 200; `/dashboard/eleve` sans auth en 307.
  - Santé locale : `/api/health` en 200.
  - Routes financières sans auth : refusées (`401`) ou méthode non autorisée contrôlée (`405` sur POST `check-pending`), jamais 200.
  - ClicToPay : webhook vide et signature invalide en `501`; aucun paiement carte validé.
  - Chemins sensibles : `/.env`, `/.git/config`, `/.next/standalone/.env`, `/docker-compose.prod.yml`, `/prisma/schema.prisma` en 404.
  - Logs PM2 filtrés : aucune erreur critique applicative nouvelle.
- Rollback prévu, non exécuté : retour Git au commit `207382f19`, rebuild, puis `pm2 startOrReload ecosystem.config.js --env production --update-env`.
- Risque résiduel :
  - ClicToPay réel non implémenté; activation commerciale paiement carte interdite tant que provider/signature/idempotence/montant/devise ne sont pas complets.
  - P0-004 global reste ouvert hors Lot 2A.

#### P0-004 Lot 2B — Admin users / Assistante students-coaches

- Statut : corrigé, testé et déployé en production le 2026-05-29.
- Commit sécurité déployé : `8ce959366 fix(security): harden admin and assistante ownership checks`.
- Runtime production validé : `9ffdcb46`, qui contient `8ce959366` plus deux commits homepage déjà présents sur `main` avant cette validation.
- Backup pré-déploiement : `/root/nexus-backups/p0-004-lot2b-deploy-20260529005132`.
- Routes :
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/search/route.ts`
  - `app/api/assistante/students/route.ts`
  - `app/api/assistante/students/[studentId]/route.ts`
  - `app/api/assistante/students/[studentId]/documents/route.ts`
  - `app/api/assistante/activate-student/route.ts`
  - `app/api/assistante/coaches/route.ts`
  - `app/api/assistante/coaches/manage/route.ts`
  - `app/api/assistante/coaches/manage/[id]/route.ts`
  - `app/api/assistante/assignments/route.ts`
  - `app/api/assistante/assignments/[id]/route.ts`
- Corrections :
  - recherche admin users limitée à ADMIN uniquement;
  - `activationUrl` tokenisée retirée de la réponse activation élève;
  - `localPath` retiré des réponses documents assistante;
  - création/update coach validés par Zod et enum `Subject`;
  - routes coach manage `[id]` ouvertes à ADMIN/ASSISTANTE au lieu d'ASSISTANTE seule;
  - doublons actifs coach/élève refusés pour tout type d'affectation.
- Tests :
  - Serveur production : `npm run typecheck` OK.
  - Serveur production : 7 suites ciblées Lot 2B, 93 tests OK.
  - Serveur production : `npm run build` OK.
  - Serveur production : tests de non-exposition champs sensibles, 3 suites, 36 tests OK.
  - Local avant déploiement : `npm run typecheck` OK.
  - Local avant déploiement : `npm run test:unit -- --runInBand` : 443 suites, 5894 tests OK.
  - Local avant déploiement : `npm run build` OK.
  - `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.
  - `npm run test:integration -- --runInBand` : non lancé, DB test `127.0.0.1:5435` fermée.
- Validation production :
  - PM2 `nexus-prod` online après reload applicatif contrôlé.
  - Port applicatif maintenu sur `127.0.0.1:3001`.
  - Smoke public : `/`, `/offres`, `/stages` en 200; `/dashboard/eleve` sans auth en 307.
  - Santé locale : `/api/health` en 200.
  - Routes admin/assistante sans auth : refusées en `401` ou méthode non autorisée contrôlée en `405`, jamais 200.
  - Champs sensibles vérifiés par tests : `password`, `activationToken`, `activationUrl`, `localPath` et tokens bruts absents.
  - Chemins sensibles : `/.env`, `/.git/config`, `/.next/standalone/.env`, `/docker-compose.prod.yml`, `/prisma/schema.prisma` en 404.
  - Logs PM2 filtrés : aucune erreur critique applicative nouvelle.
- Rollback prévu, non exécuté : retour Git au commit `e3c07144b`, rebuild, puis `pm2 startOrReload ecosystem.config.js --env production --update-env`.
- Risque résiduel :
  - consolidation `assistant`/`assistante` à planifier en P1;
  - logs admin users à revoir en P1 logs/PII;
  - P0-004 global reste ouvert hors Lot 2B : NPC, messages/conversations, assessments submit/test.

#### P0-004 Lot 2C — NPC reports/submissions/documents

- Statut : déployé en production le 2026-05-29.
- Commit déployé : `6d7677ba6 fix(security): harden NPC reports and submissions access`.
- Routes :
  - `app/api/npc/submissions/route.ts`
  - `app/api/npc/submissions/[submissionId]/documents/route.ts`
  - `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts`
  - `app/api/npc/submissions/[submissionId]/generate/route.ts`
  - `app/api/npc/uploads/route.ts`
  - `app/api/npc/files/[...path]/route.ts`
  - `app/api/coach/students/[studentId]/generated-reports/route.ts`
  - `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts`
  - `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts`
- Corrections :
  - projections submissions/documents sans chemins disque, OCR, jobs IA ou payloads internes;
  - upload legacy avec auth/RBAC avant parsing multipart et réponse sans `filePath`;
  - route `/api/npc/files/[...path]` liée à `CopyPage` exact avant lecture disque;
  - durcissement path traversal dans `readSecureFile`;
  - generated reports coach sans `contextJson`, `llmJson`, `validatedJson` ni `latexSource`;
  - test download : aucun PDF lu si `reportId` n'appartient pas au `studentId`.
- Tests :
  - 9 suites ciblées, 104 tests OK.
  - `npm run typecheck` : OK.
  - `npm run test:unit -- --runInBand` : 445 suites, 5904 tests OK.
  - `npm run build` : OK.
  - `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.
  - `npm run test:integration -- --runInBand` : non lancé, DB test `127.0.0.1:5435` fermée.
- Validation production :
  - backup : `/root/nexus-backups/p0-004-lot2c-deploy-20260529080839`;
  - typecheck serveur : OK;
  - tests ciblés Lot 2C serveur : 9 suites, 104 tests OK;
  - build serveur : OK;
  - PM2 `nexus-prod` online;
  - port : `127.0.0.1:3001`;
  - smoke routes NPC sans auth : 401/405, jamais 200;
  - path traversal `/api/npc/files/*` : aucun 200;
  - champs sensibles vérifiés par tests post-reload : 6 suites, 51 tests OK;
  - chemins sensibles web : 404.
- Déploiement : terminé. Rollback prévu, non exécuté.
- Risque résiduel :
  - antivirus upload et inspection contenu réel en P1;
  - centralisation projections NPC/report en P1;
  - P0-004 global reste ouvert hors Lot 2C : messages/conversations, assessments submit/test.

#### P0-004 Lot 2D — Messages / conversations

- Statut : corrigé, testé, CI verte et déployé production le 2026-05-29.
- Commits déployés :
  - `fa4355b61 fix(security): harden message and conversation access`
  - `ae31a8a77 fix(security): tighten message projection hardening`
  - `499d5d3bb test(e2e): harden homepage navbar dropdown checks`
- CI GitHub :
  - Run : `26625334072` (`CI Pipeline`)
  - SHA : `499d5d3bbcb1a5593efe61a30d090fdc302b78ed`
  - Conclusion : `success`
  - URL : `https://github.com/cyranoaladin/nexus-project_v0/actions/runs/26625334072`
- Routes :
  - `app/api/messages/send/route.ts`
  - `app/api/messages/conversations/route.ts`
- Corrections :
  - `senderId` imposé par la session, jamais par le body client;
  - autorisation relationnelle du `receiverId` selon rôle et relation métier;
  - coach limité aux élèves assignés et parents d'élèves assignés;
  - parent limité aux coachs assignés à ses enfants;
  - élève limité au staff ou à ses coachs assignés;
  - `fileUrl` / `fileName` arbitraires refusés tant qu'aucun endpoint attachment autorisé n'existe;
  - projections messages/participants sans `password`, tokens, email, téléphone, `fileUrl`, `fileName` ou chemins disque.
- Tests :
  - 3 suites ciblées, 16 tests OK.
  - `npm run typecheck` : OK.
  - `npm run test:unit -- --runInBand` : 446 suites, 5911 tests OK.
  - `npm run build` : OK.
  - `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.
  - `npm run test:integration -- --runInBand` : non lancé, DB test `127.0.0.1:5435` fermée.
- Validation production :
  - backup : `/root/nexus-backups/deploy-p0-004-lot2d-navbar-20260529102234`;
  - HEAD avant : `6d7677ba6c5fd5f6bccc276e5c27290b5b79c5af`;
  - HEAD après : `499d5d3bbcb1a5593efe61a30d090fdc302b78ed`;
  - typecheck serveur : OK;
  - tests ciblés serveur demandés : 2 suites, 13 tests OK;
  - tests ciblés serveur complémentaires Lot 2D : 2 suites, 8 tests OK;
  - build serveur : OK (`BUILD_EXIT=0`);
  - PM2 `nexus-prod` online après reload;
  - port : `127.0.0.1:3001`;
  - smoke public : `site=200`, `dashboard_no_auth=307`, `api_health=200`;
  - smoke sans auth : `aria_no_auth=405`, `messages_no_auth=405`;
  - smoke spécifique : `GET /api/messages/send=405`, `GET /api/aria/conversations=401`, `GET /api/aria/chat=405`;
  - logs filtrés : aucune nouvelle erreur critique applicative détectée.
- Déploiement : terminé. Rollback prévu, non exécuté.
- Risque résiduel :
  - rate limit messaging, modération contenu, audit trail et attachments signés en P1;
  - P0-004 global reste ouvert hors Lot 2D : assessments submit/test.

#### CI E2E Navbar Stabilization — Homepage

- Statut : corrigé, CI verte et inclus dans le déploiement production du 2026-05-29.
- Commit : `499d5d3bb test(e2e): harden homepage navbar dropdown checks`.
- Cause : tests Playwright homepage trop dépendants de `[role="menu"]` et du hover seul; le produit n'était pas cassé.
- Correction : tests orientés comportement utilisateur, avec ouverture hover puis click fallback et ciblage du lien par `href` + texte dans le header.
- Validation locale avant push :
  - `npx playwright test e2e/real/pages/01-homepage.spec.ts --config=playwright.ci.config.ts --project=chromium` : 14 tests OK.
  - `npm run typecheck` : OK.
  - `npm run build` : OK.
  - `npm run test:unit -- --runInBand` : 446 suites, 5911 tests OK.
- CI GitHub :
  - Run : `26625334072`
  - Conclusion : `success`
- Déploiement : commit inclus dans HEAD production `499d5d3bb`.

#### Lot 2E — Assessments submit/test

- Statut : corrigé, testé, CI verte et déployé production le 2026-05-29.
- Commit déployé : `5f1d25965 fix(security): harden assessment access controls`.
- Commit CI/test inclus : `9e00e27ce test(integration): align predict ownership with hardened contract`.
- CI GitHub :
  - Run : `26628271864`
  - Conclusion : `success`
- Routes :
  - `app/api/assessments/submit/route.ts`
  - `app/api/assessments/test/route.ts`
  - `app/api/assessments/predict/route.ts`
  - `app/api/assessments/[id]/result/route.ts`
  - `app/api/assessments/[id]/status/route.ts`
  - `app/api/assessments/[id]/export/route.ts`
- Corrections :
  - endpoint `assessments/test` réservé `ADMIN`, avec refus 401/403 avant accès Prisma;
  - `assessments/submit` conserve son caractère public produit, mais avec rate limit `expensive`, `assessmentVersion` validé par Zod, `studentId` client ignoré et erreurs internes non exposées;
  - `assessments/predict` valide le payload par Zod et vérifie l'ownership via `Student.id`, parent/enfant et assignation coach active;
  - logs d'erreur assessment réduits au type d'erreur, sans payload ni exception complète.
- Tests :
  - tests ciblés Lot 2E : 6 suites, 56 tests OK.
  - `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.
  - CI `26627488455` : bloquée sur `__tests__/integration/predict-ownership.real.test.ts`, test d'intégration aligné ensuite sur le contrat durci `Student.id` + `CoachStudentAssignment` active.
  - CI post-fix `26628271864` : `success`.
  - validations serveur avant reload : `npm run typecheck` OK, tests ciblés Lot 2E OK, `NODE_ENV=production npm run build` OK (`BUILD_EXIT=0`).
  - smoke production après reload : `site=200`, `dashboard_no_auth=307`, `api_health=200`, `assessments_test_no_auth=401`, `assessments_predict_no_auth=405`, `assessments_submit_get=405`, `predict POST no-auth=401`.
  - payload `assessmentVersion="../secret"` : refus contrôlé `Validation failed`, sans 500 ni message interne.
  - backup : `/root/nexus-backups/deploy-p0-004-lot2e-assessments-20260529165122`.
  - `test:integration` local non lancé si DB test `127.0.0.1:5435` fermée; CI intégration post-fix verte.
- Risques résiduels :
  - `assessments/submit` reste public par design; anti-abus additionnel type CAPTCHA/rate limit distribué à traiter en P1 si nécessaire;
  - consolidation de l'inventaire statique documents/factures/bilans à prévoir si le bruit P0 persiste.
- Déploiement : terminé. Rollback prévu, non exécuté.

#### Lot 2F — Stages reservations public hardening

- Statut : corrigé, testé, CI verte et déployé production le 2026-05-29.
- Déploiement :
  - commit déployé : `6237a6be3 fix(security): harden stage reservation access`;
  - CI GitHub : run `26651571313`, conclusion `success`;
  - backup : `/root/nexus-backups/deploy-p0-004-lot2f-stages-20260529195031`;
  - HEAD avant : `9e00e27cecdc22b6aa82264ee293e6ef873501f4`;
  - HEAD après : `6237a6be3c8c166eab425e5faac61bd8996d565f`;
  - PM2 : `nexus-prod` online après reload.
- Routes :
  - `app/api/stages/[stageSlug]/inscrire/route.ts`
  - `app/api/stages/[stageSlug]/reservations/route.ts`
  - `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts`
  - `app/api/stages/submit-diagnostic/route.ts`
  - `app/api/stages/[stageSlug]/bilans/route.ts`
  - `app/api/stages/route.ts`
  - `app/api/stages/[stageSlug]/route.ts`
- Corrections :
  - inscription publique : schema Zod strict, rate limit, réponse minimale sans id reservation ni token;
  - listing reservations : projection staff explicite sans `activationToken`, notes internes, User complet ou champs stage internes;
  - diagnostic public : `reservationId` corrélé à l'email soumis avant mutation;
  - catalogue public stages : retrait des bilans, noms élèves et `pdfUrl` de la réponse publique;
  - logs erreur inscription/diagnostic réduits au type d'erreur.
- Tests :
  - tests ciblés stages/reservations : 8 suites, 61 tests OK;
  - `npm run typecheck` : OK;
  - `npm run build` : OK;
  - `NODE_ENV=production npm run build` serveur : OK, `BUILD_EXIT=0`;
  - smoke production : `site=200`, `api_health=200`, `stages_public=200`, `reservations_no_auth=401`, `inscrire_get=405`, `submit_diagnostic_get=405`;
  - payload inscription avec champs interdits : refusé par validation;
  - diagnostic malformé : refus contrôlé sans 500 bavard;
  - `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.
- Risques résiduels :
  - `app/api/admin/stages/[stageId]/**` à traiter en Lot 2F-bis;
  - coach stage reports, parent bilans PDF et bilans spécialisés à traiter en Lot 2G;
  - anti-abus distribué/CAPTCHA pour endpoints publics à planifier en P1 si nécessaire.
- Déploiement : terminé. Rollback prévu, non exécuté.

#### Lot 2G — Bilans/reports visibility

- Statut : corrigé, testé, CI verte et déployé production le 2026-05-29.
- Déploiement :
  - commit déployé : `dd1e519b6 fix(security): harden bilan and report visibility`;
  - CI GitHub : run `26654623489`, conclusion `success`;
  - backup : `/root/nexus-backups/deploy-p0-004-lot2g-bilans-reports-20260529203030`;
  - HEAD avant : `6237a6be3c8c166eab425e5faac61bd8996d565f`;
  - HEAD après : `dd1e519b661e581555f92fedf1f2c414be726f15`;
  - PM2 : `nexus-prod` online après reload.
- Routes :
  - `app/api/parent/bilans/[id]/pdf/route.ts`
  - `app/api/coach/sessions/[sessionId]/report/route.ts`
  - `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts`
  - `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts`
- Corrections :
  - PDF parent : conservation des contrôles parent/ownership/publication existants, mais suppression du champ `details` en erreur 500 et log réduit au type d'erreur;
  - rapport session coach : réponse GET nettoyée des relations imbriquées `student`, `coach` et `session`;
  - rapports stage coach EAF et Maths première : retrait de `student.email` du `select` Prisma et de la réponse JSON;
  - logs d'erreur des rapports réduits, sans stack ni payload complet.
- Tests :
  - tests ciblés Lot 2G : 4 suites, 57 tests OK;
  - régressions bilans/reports : 4 suites, 31 tests OK;
  - `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes;
  - `npm run typecheck` : OK;
  - `npm run build` : OK;
  - validations serveur avant reload : `npm run typecheck` OK, tests ciblés Lot 2G OK, régressions bilans/reports OK, `NODE_ENV=production npm run build` OK (`BUILD_EXIT=0`);
  - smoke production : `site=200`, `dashboard_no_auth=307`, `api_health=200`, `parent_bilan_pdf_no_auth=401`, `coach_session_report_no_auth=401`, `eaf_stage_report_no_auth=401`, `maths_stage_report_no_auth=401`;
  - invalid POST session report no-auth : `Unauthorized`;
  - `npm run test:unit -- --runInBand` : 449 suites, 5940 tests OK;
  - `test:integration` non lancé : DB test `127.0.0.1:5435` fermée.
- Risques résiduels :
  - `app/api/admin/stages/[stageId]/**` à traiter en Lot 2F-bis;
  - centralisation des projections bilans/reports à planifier en P1 si nécessaire.
- Déploiement : terminé. Rollback prévu, non exécuté.

#### Lot 2F-bis — Admin stages

- Statut : corrigé, testé, CI verte et déployé production le 2026-05-29.
- Routes :
  - `app/api/admin/stages/[stageId]/route.ts`
  - `app/api/admin/stages/[stageId]/coaches/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts`
- Règle métier :
  - `ADMIN` only pour stage detail/PATCH/DELETE et assignation/retrait coach;
  - `ADMIN` + `ASSISTANTE` pour la gestion des séances de stage.
- Corrections :
  - vérification explicite du stage avant listing/mutation dynamique;
  - suppression coach refusée si aucune association `stageId + coachId` n'existe;
  - création/mise à jour de séance refusée si le coach fourni n'est pas assigné au stage;
  - PATCH session valide la chronologie finale complète, y compris quand seul `startAt` ou `endAt` est modifié;
  - logs d'erreur admin stages réduits au type d'erreur.
- Tests :
  - tests ciblés Lot 2F-bis : 4 suites, 22 tests OK;
  - régression admin stages existante : 1 suite, 13 tests OK;
  - validations serveur avant reload : `npm run typecheck` OK, tests ciblés + régression admin stages 5 suites, 35 tests OK, `NODE_ENV=production npm run build` OK (`BUILD_EXIT=0`);
  - `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.
- Déploiement production :
  - CI GitHub : run `26656051489`, `completed/success`, SHA `802acb9112d90ddcd04adb8699367da2ac664ae3`;
  - backup : `/root/nexus-backups/deploy-p0-004-lot2f-bis-admin-stages-20260529210803`;
  - HEAD avant : `dd1e519b661e581555f92fedf1f2c414be726f15`;
  - HEAD après : `802acb91`;
  - smoke après reload : site 200, dashboard no-auth 307, api health 200, routes admin stages sans auth jamais 200, POST/PATCH invalides sans auth refusés sans mutation.
- Risques résiduels :
  - audit global final P0-004 à produire après déploiement;
  - réduction supplémentaire des projections admin à planifier en P1 si nécessaire.
- Déploiement : terminé. Rollback prévu, non exécuté.

#### Audit global de clôture P0-004 — API / IDOR

- Statut : audit documentaire produit le 2026-05-29, sans changement applicatif ni déploiement.
- Rapport : `docs/security/P0_API_CLOSURE_AUDIT_2026-05-29.md`.
- Résultat : 164 routes inventoriées, 42 P0 statiques, 0 vrai P0 API/IDOR ouvert identifié après croisement avec les lots déployés.
- Décision recommandée : P0-004 clôturable côté API/IDOR sous réserve de validation humaine.
- Go-live large : toujours NON autorisé automatiquement; validation produit/ops/RGPD/monitoring requise.
- Bêta contrôlée : maintenue; bêta élargie possible seulement après validation humaine.

## P1 — Durcissement court terme

### P1-001 — CSP
- Risque : `unsafe-inline`/`unsafe-eval` augmentent l'impact XSS.
- Fichiers concernés : `middleware.ts`, configuration headers.
- Action : plan de migration vers nonce/CSP plus stricte.
- Test attendu : pages dashboard, Auth.js, Radix, analytics et Jitsi sans régression.
- Statut : à planifier.
- Propriétaire proposé : Sécurité frontend.
- Rollback : revenir à la CSP actuelle.

### P1-002 — CORS
- Risque : helper CORS permissif si origine non fournie.
- Fichiers concernés : helpers CORS/API.
- Action : same-origin par défaut, allowlist explicite pour API publiques.
- Test attendu : API authentifiées sans `Access-Control-Allow-Origin: *`.
- Statut : à auditer.
- Propriétaire proposé : Backend.
- Rollback : revert helper.

### P1-003 — Permissions-Policy Jitsi
- Risque : `camera=(), microphone=()` peut casser les sessions vidéo.
- Fichiers concernés : headers Nginx/middleware/pages vidéo.
- Action : tester Jitsi et spécialiser les headers si nécessaire.
- Test attendu : session vidéo avec caméra/micro fonctionnels.
- Statut : à tester.
- Propriétaire proposé : DevOps/frontend.
- Rollback : restaurer headers actuels.

### P1-004 — Rate limiting
- Risque : brute force et spam sur auth, reset, ARIA, contact, paiement.
- Fichiers concernés : `lib/rate-limit/**`, routes API publiques et mutations sensibles.
- Action : rate limit centralisé avec garde async distribuée optionnelle Upstash, fallback mémoire dev/test, et bypass `RATE_LIMIT_DISABLE=1` ignoré en production.
- Test attendu : seuils 429 couverts par tests; couverture des routes publiques sensibles.
- Statut : P1-A corrigé, testé, CI verte et déployé production le 2026-05-29.
- Propriétaire proposé : Backend.
- Rollback : revert du commit P1-A; la variable `RATE_LIMIT_DISABLE` ne désactive plus la production.
- Document : `docs/security/P1_A_ANTI_ABUSE_RATE_LIMITING_2026-05-29.md`.
- Déploiement : `docs/security/P1_A_DEPLOYMENT_REPORT_2026-05-29.md`.
- CI : run `26659083757`, SHA `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`, conclusion `success`.
- Backup : `/root/nexus-backups/deploy-p1-a-anti-abuse-rate-limit-20260529221733`.
- HEAD prod : `802acb9112d90ddcd04adb8699367da2ac664ae3` -> `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- Validations serveur : typecheck OK; tests ciblés P1-A OK, 9 suites / 50 tests; build production OK; PM2 reload OK.
- Smoke production : `site=200`, `dashboard_no_auth=307`, `api_health=200`, routes publiques GET en 405, payloads invalides refusés proprement.
- Routes couvertes P1-A : `/api/bilan-gratuit`, `/api/stages/[stageSlug]/inscrire`, `/api/stages/submit-diagnostic`, `/api/assessments/submit`, `/api/contact`, `/api/auth/reset-password`.
- Variables production attendues : `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`; état au déploiement : missing/missing.
- Mode production observé : fallback mémoire, avec warning attendu en logs; `RATE_LIMIT_DISABLE=1` absent.
- Limite : bêta élargie encore conditionnelle tant que le backend distribué Upstash n'est pas configuré et validé en production.
- Runbook configuration Upstash : `docs/security/P1_A_UPSTASH_CONFIGURATION_RUNBOOK_2026-05-29.md`.
- Vérification opérationnelle post-déploiement : runtime `69f0e143`, `UPSTASH_REDIS_REST_URL=missing`, `UPSTASH_REDIS_REST_TOKEN=missing`, `RATE_LIMIT_DISABLE_1=absent`, `api_health=200`; aucun secret lu ou modifié.
- Action suivante actualisée : P1-A-bis ajoute le backend Redis local VPS via `REDIS_URL`, gratuit et prioritaire sur Upstash. Upstash reste une option future.
- P1-A-bis : corrigé/testé localement, non déployé production. Document : `docs/security/P1_A_BIS_REDIS_LOCAL_RATE_LIMITING_2026-05-29.md`.
- Tentative déploiement P1-A-bis du 2026-05-30 : bloquée avant build/reload par timeouts des tests 429 quand `REDIS_URL` est présent sur le serveur; disque rollbacké vers `69f0e143`, PM2 non rechargé, health OK. Rapport : `docs/security/P1_A_BIS_DEPLOYMENT_BLOCKER_2026-05-30.md`.
- Correctif tests P1-A-bis poussé : `024721f92f9aebfe833f90bae5a80ee2ba3dfc0e`; validations locales OK, mais CI GitHub bloquée par un problème externe Actions/billing. Rapport : `docs/security/P1_A_BIS_CI_BILLING_BLOCKER_2026-05-30.md`.
- Reprise P1-A-bis : attendre résolution GitHub billing puis CI `CI Pipeline` et `Data Invariants` vertes sur `024721f92` avant toute nouvelle tentative de déploiement.
- État de gel P1-A-bis : production stable sur `69f0e143`, worktree propre conservé pour reprise, repo principal dirty hors déploiement, P1-B suspendu. Rapport : `docs/security/P1_A_BIS_RECOVERY_STATE_2026-05-30.md`.
- Gouvernance des flux ouverts : repo principal réservé aux chantiers STMG/Prisma locaux, interdit pour déploiement sécurité; P1-A-bis doit reprendre depuis le worktree propre après résolution CI. Document : `docs/security/PROJECT_STATE_AND_WORKSTREAMS_2026-05-30.md`.
- Condition bêta élargie : installer/configurer Redis local sur le VPS, ajouter `REDIS_URL`, reload PM2 contrôlé et valider le mode `redis`; tant que cette validation n'est pas faite, l'anti-abus distribué reste non actif en production.

### P1-005 — Logs sans PII excessive
- Risque : données élèves/parents dans logs.
- Fichiers concernés : logger middleware, routes ARIA/documents/bilans.
- Action : normaliser redaction et correlation IDs.
- Test attendu : snapshot de logs sans email/téléphone/contenu de message.
- Statut : à auditer.
- Propriétaire proposé : Backend.
- Rollback : revert logger.

### P1-006 — Backup / restore drill
- Risque : sauvegarde non prouvée.
- Fichiers concernés : scripts ops.
- Action : backup PostgreSQL quotidien et test de restauration.
- Test attendu : restauration sur DB temporaire documentée.
- Statut : à faire.
- Propriétaire proposé : DevOps.
- Rollback : non applicable.

### P1-007 — Monitoring et alerting
- Risque : incidents non détectés.
- Fichiers concernés : PM2, Nginx, health endpoints.
- Action : alerting 5xx, disque, DB, SMTP, RAG, worker.
- Test attendu : alerte de test reçue.
- Statut : à faire.
- Propriétaire proposé : DevOps.
- Rollback : désactiver alerting.

### P1-008 — Worker NPC healthcheck
- Risque : healthcheck stub et `NPC_LLM_MODE=stub` peuvent masquer une fonctionnalité non réelle.
- Fichiers concernés : `docker-compose.prod.yml`, worker NPC.
- Action : healthcheck DB/queue/provider; masquer UI si mode stub.
- Test attendu : healthcheck échoue si DB/queue indisponible.
- Statut : à faire.
- Propriétaire proposé : Backend/DevOps.
- Rollback : revenir au healthcheck actuel.

## Audit go-live global post P0-004

- Document : `docs/security/GO_LIVE_READINESS_AUDIT_2026-05-29.md`.
- Statut : audit documentaire terminé après clôture P0-004 API/IDOR.
- Décision : go-live large NON recommandé automatiquement.
- Bêta contrôlée : maintenue.
- Bêta élargie : envisageable uniquement après validation humaine produit/ops/RGPD/monitoring et traitement des conditions minimales P1.
- Premier lot P1 recommandé : `P1-A — Anti-abus public et rate limiting distribué`.
- Bloquants principaux avant go-live large : rate limiting distribué/CAPTCHA, logs sans PII excessive, backup/restore drill, monitoring/alerting, RGPD mineurs, décision paiement carte, runtime minimal.

## P2 — Product-ready

### P2-001 — Canonicalisation SessionBooking
- Risque : double source de vérité `Session`/`SessionBooking`.
- Action : choisir `SessionBooking` comme canonique, migrer usages.
- Test attendu : invariant débit crédit + réservation + rapport.
- Statut : backlog.

### P2-002 — Canonicalisation Bilan
- Risque : `Diagnostic`/`Assessment`/`Bilan`/`StageBilan` divergents.
- Action : UI lit prioritairement `Bilan`.
- Test attendu : parcours parent/élève/admin cohérent.
- Statut : backlog.

### P2-003 — Ledger financier
- Risque : revenu double compté via paiements + abonnements.
- Action : définir source de vérité financière.
- Test attendu : revenu mensuel calculé depuis ledger/factures payées.
- Statut : backlog.

### P2-004 — ADR RAG
- Risque : documentation contradictoire pgvector/ChromaDB/FastAPI.
- Action : ADR backend RAG canonique.
- Test attendu : health `/api/health/rag`.
- Statut : backlog.

### P2-005 — RGPD et mineurs
- Risque : données élèves, IA, documents et paiements insuffisamment gouvernés.
- Action : politique de confidentialité, conservation, export/suppression, accès documents.
- Test attendu : procédure DSAR documentée.
- Statut : backlog.

### P2-006 — Accessibilité
- Risque : dashboards riches avec dette WCAG.
- Action : audit WCAG rôle par rôle.
- Test attendu : axe/playwright sur parcours principaux.
- Statut : backlog.

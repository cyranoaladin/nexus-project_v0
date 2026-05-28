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
- Statut : inventaire initial produit; Lot 1 partiellement fermé le 2026-05-28 sur assessments/bilans/sessions/stages reservations. Les routes documents et factures critiques du lot ont été auditées et confirmées par tests existants, mais restent classées P0 par l'inventaire statique lorsque le script ne détecte pas leurs guards manuels.
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
- Fichiers concernés : routes API publiques et mutations sensibles.
- Action : appliquer rate limit centralisé.
- Test attendu : seuils 429 couverts par tests.
- Statut : à faire.
- Propriétaire proposé : Backend.
- Rollback : désactiver par variable env.

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

# Clôture P0 infra — Nexus Réussite

Date : 2026-05-28

## Verdict

| Item | Statut |
|---|---|
| P0-001 Webroot / dotfiles | Corrigé côté Nginx hardening |
| P0-002 Port applicatif 3001 | Corrigé côté PM2 bind localhost |
| P0-003 ARIA IDOR | Déjà corrigé et déployé par `6f54ddc1` |
| P0-004 API sensibles | Inventaire créé, audit route par route restant |
| Go-live large | Non autorisé tant que P0-004 n'est pas trié sur routes sensibles |
| Bêta contrôlée | Maintenue sous surveillance |

## Tableau de clôture

| ID | Sujet | Avant | Après | Validation | Rollback | Statut |
|---|---|---|---|---|---|---|
| P0-002 | Bind PM2 | `0.0.0.0:3001` | `127.0.0.1:3001` | `ss`, PM2 online, health local 200, site 200 | Backup `/root/nexus-backups/p0-002-20260528223728` | Fermé |
| P0-001 | Nginx sensitive paths | 404 applicatif par proxy, pas de règle explicite Nexus | 404 Nginx courte avant proxy | `nginx -t`, sensitive paths 404, asset `_next` 200 | Backup `/root/nexus-backups/p0-001-20260528223857` | Fermé côté Nginx |

## Commandes principales exécutées

### Préflight

```bash
git status --short
git log --oneline -3
pm2 status <PROCESS_NAME> --no-color
pm2 describe <PROCESS_NAME> --no-color
ss -ltnp | grep -E ':3001|:3000|:80|:443'
ufw status verbose
curl -sI http://127.0.0.1:3001/api/health
curl -sI https://nexusreussite.academy/
```

### P0-002

```bash
pm2 save
pm2 jlist > /root/nexus-backups/p0-002-20260528223728/pm2-jlist-before.json
pm2 describe <PROCESS_NAME> --no-color > /root/nexus-backups/p0-002-20260528223728/pm2-describe-before.txt
ss -ltnp > /root/nexus-backups/p0-002-20260528223728/ss-before.txt
pm2 startOrReload ecosystem.config.js --env production --update-env
pm2 save
```

### P0-001

```bash
cp -a /etc/nginx/sites-enabled/nexusreussite.academy /root/nexus-backups/p0-001-20260528223857/nexusreussite.academy.before
nginx -T > /root/nexus-backups/p0-001-20260528223857/nginx-T-before.txt 2>&1
nginx -t
systemctl reload nginx
```

## Fichiers modifiés

### Versionnés

- `ecosystem.config.js`
- `docs/security/SECURITY_HARDENING_PLAN.md`
- `docs/security/P0_INFRA_CLOSURE_2026-05-28.md`

### Hors repo

- `/etc/nginx/sites-enabled/nexusreussite.academy`

## Backups créés

| Backup | Contenu |
|---|---|
| `/root/nexus-backups/p0-002-20260528223728` | `ecosystem.config.js`, copie standalone, PM2 jlist/describe, `ss` avant |
| `/root/nexus-backups/p0-001-20260528223857` | vhost Nginx avant modification, dump `nginx -T` avant |

## Validations finales

| Test | Résultat |
|---|---|
| Git prod | propre |
| PM2 `<PROCESS_NAME>` | online |
| Port app | `127.0.0.1:3001` |
| `nginx -t` | OK |
| Site public | `200` |
| Dashboard sans auth | `307` |
| API health local | `200` |
| `POST /api/aria/chat` sans auth | `401` |
| `/api/eam/progress` sans auth | `401` |
| `/.env` | `404` |
| `/.git/config` | `404` |
| `/.next/standalone/.env` | `404` |
| `/docker-compose.prod.yml` | `404` |
| `/prisma/schema.prisma` | `404` |
| Asset `_next/static` réel | `200` |

## Risques résiduels

- Les artefacts sensibles existent encore physiquement dans `<APP_DIR>` (`.env`, `.git`, `.next/standalone/.env`, `.next/standalone/.git`). Ils sont désormais protégés par reverse proxy + règles Nginx, mais une migration vers un artefact runtime minimal reste nécessaire.
- P0-004 reste ouvert : les routes API dynamiques sensibles doivent être auditées route par route.
- P1 reste ouvert : CSP, CORS, Permissions-Policy Jitsi, rate limiting, logs sans PII, backup/restore, monitoring et worker NPC.
- Les logs PM2 récents contiennent encore des erreurs connues `Failed to find Server Action "x"` liées aux onglets ouverts sur d'anciens déploiements; pas traité dans ce lot.

## Prochaine mission recommandée

P0-004 API IDOR Lot 1 :

1. `app/api/documents/[id]/route.ts`
2. `app/api/admin/invoices/[id]/route.ts`
3. `app/api/invoices/**`
4. `app/api/assessments/[id]/**`
5. `app/api/coach/students/[studentId]/**`
6. `app/api/sessions/**`
7. `app/api/stages/**/reservations/**`

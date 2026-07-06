# Checklist environnement et infrastructure

Ne jamais écrire de valeurs de secrets dans ce document. Statut Lot 0 : noms de variables observés par lecture de code uniquement, valeurs non lues.

## Variables obligatoires probables

| Variable | Usage | Statut attendu |
| --- | --- | --- |
| `DATABASE_URL` | Prisma/PostgreSQL | Obligatoire production |
| `NEXTAUTH_SECRET` | Auth sessions | Obligatoire production |
| `NEXTAUTH_URL` | URL canonique auth | Obligatoire production |
| `NEXT_PUBLIC_APP_URL` | URL publique client | Obligatoire recommandé |
| `EMAIL_FROM` ou `SMTP_FROM` | Expéditeur email | Obligatoire si mail actif |
| `SMTP_HOST` | SMTP | Obligatoire si mail actif |
| `SMTP_PORT` | SMTP | Obligatoire si mail actif |
| `SMTP_USER` | SMTP | Obligatoire si mail actif |
| `SMTP_PASS` ou `SMTP_PASSWORD` | SMTP | Obligatoire si mail actif, nom à harmoniser |
| `REDIS_URL` ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Rate limiting distribué | Obligatoire go-live large |
| `RAG_INGESTOR_URL` | RAG | Obligatoire si ARIA/RAG actif |
| `RAG_API_TOKEN` | RAG auth | Obligatoire si service protégé |
| `OPENAI_API_KEY` ou provider IA choisi | ARIA/LLM | Obligatoire si IA live |
| `NPC_LLM_MODE` | NPC live/stub/off | Obligatoire à expliciter |

## Variables optionnelles / contexte

- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_DISABLED`
- `CRM_LEAD_NOTIFICATION_EMAIL`
- `INTERNAL_NOTIFICATION_EMAIL`
- `MAIL_DISABLED`
- `MAIL_FROM`
- `MAIL_REPLY_TO`
- `EMAIL_REPLY_TO`
- `UPLOAD_DIR`
- `INVOICE_STORAGE_DIR`
- `GENERATED_REPORTS_DIR`
- `NPC_UPLOAD_DIR`
- `NPC_MAX_FILE_SIZE_MB`
- `NPC_MAX_PAGES_PER_SUBMISSION`
- `NPC_PDF_DPI`
- `NPC_IMAGE_QUALITY`
- `NPC_CONVERTED_FORMAT`
- `NPC_WORKER_POLL_INTERVAL_MS`
- `NPC_WORKER_LOCK_DURATION_MS`
- `NPC_MAX_RETRY_ATTEMPTS`
- `RAG_SEARCH_TIMEOUT_MS`
- `RAG_SEARCH_TIMEOUT`
- `LOG_LEVEL`
- `PINO_NO_WORKER`

## Secrets à ne jamais exposer

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `SMTP_PASS` / `SMTP_PASSWORD`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`
- `MISTRAL_API_KEY`
- `CHUTES_API_KEY`
- `BILAN_TOKEN_SECRET`
- `PASSWORD_RESET_SECRET`
- `CLICTOPAY_WEBHOOK_SECRET`
- `RAG_API_TOKEN`

## DB

- PostgreSQL/Prisma obligatoire.
- `docker-compose.prod.yml` contient un service postgres avec pgvector.
- À vérifier : backups, restore, migrations, accès réseau, monitoring taille disque.

## Redis/Upstash

- Code supporte `REDIS_URL` ou Upstash.
- À vérifier : production n'est pas en mode `memory`.
- Gate : go-live large interdit si rate limit mémoire.

## SMTP

- Code observe `SMTP_PASS` et `SMTP_PASSWORD` selon zones.
- À vérifier : harmonisation du nom, envoi test, DKIM/SPF/DMARC.

## Telegram

- Variables présentes dans code.
- À vérifier : canal, erreurs silencieuses, contenu sans PII excessive.

## OpenAI/ARIA/RAG

- ARIA utilise providers LLM et `lib/rag-client.ts`.
- À vérifier : backend RAG canonique, token, timeout, fallback, logs.

## ClicToPay

- Variables observées : `NEXT_PUBLIC_CLICTOPAY_API_KEY`, `CLICTOPAY_WEBHOOK_SECRET`.
- Statut actuel code : init/webhook retournent `501 CLICTOPAY_NOT_CONFIGURED`.
- Gate : ne pas activer carte sans E2E paiement.

## Nginx

- À vérifier en production réelle : SSL, headers, reverse proxy, taille upload, dotfiles interdits, port app non exposé publiquement.

## PM2 ou Docker

- Dockerfile standalone prêt.
- `docker-compose.prod.yml` expose app `3001:3000`.
- À vérifier : choix runtime réel, binding localhost si reverse proxy, politique restart.

## Backup

- À définir : DB, uploads, documents, factures, rapports NPC.
- Gate : restore testé obligatoire avant go-live large.

## Storage

- Dossiers observés : documents, invoices, NPC uploads, generated reports.
- À vérifier : hors webroot, permissions, chiffrement, rétention, antivirus.

## Logs

- À vérifier : centralisation, redaction PII, rotation, niveau prod.

## Monitoring

- Health public : `/api/health`.
- Health interne : `/api/internal/health` avec DB/SMTP/RAG/Redis/disk/NPC.
- À vérifier : alerte externe et authentification du health interne.

## SSL

- À vérifier production : certificat, renouvellement, HSTS.

## Healthchecks

- Dockerfile appelle `/api/health`.
- Go-live large exige aussi synthetic checks pages publiques et parcours lead.

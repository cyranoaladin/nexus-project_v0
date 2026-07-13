# Email & Telegram — Setup Guide

## 1. Email (SMTP Hostinger)

### Variables d'environnement

| Variable | Exemple | Description |
|---|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` | Serveur SMTP |
| `SMTP_PORT` | `587` | Port (587 STARTTLS recommandé, 465 SSL) |
| `SMTP_SECURE` | `false` | `true` si port 465 (SSL direct) |
| `SMTP_USER` | `no-reply@nexusreussite.academy` | Adresse email SMTP |
| `SMTP_PASS` | *(secret)* | Mot de passe boîte mail (`SMTP_PASSWORD` aussi accepté) |
| `MAIL_FROM` | `Nexus Réussite <no-reply@nexusreussite.academy>` | Adresse expéditeur (fallback: `EMAIL_FROM`, `SMTP_FROM`) |
| `MAIL_REPLY_TO` | `support@nexusreussite.academy` | Adresse de réponse (optionnel) |
| `INTERNAL_NOTIFICATION_EMAIL` | `support@nexusreussite.academy` | Destinataire des notifications internes (optionnel, fallback: `MAIL_REPLY_TO`) |
| `MAIL_DISABLED` | `true` / `false` | Désactive l'envoi (défaut: `true` en `NODE_ENV=test`) |

### Architecture

```
lib/email/mailer.ts      ← Transport centralisé (singleton, MAIL_DISABLED guard)
lib/email/templates.ts   ← Templates HTML + texte (fonctions pures)
app/api/notify/email/     ← API route POST (validation zod, rate limit)
```

### Fichiers existants (code non modifié)

Les fichiers suivants continuent de fonctionner avec leur code actuel (aucune modification appliquée) :

- `lib/email-service.ts` — Emails session (welcome, confirmation, reminder, report)
- `lib/email.ts` — Emails parent (welcome, credit expiration, password reset, stage)
- `lib/invoice/send-email.ts` — Emails facture

> ⚠️ **Comportement runtime** : ces fichiers lisent les variables d'environnement SMTP (`SMTP_HOST`, `SMTP_PORT`, etc.).
> Si vous mettez à jour vos variables pour suivre le tableau ci-dessus (port 587, nouvelles adresses), leur comportement s'alignera automatiquement.
> Pour conserver un comportement rétrocompatible, gardez vos anciennes valeurs (port 465, anciens emails).

> **Migration recommandée** : à terme, migrer ces fichiers vers `lib/email/mailer.ts` pour éliminer la duplication du transport.

### Sécurité

- **Aucun envoi en CI/test** : `MAIL_DISABLED` est `true` par défaut quand `NODE_ENV=test`.
- **CSRF** : `POST /api/notify/email` est protégé par `checkCsrf` (same-origin uniquement en production).
- **Rate limit** : bucket dédié `notifyEmail` — **5 req/min/IP** via Upstash Redis distribué.
  - **Fail-closed en production** : si `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` ne sont pas configurés, l'endpoint renvoie **503** (jamais de bypass silencieux).
  - En dev/test sans Redis : rate limiting désactivé avec warning.
- **Body size** : limité à 64KB via lecture stream (pas seulement `Content-Length`). Protège contre le bypass chunked-encoding.
  - **Recommandation proxy** : configurer aussi `client_max_body_size 64k;` (nginx) ou équivalent.
- **Logs** : seul le `messageId` est loggé, jamais l'adresse email ni le contenu.
- **Secrets** : ne jamais commiter `SMTP_PASS` / `SMTP_PASSWORD`.

### Délivrabilité

Pour que les emails n'atterrissent pas en spam :

1. Configurer **SPF** : `v=spf1 include:_spf.hostinger.com ~all`
2. Configurer **DKIM** : via le panel Hostinger
3. Configurer **DMARC** : `v=DMARC1; p=quarantine; rua=mailto:dmarc@nexusreussite.academy`

> Ces configurations DNS sont hors scope de ce code — à traiter en lot séparé.

---

## 2. Telegram (Bot API)

### Variables d'environnement

| Variable | Exemple | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | *(secret)* | Token du bot (depuis @BotFather) |
| `TELEGRAM_CHAT_ID` | *(secret de configuration)* | Destination gérée hors Git |
| `TELEGRAM_NOTIFICATIONS_ENABLED` | `true` / `false` | Active explicitement l'envoi (défaut sûr : `false`) |

### Architecture

```
lib/telegram/client.ts          ← Client Bot API (getMe, getUpdates, getChat, sendMessage)
scripts/verify-telegram.mjs     ← Script de vérification des identifiants
```

### Réactivation contrôlée

La réactivation exige une fenêtre dédiée : rotation du credential, stockage privé,
validation sans message réel, puis activation explicite du flag. Aucun utilitaire du
dépôt ne découvre ou n'affiche les destinations Telegram.

### Sécurité

- **Aucun envoi implicite** : `TELEGRAM_NOTIFICATIONS_ENABLED` doit valoir exactement `true`. Sans ce flag, aucun appel réseau Telegram n'est effectué.
- **Token jamais loggé** : les erreurs utilisent uniquement un code interne stable.
- **Contenu jamais loggé** : le texte du message n'apparaît pas dans les logs.
- **Destination jamais loggée** : aucun identifiant de conversation n'apparaît dans les logs.

---

## 3. Tests

```bash
# Tests mailer (mock nodemailer, aucun réseau)
npx jest --no-coverage __tests__/lib/email/mailer.test.ts

# Tests telegram (mock fetch, aucun réseau)
npx jest --no-coverage __tests__/lib/telegram/client.test.ts

# Suite complète
npm run test:unit
```

---

## 4. API Route — POST /api/notify/email

### Payload `bilan_ack`

```json
{
  "type": "bilan_ack",
  "to": "parent@example.com",
  "parentName": "Marie Dupont",
  "studentName": "Karim Dupont",
  "formType": "Bilan gratuit"
}
```

### Payload `internal`

```json
{
  "type": "internal",
  "eventType": "Nouveau lead stage",
  "fields": {
    "Classe": "Terminale",
    "Académie": "Stage Février 2026"
  }
}
```

### Réponses

| Status | Body | Signification |
|---|---|---|
| `200` | `{ "ok": true, "skipped": false }` | Email envoyé |
| `200` | `{ "ok": true, "skipped": true }` | MAIL_DISABLED (CI/test) |
| `400` | `{ "ok": false, "error": { "code": "INVALID_JSON", "message": "..." } }` | Body non-JSON |
| `400` | `{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "..." } }` | Payload invalide |
| `413` | `{ "ok": false, "error": { "code": "PAYLOAD_TOO_LARGE", "message": "..." } }` | Body > 64KB |
| `429` | `{ "ok": false, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "..." } }` | Rate limit (5 req/min/IP) |
| `503` | `{ "ok": false, "error": { "code": "RATELIMIT_NOT_CONFIGURED", "message": "..." } }` | Redis absent en prod |
| `500` | `{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "..." } }` | Erreur SMTP |

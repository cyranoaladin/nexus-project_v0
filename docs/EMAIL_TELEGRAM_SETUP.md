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
| `MAIL_DISABLED` | `true` / `false` | Désactive l'envoi (défaut: `true` en `NODE_ENV=test`) |

### Architecture

```
lib/email/mailer.ts      ← Transport centralisé (singleton, MAIL_DISABLED guard)
lib/email/templates.ts   ← Templates HTML + texte (fonctions pures)
app/api/notify/email/     ← API route POST (validation zod, rate limit)
```

### Fichiers existants (non modifiés)

Les fichiers suivants continuent de fonctionner indépendamment :

- `lib/email-service.ts` — Emails session (welcome, confirmation, reminder, report)
- `lib/email.ts` — Emails parent (welcome, credit expiration, password reset, stage)
- `lib/invoice/send-email.ts` — Emails facture

> **Migration recommandée** : à terme, migrer ces fichiers vers `lib/email/mailer.ts` pour éliminer la duplication du transport.

### Sécurité

- **Aucun envoi en CI/test** : `MAIL_DISABLED` est `true` par défaut quand `NODE_ENV=test`.
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
| `TELEGRAM_CHAT_ID` | `-100123456789` | ID du chat/groupe/channel cible |
| `TELEGRAM_DISABLED` | `true` / `false` | Désactive l'envoi (défaut: `true` en `NODE_ENV=test`) |

### Architecture

```
lib/telegram/client.ts          ← Client Bot API (getMe, getUpdates, getChat, sendMessage)
scripts/verify-telegram.mjs     ← Script de vérification des identifiants
```

### Vérification des identifiants

```bash
# Vérifier le token et le chat_id
node scripts/verify-telegram.mjs

# Sortie attendue :
# ✅ Bot verified: @your_bot_username (ID: 123456)
# ✅ Chat verified: type=group title="Nexus Leads" (ID: -100123456)
```

### Procédure pour obtenir le chat_id

1. Créer un bot via [@BotFather](https://t.me/BotFather) → copier le token
2. Ajouter le bot dans le groupe cible
3. Envoyer un message dans le groupe
4. Lancer `node scripts/verify-telegram.mjs` (sans `TELEGRAM_CHAT_ID`)
5. Le script affiche les `chat_id` trouvés dans les updates récents
6. Ajouter `TELEGRAM_CHAT_ID=<id>` dans `.env`

### Sécurité

- **Aucun envoi en CI/test** : `TELEGRAM_DISABLED` est `true` par défaut quand `NODE_ENV=test`.
- **Token jamais loggé** : seul le `message_id` est affiché après envoi.
- **Contenu jamais loggé** : le texte du message n'apparaît pas dans les logs.
- Le script `verify-telegram.mjs` n'affiche que les `chat_id`, types et titres — jamais le contenu des messages.

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
| `400` | `{ "ok": false, "error": "Validation failed" }` | Payload invalide |
| `429` | `{ "ok": false, "error": "Too many requests" }` | Rate limit (5 req/min/IP) |
| `500` | `{ "ok": false, "error": "Internal server error" }` | Erreur SMTP |

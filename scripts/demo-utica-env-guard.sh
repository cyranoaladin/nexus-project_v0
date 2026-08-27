#!/usr/bin/env bash
# Garde d'environnement du démarrage local UTICA 2026 (hotfix sécurité,
# thread P1 review sur PR #174).
#
# Root cause corrigée : le script de démarrage utilisait des motifs
# `${VAR:-fallback}` pour DATABASE_URL/REDIS_URL/EMAIL_OUTBOX_ENCRYPTION_KEY/
# SMTP_*. Si lancé depuis un shell ayant déjà chargé les identifiants de
# production (ex. après `source /etc/nexus/nexus-prod.env`), ces valeurs de
# production étaient conservées telles quelles. Or l'artefact standalone
# tourne en NODE_ENV=production (figé au build) et
# startEmailOutboxScheduler() (instrumentation.ts) déclenche immédiatement
# kickEmailOutboxDrain() → drainEmailOutbox() → sendMail() dès que
# EMAIL_OUTBOX_WORKER_ENABLED=true — un mauvais contexte shell pouvait donc
# faire muter le véritable outbox e-mail et/ou toucher la vraie base/Redis.
#
# Isolé dans ce fichier (jamais `exec node`) pour rester testable sans
# lancer l'artefact standalone complet — voir
# __tests__/demo/utica-2026/startup-env-guard.test.ts.
set -euo pipefail

# Noms vérifiés dans le dépôt (jamais recopiés du brief sans vérification) :
#   DATABASE_URL                  prisma/schema.prisma → env("DATABASE_URL")
#   REDIS_URL                     lib/rate-limit/runtime.ts
#   NEXTAUTH_SECRET                auth.ts (NextAuth)
#   RATE_LIMIT_KEY_SECRET          lib/rate-limit/runtime.ts
#   EMAIL_OUTBOX_ENCRYPTION_KEY    lib/email/outbox-worker.ts (chiffrement au repos)
#   SMTP_HOST/PORT/SECURE/USER/PASS/PASSWORD/FROM   lib/email/mailer.ts
#   MAIL_FROM / EMAIL_FROM / MAIL_REPLY_TO / EMAIL_REPLY_TO   lib/email/mailer.ts
# NEXTAUTH_URL est délibérément absent de cette liste : le script l'écrase
# toujours de façon inconditionnelle (jamais un `${VAR:-fallback}`), donc
# aucun héritage n'est possible pour cette variable précise.
DEMO_UTICA_SENSITIVE_VARS=(
  DATABASE_URL
  REDIS_URL
  NEXTAUTH_SECRET
  RATE_LIMIT_KEY_SECRET
  EMAIL_OUTBOX_ENCRYPTION_KEY
  SMTP_HOST
  SMTP_PORT
  SMTP_SECURE
  SMTP_USER
  SMTP_PASS
  SMTP_PASSWORD
  SMTP_FROM
  MAIL_FROM
  EMAIL_FROM
  MAIL_REPLY_TO
  EMAIL_REPLY_TO
)

# Fail closed : la seule présence (non vide) d'une de ces variables dans le
# shell appelant bloque le démarrage. Jamais un jugement sur la
# vraisemblance de la valeur — sa présence suffit. Jamais sa valeur affichée.
demo_utica_refuse_inherited_env() {
  local var
  for var in "${DEMO_UTICA_SENSITIVE_VARS[@]}"; do
    if [ -n "${!var:-}" ]; then
      echo "ERREUR : environnement non sûr pour le démonstrateur local." >&2
      echo "La variable ${var} est déjà définie." >&2
      echo "Ouvrir un shell propre avant de lancer npm run demo:utica." >&2
      return 1
    fi
  done
  return 0
}

# N'appeler qu'après demo_utica_refuse_inherited_env — force toutes les
# surfaces sensibles vers des valeurs strictement locales/jetables, sans
# aucun `${VAR:-fallback}` restant sur ces noms.
demo_utica_export_local_env() {
  local host="$1" port="$2" storage_root="$3"

  export NPC_STORAGE_ROOT="${storage_root}/npc"
  export DOCUMENT_STORAGE_ROOT="${storage_root}/documents"
  export DATABASE_URL="postgresql://127.0.0.1:5432/nexus_demo_local_disposable"
  export NEXTAUTH_URL="http://${host}:${port}"
  export NEXTAUTH_SECRET="utica-demo-local-only-secret-0123456789ab"
  export RATE_LIMIT_BACKEND="redis"
  export REDIS_URL="redis://127.0.0.1:6379"
  export RATE_LIMIT_KEY_SECRET="utica-demo-local-only-ratelimit-secret-0123456789"
  export RATE_LIMIT_KEY_NAMESPACE="utica-demo-local"
  export RATE_LIMIT_TRUST_PROXY_HOPS=1
  export EMAIL_OUTBOX_WORKER_ENABLED=true
  export EMAIL_OUTBOX_ENCRYPTION_KEY="utica-demo-local-only-outbox-key-0123456789ab"
  # Double verrouillage mail (thread P1 #174) : MAIL_DISABLED court-circuite
  # tout envoi réel dans lib/email/mailer.ts::sendMail() (vérifié : contrôlé
  # en tout premier, avant toute lecture de SMTP_HOST ou création du
  # transporteur) — même si ce verrou venait un jour à sauter, SMTP_HOST/
  # USER/PASS ci-dessous ne pointent jamais vers un service réel et les
  # identifiants d'authentification SMTP sont neutralisés.
  export MAIL_DISABLED=true
  export SMTP_HOST="127.0.0.1"
  export SMTP_PORT="1025"
  export SMTP_SECURE="false"
  export SMTP_USER=""
  export SMTP_PASS=""
  export SMTP_PASSWORD=""
  export SMTP_FROM="demo@localhost"
  export MAIL_FROM=""
  export EMAIL_FROM=""
  export MAIL_REPLY_TO=""
  export EMAIL_REPLY_TO=""
}

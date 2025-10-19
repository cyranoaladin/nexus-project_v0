#!/bin/bash

set -euo pipefail

if [ -z "${BASE_URL:-}" ]; then
  echo "Erreur: BASE_URL manquante" >&2
  exit 1
fi
if [ -z "${CRON_SECRET:-}" ]; then
  echo "Erreur: CRON_SECRET manquant" >&2
  exit 1
fi

ENDPOINT="${BASE_URL%/}/api/cron/send-scheduled-reminders"
echo "POST ${ENDPOINT}"
curl -s -X POST -H "x-cron-token: ${CRON_SECRET}" "${ENDPOINT}"
echo

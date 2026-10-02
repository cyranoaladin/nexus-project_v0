#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${NPC_STORAGE_ROOT:?NPC_STORAGE_ROOT must be set before the negative control}"
: "${DOCUMENT_STORAGE_ROOT:?DOCUMENT_STORAGE_ROOT must be set before the negative control}"
: "${PORT:?PORT must be set before the negative control}"
log_file="${1:?A private log path is required}"
case "$log_file" in /*) ;; *) echo 'NPC_GUARD_LOG_PATH_NOT_ABSOLUTE' >&2; exit 1 ;; esac
test -f server.js || { echo 'STANDALONE_SERVER_MISSING' >&2; exit 1; }

if ! listener_details="$(ss -H -ltn "( sport = :$PORT )")"; then
  echo 'NPC_GUARD_LISTENER_PROBE_FAILED' >&2
  exit 1
fi
if [ -n "$listener_details" ]; then
  echo 'NPC_GUARD_PORT_ALREADY_OCCUPIED' >&2
  exit 1
fi

seconds="${PREVIEW_NPC_GUARD_TIMEOUT_SECONDS:-60}"
case "$seconds" in
  ''|*[!0-9]*) echo 'NPC_GUARD_TIMEOUT_INVALID' >&2; exit 1 ;;
esac
if (( seconds < 1 || seconds > 90 )); then
  echo 'NPC_GUARD_TIMEOUT_INVALID' >&2
  exit 1
fi

set +e
timeout --signal=TERM --kill-after=2s "${seconds}s" env -u NPC_STORAGE_ROOT node server.js >"$log_file" 2>&1
server_exit=$?
set -e

if (( server_exit == 0 || server_exit == 124 || server_exit == 137 )); then
  echo "NPC_GUARD_UNEXPECTED_EXIT=$server_exit" >&2
  exit 1
fi
if ! grep -Fq 'NPC_STORAGE_PREFLIGHT_FAILED' "$log_file"; then
  echo 'NPC_GUARD_EXPECTED_MARKER_MISSING' >&2
  exit 1
fi
if grep -Fq 'Ready in' "$log_file"; then
  echo 'NPC_GUARD_SERVER_REACHED_READY' >&2
  exit 1
fi
if ! listener_details="$(ss -H -ltn "( sport = :$PORT )")"; then
  echo 'NPC_GUARD_LISTENER_PROBE_FAILED' >&2
  exit 1
fi
if [ -n "$listener_details" ]; then
  echo 'NPC_GUARD_PORT_REMAINED_OCCUPIED' >&2
  exit 1
fi

echo "NPC_MISSING_ROOT_EXIT=$server_exit"
echo 'NPC_MISSING_ROOT_COUNTERTEST=PASS'

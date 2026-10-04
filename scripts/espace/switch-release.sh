#!/usr/bin/env bash
# Bascule de release de production — À EXÉCUTER SUR LE SERVEUR (root), jamais en local.
#
#   switch-release.sh --new /var/www/nexus-releases/<release> --expected-current /var/www/nexus-releases/<release actuelle vérifiée>
#   switch-release.sh --check /var/www/nexus-releases/<release>      # préparation (rollback readiness) : ne bascule RIEN
#
# Garanties :
#  1. VERROU : un seul déploiement à la fois (flock non bloquant sur /var/lock/nexus-production-deploy.lock). Si le verrou
#     est pris, on s'arrête (LOCK_BUSY) ; on n'attend pas, on ne contourne pas.
#  2. COMPARE-AND-SWAP : on ne bascule que si la release servie est TOUJOURS celle que l'opérateur a vérifiée
#     (--expected-current). Sinon CAS_MISMATCH : arrêt, réévaluation humaine, jamais d'écrasement d'une release plus récente.
#  3. Pré-vol (artefact, Node embarqué exact, garde de pointeur), bascule atomique du SEUL pointeur canonique,
#     garde avec --expected-release, redémarrage pm2, santé ; retour arrière automatique si la santé n'est pas confirmée.
# Ne supprime rien. Ne touche ni à la base ni aux données.
set -u

CANON=/var/www/nexus-project_v0
ALIAS=/var/www/nexus-releases/current
RELEASE_ROOT=/var/www/nexus-releases
LOCK=/var/lock/nexus-production-deploy.lock
GUARD=/usr/local/libexec/nexus-release-pointer-guard
HEALTH_URL=${NEXUS_HEALTH_URL:-http://127.0.0.1:3001/api/health}
NODE_VERSION=v22.23.1

NEW=""; EXPECTED=""; CHECK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --new) NEW=${2:-}; shift 2;;
    --expected-current) EXPECTED=${2:-}; shift 2;;
    --check) CHECK=${2:-}; shift 2;;
    *) echo "Argument inconnu : $1"; exit 64;;
  esac
done

guard() { "$GUARD" --canonical "$CANON" --alias "$ALIAS" --release-root "$RELEASE_ROOT" "$@"; }

check_release() {
  local r=$1
  case "$r" in "$RELEASE_ROOT"/*) ;; *) echo "RELEASE_HORS_RACINE $r"; return 1;; esac
  [ -d "$r" ] || { echo "RELEASE_ABSENTE $r"; return 1; }
  [ -f "$r/.next/standalone/server.js" ] || { echo "SERVER_JS_ABSENT $r"; return 1; }
  [ -f "$r/.next/standalone/.next/BUILD_ID" ] || { echo "BUILD_ID_ABSENT $r"; return 1; }
  local v; v=$("$r/.runtime/node/bin/node" -v 2>/dev/null)
  [ "$v" = "$NODE_VERSION" ] || { echo "NODE_INATTENDU ($v) $r"; return 1; }
  [ "$(stat -c %U "$r/.runtime/node/bin/node")" = root ] || { echo "NODE_PROPRIETAIRE $r"; return 1; }
  echo "RELEASE_OK $r build=$(cat "$r/.next/standalone/.next/BUILD_ID") sha=$(tr -d '\n' < "$r/RELEASE_SOURCE_SHA" 2>/dev/null) node=$v"
}

if [ -n "$CHECK" ]; then
  check_release "$CHECK" || exit 1
  echo "POINTEUR_MODIFIABLE=$([ -L "$CANON" ] && [ -w "$(dirname "$CANON")" ] && echo YES || echo NO)"
  echo "COMMANDE_PM2=$(pm2 jlist | python3 -c "import sys,json; p=[x for x in json.load(sys.stdin) if x['name']=='nexus-prod'][0]['pm2_env']; print(p.get('pm_exec_path'), p.get('args'))")"
  guard && echo "GARDE_ETAT_COURANT=OK"
  exit 0
fi

[ -n "$NEW" ] && [ -n "$EXPECTED" ] || { echo "--new et --expected-current sont obligatoires (ou --check)"; exit 64; }

exec 9>>"$LOCK" || { echo "VERROU_ILLISIBLE $LOCK"; exit 10; }
flock -n 9 || { echo "LOCK_BUSY : un autre déploiement tient $LOCK — arrêt"; exit 10; }
echo "LOCK_ACQUIRED $LOCK"

CURRENT=$(readlink -f "$CANON")
if [ "$CURRENT" != "$EXPECTED" ]; then
  echo "CAS_MISMATCH : release servie = $CURRENT, attendue = $EXPECTED — AUCUNE bascule, réévaluer"
  exit 11
fi
echo "CAS_OK current=$CURRENT"

check_release "$NEW" || exit 12
guard || { echo "GARDE_PREVOL_KO"; exit 13; }

rollback() {
  ln -sfn "$CURRENT" "$CANON.new" && mv -T "$CANON.new" "$CANON"
  echo "ROLLBACK_POINTEUR -> $CURRENT"
}

ln -sfn "$NEW" "$CANON.new" && mv -T "$CANON.new" "$CANON" || { echo "BASCULE_KO"; exit 14; }
if ! guard --expected-release "$NEW"; then echo "GARDE_POST_BASCULE_KO"; rollback; exit 15; fi

pm2 restart nexus-prod >/dev/null 2>&1
sleep 12
code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
echo "SANTE=$code"
if [ "$code" != 200 ]; then
  echo "SANTE_KO -> retour arrière"
  rollback; pm2 restart nexus-prod >/dev/null 2>&1; sleep 10
  curl -s -o /dev/null -w "SANTE_APRES_ROLLBACK=%{http_code}\n" "$HEALTH_URL"
  exit 16
fi
pm2 save >/dev/null 2>&1
guard --expected-release "$NEW" && echo "GARDE_FINAL=OK"
echo "CANON=$(readlink "$CANON")"
echo "ALIAS=$(readlink "$ALIAS") => $(readlink -f "$ALIAS")"
PID=$(pm2 jlist | python3 -c "import sys,json; print([x for x in json.load(sys.stdin) if x['name']=='nexus-prod'][0]['pid'])")
echo "CMDLINE=$(tr '\0' ' ' < /proc/"$PID"/cmdline | cut -c1-300)"
for c in $(pgrep -P "$PID"); do echo "ENFANT $c EXE=$(readlink /proc/"$c"/exe)"; done
echo "DEPLOY_DONE new=$NEW previous=$CURRENT"

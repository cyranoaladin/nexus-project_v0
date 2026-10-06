#!/usr/bin/env bash
# Bascule de release de production — À EXÉCUTER SUR LE SERVEUR (root), jamais en local.
#
#   switch-release.sh --new <RELEASES_DIR>/<release> --expected-current <RELEASES_DIR>/<release actuelle vérifiée>
#   switch-release.sh --check <RELEASES_DIR>/<release>      # préparation (rollback readiness) : ne bascule RIEN
#   switch-release.sh --audit-only --catalog <espace-catalog.json> --db-json <lignes.json>   # comparaison seule (tests)
#   switch-release.sh --preflight-only <release>                      # preflight complet (lecture base), sans verrou ni bascule
#
# Garanties :
#  1. VERROU : un seul déploiement à la fois (flock non bloquant sur /var/lock/nexus-release-switch.lock). Si le verrou
#     est pris, on s'arrête (LOCK_BUSY) ; on n'attend pas, on ne contourne pas.
#  2. COMPARE-AND-SWAP : on ne bascule que si la release servie est TOUJOURS celle que l'opérateur a vérifiée
#     (--expected-current). Sinon CAS_MISMATCH : arrêt, réévaluation humaine, jamais d'écrasement d'une release plus récente.
#  3. PREFLIGHT CATALOGUE ↔ BASE (lecture seule, fail closed) : le catalogue d'activités du code de la release
#     (<release>/espace-catalog.json, produit par scripts/espace/export-catalog.ts) doit correspondre au miroir
#     `espace_activities`. Activité absente, slug dupliqué, matière / type / titre / étapes / version incohérents →
#     DEPLOYMENT_BLOCKED, aucune bascule, AUCUNE mutation automatique : corriger explicitement par
#     `provision.ts sync-activities --execute`, puis relancer.
#  4. Pré-vol (artefact, Node embarqué exact, garde de pointeur), bascule atomique du SEUL pointeur canonique,
#     garde avec --expected-release, redémarrage pm2, santé ; retour arrière automatique si la santé n'est pas confirmée.
# Ne supprime rien. Ne touche ni à la base ni aux données.
set -u

# Topologie fournie par l'environnement (politique « no-public-infrastructure » du dépôt) ;
# les valeurs réelles vivent dans le runbook privé du serveur.
CANON=${NEXUS_CANONICAL_POINTER:?NEXUS_CANONICAL_POINTER requis (ex: <APP_DIR>)}
ALIAS=${NEXUS_RELEASES_ALIAS:?NEXUS_RELEASES_ALIAS requis (ex: <RELEASES_DIR>/current)}
RELEASE_ROOT=${NEXUS_RELEASE_ROOT:?NEXUS_RELEASE_ROOT requis (ex: <RELEASES_DIR>)}
LOCK=${NEXUS_DEPLOY_LOCK:-/var/lock/nexus-release-switch.lock}
GUARD=${NEXUS_POINTER_GUARD:?NEXUS_POINTER_GUARD requis}
HEALTH_URL=${NEXUS_HEALTH_URL:-http://127.0.0.1:3001/api/health}
NODE_VERSION=v22.23.1

NEW=""; EXPECTED=""; CHECK=""; PREFLIGHT_ONLY=""; AUDIT_ONLY=""; CATALOG=""; DBJSON_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --new) NEW=${2:-}; shift 2;;
    --expected-current) EXPECTED=${2:-}; shift 2;;
    --check) CHECK=${2:-}; shift 2;;
    --audit-only) AUDIT_ONLY=1; shift;;
    --preflight-only) PREFLIGHT_ONLY=${2:-}; shift 2;;
    --catalog) CATALOG=${2:-}; shift 2;;
    --db-json) DBJSON_FILE=${2:-}; shift 2;;
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

# ─── Preflight catalogue (code) ↔ miroir en base : lecture seule, fail closed ───
audit_catalog() { # $1 = espace-catalog.json, $2 = fichier JSON des lignes de espace_activities
  python3 - "$1" "$2" <<'PY'
import json, sys
catalog = json.load(open(sys.argv[1], encoding='utf8'))
raw = open(sys.argv[2], encoding='utf8').read().strip()
rows = json.loads(raw) if raw and raw != 'null' else []
errors, warnings, seen = [], [], set()
for a in catalog:
    if a['slug'] in seen:
        errors.append(f"DUPLICATE_SLUG {a['slug']} : slug dupliqué dans le catalogue du code")
    seen.add(a['slug'])
by_slug = {r['slug']: r for r in rows}
for a in catalog:
    r = by_slug.get(a['slug'])
    if r is None:
        errors.append(f"MISSING_IN_DB {a['slug']} : présente dans le code, absente de espace_activities")
        continue
    for field in ('subject', 'moduleSlug', 'title', 'kind', 'stepsTotal', 'contentVersion'):
        if r.get(field) != a.get(field):
            errors.append(f"MISMATCH {a['slug']}.{field} : code={a.get(field)!r} base={r.get(field)!r}")
for r in rows:
    if r['slug'] not in seen:
        warnings.append(f"EXTRA_IN_DB {r['slug']} : en base, absente du catalogue du code")
for w in warnings:
    print('AVERTISSEMENT', w)
for e in errors:
    print('ERREUR', e)
if errors:
    print(f"CATALOGUE_DB_SYNC=FAIL ({len(errors)} écart(s))")
    sys.exit(1)
print(f"CATALOGUE_DB_SYNC=PASS ({len(catalog)} activités)")
PY
}

fetch_activities_json() { # lecture seule, identifiants lus sur le serveur (jamais affichés)
  # IMPORTANT : le script est lu sur l'entrée standard (ssh … 'bash -s' < switch-release.sh). Toute commande qui lit stdin
  # (docker exec -i) AVALERAIT la suite du script et l'arrêterait en silence : stdin est donc fermé explicitement.
  ( set -a; . "${NEXUS_MIGRATOR_ENV:-/etc/nexus/nexus-migrator.env}"; set +a
    "${DOCKER_BIN:-docker}" exec -e PGPASSWORD="${NEXUS_MIGRATOR_PASSWORD}" nexus-postgres-db psql -U nexus_admin -d nexus_prod -X -At -c \
      "SELECT json_agg(row_to_json(t)) FROM (SELECT slug, subject::text AS subject, \"moduleSlug\", title, kind::text AS kind, \"stepsTotal\", \"contentVersion\" FROM espace_activities ORDER BY slug) t;" < /dev/null )
}

catalog_preflight() { # $1 = release candidate
  local cat="$1/espace-catalog.json" tmp rc
  if [ ! -f "$cat" ]; then
    echo "DEPLOYMENT_BLOCKED : $cat absent (générer avec scripts/espace/export-catalog.ts avant l'envoi)"; return 1
  fi
  tmp=$(mktemp) || return 1
  if ! fetch_activities_json > "$tmp" 2>/dev/null; then
    rm -f "$tmp"; echo "DEPLOYMENT_BLOCKED : lecture de espace_activities impossible (fail closed)"; return 1
  fi
  audit_catalog "$cat" "$tmp"; rc=$?
  rm -f "$tmp"
  if [ $rc -ne 0 ]; then
    echo "DEPLOYMENT_BLOCKED : le catalogue du code et la base diffèrent. Aucune mutation automatique : exécuter explicitement"
    echo "  npx tsx scripts/espace/provision.ts sync-activities --execute   (puis audit-activities), puis relancer ce déploiement."
    return 1
  fi
}

if [ -n "$AUDIT_ONLY" ]; then
  [ -f "$CATALOG" ] && [ -f "$DBJSON_FILE" ] || { echo "--audit-only exige --catalog et --db-json (fichiers existants)"; exit 64; }
  if audit_catalog "$CATALOG" "$DBJSON_FILE"; then exit 0; fi
  echo "DEPLOYMENT_BLOCKED : le catalogue du code et la base diffèrent. Aucune mutation automatique : exécuter explicitement"
  echo "  npx tsx scripts/espace/provision.ts sync-activities --execute   (puis audit-activities), puis relancer ce déploiement."
  exit 17
fi

if [ -n "$PREFLIGHT_ONLY" ]; then   # preflight complet (lecture en base comprise), sans verrou ni bascule
  catalog_preflight "$PREFLIGHT_ONLY" || exit 17
  echo "PREFLIGHT_ONLY_DONE"
  exit 0
fi

if [ -n "$CHECK" ]; then
  check_release "$CHECK" || exit 1
  echo "POINTEUR_MODIFIABLE=$([ -L "$CANON" ] && [ -w "$(dirname "$CANON")" ] && echo YES || echo NO)"
  echo "COMMANDE_PM2=$(pm2 jlist | python3 -c "import sys,json; p=[x for x in json.load(sys.stdin) if x['name']=='${NEXUS_PM2_APP:?NEXUS_PM2_APP requis}'][0]['pm2_env']; print(p.get('pm_exec_path'), p.get('args'))")"
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
catalog_preflight "$NEW" || exit 17
guard || { echo "GARDE_PREVOL_KO"; exit 13; }

rollback() {
  ln -sfn "$CURRENT" "$CANON.new" && mv -T "$CANON.new" "$CANON"
  echo "ROLLBACK_POINTEUR -> $CURRENT"
}

ln -sfn "$NEW" "$CANON.new" && mv -T "$CANON.new" "$CANON" || { echo "BASCULE_KO"; exit 14; }
if ! guard --expected-release "$NEW"; then echo "GARDE_POST_BASCULE_KO"; rollback; exit 15; fi

pm2 restart ${NEXUS_PM2_APP:?NEXUS_PM2_APP requis} >/dev/null 2>&1
sleep 12
code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
echo "SANTE=$code"
if [ "$code" != 200 ]; then
  echo "SANTE_KO -> retour arrière"
  rollback; pm2 restart ${NEXUS_PM2_APP:?NEXUS_PM2_APP requis} >/dev/null 2>&1; sleep 10
  curl -s -o /dev/null -w "SANTE_APRES_ROLLBACK=%{http_code}\n" "$HEALTH_URL"
  exit 16
fi
pm2 save >/dev/null 2>&1
guard --expected-release "$NEW" && echo "GARDE_FINAL=OK"
echo "CANON=$(readlink "$CANON")"
echo "ALIAS=$(readlink "$ALIAS") => $(readlink -f "$ALIAS")"
PID=$(pm2 jlist | python3 -c "import sys,json; print([x for x in json.load(sys.stdin) if x['name']=='${NEXUS_PM2_APP:?NEXUS_PM2_APP requis}'][0]['pid'])")
echo "CMDLINE=$(tr '\0' ' ' < /proc/"$PID"/cmdline | cut -c1-300)"
for c in $(pgrep -P "$PID"); do echo "ENFANT $c EXE=$(readlink /proc/"$c"/exe)"; done
echo "DEPLOY_DONE new=$NEW previous=$CURRENT"

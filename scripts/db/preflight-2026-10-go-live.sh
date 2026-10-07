#!/usr/bin/env bash
#
# Pré-vol LECTURE SEULE des 13 migrations du lot go-live 2026-10 (PR #337).
#
# Usage :
#   scripts/db/preflight-2026-10-go-live.sh legacy  "$DATABASE_URL" [fichier-état-phase]
#   scripts/db/preflight-2026-10-go-live.sh core-v2 "$CORE_V2_DATABASE_URL"
#
# Chaque session est ouverte avec default_transaction_read_only=on : toute
# écriture accidentelle échouerait. Le script n'affiche que des comptages et
# des noms d'objets — jamais de contenu de ligne, donc jamais de PII.
#
# Codes de sortie :
#   0  PASS  — aucune condition bloquante pour `prisma migrate deploy`
#   1  FAIL  — au moins un constat bloquant (détaillé sur stdout)
#   2  ERREUR d'usage ou de connexion
#
# Répété le 2026-10-05 sur bases jetables PostgreSQL 13/15/16 : PASS sur un
# état conforme, FAIL sur des violations synthétiques (chevauchement coach,
# intervalle invalide, migrations marquées rolled_back). Voir
# docs/audits/2026-10-03-aria-recovery/release-readiness-closeout.md.
set -euo pipefail

MODE="${1:-}"
URL="${2:-}"
case "$MODE" in legacy|core-v2) ;; *) echo "usage: $0 legacy|core-v2 <database-url>" >&2; exit 2 ;; esac
[ -n "$URL" ] || { echo "usage: $0 legacy|core-v2 <database-url>" >&2; exit 2; }

SQL_DIR="$(cd "$(dirname "$0")" && pwd)"
RO_PSQL=(psql "$URL" -X -q -v ON_ERROR_STOP=1 -tA)
export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=60000 ${PGOPTIONS:-}"

fail=0
check() { # check <0-attendu> <libellé> <sql>
  local expected="$1" label="$2" sql="$3" got
  got="$("${RO_PSQL[@]}" -c "$sql")" || { echo "ERROR  $label (requête en échec)"; exit 2; }
  if [ "$got" = "$expected" ]; then
    echo "PASS   $label ($got)"
  else
    echo "FAIL   $label (obtenu: $got, attendu: $expected)"
    fail=1
  fi
}
info() { local label="$1" sql="$2"; echo "INFO   $label: $("${RO_PSQL[@]}" -c "$sql")"; }

echo "== préflight $MODE sur $("${RO_PSQL[@]}" -c 'select current_database()') (PostgreSQL $("${RO_PSQL[@]}" -c 'show server_version')) =="
check on "session en lecture seule" "show transaction_read_only"

# -- Journal Prisma : migrate deploy s'arrête en P3009/P3018 si le DERNIER
#    enregistrement d'une migration est inachevé ou marqué rolled back. Un
#    `migrate resolve --applied` légitime laisse l'ancienne ligne rolled back
#    à côté d'une nouvelle ligne appliquée : seul le dernier état compte
#    (mesuré en répétition ; cf. runbook migrate-resolve).
check 0 "journal Prisma: dernier état de chaque migration terminé et non rolled back" \
  "select count(*) from (select distinct on (migration_name) finished_at, rolled_back_at from _prisma_migrations order by migration_name, started_at desc) last where last.finished_at is null or last.rolled_back_at is not null"
info "dernière migration appliquée" \
  "select coalesce(max(migration_name),'(aucune)') from _prisma_migrations where finished_at is not null and rolled_back_at is null"

if [ "$MODE" = legacy ]; then
  # -- KNOWN_BOUNDED_LEGACY_DIVERGENCE=1 : la migration 20260425113000_add_maths_progress_track
  #    diverge entre l'arbre Git (corps gardé, f861…) et le journal de production
  #    (corps non gardé réellement exécuté, 26c3…). Divergence unique, bornée et
  #    déclarée dans security/migration-checksum-exceptions.json ; réconciliée
  #    forward-only par 20261007120000_reconcile_maths_progress_track.
  #    Garde liée à la PHASE (jamais « pré ou post » générique) : PRE_PENDING exige le
  #    journal production exact + le catalogue maths_progress pré-déploiement ;
  #    ALREADY_RECONCILED exige le jeu de migrations du dépôt + le catalogue final.
  #    Tout le reste échoue. L'état est écrit (3e argument) pour le postflight :
  #    scripts/db/postflight-2026-10-go-live.sh legacy "$URL" <état>.
  phase_out="$(node "$SQL_DIR/verify-migration-checksum-exceptions.mjs" preflight --database-url "$URL" ${3:+--state-out "$3"} 2>&1)" \
    && echo "PASS   phase maths_progress_track: ${phase_out}" \
    || { echo "FAIL   phase maths_progress_track:"; echo "$phase_out" | sed 's/^/       /'; fail=1; }

  # -- Objets du lot déjà présents = application manuelle antérieure : deploy
  #    échouerait « already exists ». Doit être 0 AVANT migration.
  check 0 "aucune table du lot déjà présente (application manuelle)" \
    "select count(*) from information_schema.tables where table_schema='public' and table_name in ('account_security_events','invoice_financial_delegations','invoice_financial_access_audits','stage_reservation_decision_audits','session_booking_cancellation_audits')"
  check 0 "aucune colonne du lot déjà présente" \
    "select count(*) from information_schema.columns where table_schema='public' and ((table_name='invoices' and column_name='payerUserId') or (table_name='subscription_requests' and column_name='requestedByUserId') or (table_name='aria_workshop_sessions' and column_name='admissionRevision'))"
  # -- Extension requise par l'index d'exclusion des conflits coach.
  check 1 "extension btree_gist installée ou disponible" \
    "select least(1, (select count(*) from pg_extension where extname='btree_gist') + (select count(*) from pg_available_extensions where name='btree_gist'))"
  # -- Fonctions attendues par le schéma historique (une absence a déjà fait
  #    échouer la chaîne sur PostgreSQL 17 en répétition).
  check 1 "fonction nexus_normalize_name_part présente (schéma historique)" \
    "select count(*) from pg_proc where proname='nexus_normalize_name_part'"
  # -- Données violant les contraintes AJOUTÉES par 20261005014000 : la
  #    migration valide la contrainte, toute ligne violante bloque le deploy.
  #    Un constat non nul exige une décision humaine sur les lignes réelles
  #    (forward-fix documenté), jamais une suppression automatique.
  check 0 "stage_sessions: aucun intervalle invalide (endAt <= startAt)" \
    "select count(*) from stage_sessions where not (\"endAt\" > \"startAt\")"
  check 0 "stage_sessions: aucun chevauchement même coach" \
    "select count(*) from stage_sessions a join stage_sessions b on a.\"coachId\"=b.\"coachId\" and a.id<b.id and tsrange(a.\"startAt\",a.\"endAt\",'[)') && tsrange(b.\"startAt\",b.\"endAt\",'[)') where a.\"coachId\" is not null"
  # -- Références orphelines sur les colonnes que les nouvelles FK ciblent.
  check 0 "stage_sessions.coachId sans coach_profiles correspondant" \
    "select count(*) from stage_sessions s left join coach_profiles c on c.id=s.\"coachId\" where s.\"coachId\" is not null and c.id is null"
  info "volumétrie approx. des tables verrouillées brièvement" \
    "select string_agg(relname||'='||n_live_tup, ', ') from pg_stat_user_tables where relname in ('invoices','subscription_requests','stage_sessions','aria_workshop_sessions')"
else
  # -- Objets du lot Core v2 (0023..0025) déjà présents ?
  check 0 "household_parents: colonnes de vérification pas déjà présentes" \
    "select count(*) from information_schema.columns where table_schema='public' and table_name='household_parents' and column_name in ('verificationStatus','revision')"
  # -- 0024/0025 valident la contrainte payload réécrite : toute ligne outbox
  #    historique non conforme bloque VALIDATE CONSTRAINT.
  check 0 "core_v2_job_outbox: aucune ligne violant la contrainte 0025" \
    "select count(*) from core_v2_job_outbox where not coalesce(jsonb_typeof(payload)='object' and case when \"jobType\"::text='RECOVER_ARIA_TURN' then payload->>'schemaVersion'='1' and jsonb_typeof(payload->'turnId')='string' else false end, false)"
  info "volumétrie outbox par jobType" \
    "select coalesce(string_agg(\"jobType\"::text||'='||n, ', '),'(vide)') from (select \"jobType\", count(*) n from core_v2_job_outbox group by 1) s"
fi

if [ "$fail" -eq 0 ]; then echo "== PREFLIGHT $MODE: PASS =="; else echo "== PREFLIGHT $MODE: FAIL (constats bloquants ci-dessus) =="; fi
exit "$fail"

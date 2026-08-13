#!/usr/bin/env bash
# Rotation des releases à la bascule (post-flip, santé verte exigée).
#
# Politique (validée le 2026-08-12, après l'incident disque 86 %) :
#   - conserver la release ACTIVE (cible du symlink canonique) ;
#   - conserver l'instance la plus récente de chacun des N derniers SHA
#     distincts disposant d'un runtime Node embarqué (.runtime/node/bin/node),
#     N = --keep-node22 (défaut 2, l'active comptant pour son SHA) ;
#   - conserver toute release épinglée dans le fichier de rétention
#     (--pin-file, une entrée par ligne, commentaires # autorisés) — le
#     mécanisme qui aurait protégé 1b8219b1… automatiquement ;
#   - tout le reste est purgé, une release à la fois, avec vérification
#     santé (--health-url) avant chaque suppression.
#
# Fail-closed : sans --apply le script n'est qu'un plan (dry-run). Le fichier
# d'épinglage DOIT exister (même vide) — absence = abort. Toute release
# encore référencée par un processus est refusée.
set -euo pipefail

fail() {
  printf 'rotate-releases failed: %s\n' "$1" >&2
  exit 1
}

release_root=''
canonical=''
pin_file=''
keep_node22=2
health_url=''
apply=0

while (($# > 0)); do
  case "$1" in
    --release-root)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      release_root=$2; shift 2 ;;
    --canonical)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      canonical=$2; shift 2 ;;
    --pin-file)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      pin_file=$2; shift 2 ;;
    --keep-node22)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      keep_node22=$2; shift 2 ;;
    --health-url)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      health_url=$2; shift 2 ;;
    --apply)
      apply=1; shift ;;
    *)
      fail 'UNKNOWN_ARGUMENT' ;;
  esac
done

[[ -n "$release_root" && -n "$canonical" && -n "$pin_file" ]] \
  || fail 'REQUIRED_ARGUMENT_MISSING'
[[ "$release_root" = /* && "$canonical" = /* && "$pin_file" = /* ]] \
  || fail 'PATH_NOT_ABSOLUTE'
[[ "$keep_node22" =~ ^[0-9]+$ && "$keep_node22" -ge 1 ]] || fail 'INVALID_KEEP_COUNT'
[[ -d "$release_root" ]] || fail 'RELEASE_ROOT_MISSING'
[[ -L "$canonical" ]] || fail 'CANONICAL_NOT_SYMLINK'
# Épinglage fail-closed : le fichier doit exister, même vide.
[[ -f "$pin_file" ]] || fail 'PIN_FILE_MISSING'

active_path=$(readlink -f "$canonical") || fail 'CANONICAL_DANGLING'
[[ -d "$active_path" ]] || fail 'CANONICAL_DANGLING'
case "$active_path" in
  "$release_root"/*) ;;
  *) fail 'ACTIVE_OUTSIDE_RELEASE_ROOT' ;;
esac
active_name=${active_path#"$release_root"/}
[[ "$active_name" != */* ]] || fail 'ACTIVE_NOT_DIRECT_CHILD'

check_health() {
  [[ -n "$health_url" ]] || return 0
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$health_url" || echo 000)
  [[ "$code" = 200 ]] || fail "HEALTH_CHECK_FAILED_$code"
}

check_health

# Épinglés : une entrée (nom de dossier) par ligne, # commentaires.
declare -A pinned=()
while IFS= read -r line; do
  line=${line%%#*}
  line=$(printf '%s' "$line" | tr -d '[:space:]')
  [[ -n "$line" ]] && pinned["$line"]=1
done < "$pin_file"

# SHA d'une release = préfixe hexadécimal du nom de dossier.
sha_of() {
  local name=$1
  if [[ "$name" =~ ^([0-9a-f]{7,40}) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  else
    printf '%s' "$name"
  fi
}

# Inventaire : nom|mtime|node22(0/1), trié du plus récent au plus ancien.
inventory=$(
  for dir in "$release_root"/*/; do
    [[ -d "$dir" ]] || continue
    [[ -L "${dir%/}" ]] && continue
    name=$(basename "$dir")
    mtime=$(stat -c '%Y' "$dir")
    node22=0
    [[ -x "$dir/.runtime/node/bin/node" ]] && node22=1
    printf '%s|%s|%s\n' "$mtime" "$name" "$node22"
  done | sort -rn
)

declare -A keep=()
keep["$active_name"]=1
for name in "${!pinned[@]}"; do
  keep["$name"]=1
done

# Les N derniers SHA distincts Node 22 : l'instance la plus récente de
# chaque groupe. Le SHA de l'active compte pour un groupe si elle embarque
# un runtime.
declare -A sha_seen=()
groups_kept=0
active_sha=$(sha_of "$active_name")
if [[ -x "$release_root/$active_name/.runtime/node/bin/node" ]]; then
  sha_seen["$active_sha"]=1
  groups_kept=1
fi
while IFS='|' read -r _mtime name node22; do
  [[ -n "$name" ]] || continue
  [[ "$node22" = 1 ]] || continue
  sha=$(sha_of "$name")
  if [[ -z "${sha_seen[$sha]:-}" ]]; then
    if (( groups_kept < keep_node22 )); then
      sha_seen["$sha"]=1
      keep["$name"]=1
      groups_kept=$((groups_kept + 1))
    fi
  fi
done <<< "$inventory"

deleted=0
freed_bytes=0
while IFS='|' read -r _mtime name _node22; do
  [[ -n "$name" ]] || continue
  if [[ -n "${keep[$name]:-}" ]]; then
    printf 'KEEP   %s\n' "$name"
    continue
  fi
  if pgrep -f "$release_root/$name" >/dev/null 2>&1; then
    printf 'SKIP   %s (référencée par un processus)\n' "$name"
    continue
  fi
  size=$(du -sb "$release_root/$name" | cut -f1)
  if (( apply )); then
    check_health
    rm -rf "${release_root:?}/${name:?}"
    printf 'DELETE %s (%s octets)\n' "$name" "$size"
  else
    printf 'PLAN   %s (%s octets)\n' "$name" "$size"
  fi
  deleted=$((deleted + 1))
  freed_bytes=$((freed_bytes + size))
done <<< "$inventory"

check_health
if (( apply )); then
  printf 'rotate-releases: %s release(s) supprimée(s), %s octets libérés\n' "$deleted" "$freed_bytes"
else
  printf 'rotate-releases (dry-run): %s release(s) purgeable(s), %s octets récupérables — relancer avec --apply\n' "$deleted" "$freed_bytes"
fi

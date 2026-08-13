#!/usr/bin/env bash
# Purge des espaces de travail de build en fin de release réussie.
#
# /var/www/nexus-build-staging et /var/www/nexus-build-validation
# accumulent un workspace complet (~3 Go) par build et ne sont jamais
# nettoyés — c'était 11,6 Go de fuite constatés le 2026-08-12. À appeler
# en fin de déploiement réussi, après la bascule du symlink.
#
# Fail-closed : sans --apply, plan seulement. --keep <nom> (répétable)
# préserve le workspace de la release qui vient d'être construite.
set -euo pipefail

fail() {
  printf 'purge-build-workspaces failed: %s\n' "$1" >&2
  exit 1
}

roots=()
keeps=()
apply=0

while (($# > 0)); do
  case "$1" in
    --root)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      roots+=("$2"); shift 2 ;;
    --keep)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      keeps+=("$2"); shift 2 ;;
    --apply)
      apply=1; shift ;;
    *)
      fail 'UNKNOWN_ARGUMENT' ;;
  esac
done

((${#roots[@]} > 0)) || fail 'REQUIRED_ARGUMENT_MISSING'
for root in "${roots[@]}"; do
  [[ "$root" = /* ]] || fail 'PATH_NOT_ABSOLUTE'
  # Garde-fou : uniquement des racines de build nexus, jamais un chemin
  # arbitraire (serveur mutualisé).
  case "$(basename "$root")" in
    nexus-build-*) ;;
    *) fail 'ROOT_NOT_A_NEXUS_BUILD_WORKSPACE' ;;
  esac
done

is_kept() {
  local name=$1 k
  for k in "${keeps[@]:-}"; do
    [[ "$k" = "$name" ]] && return 0
  done
  return 1
}

purged=0
freed_bytes=0
for root in "${roots[@]}"; do
  [[ -d "$root" ]] || { printf 'SKIP   %s (absent)\n' "$root"; continue; }
  for dir in "$root"/*/; do
    [[ -d "$dir" ]] || continue
    name=$(basename "$dir")
    if is_kept "$name"; then
      printf 'KEEP   %s/%s\n' "$root" "$name"
      continue
    fi
    if pgrep -f "$root/$name" >/dev/null 2>&1; then
      printf 'SKIP   %s/%s (référencé par un processus)\n' "$root" "$name"
      continue
    fi
    size=$(du -sb "$dir" | cut -f1)
    if (( apply )); then
      rm -rf "${root:?}/${name:?}"
      printf 'DELETE %s/%s (%s octets)\n' "$root" "$name" "$size"
    else
      printf 'PLAN   %s/%s (%s octets)\n' "$root" "$name" "$size"
    fi
    purged=$((purged + 1))
    freed_bytes=$((freed_bytes + size))
  done
done

if (( apply )); then
  printf 'purge-build-workspaces: %s workspace(s) supprimé(s), %s octets libérés\n' "$purged" "$freed_bytes"
else
  printf 'purge-build-workspaces (dry-run): %s workspace(s) purgeable(s), %s octets — relancer avec --apply\n' "$purged" "$freed_bytes"
fi

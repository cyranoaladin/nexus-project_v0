#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"

storage_parent="$(mktemp -d "$RUNNER_TEMP/preview-storage-smoke.XXXXXX")"
prepared=0
cleanup_on_failure() {
  if (( prepared == 0 )); then rm -r -- "$storage_parent"; fi
}
trap cleanup_on_failure EXIT

npc_root="$storage_parent/npc"
document_root="$storage_parent/documents"
proof_root="$RUNNER_TEMP/preview-delivery-proofs"
if [ -L "$proof_root" ]; then
  echo 'SMOKE_PROOF_DIRECTORY_INVALID' >&2
  exit 1
fi
install -d -m 0700 -- "$npc_root" "$document_root" "$proof_root"
storage_parent="$(realpath -e -- "$storage_parent")"
workspace="$(realpath -e -- "$GITHUB_WORKSPACE")"
runner_temp="$(realpath -e -- "$RUNNER_TEMP")"
if [ -L "$proof_root" ] || [ ! -d "$proof_root" ] ||
   [ "$(dirname -- "$(realpath -e -- "$proof_root")")" != "$runner_temp" ] ||
   [ "$(stat -c %u -- "$proof_root")" != "$(id -u)" ] ||
   [ "$(stat -c %a -- "$proof_root")" != 700 ]; then
  echo 'SMOKE_PROOF_DIRECTORY_INVALID' >&2
  exit 1
fi
if [[ "$storage_parent" == "$workspace" || "$storage_parent" == "$workspace/"* || "$workspace" == "$storage_parent/"* ]]; then
  echo 'SMOKE_STORAGE_OVERLAPS_WORKSPACE' >&2
  exit 1
fi

for root in "$storage_parent" "$npc_root" "$document_root"; do
  test ! -L "$root"
  test "$(stat -c %u -- "$root")" = "$(id -u)"
  test "$(stat -c %a -- "$root")" = 700
  test -r "$root" && test -w "$root" && test -x "$root"
  probe="$(mktemp "$root/.access-probe.XXXXXX")"
  test -r "$probe" && test -w "$probe"
  rm -- "$probe"
done

printf 'PREVIEW_SMOKE_STORAGE_PARENT=%s\n' "$storage_parent" >> "$GITHUB_ENV"
printf 'NPC_STORAGE_ROOT=%s\n' "$(realpath -e -- "$npc_root")" >> "$GITHUB_ENV"
printf 'DOCUMENT_STORAGE_ROOT=%s\n' "$(realpath -e -- "$document_root")" >> "$GITHUB_ENV"
prepared=1
echo 'SMOKE_STORAGE_ROOTS_PREPARED=PASS'

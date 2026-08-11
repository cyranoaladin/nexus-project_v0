#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Release pointer guard failed: %s\n' "$1" >&2
  exit 1
}

canonical=''
compat_alias=''
release_root=''
expected_release=''

while (($# > 0)); do
  case "$1" in
    --canonical)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      canonical=$2
      shift 2
      ;;
    --alias)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      compat_alias=$2
      shift 2
      ;;
    --release-root)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      release_root=$2
      shift 2
      ;;
    --expected-release)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      expected_release=$2
      shift 2
      ;;
    *)
      fail 'UNKNOWN_ARGUMENT'
      ;;
  esac
done

[[ -n "$canonical" && -n "$compat_alias" && -n "$release_root" ]] \
  || fail 'REQUIRED_ARGUMENT_MISSING'

for path_value in "$canonical" "$compat_alias" "$release_root"; do
  [[ "$path_value" = /* ]] || fail 'PATH_NOT_ABSOLUTE'
done
if [[ -n "$expected_release" && "$expected_release" != /* ]]; then
  fail 'PATH_NOT_ABSOLUTE'
fi

[[ -L "$canonical" ]] || fail 'CANONICAL_NOT_SYMLINK'
[[ -L "$compat_alias" ]] || fail 'ALIAS_NOT_SYMLINK'
[[ -d "$release_root" ]] || fail 'RELEASE_ROOT_MISSING'

canonical_resolved=$(readlink -f "$canonical")
[[ -n "$canonical_resolved" && -d "$canonical_resolved" ]] \
  || fail 'CANONICAL_DANGLING'

alias_resolved=$(readlink -f "$compat_alias")
[[ -n "$alias_resolved" && -d "$alias_resolved" ]] || fail 'ALIAS_DANGLING'
[[ "$alias_resolved" == "$canonical_resolved" ]] || fail 'POINTER_DIVERGENCE'

alias_raw=$(readlink "$compat_alias")
[[ "$alias_raw" == "$canonical" ]] || fail 'ALIAS_NOT_CHAINED'

release_root_resolved=$(readlink -f "$release_root")
case "$canonical_resolved" in
  "$release_root_resolved"/*) ;;
  *) fail 'RELEASE_OUTSIDE_ROOT' ;;
esac

[[ -f "$canonical_resolved/.next/standalone/server.js" ]] \
  || fail 'STANDALONE_ENTRYPOINT_MISSING'

if [[ -n "$expected_release" ]]; then
  expected_resolved=$(readlink -m "$expected_release")
  [[ "$canonical_resolved" == "$expected_resolved" ]] \
    || fail 'EXPECTED_RELEASE_MISMATCH'
fi

printf 'Release pointer guard passed\n'

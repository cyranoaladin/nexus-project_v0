#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

patterns=(
  "88.99.254.""59"
  "46.202.171.""14"
  "root@""88.99.254.59"
  "/var/www/""nexus-project_v0"
  "/var/www/""nexus-releases"
  "/usr/local/libexec/""nexus-prod-launcher"
  "nexus-""prod"
)

violations=()
for pattern in "${patterns[@]}"; do
  while IFS= read -r file; do
    violations+=("$file")
  done < <(git grep -I -l -F "$pattern" -- . ':(exclude)package-lock.json' || true)
done

if ((${#violations[@]} > 0)); then
  printf 'Public repository infrastructure disclosure detected in:\n' >&2
  printf '%s\n' "${violations[@]}" | sort -u >&2
  exit 1
fi

echo "Public infrastructure disclosure scan passed"

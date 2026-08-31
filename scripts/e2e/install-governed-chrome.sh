#!/usr/bin/env bash

set -Eeuo pipefail

CHROME_VERSION='152.0.7977.64'
CHROME_PACKAGE_VERSION='152.0.7977.64-1'
CHROME_DEB_SHA256='4eae0736a812d9bc851cd2937f7af00e47dbaf8305845eed452703ff009873c7'
CHROME_DEB_NAME='google-chrome-stable_152.0.7977.64-1_amd64.deb'
CHROME_DEB_URL="https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/${CHROME_DEB_NAME}"

if [ "$(dpkg --print-architecture)" != 'amd64' ]; then
  echo '[governed-chrome] ERROR: Google Chrome 152 artifact is pinned for amd64 only.' >&2
  exit 1
fi

CACHE_ROOT="${NEXUS_BROWSER_CACHE_DIR:-${XDG_CACHE_HOME:-${HOME}/.cache}/nexus-governed-browsers}"
install -d -m 0755 -- "$CACHE_ROOT"
deb_path="${CACHE_ROOT}/${CHROME_DEB_NAME}"

verify_deb() {
  printf '%s  %s\n' "$CHROME_DEB_SHA256" "$1" | sha256sum --check --strict
}

if [ ! -f "$deb_path" ]; then
  temporary_deb="${deb_path}.download.$$"
  trap 'rm -f -- "$temporary_deb"' EXIT
  curl --fail --silent --show-error --location "$CHROME_DEB_URL" --output "$temporary_deb"
  verify_deb "$temporary_deb"
  mv -- "$temporary_deb" "$deb_path"
  trap - EXIT
fi

# A cache hit is never trusted implicitly. Corruption or cache poisoning fails
# closed here and never triggers a request for a moving "latest" artifact.
verify_deb "$deb_path"

if [ "$(id -u)" -eq 0 ]; then
  dpkg --install "$deb_path"
else
  sudo dpkg --install "$deb_path"
fi

installed_version="$(google-chrome-stable --version | sed -E 's/^Google Chrome[[:space:]]+//; s/[[:space:]]+$//')"
if [ "$installed_version" != "$CHROME_VERSION" ]; then
  echo "[governed-chrome] ERROR: expected ${CHROME_VERSION}, got ${installed_version}." >&2
  exit 1
fi

echo "[governed-chrome] Installed Google Chrome ${installed_version}."

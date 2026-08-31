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

workdir="$(mktemp -d)"
trap 'rm -rf -- "$workdir"' EXIT
deb_path="${workdir}/${CHROME_DEB_NAME}"

curl --fail --silent --show-error --location "$CHROME_DEB_URL" --output "$deb_path"
printf '%s  %s\n' "$CHROME_DEB_SHA256" "$deb_path" | sha256sum --check --strict

if [ "$(id -u)" -eq 0 ]; then
  dpkg --install "$deb_path"
else
  sudo dpkg --install "$deb_path"
fi

installed_version="$(google-chrome-stable --version | sed -E 's/^Google Chrome //')"
if [ "$installed_version" != "$CHROME_VERSION" ]; then
  echo "[governed-chrome] ERROR: expected ${CHROME_VERSION}, got ${installed_version}." >&2
  exit 1
fi

echo "[governed-chrome] Installed Google Chrome ${installed_version}."

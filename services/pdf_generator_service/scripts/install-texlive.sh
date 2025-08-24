#!/usr/bin/env bash
set -euo pipefail

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended texlive-fonts-extra \
  ghostscript make
apt-get clean
rm -rf /var/lib/apt/lists/*

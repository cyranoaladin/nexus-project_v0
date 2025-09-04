#!/usr/bin/env bash
set -euo pipefail

# Directory to save k6 JSON summaries
OUT_DIR="${OUT_DIR:-audit/k6}"
BASE_URL="${BASE_URL:-http://localhost:3003}"

mkdir -p "$OUT_DIR"

# Export BASE_URL env for k6 script consumption
export BASE_URL

# Run k6 with JSON summary export
k6 run --summary-export "${OUT_DIR}/bilan_pdf_summary.json" performance/k6/bilan_pdf.js


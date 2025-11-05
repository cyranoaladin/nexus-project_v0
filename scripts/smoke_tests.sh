#!/usr/bin/env bash
set -euo pipefail

echo "Health:"
curl -s http://localhost:8000/health/ | jq . || true

echo "Bilan:"
curl -s -X POST http://localhost:8000/onboarding/bilan \
  -H "Content-Type: application/json" \
  -d '{"statut":"scolarise","niveau":"premiere","specialites":["maths","nsi"]}' | jq . || true

echo "Epreuves:"
curl -s "http://localhost:8000/parcours/epreuves?student_id=00000000-0000-0000-0000-000000000000" | jq . || true

#!/bin/bash
# Guard: detect hardcoded values that should come from canonical sources
# Sources: data/pricing.canonical.json, lib/legal.ts, lib/whatsapp.ts

FAIL=0

echo "=== Checking for hardcoded values outside canonical sources ==="

# Matricule fiscal en dur (hors lib/legal.ts)
COUNT=$(grep -rn "1948837" app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "legal.ts\|test\|spec\|__tests__" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "WARN: $COUNT occurrences of matricule fiscal '1948837' outside lib/legal.ts"
fi

# price_annual_public / price_annual_campaign (deleted fields)
COUNT=$(grep -rn "price_annual_public\|price_annual_campaign\|isCampaignActive" lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT references to deleted pricing fields (price_annual_public/campaign)"
  FAIL=1
fi

# discount_pct on packs (deleted)
COUNT=$(grep -rn "discount_pct" lib/pricing.ts 2>/dev/null | grep -i "pack" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: discount_pct still in Pack type"
  FAIL=1
fi

# badge campagne
COUNT=$(grep -rn "badge.*campagne\|campaign_label\|campaignBadge" app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT references to campaign badge"
  FAIL=1
fi

echo "=== Guard complete (FAIL=$FAIL) ==="
exit $FAIL

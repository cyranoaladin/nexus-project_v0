#!/bin/bash
# Guard: detect hardcoded values that should come from canonical sources.
# Sources: data/pricing.canonical.json, lib/legal.ts, lib/whatsapp.ts
# EXIT 1 if any violation found — blocks commit.
# Exceptions: _data/offers.ts (stages UX, internal), facturation template "0,000 TND"

FAIL=0

echo "=== check:no-hardcoded ==="

# 1. Deleted pricing fields
COUNT=$(grep -rn "price_annual_public\|price_annual_campaign\|isCampaignActive" lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT references to deleted pricing fields"
  FAIL=1
fi

# 2. Campaign badge
COUNT=$(grep -rn "campaignBadge\|badge.*campagne\|campaign_label" app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT references to campaign badge"
  FAIL=1
fi

# 3. Matricule fiscal outside lib/legal.ts
COUNT=$(grep -rn "1948837" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "legal.ts\|test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT hardcoded matricule fiscal"
  FAIL=1
fi

# 4. Email contact@ outside canonical sources
COUNT=$(grep -rn "contact@nexusreussite" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "legal.ts\|whatsapp\|test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT hardcoded email"
  FAIL=1
fi

# 5. Phone number outside canonical sources
COUNT=$(grep -rn "99 19 28 29\|99192829\|21699192829" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "legal.ts\|whatsapp.ts\|test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT hardcoded phone"
  FAIL=1
fi

# 6. Entity name outside lib/legal.ts
COUNT=$(grep -rn "M&M ACADEMY\|STE M&amp;M" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "legal.ts\|test\|spec\|__tests__\|node_modules" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT hardcoded entity name"
  FAIL=1
fi

# 7. Hardcoded TND prices in client-facing code (excluding documented exceptions)
COUNT=$(grep -rnE "[0-9]{2,5}\s*TND" app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules\|.next\|test\|spec\|__tests__\|pricing.canonical\|pricing.ts\|legal.ts\|//.*TND\|facturation.*0,000\|admin/facturation.*Prix en" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "FAIL: $COUNT hardcoded TND prices in client code"
  grep -rnE "[0-9]{2,5}\s*TND" app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules\|.next\|test\|spec\|__tests__\|pricing.canonical\|pricing.ts\|legal.ts\|//.*TND\|profitabilityNotes\|_data/offers\|facturation.*0,000\|admin/facturation.*Prix en"
  FAIL=1
fi

# 8. Static HTML files with prices/contact (should not exist)
if ls public/*.html 2>/dev/null | grep -q .; then
  echo "FAIL: static HTML files exist in public/ (should be deleted)"
  ls public/*.html
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "OK: 0 hardcoded values outside canonical sources"
fi

exit $FAIL

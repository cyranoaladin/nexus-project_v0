#!/usr/bin/env node
/**
 * Extracts client-safe subsets from pricing.canonical.json:
 *   - data/pricing-client-data.generated.json  (rules + repères + payment summaries)
 *   - data/stage-calendar-client.json          (minimal stage calendar)
 *
 * Run after editing pricing.canonical.json:
 *   node scripts/generate-pricing-client-data.js
 *
 * The transform logic itself lives in scripts/pricing-client-data-builder.js
 * — shared with __tests__/lib/pricing-client-sync.test.ts, which proves the
 * committed generated files are exactly what this script would produce from
 * the current canonical.json (no manual edits, no drift).
 */
const fs = require('fs');
const path = require('path');
const { buildClientData, buildMiniCalendar } = require('./pricing-client-data-builder');

const canonical = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'pricing.canonical.json'), 'utf-8'),
);

const clientData = buildClientData(canonical);
const clientDataPath = path.join(__dirname, '..', 'data', 'pricing-client-data.generated.json');
fs.writeFileSync(clientDataPath, JSON.stringify(clientData, null, 2) + '\n');

const miniCalendar = buildMiniCalendar(canonical);
const calendarPath = path.join(__dirname, '..', 'data', 'stage-calendar-client.json');
fs.writeFileSync(calendarPath, JSON.stringify(miniCalendar, null, 2) + '\n');

console.log('✓ pricing-client-data.generated.json (%d bytes)', fs.statSync(clientDataPath).size);
console.log('✓ stage-calendar-client.json (%d bytes)', fs.statSync(calendarPath).size);

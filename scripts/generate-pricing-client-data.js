#!/usr/bin/env node
/**
 * Extracts client-safe subsets from pricing.canonical.json:
 *   - data/pricing-client-data.generated.json  (rules + reperes_tarifaires)
 *   - data/stage-calendar-client.json          (minimal stage calendar)
 *
 * Run after editing pricing.canonical.json:
 *   node scripts/generate-pricing-client-data.js
 */
const fs = require('fs');
const path = require('path');

const canonical = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'pricing.canonical.json'), 'utf-8'),
);

// 1. Rules + repères + operational catalog
const clientData = {
  rules: canonical.rules,
  reperes_tarifaires: canonical.reperes_tarifaires,
  operational_subscription_plans: canonical.operational_subscription_plans,
  operational_aria_addons: canonical.operational_aria_addons,
  operational_special_packs: canonical.operational_special_packs,
  operational_credit_costs: canonical.operational_credit_costs,
};
const clientDataPath = path.join(__dirname, '..', 'data', 'pricing-client-data.generated.json');
fs.writeFileSync(clientDataPath, JSON.stringify(clientData, null, 2) + '\n');

// 2. Mini stage calendar (id, title, date_start, dates_display only)
const miniCalendar = canonical.stage_calendar.map((e) => ({
  id: e.id,
  title: e.title,
  date_start: e.date_start,
  dates_display: e.dates_display,
}));
const calendarPath = path.join(__dirname, '..', 'data', 'stage-calendar-client.json');
fs.writeFileSync(calendarPath, JSON.stringify(miniCalendar, null, 2) + '\n');

console.log('✓ pricing-client-data.generated.json (%d bytes)', fs.statSync(clientDataPath).size);
console.log('✓ stage-calendar-client.json (%d bytes)', fs.statSync(calendarPath).size);

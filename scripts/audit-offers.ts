#!/usr/bin/env npx tsx
/**
 * Run: npx tsx scripts/audit-offers.ts
 * Prints full profitability audit for all stage offers.
 */
import { printAuditSummary } from "../app/stages/_lib/profitability";

printAuditSummary();

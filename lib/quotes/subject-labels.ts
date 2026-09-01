/**
 * SUBJECT_LABELS — canonical French labels for the Prisma Subject enum.
 * Client-safe: unlike lib/quotes/exam-profile.ts (which pulls in
 * lib/exams/catalog, marked 'server-only'), this module has no
 * server-only import in its chain — safe for both server modules and
 * 'use client' components, on the model of lib/quotes/regulatory-
 * maturity.ts. Mission P0-A dedupe: this replaces four independently-
 * drifting copies (lib/quotes/exam-profile.ts, lib/quotes/pdf-adapter.ts,
 * components/quotes/DevisWizard.tsx, components/dashboard/assistante/
 * PublicWizardPreview.tsx) — never redefine this map elsewhere.
 *
 * Pre-existing gap, not introduced or fixed here (out of scope for the
 * P0-A dedupe): the Subject enum also has ARABE/ITALIEN/RUSSE/ALLEMAND,
 * which none of the four original copies covered either.
 */
import type { Subject } from '@prisma/client';

export const SUBJECT_LABELS: Record<Subject, string> = {
  MATHEMATIQUES: 'Mathématiques',
  MATHS_EXPERTES: 'Mathématiques expertes',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-Géographie',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'SVT',
  SES: 'SES',
};

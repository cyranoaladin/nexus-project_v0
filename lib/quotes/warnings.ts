/**
 * Client-safe home for family-facing commercial warning text. Deliberately
 * has NO imports — lib/quotes/pricing.ts transitively imports lib/pricing.ts
 * (which declares `import 'server-only'`), so re-exporting this constant
 * from pricing.ts alone would poison any client bundle that needs it
 * (T5R6: CandidatIndividuelWorkspace.tsx, a 'use client' component, reuses
 * this exact string for its own staff-facing hint — see pricing.ts's own
 * re-export below for every server-side consumer).
 */

/**
 * T3A §6 — mandatory, non-bypassable commercial warning for
 * MOD_SPECIALITE_ABANDONNEE (direction decisions registry, commit
 * 4ffaac8ed: "avertissement obligatoire et non contournable côté
 * affichage famille"). Appended to the line's existing `reason` field —
 * already documented (schemas.ts/persistence.server.ts) as "why this
 * line is/isn't included — shown to the family" — rather than inventing
 * a new field or a new regulatory rule. lib/quotes/pdf-adapter.server.ts
 * checks for this exact marker to surface it on the family-facing PDF.
 *
 * T5R6 §FINDING_16 — the original wording ("ne prépare aucune épreuve du
 * bac ... hors épreuve notée") was found ambiguous during human review:
 * the carte d'examen correctly lists this specialty as "À présenter"
 * (coefficient 8) — the ponctuelle evaluation genuinely exists, only this
 * accompaniement isn't a dedicated preparation for it. Direction decision:
 * replace with wording that keeps all four ideas explicit (the ponctuelle
 * evaluation exists; the module covers the Première-year programme; this
 * accompaniement isn't a dedicated preparation for that evaluation; never
 * an "aucune épreuve du bac" claim) — never changes the carte's own
 * statut/coefficient, only this display-time warning text.
 */
export const SPECIALITE_ABANDONNEE_WARNING =
  "Important : cet accompagnement porte sur le programme de Première de la spécialité non poursuivie. Il ne constitue pas, dans sa formule actuelle, une préparation spécifique à l'évaluation ponctuelle correspondante du baccalauréat.";

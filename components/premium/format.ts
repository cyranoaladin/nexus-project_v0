/**
 * Formatting helpers for luxury public pages.
 * All prices in TND — never €.
 */

/** Format a number with French thousand separator + " TND" */
export function fmtTND(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} TND`;
}

/** Format price number only (no currency suffix) */
export function fmtPrice(amount: number): string {
  return amount.toLocaleString('fr-FR');
}

/** Format monthly display "X TND / mois" */
export function fmtMonthly(amount: number): string {
  return `${fmtPrice(amount)}\u00A0TND\u00A0/\u00A0mois`;
}

/** Format "dès X TND / mois" */
export function fmtDesMonthly(amount: number): string {
  return `dès ${fmtPrice(amount)}\u00A0TND\u00A0/\u00A0mois`;
}

/** Format group info "5 max, ouverture dès 3" */
export function fmtGroup(max: number, minOpen: number): string {
  return `${max}\u00A0max, ouverture dès\u00A0${minOpen}`;
}

/** Format hours "Xh / semaine" */
export function fmtHoursWeek(hours: number): string {
  return `${hours}h\u00A0/\u00A0semaine`;
}

/** Format discount badge "-X %" */
export function fmtDiscount(pct: number): string {
  return `−${Math.round(pct)}\u00A0%`;
}

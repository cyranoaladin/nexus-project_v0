import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CANDIDAT_LIBRE_N_INSTALLMENTS,
  QUOTE_BILLED_MONTHS,
  computeCandidatLibreSchedule,
  computeGrandTotal,
} from '@/lib/quotes/pricing';

/**
 * QUOTE_TOTAL_RECONCILIATION — invariant partagé du domaine devis.
 *
 *   monthlyTotal = mensualité
 *   months       = nombre de mensualités (parcours annuel Nexus : 10)
 *   grandTotal   = monthlyTotal × months
 *
 * Une seule convention existe dans le dépôt : ce test échoue si une
 * implémentation concurrente réintroduit un autre sens pour ces champs, ou
 * si le nombre de mensualités est redupliqué en littéral.
 */

const root = process.cwd();

describe('QUOTE_TOTAL_RECONCILIATION', () => {
  test('le parcours annuel Nexus compte 10 mensualités', () => {
    expect(QUOTE_BILLED_MONTHS).toBe(10);
  });

  test('grandTotal === monthlyTotal × months', () => {
    for (const monthlyTotal of [0, 1, 250, 390, 745, 1234]) {
      expect(computeGrandTotal(monthlyTotal)).toBe(monthlyTotal * QUOTE_BILLED_MONTHS);
      expect(computeGrandTotal(monthlyTotal, 9)).toBe(monthlyTotal * 9);
    }
  });

  test("l'échéancier candidat-individuel partage le même nombre de mensualités", () => {
    expect(CANDIDAT_LIBRE_N_INSTALLMENTS).toBe(QUOTE_BILLED_MONTHS);
  });

  test("l'échéancier reconstitue exactement le total annuel, sans écart d'arrondi", () => {
    for (const monthlyTotal of [250, 390, 745, 1234]) {
      const grandTotal = computeGrandTotal(monthlyTotal);
      const s = computeCandidatLibreSchedule(grandTotal);

      expect(s.nInstallments).toBe(QUOTE_BILLED_MONTHS);
      expect(s.deposit + s.installmentAmount * (s.nInstallments - 1) + s.lastInstallmentAmount).toBe(
        grandTotal,
      );
      // Sans acompte, un total annuel divisible par 10 donne 10 mensualités identiques.
      expect(s.deposit).toBe(0);
      expect(s.lastInstallmentAmount).toBe(s.installmentAmount);
      expect(s.installmentAmount).toBe(monthlyTotal);
    }
  });

  test('aucune implémentation concurrente ne recalcule le total annuel en littéral', () => {
    // Le domaine passe par computeGrandTotal ; un `monthlyTotal * 10` isolé
    // signalerait une seconde convention en train de diverger.
    const sources = [
      'lib/quotes/recommendation.ts',
      'lib/quotes/pricing.ts',
      'lib/quotes/pricing-engine.ts',
      'lib/quotes/pipeline.ts',
    ];

    for (const relativePath of sources) {
      let source: string;
      try {
        source = readFileSync(join(root, relativePath), 'utf8');
      } catch {
        continue; // fichier absent de cette lignée : rien à contraindre
      }
      expect(source).not.toMatch(/monthlyTotal\s*\*\s*10\b/);
      expect(source).not.toMatch(/months:\s*10\b/);
    }
  });
});

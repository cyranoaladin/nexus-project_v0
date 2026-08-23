/**
 * Quote status transition graph (CDC §25) — "Transitions contrôlées côté
 * serveur. Pas de modification directe arbitraire depuis le client." Pure,
 * no DB: the persistence layer calls canTransition() before writing.
 */
import type { QuoteStatus } from '@prisma/client';

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  ESTIMATION: ['BILAN_A_FAIRE', 'BILAN_TERMINE', 'DEVIS_ENVOYE', 'EXPIRE'],
  BILAN_A_FAIRE: ['BILAN_TERMINE', 'EXPIRE'],
  BILAN_TERMINE: ['DEVIS_ENVOYE', 'EXPIRE'],
  DEVIS_ENVOYE: ['DEVIS_CONSULTE', 'A_RAPPELER', 'ACCEPTE', 'REFUSE', 'EXPIRE'],
  DEVIS_CONSULTE: ['A_RAPPELER', 'ACCEPTE', 'REFUSE', 'EXPIRE'],
  A_RAPPELER: ['DEVIS_CONSULTE', 'ACCEPTE', 'REFUSE', 'EXPIRE'],
  ACCEPTE: ['INSCRIT'],
  REFUSE: [],
  INSCRIT: [],
  EXPIRE: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

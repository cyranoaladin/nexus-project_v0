import { LEGAL } from '@/lib/legal';

export const CGV_POLICY = {
  version: '1.0',
  versionLabel: 'CGV v1.0 – 2026-03-01',
  effectiveDateLabel: '1er mars 2026',
  payment: {
    provider: 'ClicToPay',
    bank: LEGAL.billing.bank,
    methodsLabel: `ClicToPay (${LEGAL.billing.bank}) ou virement bancaire`,
    acceptedCards: 'Cartes bancaires nationales et internationales acceptées.',
    security: 'CVV2 + 3D Secure requis.',
    cardFee: 'Aucun frais additionnel lié au paiement par carte.',
    cvvStorage: 'Le cryptogramme visuel (CVV) n’est jamais stocké.',
  },
  refunds: {
    summary: 'Les conditions applicables dépendent de la formule et de la consommation des séances.',
    subscriptions: 'Aucun remboursement prorata pour les jours restants du mois en cours après résiliation.',
    packs:
      'Remboursement intégral si la demande est formulée dans les 14 jours suivant l’achat et qu’aucune séance n’a été consommée.',
    technicalIncident:
      'Si un service payé n’a pas pu être délivré du fait de Nexus Réussite, un remboursement ou un avoir est accordé.',
    request:
      'Les demandes de remboursement doivent indiquer le motif et la référence de commande. Délai de traitement : 10 jours ouvrés maximum.',
  },
} as const;

export const CGV_VERSION = CGV_POLICY.versionLabel;

import { render, screen } from '@testing-library/react';
import { EleveHubRessources } from '@/components/dashboard/eleve/EleveHubRessources';
import type { EleveHub } from '@/components/dashboard/eleve/types';

const hub: EleveHub = {
  byCategory: {
    INTERACTIVE_PROGRAM: [
      {
        id: 'interactive:maths-stmg',
        category: 'INTERACTIVE_PROGRAM',
        title: 'Mathématiques STMG — livret interactif',
        type: 'LINK',
        externalUrl: '/dashboard/eleve/programme/maths',
        badge: 'INTERACTIF',
      },
    ],
    OFFICIAL_PROGRAM: [],
    OFFICIAL_AUTOMATISMES: [],
    OFFICIAL_SUJET: [],
    COACH_RESOURCE: [],
    USER_DOCUMENT: [],
    RAG_REFERENCE: [],
    INVOICE: [],
    RECEIPT: [],
    STAGE_BILAN: [],
  },
  totalCount: 1,
  recentlyAddedCount: 0,
};

describe('EleveHubRessources', () => {
  it('uses the resources anchor targeted by dashboard navigation', () => {
    render(<EleveHubRessources hub={hub} />);

    expect(screen.getByRole('region', { name: /Hub Ressources Pédagogiques/i })).toHaveAttribute(
      'id',
      'resources'
    );
  });
});

import { render, screen } from '@testing-library/react';
import { AriaResourcesPanel } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';

function cockpit(resources: AriaCockpitDTO['resources']): AriaCockpitDTO {
  return { resources } as unknown as AriaCockpitDTO;
}

describe('AriaResourcesPanel', () => {
  it('shows an empty state with no resources', () => {
    render(<AriaResourcesPanel cockpit={cockpit([])} />);
    expect(screen.getByText('Aucune ressource disponible')).toBeInTheDocument();
  });

  it('groups resources by category in editorial order, with an optional subtitle', () => {
    render(
      <AriaResourcesPanel
        cockpit={cockpit([
          { id: 'u1', title: 'Ma fiche', category: 'USER_DOCUMENT', href: null },
          { id: 'p1', title: 'Programme officiel', subtitle: 'Édition 2026', category: 'OFFICIAL_PROGRAM', href: '/r/p1' },
        ] as unknown as AriaCockpitDTO['resources'])}
      />,
    );
    const headings = screen.getAllByText(/Programmes officiels|Tes documents/);
    expect(headings.map((el) => el.textContent)).toEqual(['Programmes officiels', 'Tes documents']);
    expect(screen.getByText('Ma fiche')).toBeInTheDocument();
    expect(screen.getByText('Édition 2026')).toBeInTheDocument();
  });
});

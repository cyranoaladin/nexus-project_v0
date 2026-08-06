import { fireEvent, render, screen } from '@testing-library/react';

import { CoachGroupPlanPicker, type GroupPlanPickerCandidate } from '@/components/bilans/CoachGroupPlanPicker';

function candidate(id: string, assessmentPackId: string, displayName = id): GroupPlanPickerCandidate {
  return { id, assessmentPackId, status: 'REPORT_PENDING_REVIEW', displayName };
}

describe('CoachGroupPlanPicker', () => {
  it('blocks submission and shows an inline error when nothing is selected', () => {
    const candidates = [candidate('a', 'pack-1'), candidate('b', 'pack-1'), candidate('c', 'pack-1')];
    render(<CoachGroupPlanPicker candidates={candidates} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le plan HTML' }));

    expect(screen.getByRole('alert')).toHaveTextContent('trois et cinq');
  });

  it('blocks submission when fewer than three attempts of the same pack are selected', () => {
    const candidates = [candidate('a', 'pack-1'), candidate('b', 'pack-1'), candidate('c', 'pack-1')];
    render(<CoachGroupPlanPicker candidates={candidates} />);

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le plan HTML' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/entre 3 et 5/);
  });

  it('blocks submission when more than five attempts are selected', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => candidate(`id-${i}`, 'pack-1'));
    render(<CoachGroupPlanPicker candidates={candidates} />);

    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le plan HTML' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/entre 3 et 5/);
  });

  it('blocks submission when selections span more than one pack', () => {
    const candidates = [candidate('a', 'pack-1'), candidate('b', 'pack-1'), candidate('c', 'pack-2')];
    render(<CoachGroupPlanPicker candidates={candidates} />);

    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le plan HTML' }));

    expect(screen.getByRole('alert')).toHaveTextContent('même pack');
  });

  it('allows submission (no inline error) with 3-5 selections from the same pack', () => {
    const windowOpen = jest.spyOn(window, 'open').mockImplementation(() => null);
    const candidates = [candidate('a', 'pack-1'), candidate('b', 'pack-1'), candidate('c', 'pack-1'), candidate('d', 'pack-2')];
    render(<CoachGroupPlanPicker candidates={candidates} />);

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le plan HTML' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    windowOpen.mockRestore();
  });

  it('opens a URL built only from validated, tracked ids -- never from raw DOM checkbox state', () => {
    // The whole point of not using a native <form method="get"> here: a
    // forged extra checkbox injected outside React's tree (id absent from
    // both `candidates` and `selected`) can never influence a URL built
    // directly from `selected`, since selected can only ever contain ids
    // this component's own onChange handler added.
    const windowOpen = jest.spyOn(window, 'open').mockImplementation(() => null);
    const candidates = [candidate('a', 'pack-1'), candidate('b', 'pack-1'), candidate('c', 'pack-1')];
    render(<CoachGroupPlanPicker candidates={candidates} />);

    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le plan HTML' }));

    expect(windowOpen).toHaveBeenCalledTimes(1);
    const [url] = windowOpen.mock.calls[0];
    const params = new URLSearchParams(String(url).split('?')[1]);
    expect(params.getAll('attemptId').sort()).toEqual(['a', 'b', 'c']);
    expect(params.get('format')).toBe('html');
    windowOpen.mockRestore();
  });

  it('clears a previous inline error once the selection is adjusted', () => {
    const candidates = [candidate('a', 'pack-1'), candidate('b', 'pack-1'), candidate('c', 'pack-1')];
    render(<CoachGroupPlanPicker candidates={candidates} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le plan HTML' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

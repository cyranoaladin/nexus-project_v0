import { fireEvent, render, screen } from '@testing-library/react';
import { AriaChatLauncher } from '@/components/aria/AriaChatLauncher';
import { AriaChatPanel } from '@/components/aria/AriaChatPanel';
import { AriaMarketingDemo } from '@/components/aria/AriaMarketingDemo';

jest.mock('@/components/aria/AriaChatPanel', () => ({
  AriaChatPanel: jest.fn(({ open, onClose, initialCourseKey }) => (
    open
      ? <button type="button" onClick={onClose}>panel:{initialCourseKey ?? 'none'}</button>
      : null
  )),
}));

describe('ARIA chat entrypoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the dashboard launcher as a thin uncontrolled wrapper around the shared panel', () => {
    render(<AriaChatLauncher initialCourseKey="eds-nsi-terminale" />);

    expect(screen.queryByText('panel:eds-nsi-terminale')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ARIA' }));
    expect(screen.getByText('panel:eds-nsi-terminale')).toBeInTheDocument();
    fireEvent.click(screen.getByText('panel:eds-nsi-terminale'));
    expect(screen.queryByText('panel:eds-nsi-terminale')).not.toBeInTheDocument();
  });

  it('delegates controlled visibility without creating a second chat engine', () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const { rerender } = render(
      <AriaChatLauncher open={false} onOpen={onOpen} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ARIA' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('panel:none')).not.toBeInTheDocument();

    rerender(<AriaChatLauncher open onOpen={onOpen} onClose={onClose} />);
    fireEvent.click(screen.getByText('panel:none'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(AriaChatPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, initialCourseKey: undefined }),
      {},
    );
  });

  it('renders a labelled, explicitly static public demonstration with no interactive chat control', () => {
    render(<AriaMarketingDemo />);

    expect(screen.getByLabelText('Exemple statique de dialogue ARIA')).toHaveTextContent(
      'Démonstration statique — aucune conversation ni donnée élève.',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

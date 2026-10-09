import { render, screen } from '@testing-library/react';
import { SaveIndicator } from '@/components/espace/shared/SaveIndicator';

it.each(['offline', 'error'] as const)('reste honnête si le stockage local est indisponible (%s)', state => {
  render(<SaveIndicator state={state} lastSavedAt={null} />);
  expect(screen.getByRole('status')).toHaveTextContent(/garde|gardez|conservez/i);
  expect(screen.getByRole('status')).not.toHaveTextContent(/reste conservé sur cet appareil/i);
});

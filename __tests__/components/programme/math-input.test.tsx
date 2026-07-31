import { render, screen, waitFor } from '@testing-library/react';
import MathInput from '@/components/programme/shared/MathInput';

jest.mock('mathlive', () => ({}), { virtual: true });

describe('MathInput', () => {
  it('mounts MathLive without mutating React-owned fallback children', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <MathInput initialValue={String.raw`\frac{a+b}{c}+\hat{x}`} />,
    );

    await waitFor(() => {
      expect(container.querySelector('math-field')).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText('Tape ta réponse mathématique...')).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

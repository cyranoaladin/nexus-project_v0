import { render } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

describe('Alert', () => {
  it('renders title and description', () => {
    const { getByText } = render(
      <Alert>
        <AlertTitle>Attention</AlertTitle>
        <AlertDescription>Something happened</AlertDescription>
      </Alert>
    );

    expect(getByText('Attention')).toBeInTheDocument();
    expect(getByText('Something happened')).toBeInTheDocument();
  });

  it('applies destructive variant', () => {
    const { getByRole } = render(<Alert variant="destructive">Boom</Alert>);
    expect(getByRole('alert').className).toMatch(/destructive/);
  });
});

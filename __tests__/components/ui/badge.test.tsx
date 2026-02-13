import { render } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children', () => {
    const { getByText } = render(<Badge>New</Badge>);
    expect(getByText('New')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { getByText } = render(<Badge variant="success">OK</Badge>);
    expect(getByText('OK').className).toMatch(/success/i);
  });
});

import { render } from '@testing-library/react';
import { Label } from '@/components/ui/label';

describe('Label', () => {
  it('renders label text', () => {
    const { getByText } = render(<Label htmlFor="field">Name</Label>);
    expect(getByText('Name')).toBeInTheDocument();
  });
});

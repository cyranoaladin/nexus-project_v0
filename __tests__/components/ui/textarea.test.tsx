import { render } from '@testing-library/react';
import { Textarea } from '@/components/ui/textarea';

describe('Textarea', () => {
  it('renders textarea with placeholder', () => {
    const { getByPlaceholderText } = render(<Textarea placeholder="Message" />);
    expect(getByPlaceholderText('Message')).toBeInTheDocument();
  });
});

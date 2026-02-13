/**
 * ScrollArea Component Tests
 */

import { render, screen } from '@testing-library/react';
import { ScrollArea } from '@/components/ui/scroll-area';

describe('ScrollArea', () => {
  it('renders children inside scroll area', () => {
    render(
      <ScrollArea className="custom-scroll">
        <div>Scrollable content</div>
      </ScrollArea>
    );

    expect(screen.getByText('Scrollable content')).toBeInTheDocument();
  });

  it('supports custom className', () => {
    const { container } = render(
      <ScrollArea className="custom-scroll">
        <div>Content</div>
      </ScrollArea>
    );

    const root = container.querySelector('.custom-scroll');
    expect(root).toBeInTheDocument();
  });
});

/**
 * Avatar Component Tests
 */

import { render, screen } from '@testing-library/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

describe('Avatar', () => {
  it('renders avatar root with custom className', () => {
    const { container } = render(
      <Avatar className="custom-avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );

    const root = container.querySelector('.custom-avatar');
    expect(root).toBeInTheDocument();
  });

  it('keeps fallback visible when image has not loaded', () => {
    render(
      <Avatar>
        <AvatarImage src="/avatar.png" alt="User avatar" />
        <AvatarFallback>UA</AvatarFallback>
      </Avatar>
    );

    expect(screen.getByText('UA')).toBeInTheDocument();
  });

  it('renders fallback content', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );

    expect(screen.getByText('AB')).toBeInTheDocument();
  });
});

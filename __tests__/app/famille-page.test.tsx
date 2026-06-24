import { render, screen } from '@testing-library/react';

import FamillePage from '@/app/famille/page';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

describe('FamillePage', () => {
  test('renders group opening thresholds without undefined labels', () => {
    const { container } = render(<FamillePage />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(container.textContent).toMatch(/Brevet/);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });
});

/**
 * Breadcrumb Component Tests
 */

import { render, screen } from '@testing-library/react';
import { Breadcrumb } from '@/components/ui/breadcrumb';

describe('Breadcrumb', () => {
  it('renders breadcrumb items and separators', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(3);
  });

  it('renders last item as current page', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Profile' },
        ]}
      />
    );

    const current = screen.getByText('Profile');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).toBe('SPAN');
  });

  it('renders links for non-last items', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Projects', href: '/projects' },
          { label: 'Alpha' },
        ]}
      />
    );

    const homeLink = screen.getByText('Home').closest('a');
    const projectsLink = screen.getByText('Projects').closest('a');

    expect(homeLink).toHaveAttribute('href', '/');
    expect(projectsLink).toHaveAttribute('href', '/projects');
  });

  it('defaults href to / when not provided on non-last items', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home' },
          { label: 'Page' },
        ]}
      />
    );

    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });
});

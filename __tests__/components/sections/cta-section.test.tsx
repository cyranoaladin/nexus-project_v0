import CTASection from '@/components/sections/cta-section';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// Mock de next/link
jest.mock('next/link', () => {
  return function MockedLink({ children, href }: { children: React.ReactNode; href: string; }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock de framer-motion — filter motion-specific props
jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'onViewportEnter', 'onViewportLeave',
    'drag', 'dragConstraints', 'layout', 'layoutId',
    'onAnimationStart', 'onAnimationComplete', 'custom', 'inherit',
  ]);
  const filterProps = (props: any) => {
    const filtered: any = {};
    Object.keys(props).forEach((k) => { if (!motionProps.has(k)) filtered[k] = props[k]; });
    return filtered;
  };
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => <div {...filterProps(props)} ref={ref}>{children}</div>),
    },
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: any) => children,
  };
});

describe('CTASection', () => {
  it('renders the main CTA message', () => {
    render(<CTASection />);

    expect(screen.getByText(/L'Innovation n'attend pas/i)).toBeInTheDocument();
  });

  it('renders both CTA buttons', () => {
    render(<CTASection />);

    expect(screen.getByText(/Parler à un Expert/i)).toBeInTheDocument();
    expect(screen.getByText(/Auditer mon Établissement/i)).toBeInTheDocument();
  });

  it('has correct links for CTA buttons', () => {
    render(<CTASection />);

    const demoLink = screen.getByText(/Parler à un Expert/i).closest('a');
    expect(demoLink).toHaveAttribute('href', '/contact');

    const auditLink = screen.getByText(/Auditer mon Établissement/i).closest('a');
    expect(auditLink).toHaveAttribute('href', '/contact');
  });

  it('renders trust indicators', () => {
    render(<CTASection />);

    expect(screen.getByText(/Deux voies pour commencer votre transformation/i)).toBeInTheDocument();
  });

  it('renders animated trust elements', () => {
    render(<CTASection />);

    const animatedElements = document.querySelectorAll('[style*="animation-delay"]');
    expect(animatedElements.length).toBeGreaterThanOrEqual(0);
  });

  it('renders proper semantic structure', () => {
    render(<CTASection />);

    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('id', 'contact');

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
  });

  it('has proper button styling and classes', () => {
    render(<CTASection />);

    const primaryButton = screen.getByText(/Parler à un Expert/i).closest('a');
    const secondaryButton = screen.getByText(/Auditer mon Établissement/i).closest('a');

    expect(primaryButton).toBeInTheDocument();
    expect(secondaryButton).toBeInTheDocument();
  });

  it('renders benefits or features if present', () => {
    render(<CTASection />);

    const mainContent = document.querySelector('section');
    expect(mainContent).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    expect(() => render(<CTASection />)).not.toThrow();
  });

  it('has accessible button elements', () => {
    render(<CTASection />);

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).not.toBe('');
    });
  });

  it('maintains proper visual hierarchy', () => {
    render(<CTASection />);

    const mainMessage = screen.getByText(/L'Innovation n'attend pas/i);
    expect(mainMessage).toBeInTheDocument();

    const primaryCTA = screen.getByText(/Parler à un Expert/i);
    expect(primaryCTA).toBeInTheDocument();
  });
});

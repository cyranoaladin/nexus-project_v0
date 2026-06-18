import { HeroSection } from '@/components/sections/hero-section';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('next/link', () => {
  return function MockedLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => {
    const React = require('react');
    return <button {...props}>{children}</button>;
  },
}));

jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileInView', 'viewport']);
  const filterProps = (props: any) => {
    const filtered: any = {};
    Object.keys(props).forEach((key) => {
      if (!motionProps.has(key)) filtered[key] = props[key];
    });
    return filtered;
  };

  const MotionDiv = React.forwardRef(({ children, ...props }: any, ref: any) => <div {...filterProps(props)} ref={ref}>{children}</div>);
  const MotionH1 = React.forwardRef(({ children, ...props }: any, ref: any) => <h1 {...filterProps(props)} ref={ref}>{children}</h1>);
  const MotionP = React.forwardRef(({ children, ...props }: any, ref: any) => <p {...filterProps(props)} ref={ref}>{children}</p>);
  const MotionButton = React.forwardRef(({ children, ...props }: any, ref: any) => <button {...filterProps(props)} ref={ref}>{children}</button>);

  return {
    motion: {
      div: MotionDiv,
      h1: MotionH1,
      p: MotionP,
      button: MotionButton,
    },
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: any) => children,
  };
});

describe('HeroSection', () => {
  it('renders the legacy premium hero copy and CTAs', () => {
    render(<HeroSection />);

    expect(screen.getByText(/pédagogie augmentée par l'ia/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /la pédagogie augmentée pour réussir son bac\. sans stress\./i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /découvrir nos offres/i })).toHaveAttribute('href', '/offres');
    expect(screen.getByRole('button', { name: /commencer mon bilan stratégique gratuit/i })).toBeInTheDocument();
  });

  it('opens the bilan link from the primary CTA', () => {
    render(<HeroSection />);

    const primaryButton = screen.getByRole('button', { name: /commencer mon bilan stratégique gratuit/i });
    fireEvent.click(primaryButton);

    expect(window.location.href).toContain('/bilan-gratuit');
  });
});

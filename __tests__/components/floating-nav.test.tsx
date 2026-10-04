import { navigateDocument } from '@/lib/browser-navigation';
jest.mock('@/lib/browser-navigation', () => ({ navigateDocument: jest.fn(), reloadDocument: jest.fn() }));
import { FloatingNav } from '@/components/ui/floating-nav';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock framer-motion — filter motion-specific props
jest.mock('framer-motion', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const motionProps = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'onViewportEnter', 'onViewportLeave',
    'drag', 'dragConstraints', 'layout', 'layoutId',
    'onAnimationStart', 'onAnimationComplete', 'custom', 'inherit',
  ]);
  const filterProps = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {};
    Object.keys(props).forEach((k) => { if (!motionProps.has(k)) filtered[k] = props[k]; });
    return filtered;
  };
  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(function MockMotionDiv({ children, ...props }, ref) { return <div {...filterProps(props)} ref={ref}>{children}</div>; }),
      button: React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(function MockMotionButton({ children, ...props }, ref) { return <button {...filterProps(props)} ref={ref}>{children}</button>; }),
    },
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => ({ get: () => 1 }),
    useReducedMotion: () => false,
  };
});

// Mock document.querySelector pour le scroll
const mockScrollIntoView = jest.fn();
Object.defineProperty(window, 'scrollIntoView', {
  value: mockScrollIntoView,
  writable: true,
});

describe('FloatingNav', () => {
  beforeEach(() => {
    mockScrollIntoView.mockClear();
  });

  it('affiche les trois boutons de navigation', () => {
    render(<FloatingNav />);

    expect(screen.getByText('ARIA')).toBeInTheDocument();
    expect(screen.getByText('Stages')).toBeInTheDocument();
    expect(screen.getByText('Parcours')).toBeInTheDocument();
  });

  it('a les bonnes icônes pour chaque bouton', () => {
    render(<FloatingNav />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('navigue vers la section canonique des offres quand on clique sur un bouton', () => {
    render(<FloatingNav />);

    const ariaButton = screen.getByText('ARIA');
    fireEvent.click(ariaButton);

    expect(navigateDocument).toHaveBeenCalledWith('/offres#section-plateforme');
  });

  it('a les bonnes classes CSS', () => {
    render(<FloatingNav />);

    const button = screen.getByText('ARIA');
    // Navigate up: button -> flex div -> bg-white div -> motion.div (fixed container)
    const navContainer = button.closest('div')?.parentElement?.parentElement;
    expect(navContainer).toHaveClass('fixed');
    expect(navContainer).toHaveClass('bottom-6');
    expect(navContainer).toHaveClass('left-1/2');
  });

  it('ne tente pas de scroll local pour les liens inter-pages', () => {
    jest.spyOn(document, 'querySelector').mockReturnValue(null);

    render(<FloatingNav />);

    const ariaButton = screen.getByText('ARIA');
    fireEvent.click(ariaButton);

    expect(document.querySelector).not.toHaveBeenCalled();
    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });
});

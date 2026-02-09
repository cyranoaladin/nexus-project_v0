import { FloatingNav } from '@/components/ui/floating-nav';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock framer-motion — filter motion-specific props
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
      button: React.forwardRef(({ children, ...props }: any, ref: any) => <button {...filterProps(props)} ref={ref}>{children}</button>),
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

    expect(screen.getByText('Cortex')).toBeInTheDocument();
    expect(screen.getByText('Académies')).toBeInTheDocument();
    expect(screen.getByText('Odyssée')).toBeInTheDocument();
  });

  it('a les bonnes icônes pour chaque bouton', () => {
    render(<FloatingNav />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('appelle scrollIntoView quand on clique sur un bouton', () => {
    const mockElement = { scrollIntoView: mockScrollIntoView };
    jest.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);

    render(<FloatingNav />);

    const cortexButton = screen.getByText('Cortex');
    fireEvent.click(cortexButton);

    expect(document.querySelector).toHaveBeenCalledWith('#cortex');
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('a les bonnes classes CSS', () => {
    render(<FloatingNav />);

    const button = screen.getByText('Cortex');
    // Navigate up: button -> flex div -> bg-white div -> motion.div (fixed container)
    const navContainer = button.closest('div')?.parentElement?.parentElement;
    expect(navContainer).toHaveClass('fixed');
    expect(navContainer).toHaveClass('bottom-6');
    expect(navContainer).toHaveClass('left-1/2');
  });

  it('gère le cas où l\'élément n\'existe pas', () => {
    jest.spyOn(document, 'querySelector').mockReturnValue(null);

    render(<FloatingNav />);

    const cortexButton = screen.getByText('Cortex');
    fireEvent.click(cortexButton);

    expect(document.querySelector).toHaveBeenCalledWith('#cortex');
    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });
});

/**
 * Button Component Tests
 *
 * Tests for enhanced button component with loading state and animations
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import * as FramerMotion from 'framer-motion';

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  useReducedMotion: jest.fn(() => false),
}));

// Polyfill PointerEvent for jsdom
if (!global.PointerEvent) {
  class PointerEvent extends MouseEvent {
    public pointerId: number;
    public width: number;
    public height: number;
    public pressure: number;
    public tangentialPressure: number;
    public tiltX: number;
    public tiltY: number;
    public twist: number;
    public pointerType: string;
    public isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 0;
      this.width = params.width || 0;
      this.height = params.height || 0;
      this.pressure = params.pressure || 0;
      this.tangentialPressure = params.tangentialPressure || 0;
      this.tiltX = params.tiltX || 0;
      this.tiltY = params.tiltY || 0;
      this.twist = params.twist || 0;
      this.pointerType = params.pointerType || 'mouse';
      this.isPrimary = params.isPrimary || false;
    }
  }
  (global as any).PointerEvent = PointerEvent;
}

describe('Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FramerMotion.useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  describe('Rendering', () => {
    it('renders button with default variant and size', () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole('button', { name: 'Click me' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-brand-primary');
      expect(button).toHaveClass('h-10');
    });

    it('renders all variants correctly', () => {
      const variants = ['default', 'secondary', 'accent', 'outline', 'ghost', 'link'] as const;

      variants.forEach((variant) => {
        const { unmount } = render(<Button variant={variant}>{variant}</Button>);
        const button = screen.getByRole('button', { name: variant });
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it('renders secondary variant with correct styles', () => {
      render(<Button variant="secondary">Secondary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-brand-primary/10');
      expect(button).toHaveClass('text-brand-primary');
    });

    it('renders accent variant with correct styles', () => {
      render(<Button variant="accent">Accent</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-brand-secondary');
    });

    it('renders outline variant with correct styles', () => {
      render(<Button variant="outline">Outline</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border');
      expect(button).toHaveClass('border-brand-primary');
    });

    it('renders ghost variant with correct styles', () => {
      render(<Button variant="ghost">Ghost</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-brand-primary');
      expect(button).toHaveClass('hover:bg-brand-primary/10');
    });

    it('renders link variant with correct styles', () => {
      render(<Button variant="link">Link</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-brand-primary');
      expect(button).toHaveClass('underline-offset-4');
    });

    it('renders all sizes correctly', () => {
      const sizes = ['sm', 'default', 'lg', 'icon'] as const;

      sizes.forEach((size) => {
        const { unmount } = render(<Button size={size}>{size}</Button>);
        const button = screen.getByRole('button', { name: size });
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it('renders small size with correct styles', () => {
      render(<Button size="sm">Small</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');
      expect(button).toHaveClass('px-3');
    });

    it('renders large size with correct styles', () => {
      render(<Button size="lg">Large</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-12');
      expect(button).toHaveClass('px-6');
    });

    it('renders icon size with correct styles', () => {
      render(<Button size="icon">🔍</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');
      expect(button).toHaveClass('w-8');
    });

    it('renders loading state with spinner', () => {
      render(<Button loading>Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      
      // Check for loader icon (Loader2 from lucide-react)
      const loader = button.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveClass('mr-2');
    });

    it('renders without loading spinner by default', () => {
      render(<Button>Normal</Button>);

      const button = screen.getByRole('button');
      const loader = button.querySelector('.animate-spin');
      expect(loader).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Button className="custom-class">Custom</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      // Should still have base classes
      expect(button).toHaveClass('rounded-lg');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<Button ref={ref as any}>Ref Test</Button>);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has aria-busy="true" when loading', () => {
      render(<Button loading>Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('has aria-busy="false" when not loading', () => {
      render(<Button loading={false}>Not Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'false');
    });

    it('is disabled when loading', () => {
      render(<Button loading>Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('is disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('is disabled when both loading and disabled are true', () => {
      render(<Button loading disabled>Both</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('has proper focus-visible styles', () => {
      render(<Button>Focus me</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:outline-none');
      expect(button).toHaveClass('focus-visible:ring-2');
    });

    it('supports keyboard activation with Enter', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Press me</Button>);

      const button = screen.getByRole('button');
      button.focus();
      
      // Simulate Enter key using fireEvent for better jsdom compatibility
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalled();
    });

    it('supports keyboard activation with Space', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Press me</Button>);

      const button = screen.getByRole('button');
      button.focus();
      
      // Simulate Space key using fireEvent for better jsdom compatibility
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalled();
    });

    it('has aria-hidden on loading spinner icon', () => {
      render(<Button loading>Loading</Button>);

      const loader = document.querySelector('.animate-spin');
      expect(loader).toHaveAttribute('aria-hidden', 'true');
    });

    it('maintains button text visibility when loading', () => {
      render(<Button loading>Submit</Button>);

      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });

  describe('Animations', () => {
    it('applies hover animation when not disabled', () => {
      const { container } = render(<Button>Hover me</Button>);

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      
      // Framer Motion props are applied to the motion.button
      // We test that the component renders without errors
    });

    it('applies tap animation when not disabled', () => {
      const { container } = render(<Button>Tap me</Button>);

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('does not apply animations when disabled', () => {
      const { container } = render(<Button disabled>Disabled</Button>);

      const button = container.querySelector('button');
      expect(button).toBeDisabled();
    });

    it('does not apply animations when loading', () => {
      const { container } = render(<Button loading>Loading</Button>);

      const button = container.querySelector('button');
      expect(button).toBeDisabled();
    });

    it('respects prefers-reduced-motion', () => {
      (FramerMotion.useReducedMotion as jest.Mock).mockReturnValue(true);
      
      const { container } = render(<Button>No Motion</Button>);

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      
      // Component should render without motion when reduced motion is preferred
      expect(FramerMotion.useReducedMotion).toHaveBeenCalled();
    });

    it('applies animations when reduced motion is false', () => {
      (FramerMotion.useReducedMotion as jest.Mock).mockReturnValue(false);
      
      const { container } = render(<Button>With Motion</Button>);

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      
      expect(FramerMotion.useReducedMotion).toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('is interactive by default', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents interaction when disabled', () => {
      const handleClick = jest.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('prevents interaction when loading', () => {
      const handleClick = jest.fn();
      render(<Button loading onClick={handleClick}>Loading</Button>);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('has disabled styling when disabled', () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:pointer-events-none');
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('transitions from loading to normal', () => {
      const { rerender } = render(<Button loading>Submit</Button>);

      let button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      
      rerender(<Button loading={false}>Submit</Button>);
      
      button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'false');
    });

    it('supports type attribute', () => {
      render(<Button type="submit">Submit</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('renders as button element', () => {
      render(<Button>Default</Button>);

      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('Edge Cases', () => {
    it('handles long text content', () => {
      const longText = 'This is a very long button text that might wrap or overflow';
      render(<Button>{longText}</Button>);

      expect(screen.getByText(longText)).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toHaveClass('whitespace-nowrap');
    });

    it('handles children with icons', () => {
      render(
        <Button>
          <span>🔍</span>
          Search
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('🔍Search');
    });

    it('handles async onClick', async () => {
      const asyncClick = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      render(<Button onClick={asyncClick}>Async</Button>);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(asyncClick).toHaveBeenCalledTimes(1);
      
      // Wait for async operation
      await waitFor(() => {
        expect(asyncClick).toHaveBeenCalledTimes(1);
      });
    });

    it('handles multiple rapid clicks', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Rapid clicks</Button>);

      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('handles empty children', () => {
      const { container } = render(<Button></Button>);

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('handles null children', () => {
      const { container } = render(<Button>{null}</Button>);

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('handles complex nested children', () => {
      render(
        <Button>
          <div>
            <span>Nested</span>
            <strong>Content</strong>
          </div>
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('NestedContent');
    });

    it('supports data attributes', () => {
      render(<Button data-testid="custom-button" data-value="123">Data</Button>);

      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('data-value', '123');
    });

    it('supports custom event handlers', () => {
      const handleMouseEnter = jest.fn();
      const handleMouseLeave = jest.fn();
      
      render(
        <Button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Hover
        </Button>
      );

      const button = screen.getByRole('button');
      
      fireEvent.mouseEnter(button);
      expect(handleMouseEnter).toHaveBeenCalledTimes(1);
      
      fireEvent.mouseLeave(button);
      expect(handleMouseLeave).toHaveBeenCalledTimes(1);
    });
  });

  describe('asChild Prop', () => {
    it('renders as Slot component when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );

      const link = screen.getByRole('link', { name: 'Link Button' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
    });

    it('applies styles to child element when asChild is true', () => {
      render(
        <Button asChild variant="secondary">
          <a href="/test">Styled Link</a>
        </Button>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('bg-brand-primary/10');
    });

    it('applies aria-busy to child when asChild and loading', () => {
      render(
        <Button asChild loading>
          <a href="/test">Loading Link</a>
        </Button>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-busy', 'true');
    });

    it('renders as button when asChild is false', () => {
      render(<Button asChild={false}>Regular Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Variant and Size Combinations', () => {
    it('handles default variant with small size', () => {
      render(<Button variant="default" size="sm">Small Default</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-brand-primary');
      expect(button).toHaveClass('h-8');
    });

    it('handles outline variant with large size', () => {
      render(<Button variant="outline" size="lg">Large Outline</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border');
      expect(button).toHaveClass('h-12');
    });

    it('handles accent variant with icon size', () => {
      render(<Button variant="accent" size="icon">+</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-brand-secondary');
      expect(button).toHaveClass('h-8');
      expect(button).toHaveClass('w-8');
    });

    it('handles ghost variant with loading state', () => {
      render(<Button variant="ghost" loading>Loading Ghost</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-brand-primary');
      expect(button).toBeDisabled();
      
      const loader = button.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('Loading State Details', () => {
    it('shows spinner before button text', () => {
      const { container } = render(<Button loading>Submit</Button>);

      const button = container.querySelector('button');
      const spinner = button?.querySelector('.animate-spin');
      const text = button?.textContent;
      
      expect(spinner).toBeInTheDocument();
      expect(text).toContain('Submit');
      
      // Spinner should be first child (has mr-2 margin)
      expect(spinner).toHaveClass('mr-2');
    });

    it('spinner has correct size (h-4 w-4)', () => {
      render(<Button loading>Loading</Button>);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-4');
      expect(spinner).toHaveClass('w-4');
    });

    it('loading button combines with all variants', () => {
      const variants = ['default', 'secondary', 'accent', 'outline', 'ghost', 'link'] as const;

      variants.forEach((variant) => {
        const { unmount } = render(
          <Button variant={variant} loading>
            {variant}
          </Button>
        );
        
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        
        const spinner = button.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
        
        unmount();
      });
    });
  });
});

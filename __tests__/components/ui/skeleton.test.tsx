/**
 * Skeleton Component Tests
 *
 * Tests for loading placeholder components
 */

import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonInput,
} from '@/components/ui/skeleton';

jest.mock('framer-motion', () => ({
  useReducedMotion: jest.fn(() => false),
}));

describe('Skeleton', () => {
  describe('Basic Skeleton', () => {
    it('renders with default animation', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild;
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('renders with pulse animation', () => {
      const { container } = render(<Skeleton animation="pulse" />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('renders with wave animation', () => {
      const { container } = render(<Skeleton animation="wave" />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('relative');
      expect(skeleton).toHaveClass('overflow-hidden');
    });

    it('renders with no animation', () => {
      const { container } = render(<Skeleton animation="none" />);

      const skeleton = container.firstChild;
      expect(skeleton).not.toHaveClass('animate-pulse');
    });

    it('applies custom className', () => {
      const { container } = render(
        <Skeleton className="h-12 w-12 rounded-full" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('h-12');
      expect(skeleton).toHaveClass('w-12');
      expect(skeleton).toHaveClass('rounded-full');
    });

    it('applies base styles', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('rounded-md');
      expect(skeleton).toHaveClass('bg-neutral-200');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<Skeleton ref={ref as any} />);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('SkeletonText', () => {
    it('renders default 3 lines', () => {
      const { container } = render(<SkeletonText />);

      const skeletons = container.querySelectorAll('.h-4');
      expect(skeletons).toHaveLength(3);
    });

    it('renders custom number of lines', () => {
      const { container } = render(<SkeletonText lines={5} />);

      const skeletons = container.querySelectorAll('.h-4');
      expect(skeletons).toHaveLength(5);
    });

    it('renders single line', () => {
      const { container } = render(<SkeletonText lines={1} />);

      const skeletons = container.querySelectorAll('.h-4');
      expect(skeletons).toHaveLength(1);
    });

    it('last line is shorter (4/5 width)', () => {
      const { container } = render(<SkeletonText lines={3} />);

      const skeletons = container.querySelectorAll('.h-4');
      const lastSkeleton = skeletons[2];
      expect(lastSkeleton).toHaveClass('w-4/5');
    });

    it('applies custom className', () => {
      const { container } = render(
        <SkeletonText className="custom-spacing" />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-spacing');
      expect(wrapper).toHaveClass('space-y-2');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<SkeletonText ref={ref as any} />);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('SkeletonCard', () => {
    it('renders card structure', () => {
      const { container } = render(<SkeletonCard />);

      const card = container.firstChild;
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-neutral-200');
    });

    it('contains avatar and text skeletons', () => {
      const { container } = render(<SkeletonCard />);

      const avatarSkeleton = container.querySelector('.h-12.w-12.rounded-full');
      expect(avatarSkeleton).toBeInTheDocument();

      const textSkeletons = container.querySelectorAll('.h-4');
      expect(textSkeletons.length).toBeGreaterThan(0);
    });

    it('applies custom className', () => {
      const { container } = render(
        <SkeletonCard className="custom-card" />
      );

      const card = container.firstChild;
      expect(card).toHaveClass('custom-card');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<SkeletonCard ref={ref as any} />);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('SkeletonAvatar', () => {
    it('renders with default medium size', () => {
      const { container } = render(<SkeletonAvatar />);

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('h-12');
      expect(avatar).toHaveClass('w-12');
      expect(avatar).toHaveClass('rounded-full');
    });

    it('renders small size', () => {
      const { container } = render(<SkeletonAvatar size="sm" />);

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('h-8');
      expect(avatar).toHaveClass('w-8');
    });

    it('renders medium size', () => {
      const { container } = render(<SkeletonAvatar size="md" />);

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('h-12');
      expect(avatar).toHaveClass('w-12');
    });

    it('renders large size', () => {
      const { container } = render(<SkeletonAvatar size="lg" />);

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('h-16');
      expect(avatar).toHaveClass('w-16');
    });

    it('applies custom className', () => {
      const { container } = render(
        <SkeletonAvatar className="custom-avatar" />
      );

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('custom-avatar');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<SkeletonAvatar ref={ref as any} />);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('SkeletonButton', () => {
    it('renders with default size', () => {
      const { container } = render(<SkeletonButton />);

      const button = container.firstChild;
      expect(button).toHaveClass('h-10');
      expect(button).toHaveClass('md:h-12');
      expect(button).toHaveClass('w-24');
      expect(button).toHaveClass('md:w-32');
      expect(button).toHaveClass('rounded-lg');
    });

    it('renders small size', () => {
      const { container } = render(<SkeletonButton size="sm" />);

      const button = container.firstChild;
      expect(button).toHaveClass('h-8');
      expect(button).toHaveClass('md:h-9');
      expect(button).toHaveClass('w-20');
      expect(button).toHaveClass('md:w-24');
    });

    it('renders large size', () => {
      const { container } = render(<SkeletonButton size="lg" />);

      const button = container.firstChild;
      expect(button).toHaveClass('h-12');
      expect(button).toHaveClass('md:h-14');
      expect(button).toHaveClass('w-32');
      expect(button).toHaveClass('md:w-40');
    });

    it('renders icon size (square)', () => {
      const { container } = render(<SkeletonButton size="icon" />);

      const button = container.firstChild;
      expect(button).toHaveClass('h-8');
      expect(button).toHaveClass('w-8');
      expect(button).toHaveClass('md:h-10');
      expect(button).toHaveClass('md:w-10');
    });

    it('has default aria-label', () => {
      const { container } = render(<SkeletonButton />);

      const button = container.firstChild;
      expect(button).toHaveAttribute('aria-label', 'Loading button');
    });

    it('can override aria-label', () => {
      const { container } = render(<SkeletonButton aria-label="Custom loading" />);

      const button = container.firstChild;
      expect(button).toHaveAttribute('aria-label', 'Custom loading');
    });

    it('applies custom className', () => {
      const { container } = render(
        <SkeletonButton className="custom-button" />
      );

      const button = container.firstChild;
      expect(button).toHaveClass('custom-button');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<SkeletonButton ref={ref as any} />);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('SkeletonInput', () => {
    it('renders with input dimensions', () => {
      const { container } = render(<SkeletonInput />);

      const input = container.firstChild;
      expect(input).toHaveClass('h-10');
      expect(input).toHaveClass('md:h-12');
      expect(input).toHaveClass('w-full');
      expect(input).toHaveClass('rounded-lg');
    });

    it('has default aria-label', () => {
      const { container } = render(<SkeletonInput />);

      const input = container.firstChild;
      expect(input).toHaveAttribute('aria-label', 'Loading input');
    });

    it('can override aria-label', () => {
      const { container } = render(<SkeletonInput aria-label="Custom loading" />);

      const input = container.firstChild;
      expect(input).toHaveAttribute('aria-label', 'Custom loading');
    });

    it('applies custom className', () => {
      const { container } = render(
        <SkeletonInput className="custom-input" />
      );

      const input = container.firstChild;
      expect(input).toHaveClass('custom-input');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<SkeletonInput ref={ref as any} />);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero lines in SkeletonText', () => {
      const { container } = render(<SkeletonText lines={0} />);

      const skeletons = container.querySelectorAll('.h-4');
      expect(skeletons).toHaveLength(0);
    });

    it('handles very large number of lines', () => {
      const { container } = render(<SkeletonText lines={100} />);

      const skeletons = container.querySelectorAll('.h-4');
      expect(skeletons).toHaveLength(100);
    });

    it('combines animation prop with custom className', () => {
      const { container } = render(
        <Skeleton animation="wave" className="h-20 w-20" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('h-20');
      expect(skeleton).toHaveClass('w-20');
      expect(skeleton).toHaveClass('relative');
      expect(skeleton).toHaveClass('overflow-hidden');
    });

    it('SkeletonButton renders with all animation variants', () => {
      const { container: pulseContainer } = render(<SkeletonButton animation="pulse" />);
      const pulseButton = pulseContainer.firstChild;
      expect(pulseButton).toHaveClass('animate-pulse');

      const { container: waveContainer } = render(<SkeletonButton animation="wave" />);
      const waveButton = waveContainer.firstChild;
      expect(waveButton).toHaveClass('relative');
      expect(waveButton).toHaveClass('overflow-hidden');

      const { container: noneContainer } = render(<SkeletonButton animation="none" />);
      const noneButton = noneContainer.firstChild;
      expect(noneButton).not.toHaveClass('animate-pulse');
      expect(noneButton).not.toHaveClass('relative');
    });

    it('SkeletonInput renders with all animation variants', () => {
      const { container: pulseContainer } = render(<SkeletonInput animation="pulse" />);
      const pulseInput = pulseContainer.firstChild;
      expect(pulseInput).toHaveClass('animate-pulse');

      const { container: waveContainer } = render(<SkeletonInput animation="wave" />);
      const waveInput = waveContainer.firstChild;
      expect(waveInput).toHaveClass('relative');
      expect(waveInput).toHaveClass('overflow-hidden');

      const { container: noneContainer } = render(<SkeletonInput animation="none" />);
      const noneInput = noneContainer.firstChild;
      expect(noneInput).not.toHaveClass('animate-pulse');
      expect(noneInput).not.toHaveClass('relative');
    });

    it('SkeletonButton all sizes with custom className', () => {
      const { container: smContainer } = render(
        <SkeletonButton size="sm" className="custom-sm" />
      );
      expect(smContainer.firstChild).toHaveClass('custom-sm');

      const { container: lgContainer } = render(
        <SkeletonButton size="lg" className="custom-lg" />
      );
      expect(lgContainer.firstChild).toHaveClass('custom-lg');

      const { container: iconContainer } = render(
        <SkeletonButton size="icon" className="custom-icon" />
      );
      expect(iconContainer.firstChild).toHaveClass('custom-icon');
    });

    it('SkeletonInput with custom width', () => {
      const { container } = render(
        <SkeletonInput className="w-1/2" />
      );

      const input = container.firstChild;
      expect(input).toHaveClass('w-1/2');
    });

    it('combines aria attributes with custom props on new patterns', () => {
      const { container } = render(
        <SkeletonButton
          aria-label="Custom loading"
          aria-live="polite"
          role="status"
          className="custom-class"
        />
      );

      const button = container.firstChild;
      expect(button).toHaveAttribute('aria-label', 'Custom loading');
      expect(button).toHaveAttribute('aria-live', 'polite');
      expect(button).toHaveAttribute('role', 'status');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Composite Usage', () => {
    it('renders multiple skeletons together', () => {
      const { container } = render(
        <div className="flex items-center space-x-4">
          <SkeletonAvatar size="lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      );

      const avatar = container.querySelector('.h-16.w-16.rounded-full');
      expect(avatar).toBeInTheDocument();

      const textSkeletons = container.querySelectorAll('.h-4');
      expect(textSkeletons).toHaveLength(2);
    });

    it('renders skeleton list', () => {
      const { container } = render(
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );

      const cards = container.querySelectorAll('.rounded-lg.border');
      expect(cards).toHaveLength(3);
    });
  });

  describe('Accessibility', () => {
    it('has aria-busy="true" by default', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('aria-busy', 'true');
    });

    it('has aria-busy on all skeleton patterns', () => {
      render(
        <div data-testid="test-container">
          <SkeletonButton />
          <SkeletonInput />
          <SkeletonAvatar />
          <SkeletonText lines={1} />
        </div>
      );

      const container = screen.getByTestId('test-container');
      const skeletons = container.querySelectorAll('[aria-busy="true"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('can have aria-label for loading state', () => {
      const { container } = render(
        <Skeleton aria-label="Loading content" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
    });

    it('supports aria-live="polite"', () => {
      const { container } = render(
        <Skeleton aria-live="polite" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('aria-live', 'polite');
    });

    it('supports aria-live="assertive"', () => {
      const { container } = render(
        <Skeleton aria-live="assertive" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('aria-live', 'assertive');
    });

    it('supports aria-live="off"', () => {
      const { container } = render(
        <Skeleton aria-live="off" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('aria-live', 'off');
    });

    it('can combine aria-label and aria-live', () => {
      const { container } = render(
        <Skeleton aria-label="Loading profile" aria-live="polite" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('aria-label', 'Loading profile');
      expect(skeleton).toHaveAttribute('aria-live', 'polite');
      expect(skeleton).toHaveAttribute('aria-busy', 'true');
    });

    it('supports role attribute', () => {
      const { container } = render(
        <Skeleton role="status" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('role', 'status');
    });

    it('SkeletonButton has appropriate aria-label', () => {
      const { container } = render(<SkeletonButton />);

      const button = container.firstChild;
      expect(button).toHaveAttribute('aria-label', 'Loading button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('SkeletonInput has appropriate aria-label', () => {
      const { container } = render(<SkeletonInput />);

      const input = container.firstChild;
      expect(input).toHaveAttribute('aria-label', 'Loading input');
      expect(input).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Reduced Motion', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('respects prefers-reduced-motion for pulse animation', () => {
      const { useReducedMotion } = require('framer-motion');
      (useReducedMotion as jest.Mock).mockReturnValue(true);

      const { container } = render(<Skeleton animation="pulse" />);

      const skeleton = container.firstChild;
      expect(skeleton).not.toHaveClass('animate-pulse');
    });

    it('respects prefers-reduced-motion for wave animation', () => {
      const { useReducedMotion } = require('framer-motion');
      (useReducedMotion as jest.Mock).mockReturnValue(true);

      const { container } = render(<Skeleton animation="wave" />);

      const skeleton = container.firstChild;
      expect(skeleton).not.toHaveClass('relative');
      expect(skeleton).not.toHaveClass('overflow-hidden');
    });

    it('keeps animation when reduced motion is disabled', () => {
      const { useReducedMotion } = require('framer-motion');
      (useReducedMotion as jest.Mock).mockReturnValue(false);

      const { container } = render(<Skeleton animation="pulse" />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('respects prefers-reduced-motion for SkeletonButton', () => {
      const { useReducedMotion } = require('framer-motion');
      (useReducedMotion as jest.Mock).mockReturnValue(true);

      const { container } = render(<SkeletonButton />);

      const button = container.firstChild;
      expect(button).not.toHaveClass('animate-pulse');
    });

    it('respects prefers-reduced-motion for SkeletonInput', () => {
      const { useReducedMotion } = require('framer-motion');
      (useReducedMotion as jest.Mock).mockReturnValue(true);

      const { container } = render(<SkeletonInput />);

      const input = container.firstChild;
      expect(input).not.toHaveClass('animate-pulse');
    });

    it('respects prefers-reduced-motion for SkeletonText', () => {
      const { useReducedMotion } = require('framer-motion');
      (useReducedMotion as jest.Mock).mockReturnValue(true);

      const { container } = render(<SkeletonText lines={2} />);

      const skeletons = container.querySelectorAll('[aria-busy="true"]');
      skeletons.forEach((skeleton) => {
        expect(skeleton).not.toHaveClass('animate-pulse');
      });
    });

    it('animation="none" works regardless of reduced motion preference', () => {
      const { useReducedMotion } = require('framer-motion');
      (useReducedMotion as jest.Mock).mockReturnValue(false);

      const { container } = render(<Skeleton animation="none" />);

      const skeleton = container.firstChild;
      expect(skeleton).not.toHaveClass('animate-pulse');
    });
  });
});

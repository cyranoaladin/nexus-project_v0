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
} from '@/components/ui/skeleton';

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
    it('can have aria-label for loading state', () => {
      const { container } = render(
        <Skeleton aria-label="Loading content" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
    });

    it('can have aria-busy attribute', () => {
      const { container } = render(
        <div aria-busy="true">
          <Skeleton />
        </div>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveAttribute('aria-busy', 'true');
    });

    it('supports role attribute', () => {
      const { container } = render(
        <Skeleton role="status" />
      );

      const skeleton = container.firstChild;
      expect(skeleton).toHaveAttribute('role', 'status');
    });
  });
});

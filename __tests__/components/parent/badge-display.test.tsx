import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BadgeDisplay } from '@/components/ui/parent/badge-display';

jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, {
      get: (target, prop) => {
        return React.forwardRef((props: any, ref: any) => {
          const { children, initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
          return React.createElement(prop, { ...rest, ref }, children);
        });
      }
    }),
    useReducedMotion: () => false,
  };
});

const mockBadges = [
  {
    id: '1',
    name: 'Badge Assiduité 1',
    description: 'Premier badge d\'assiduité',
    category: 'ASSIDUITE',
    icon: '🎯',
    earnedAt: new Date('2024-01-15'),
    isRecent: false,
  },
  {
    id: '2',
    name: 'Badge Progression 1',
    description: 'Premier badge de progression',
    category: 'PROGRESSION',
    icon: '📈',
    earnedAt: new Date('2024-01-20'),
    isRecent: false,
  },
  {
    id: '3',
    name: 'Badge Curiosité 1',
    description: 'Premier badge de curiosité',
    category: 'CURIOSITE',
    icon: '🔍',
    earnedAt: new Date(),
    isRecent: true,
  },
  {
    id: '4',
    name: 'Badge Assiduité 2',
    description: 'Deuxième badge d\'assiduité',
    category: 'ASSIDUITE',
    icon: '⭐',
    earnedAt: new Date('2024-01-25'),
    isRecent: false,
  },
];

describe('BadgeDisplay Component', () => {
  describe('Rendering with badges', () => {
    test('should render all badges by default', async () => {
      render(<BadgeDisplay badges={mockBadges} />);
      
      await waitFor(() => {
        expect(screen.getByText('Badge Assiduité 1')).toBeInTheDocument();
      });
      expect(screen.getByText('Badge Progression 1')).toBeInTheDocument();
      expect(screen.getByText('Badge Curiosité 1')).toBeInTheDocument();
      expect(screen.getByText('Badge Assiduité 2')).toBeInTheDocument();
    });

    test('should display badge counts in tabs', () => {
      render(<BadgeDisplay badges={mockBadges} />);
      
      expect(screen.getByText(/Tous \(4\)/)).toBeInTheDocument();
      expect(screen.getByText(/Assiduité \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/Progression \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Curiosité \(1\)/)).toBeInTheDocument();
    });

    test('should display badge descriptions and earned dates', () => {
      render(<BadgeDisplay badges={mockBadges} />);
      
      expect(screen.getByText('Premier badge d\'assiduité')).toBeInTheDocument();
      expect(screen.getByText('Premier badge de progression')).toBeInTheDocument();
    });
  });

  describe('Category tab switching', () => {
    test('should filter badges when category tab is clicked', async () => {
      const user = userEvent.setup();
      render(<BadgeDisplay badges={mockBadges} />);
      
      const assiduitéTab = screen.getByText(/Assiduité \(2\)/);
      await user.click(assiduitéTab);
      
      await waitFor(() => {
        expect(screen.getByText('Badge Assiduité 1')).toBeInTheDocument();
        expect(screen.getByText('Badge Assiduité 2')).toBeInTheDocument();
        expect(screen.queryByText('Badge Progression 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Badge Curiosité 1')).not.toBeInTheDocument();
      });
    });

    test('should show only progression badges when progression tab is selected', async () => {
      const user = userEvent.setup();
      render(<BadgeDisplay badges={mockBadges} />);
      
      const progressionTab = screen.getByText(/Progression \(1\)/);
      await user.click(progressionTab);
      
      await waitFor(() => {
        expect(screen.getByText('Badge Progression 1')).toBeInTheDocument();
        expect(screen.queryByText('Badge Assiduité 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Badge Curiosité 1')).not.toBeInTheDocument();
      });
    });

    test('should show only curiosité badges when curiosité tab is selected', async () => {
      const user = userEvent.setup();
      render(<BadgeDisplay badges={mockBadges} />);
      
      const curiositéTab = screen.getByText(/Curiosité \(1\)/);
      await user.click(curiositéTab);
      
      await waitFor(() => {
        expect(screen.getByText('Badge Curiosité 1')).toBeInTheDocument();
        expect(screen.queryByText('Badge Assiduité 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Badge Progression 1')).not.toBeInTheDocument();
      });
    });

    test('should return to all badges when "Tous" tab is clicked', async () => {
      const user = userEvent.setup();
      render(<BadgeDisplay badges={mockBadges} />);
      
      const assiduitéTab = screen.getByText(/Assiduité \(2\)/);
      await user.click(assiduitéTab);
      
      await waitFor(() => {
        expect(screen.queryByText('Badge Curiosité 1')).not.toBeInTheDocument();
      });
      
      const allTab = screen.getByText(/Tous \(4\)/);
      await user.click(allTab);
      
      await waitFor(() => {
        expect(screen.getByText('Badge Assiduité 1')).toBeInTheDocument();
        expect(screen.getByText('Badge Progression 1')).toBeInTheDocument();
        expect(screen.getByText('Badge Curiosité 1')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    test('should display empty state when no badges are provided', () => {
      render(<BadgeDisplay badges={[]} />);
      
      expect(screen.getByText('Aucun badge gagné pour le moment')).toBeInTheDocument();
      expect(screen.getByText(/Les badges apparaîtront au fur et à mesure des progrès/)).toBeInTheDocument();
    });

    test('should display empty state when category has no badges', async () => {
      const badgesWithoutProgression = mockBadges.filter(b => b.category !== 'PROGRESSION');
      const user = userEvent.setup();
      render(<BadgeDisplay badges={badgesWithoutProgression} />);
      
      const progressionTab = screen.getByText(/Progression \(0\)/);
      await user.click(progressionTab);
      
      await waitFor(() => {
        expect(screen.getByText('Aucun badge gagné pour le moment')).toBeInTheDocument();
      });
    });
  });

  describe('Recent badge indicator', () => {
    test('should display "Nouveau" indicator for recent badges', () => {
      render(<BadgeDisplay badges={mockBadges} />);
      
      const nouveauBadges = screen.getAllByText('Nouveau');
      expect(nouveauBadges.length).toBeGreaterThan(0);
    });

    test('should not display "Nouveau" indicator for old badges', () => {
      const oldBadges = mockBadges.map(badge => ({ ...badge, isRecent: false }));
      render(<BadgeDisplay badges={oldBadges} />);
      
      expect(screen.queryByText('Nouveau')).not.toBeInTheDocument();
    });

    test('should only mark badges with isRecent flag as new', () => {
      render(<BadgeDisplay badges={mockBadges} />);
      
      const recentBadgesCount = mockBadges.filter(b => b.isRecent).length;
      const nouveauBadges = screen.getAllByText('Nouveau');
      
      expect(nouveauBadges).toHaveLength(recentBadgesCount);
    });
  });

  describe('Badge icons', () => {
    test('should display custom icons when provided', () => {
      render(<BadgeDisplay badges={mockBadges} />);
      
      const badgeCards = screen.getAllByRole('img');
      expect(badgeCards.length).toBeGreaterThan(0);
    });

    test('should display default icon when icon is null', () => {
      const badgesWithoutIcons = mockBadges.map(badge => ({ ...badge, icon: null }));
      render(<BadgeDisplay badges={badgesWithoutIcons} />);
      
      expect(screen.getByText('Badge Assiduité 1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels for badge icons', () => {
      render(<BadgeDisplay badges={mockBadges} />);
      
      const badgeIcon = screen.getByLabelText('Badge Assiduité 1');
      expect(badgeIcon).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    test('should handle large number of badges', () => {
      const manyBadges = Array.from({ length: 50 }, (_, i) => ({
        id: `badge-${i}`,
        name: `Badge ${i}`,
        description: `Description ${i}`,
        category: ['ASSIDUITE', 'PROGRESSION', 'CURIOSITE'][i % 3] as 'ASSIDUITE' | 'PROGRESSION' | 'CURIOSITE',
        icon: '🏆',
        earnedAt: new Date(),
        isRecent: i < 5,
      }));
      
      render(<BadgeDisplay badges={manyBadges} />);
      
      expect(screen.getByText(/Tous \(50\)/)).toBeInTheDocument();
    });

    test('should handle badges with missing descriptions', () => {
      const badgesWithEmptyDesc = mockBadges.map(badge => ({ ...badge, description: '' }));
      render(<BadgeDisplay badges={badgesWithEmptyDesc} />);
      
      expect(screen.getByText('Badge Assiduité 1')).toBeInTheDocument();
    });
  });
});

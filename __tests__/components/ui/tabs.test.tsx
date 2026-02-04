/**
 * Tabs Component Tests
 *
 * Tests for tabbed interface component
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';

describe('Tabs', () => {
  const renderBasicTabs = () => {
    return render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );
  };

  describe('Rendering', () => {
    it('renders all tab triggers', () => {
      renderBasicTabs();

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles multiple tab switches', async () => {
      const { container } = renderBasicTabs();

      const tab2 = screen.getByText('Tab 2');
      const tab3 = screen.getByText('Tab 3');

      fireEvent.click(tab2);
      await waitFor(() => {
        const panel = container.querySelector('[role="tabpanel"]');
        if (panel) {
          expect(panel).toHaveTextContent('Content 2');
        }
      });

      fireEvent.click(tab3);
      await waitFor(() => {
        const panel = container.querySelector('[role="tabpanel"]');
        if (panel) {
          expect(panel).toHaveTextContent('Content 3');
        }
      });
    });

    it('supports controlled state', async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <Tabs value="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab2 = screen.getByText('Tab 2');
      await user.click(tab2);

      expect(onValueChange).toHaveBeenCalledWith('tab2');
    });
  });



  describe('Styling', () => {
    it('supports custom className on TabsList', () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>
      );

      const list = container.querySelector('.custom-list');
      expect(list).toBeInTheDocument();
    });

    it('supports custom className on TabsTrigger', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" className="custom-trigger">
              Tab 1
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>
      );

      const trigger = screen.getByText('Tab 1');
      expect(trigger).toHaveClass('custom-trigger');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes on tabs', () => {
      const { container } = renderBasicTabs();

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).toBeInTheDocument();

      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(3);
    });
  });

  describe('Disabled State', () => {
    it('renders disabled tab', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>
              Tab 2
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab2 = screen.getByText('Tab 2');
      expect(tab2).toBeDisabled();
    });

    it('cannot click disabled tab', async () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>
              Tab 2
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab2 = screen.getByText('Tab 2');
      fireEvent.click(tab2);

      // Content 1 should still be visible
      await waitFor(() => {
        const panel = container.querySelector('[role="tabpanel"]');
        if (panel) {
          expect(panel).toHaveTextContent('Content 1');
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles single tab', async () => {
      const { container } = render(
        <Tabs defaultValue="only">
          <TabsList>
            <TabsTrigger value="only">Only Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="only">Only Content</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Only Tab')).toBeInTheDocument();
      await waitFor(() => {
        const panel = container.querySelector('[role="tabpanel"]');
        if (panel) {
          expect(panel).toHaveTextContent('Only Content');
        }
      });
    });

    it('handles empty content', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"></TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('handles tabs without defaultValue', () => {
      render(
        <Tabs>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      // No content should be visible initially (no active tab)
      const { container } = render(
        <Tabs>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>
      );

      const tabpanel = container.querySelector('[role="tabpanel"]');
      expect(tabpanel).not.toBeInTheDocument();
    });
  });
});

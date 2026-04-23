/**
 * F52: BilanTabs Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BilanTabs, { useBilanTabs } from '@/components/bilan/BilanTabs';

describe('F52: BilanTabs', () => {
  it('should render all three audience tabs by default', () => {
    render(
      <BilanTabs
        activeAudience="student"
        onAudienceChange={() => {}}
      />
    );

    expect(screen.getByText('Élève')).toBeInTheDocument();
    expect(screen.getByText('Parents')).toBeInTheDocument();
    expect(screen.getByText('Nexus')).toBeInTheDocument();
  });

  it('should highlight active audience', () => {
    render(
      <BilanTabs
        activeAudience="parents"
        onAudienceChange={() => {}}
      />
    );

    const parentsButton = screen.getByText('Parents').closest('button');
    expect(parentsButton).toHaveClass('bg-green-100');
  });

  it('should call onAudienceChange when tab clicked', () => {
    const onChange = jest.fn();
    render(
      <BilanTabs
        activeAudience="student"
        onAudienceChange={onChange}
      />
    );

    fireEvent.click(screen.getByText('Parents'));
    expect(onChange).toHaveBeenCalledWith('parents');
  });

  it('should return null when only one tab visible (hiding others)', () => {
    const { container } = render(
      <BilanTabs
        activeAudience="student"
        onAudienceChange={() => {}}
        showParents={false}
        showNexus={false}
      />
    );

    // Component returns null when only one tab visible
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Élève')).not.toBeInTheDocument();
  });

  it('should apply disabled state', () => {
    render(
      <BilanTabs
        activeAudience="student"
        onAudienceChange={() => {}}
        disabled={true}
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveClass('cursor-not-allowed');
    });
  });
});

describe('F52: useBilanTabs hook', () => {
  function TestComponent() {
    const { activeAudience, setActiveAudience, BilanTabsComponent } = useBilanTabs('student');
    return (
      <div>
        <BilanTabsComponent />
        <div data-testid="active">{activeAudience}</div>
        <button onClick={() => setActiveAudience('parents')}>Change</button>
      </div>
    );
  }

  it('should manage audience state', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('active')).toHaveTextContent('student');
  });
});

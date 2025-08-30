import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BilanCard, BilanCardProps } from '@/components/BilanCard';

const mockPush = jest.fn();
const mockOpen = jest.fn();

// Mock next/navigation and window.open
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

Object.defineProperty(window, 'open', { value: mockOpen });

const baseBilan: BilanCardProps = {
  id: 'bilan-123',
  variant: 'ELEVE',
  status: 'PENDING',
  createdAt: new Date('2023-01-01T10:00:00Z').toISOString(),
};

describe('BilanCard', () => {

  beforeEach(() => {
    mockPush.mockClear();
    mockOpen.mockClear();
  });

  it('renders correctly for PENDING status and handles click', () => {
    render(<BilanCard bilan={baseBilan} />);
    
    expect(screen.getByText('Bilan Premium')).toBeInTheDocument();
    expect(screen.getByText('1 janvier 2023')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    
    const button = screen.getByRole('button', { name: /Compléter Volet 2/i });
    expect(button).not.toBeDisabled();
    
    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith('/dashboard/student/bilan/bilan-123/volet2');
  });

  it('renders correctly for GENERATING status', () => {
    const bilanGenerating = { ...baseBilan, status: 'GENERATING' as const };
    render(<BilanCard bilan={bilanGenerating} />);
    
    expect(screen.getByText('Génération...')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /En cours.../i });
    expect(button).toBeDisabled();
  });

  it('renders correctly for READY status and handles click', () => {
    const bilanReady = { ...baseBilan, status: 'READY' as const };
    render(<BilanCard bilan={bilanReady} />);
    
    expect(screen.getByText('Prêt')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Télécharger/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(mockOpen).toHaveBeenCalledWith('/api/bilans/bilan-123/download', '_blank');
  });

  it('renders correctly for FAILED status', () => {
    const bilanFailed = { ...baseBilan, status: 'FAILED' as const };
    render(<BilanCard bilan={bilanFailed} />);
    
    expect(screen.getByText('Échec')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /En cours.../i });
    expect(button).toBeDisabled();
  });

  it('displays the variant and score correctly', () => {
    const bilanParent = { ...baseBilan, variant: 'PARENT' as const, score: 85 };
    render(<BilanCard bilan={bilanParent} />);
    
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });
});

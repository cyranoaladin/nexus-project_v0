import React from 'react';
import { render, screen } from '@testing-library/react';
import { TeacherView } from '../app/programme/maths-1ere/components/Enseignant/TeacherView';
import '@testing-library/jest-dom';

// Mock de framer-motion car il peut poser problème dans Jest
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock du store zustand
jest.mock('../app/programme/maths-1ere/store', () => ({
  useMathsLabStore: () => ({
    completedChapters: [],
    totalXP: 0,
    streak: 0,
    chapterProgress: {},
    isChapterCompleted: () => false,
  }),
}));

describe('TeacherView - Logo Bilan', () => {
  it('doit afficher le logo Nexus dans la section printable du bilan', () => {
    render(<TeacherView studentName="Test Student" />);
    
    // Aller sur l'onglet Bilan
    const bilanTab = screen.getByText('Export Bilan');
    bilanTab.click();

    // Le logo doit être présent avec le bon src
    const logo = screen.getByAltText('Nexus Réussite');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/images/logo_slogan_nexus.png');
  });
});

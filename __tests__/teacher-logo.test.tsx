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

// Mock de lucide-react pour éviter les erreurs d'import ESM
jest.mock('lucide-react', () => {
  const React = require('react');
  return new Proxy({}, {
    get: () => (props: any) => React.createElement('svg', props),
  });
});

// Mock de @react-pdf/renderer pour éviter les erreurs d'import ESM et de primitives
jest.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }: any) => <>{children({ loading: false })}</>,
  Document: ({ children }: any) => <>{children}</>,
  Page: ({ children }: any) => <>{children}</>,
  View: ({ children }: any) => <>{children}</>,
  Text: ({ children }: any) => <>{children}</>,
  Image: (props: any) => <img {...props} />,
  StyleSheet: { create: (s: any) => s },
}));

// Mock du store zustand
jest.mock('../app/programme/maths-1ere/store', () => ({
  useMathsLabStore: () => ({
    completedChapters: [],
    totalXP: 0,
    streak: 0,
    chapterProgress: {},
    diagnosticResults: {},
    getNiveau: () => ({ nom: 'Première' }),
    getDueReviews: () => [],
    isChapterCompleted: () => false,
  }),
}));

describe('TeacherView - Logo Bilan', () => {
  beforeAll(() => {
    // Mock window.print
    Object.defineProperty(window, 'print', {
      value: jest.fn(),
      configurable: true,
    });
  });

  it('doit afficher le logo Nexus dans la section printable du bilan', async () => {
    const { findByAltText, getByText } = render(<TeacherView studentName="Test Student" />);
    
    // Aller sur l'onglet Bilan
    const bilanTab = getByText('Export Bilan');
    bilanTab.click();

    // Le logo doit être présent avec le bon src
    const logo = await findByAltText('Nexus Réussite');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/images/logo_slogan_nexus.png');
  });
});

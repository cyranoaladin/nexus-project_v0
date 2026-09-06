import { fireEvent, render, screen } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';

import { ExamenBlancView } from '@/app/programme/maths-1ere/components/Examen/ExamenBlancView';

jest.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, element: string) => (
      { children, ...props }: PropsWithChildren<Record<string, unknown>>
    ) => createElement(element, props, children),
  }),
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock('lucide-react', () => new Proxy({}, {
  get: () => (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

jest.mock('@/components/programme/shared/MathContent', () => ({
  MathRichText: ({ content }: { content: string }) => <span>{content}</span>,
}));

jest.mock('@/components/programme/shared/RAG/RAGRemediation', () => ({
  RAGRemediation: () => <div data-testid="rag-remediation" />,
}));

jest.mock('@/app/programme/maths-1ere/store', () => ({
  useMathsLabStore: () => ({
    examState: {
      isActive: true,
      elapsedSeconds: 0,
      autoStates: {},
      exScores: {},
    },
    saveExamState: jest.fn(),
    clearExamState: jest.fn(),
  }),
}));

function openFirstCorrection() {
  fireEvent.click(screen.getByRole('button', { name: 'Correction complète' }));
  const questionButton = screen.getAllByRole('button').find((button) =>
    button.textContent?.includes('pt') && button.textContent?.includes('…'),
  );
  expect(questionButton).toBeDefined();
  fireEvent.click(questionButton!);
}

describe('Examen Blanc RAG access', () => {
  it('hides RAG remediation when the caller is not an authorized student', () => {
    render(<ExamenBlancView userRole="COACH" />);

    openFirstCorrection();

    expect(screen.queryByTestId('rag-remediation')).not.toBeInTheDocument();
    expect(screen.queryByText('Aide Nexus (RAG)')).not.toBeInTheDocument();
  });

  it('keeps RAG remediation available for an authorized student', () => {
    render(<ExamenBlancView userRole="ELEVE" />);

    openFirstCorrection();

    expect(screen.getByTestId('rag-remediation')).toBeInTheDocument();
    expect(screen.getByText('Aide Nexus (RAG)')).toBeInTheDocument();
  });
});

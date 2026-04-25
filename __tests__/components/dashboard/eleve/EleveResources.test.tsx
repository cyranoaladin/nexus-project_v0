import React from 'react';
import { render, screen } from '@testing-library/react';
import { EleveResources } from '@/components/dashboard/eleve/EleveResources';
import type { EleveResource } from '@/components/dashboard/eleve/types';

const makeResource = (overrides: Partial<EleveResource> = {}): EleveResource => ({
  id: 'r1',
  type: 'USER_DOCUMENT',
  title: 'Fiche Maths.pdf',
  uploadedAt: '2026-04-01T10:00:00.000Z',
  downloadUrl: '/api/student/documents/r1/download',
  ...overrides,
});

describe('EleveResources', () => {
  it('renders empty state when resources is empty', () => {
    render(<EleveResources resources={[]} />);
    expect(screen.getByText(/Aucune ressource disponible/i)).toBeInTheDocument();
  });

  it('renders a resource item with title and download link', () => {
    render(<EleveResources resources={[makeResource()]} />);
    const link = screen.getByRole('link', { name: /Télécharger Fiche Maths.pdf/i });
    expect(link).toHaveAttribute('href', '/api/student/documents/r1/download');
    expect(screen.getByText('Fiche Maths.pdf')).toBeInTheDocument();
  });

  it('shows type label "Document" for USER_DOCUMENT', () => {
    render(<EleveResources resources={[makeResource({ type: 'USER_DOCUMENT' })]} />);
    expect(screen.getByText(/Document/)).toBeInTheDocument();
  });

  it('shows type label "Fiche de révision" for RAG_REFERENCE', () => {
    render(<EleveResources resources={[makeResource({ type: 'RAG_REFERENCE', title: 'Algo.pdf' })]} />);
    expect(screen.getByText(/Fiche de révision/)).toBeInTheDocument();
  });

  it('shows formatted file size when sizeBytes is provided', () => {
    render(<EleveResources resources={[makeResource({ sizeBytes: 204800 })]} />);
    expect(screen.getByText(/200 Ko/)).toBeInTheDocument();
  });

  it('renders multiple resources', () => {
    render(
      <EleveResources
        resources={[
          makeResource({ id: 'r1', title: 'Doc 1' }),
          makeResource({ id: 'r2', title: 'Doc 2' }),
        ]}
      />
    );
    expect(screen.getByText('Doc 1')).toBeInTheDocument();
    expect(screen.getByText('Doc 2')).toBeInTheDocument();
  });

  it('does not fetch internally — no fetch call expected', () => {
    const spy = jest.spyOn(global, 'fetch');
    render(<EleveResources resources={[makeResource()]} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

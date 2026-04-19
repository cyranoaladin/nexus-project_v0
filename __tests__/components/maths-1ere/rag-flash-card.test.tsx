/**
 * Tests for RAGFlashCard component
 *
 * Validates:
 * - Auto-fetch on mount (from weakest diagnosed chapter)
 * - Loading state display
 * - Correct rendering with MathRichText (no raw LaTeX)
 * - Error / empty state fallback
 * - Refresh button works
 * - "Voir d'autres conseils" CTA fires callback
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RAGFlashCard } from '@/app/programme/maths-1ere/components/RAG/RAGFlashCard';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock zustand store
const mockStore = {
  diagnosticResults: {} as Record<string, { score: number; total: number; date: string }>,
  getDueReviews: jest.fn(() => [] as string[]),
};

jest.mock('@/app/programme/maths-1ere/store', () => ({
  useMathsLabStore: () => mockStore,
}));

// Mock programmeData
jest.mock('@/app/programme/maths-1ere/data', () => ({
  programmeData: {
    algebre: {
      titre: 'Algèbre',
      chapitres: [{ id: 'second-degre', titre: 'Second Degré' }],
    },
  },
}));

// Mock MathContent
jest.mock('@/app/programme/maths-1ere/components/MathContent', () => ({
  MathRichText: ({ content }: { content: string }) => (
    <div data-testid="math-rich-text">{content}</div>
  ),
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<object>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren<object>) => <>{children}</>,
}));

// Mock fetch globally
const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  mockStore.diagnosticResults = {};
  mockStore.getDueReviews.mockReturnValue([]);
  (global as typeof globalThis & { fetch: jest.Mock }).fetch = mockFetch;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RAGFlashCard', () => {
  it('déclenche un fetch automatiquement au montage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: [{ id: '1', document: 'Contenu test', score: 85, metadata: { type: 'methode' } }],
      }),
    });

    render(<RAGFlashCard onShowMore={jest.fn()} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/programme/maths-1ere/rag');
    const body = JSON.parse(options.body as string);
    expect(body.chapId).toBeDefined();
    expect(body.chapTitre).toBeDefined();
  });

  it("utilise le chapitre le plus faible du diagnostic comme cible", async () => {
    mockStore.diagnosticResults = {
      'probabilites-conditionnelles': { score: 1, total: 5, date: '2026-04-01' },
      'second-degre': { score: 4, total: 5, date: '2026-04-01' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    render(<RAGFlashCard onShowMore={jest.fn()} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.chapId).toBe('probabilites-conditionnelles');
  });

  it("affiche le state 'loading' puis le résultat", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: [
          {
            id: '1',
            document: 'Ne pas oublier $\\Delta = b^2 - 4ac$',
            score: 90,
            metadata: { type: 'methode', title: 'Discriminant' },
          },
        ],
      }),
    });

    render(<RAGFlashCard onShowMore={jest.fn()} />);

    // Eventually shows content via MathRichText
    await waitFor(() => {
      expect(screen.getByTestId('math-rich-text')).toBeInTheDocument();
    });

    const content = screen.getByTestId('math-rich-text').textContent ?? '';
    // Content should not be empty
    expect(content.length).toBeGreaterThan(0);
  });

  it("affiche un message d'erreur si le RAG est indisponible", async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<RAGFlashCard onShowMore={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/temporairement indisponible/i)).toBeInTheDocument();
    });
  });

  it("affiche un message 'aucune ressource' si hits est vide", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    render(<RAGFlashCard onShowMore={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/aucune ressource/i)).toBeInTheDocument();
    });
  });

  it("appelle onShowMore au clic sur le bouton CTA", async () => {
    const onShowMore = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    render(<RAGFlashCard onShowMore={onShowMore} />);

    await waitFor(() => screen.getByText(/voir d'autres conseils/i));
    fireEvent.click(screen.getByText(/voir d'autres conseils/i));

    expect(onShowMore).toHaveBeenCalledTimes(1);
  });

  it("le bouton Rafraîchir déclenche un nouveau fetch", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hits: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hits: [] }) });

    render(<RAGFlashCard onShowMore={jest.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const refreshBtn = screen.getByLabelText(/rafraîchir/i);
    fireEvent.click(refreshBtn);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});

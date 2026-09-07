import { fireEvent, render, screen } from '@testing-library/react';
import RAGSources from '@/app/programme/maths-1ere/components/RAGSources';
import { RAGRemediation } from '@/components/programme/shared/RAG/RAGRemediation';
jest.mock('@/components/programme/shared/MathContent', () => ({ MathRichText: ({ content }: { content: string }) => <p>{content}</p> }));
afterEach(() => jest.restoreAllMocks());
function response(source = 'https://education.example/document.pdf') {
 return { ok: true, json: async () => ({ source: 'rag-v2', hits: [{ id: 'h1', document: 'Extrait officiel.', score: 92, citation: { label: 'OFFICIEL_MEN', source, page: 12 }, metadata: { title: 'Programme', sourceLabel: 'OFFICIEL_MEN', page: 12 } }] }) } as Response;
}
it('renders a safely linked source and page', async () => {
 jest.spyOn(global, 'fetch').mockResolvedValue(response());
 render(<RAGSources chapId="ch1" chapTitre="Suites" />);
 fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
 expect(await screen.findByRole('link', { name: 'https://education.example/document.pdf' })).toHaveAttribute('href', 'https://education.example/document.pdf');
 expect(screen.getByText(/OFFICIEL_MEN.*page 12/)).toBeVisible();
});
it.each(['javascript:alert(1)', 'file:///private/document.pdf', 'urn:official:document'])('renders a non-http source only as text: %s', async source => {
 jest.spyOn(global, 'fetch').mockResolvedValue(response(source));
 render(<RAGSources chapId="ch1" chapTitre="Suites" />);
 fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
 expect(await screen.findByText(source)).toBeVisible();
 expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('renders remediation provenance and page beside the excerpt', async () => {
 jest.spyOn(global, 'fetch').mockResolvedValue(response());
 render(<RAGRemediation chapId="ch1" chapTitre="Suites" />);
 fireEvent.click(screen.getByRole('button', { name: 'Consulter les ressources' }));
 expect(await screen.findByText(/OFFICIEL_MEN.*page 12/)).toBeVisible();
 expect(screen.getByText('Extrait officiel.')).toBeVisible();
});

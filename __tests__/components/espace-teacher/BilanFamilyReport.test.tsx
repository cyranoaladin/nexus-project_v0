import { render, screen } from '@testing-library/react';
import { BilanFamilyReport } from '@/components/espace/teacher/BilanFamilyReport';

it('separates student declarations from teacher observations without inventing progress or a score', () => {
  const { container } = render(<BilanFamilyReport studentName="Élève Test" level="3e" status="SUBMITTED" steps={{ scope: { fields: { '3-arith': 'yes' } }, mastery: { fields: { '3-div-s': 'alone' } }, evidence: { fields: { '3-div': '{"answer":"mon essai","aid":"Un indice","skipped":false}' } }, next: { fields: { commitment: 'Refaire seul une question' } } }} annotations={[{ id: 'a1', body: 'Priorité 1 : contrôler le reste sans aide.', authorName: 'Professeur', stepId: null, createdAt: '2026-10-07T10:00:00Z' }]} />);
  expect(screen.getByText('Élève Test')).toBeInTheDocument();
  expect(screen.getByText(/Projet de bilan/)).toBeInTheDocument();
  expect(screen.getByText(/Aide déclarée : Un indice/)).toBeInTheDocument();
  expect(screen.getByText(/Priorité 1 : contrôler/)).toBeInTheDocument();
  expect(container.textContent).not.toContain('"answer"');
  expect(container.textContent).not.toContain('347 = 16 × 21 + 11');
  expect(container.textContent).not.toContain('Note globale');
});

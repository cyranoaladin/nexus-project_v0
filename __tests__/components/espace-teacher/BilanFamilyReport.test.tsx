import { bilanData } from '@/lib/espace/bilan-data';
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
  for (const heading of container.querySelectorAll('h1, h2, h3')) {
    expect(heading).toHaveClass('text-slate-900');
  }
});

it.each([['tle-maths', 'Mathématiques'], ['tle-nsi', 'NSI']] as const)('prints the correct subject and level for %s without relabelling it Seconde', (level, subject) => {
  render(<BilanFamilyReport studentName="Élève fictif Terminale" level={level} status="SUBMITTED" steps={{}} annotations={[]} />);
  expect(screen.getByText(`NEXUS RÉUSSITE · ${subject.toLocaleUpperCase('fr-FR')}`)).toBeVisible();
  expect(screen.getByText('Terminale · Septembre 2026')).toBeVisible();
  expect(screen.queryByText('Seconde · Septembre 2026')).not.toBeInTheDocument();
});

it('preserves Python line breaks and indentation in the family report prompt', () => {
  const task = bilanData.tasks.find(t => t.module === bilanData.modules['tle-nsi'][0].id && t.prompt.includes('\n'))!;
  const scope = Object.fromEntries(bilanData.modules['tle-nsi'].map(theme => [theme.id, 'yes']));
  render(<BilanFamilyReport studentName="Élève fictif NSI" level="tle-nsi" status="SUBMITTED" steps={{scope:{fields:scope},evidence:{fields:{[task.id]:JSON.stringify({answer:'Trace fictive'})}}}} annotations={[]} />);
  const prompt = screen.getByText((_text, element) => element?.tagName === 'P' && element.textContent === task.prompt);
  expect(prompt).toHaveClass('whitespace-pre-wrap');
});

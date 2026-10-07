import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const edit = jest.fn();
const submit = jest.fn();
let syncMock: Record<string, unknown>;
jest.mock('@/components/espace/shared/useWorkSync', () => ({ useWorkSync: () => syncMock }));

import { BilanWorkbench, type BilanWorkbenchProps } from '@/components/espace/student/BilanWorkbench';
import { bilanData } from '@/lib/espace/bilan-data';

function setup(steps: Record<string, unknown> = {}, over: Partial<BilanWorkbenchProps['work']> = {}) {
  const work = { id: 'bilan-work', status: 'IN_PROGRESS' as const, revision: 2, currentStep: 0, lastSavedAt: '2026-10-07T09:00:00Z', steps: steps as never, ...over };
  syncMock = { state: 'saved', steps: work.steps, edit, conflict: null, resolveConflict: jest.fn(), submit, lastSavedAt: null };
  return render(<BilanWorkbench userId="student-server-id" studentName="Élève Test" level="3e" work={work} annotations={[]} />);
}
beforeEach(() => { edit.mockReset(); submit.mockReset(); });

it('uses the server identity without asking for a name or a level', () => {
  setup();
  expect(screen.getByText('Élève Test')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /nom|prénom/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Seconde' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Importer|ChatGPT|JSON/i)).not.toBeInTheDocument();
});

it('saves a declared worked topic through the existing server synchronization', () => {
  setup();
  const module = bilanData.modules['3e'][0];
  const group = screen.getByRole('group', { name: module.label });
  fireEvent.click(within(group).getByRole('radio', { name: 'Oui, travaillé en séance' }));
  expect(edit).toHaveBeenCalledWith('scope', { fields: { [module.id]: 'yes' } }, expect.objectContaining({ currentStep: 0 }));
});

it('never proposes mini tasks for an undeclared topic', () => {
  setup({}, { currentStep: 2 });
  expect(screen.getByText(/Aucune notion déclarée travaillée/)).toBeInTheDocument();
  expect(screen.queryByText(bilanData.tasks[0].prompt)).not.toBeInTheDocument();
});

it('excludes a task whose prerequisite was not worked', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } }, mastery: { fields: { '3-div-s': 'notworked' } } }, { currentStep: 2 });
  expect(screen.queryByRole('checkbox', { name: 'Une égalité à vérifier' })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Des sachets identiques' })).toBeInTheDocument();
});

it('keeps a submitted bilan read-only', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } } }, { status: 'SUBMITTED' });
  expect(screen.getAllByRole('radio').every(el => (el as HTMLInputElement).disabled)).toBe(true);
  expect(screen.queryByRole('button', { name: 'Transmettre mon bilan' })).not.toBeInTheDocument();
});

it('transmits only after an explicit review confirmation and locks after server acknowledgement', async () => {
  submit.mockResolvedValue({ kind: 'ok' });
  setup({ review: { fields: { confirmed: 'yes' } } }, { currentStep: 7 });
  fireEvent.click(screen.getByRole('button', { name: 'Transmettre mon bilan' }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Transmettre' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(/Ton bilan a été transmis/)).toBeInTheDocument();
});

it('shows failed submission and preserves the editable answers', async () => {
  submit.mockResolvedValue({ kind: 'blocked', reason: 'offline' });
  setup({ review: { fields: { confirmed: 'yes' } } }, { currentStep: 7 });
  fireEvent.click(screen.getByRole('button', { name: 'Transmettre mon bilan' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Transmettre' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/connexion|enregistré/);
  expect(screen.getByRole('checkbox', { name: /J’ai relu/ })).not.toBeDisabled();
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const edit = jest.fn();
const submit = jest.fn();
let syncMock: Record<string, unknown>;
jest.mock('@/components/espace/shared/useWorkSync', () => ({ useWorkSync: () => syncMock }));

import { BilanWorkbench, type BilanWorkbenchProps } from '@/components/espace/student/BilanWorkbench';
import { bilanData } from '@/lib/espace/bilan-data';

function setup(steps: Record<string, unknown> = {}, over: Partial<BilanWorkbenchProps['work']> = {}, extra: Partial<BilanWorkbenchProps> = {}) {
  const work = { id: 'bilan-work', status: 'IN_PROGRESS' as const, revision: 2, currentStep: 0, lastSavedAt: '2026-10-07T09:00:00Z', steps: steps as never, ...over };
  syncMock = { state: 'saved', steps: work.steps, edit, conflict: null, resolveConflict: jest.fn(), submit, lastSavedAt: null };
  return render(<BilanWorkbench userId="student-server-id" studentName="Élève Test" level="3e" work={work} annotations={[]} {...extra} />);
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

it('accepts the teacher reopening after a server refresh without requiring a full browser reload', () => {
  const view = setup({}, { status: 'SUBMITTED' });
  view.rerender(<BilanWorkbench userId="student-server-id" studentName="Élève Test" level="3e" work={{ id: 'bilan-work', status: 'REOPENED', revision: 4, currentStep: 0, lastSavedAt: '2026-10-07T11:00:00Z', steps: {} }} annotations={[]} />);
  expect(screen.getByText(/Ton professeur t’invite à reprendre/)).toBeInTheDocument();
  expect(screen.getAllByRole('radio').every(el => !(el as HTMLInputElement).disabled)).toBe(true);
});

it('preserves the first attempt when temporarily marking a task as not done', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } }, evidence: { fields: { '3-div': JSON.stringify({ answer: 'Mon premier raisonnement', retry: 'Après un indice', aid: 'Un indice', skipped: false }) } } }, { currentStep: 2 }, { preview: true });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Je n’ai pas fait cet essai' }));
  expect(screen.queryByLabelText('Mon premier essai et mon explication')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Je n’ai pas fait cet essai' }));
  expect(screen.getByLabelText('Mon premier essai et mon explication')).toHaveValue('Mon premier raisonnement');
  expect(screen.getByLabelText(/Après une aide ou une reprise \(facultatif\)/)).toHaveValue('Après un indice');
  expect(edit).not.toHaveBeenCalled();
});

it('limits selected tasks to two without losing the existing attempts', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } } }, { currentStep: 2 }, { preview: true });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Une égalité à vérifier' }));
  fireEvent.change(screen.getByLabelText('Mon premier essai et mon explication'), { target: { value: 'Ma trace conservée' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Premier ou carré ?' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Des sachets identiques' }));
  expect(screen.getByRole('checkbox', { name: 'Des sachets identiques' })).not.toBeChecked();
  expect(screen.getAllByLabelText('Mon premier essai et mon explication')[0]).toHaveValue('Ma trace conservée');
});

it('allows declining a multi-choice question even after reaching its selection limit', () => {
  setup({}, { currentStep: 3 }, { preview: true });
  const question = screen.getByRole('group', { name: 'Qu’est-ce qui te gêne le plus en ce moment ?' });
  fireEvent.click(within(question).getByLabelText('Comprendre la consigne'));
  fireEvent.click(within(question).getByLabelText('Faire les calculs'));
  fireEvent.click(within(question).getByLabelText('Je ne souhaite pas répondre'));
  expect(within(question).getByLabelText('Je ne souhaite pas répondre')).toBeChecked();
  expect(within(question).getByLabelText('Comprendre la consigne')).not.toBeChecked();
  expect(within(question).getByLabelText('Faire les calculs')).not.toBeChecked();
});

it('clears incompatible evidence and the review confirmation when the scope changes', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } }, evidence: { fields: { '3-div': '{"answer":"ancienne preuve"}' } }, review: { fields: { confirmed: 'yes' } } });
  fireEvent.click(within(screen.getByRole('group', { name: 'Divisibilité, nombres premiers et division' })).getByLabelText('Non travaillé'));
  expect(edit).toHaveBeenCalledWith('evidence', { fields: {} }, expect.anything());
  expect(edit).toHaveBeenCalledWith('review', { fields: { confirmed: '' } }, expect.anything());
});

it('explains that a concurrently changed copy must be reread before transmission', async () => {
  submit.mockResolvedValue({ kind: 'failed', message: 'Le travail a changé sur un autre appareil. Relisez la version actualisée avant de transmettre.' });
  setup({ review: { fields: { confirmed: 'yes' } } }, { currentStep: 7 });
  fireEvent.click(screen.getByRole('button', { name: 'Transmettre mon bilan' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Transmettre' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Relisez la version actualisée');
});

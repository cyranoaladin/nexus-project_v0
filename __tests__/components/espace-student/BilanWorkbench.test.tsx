import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const edit = jest.fn();
const submit = jest.fn();
let syncMock: Record<string, unknown>;
jest.mock('@/components/espace/shared/useWorkSync', () => ({ useWorkSync: () => syncMock }));
jest.mock('@/lib/espace/bilan-data', () => {
  const actual = jest.requireActual('@/lib/espace/bilan-data');
  return { ...actual, getBilanSections: jest.fn(actual.getBilanSections) };
});

import { BilanWorkbench, type BilanWorkbenchProps } from '@/components/espace/student/BilanWorkbench';
import * as bilanModule from '@/lib/espace/bilan-data';
import { bilanData, getBilanSections, getBilanLesson, getBilanSkillStep } from '@/lib/espace/bilan-data';

function setup(steps: Record<string, unknown> = {}, over: Partial<BilanWorkbenchProps['work']> = {}, extra: Partial<BilanWorkbenchProps> = {}) {
  const level = extra.level ?? '3e';
  const legacySteps = ['scope', 'mastery', 'evidence', 'methods', 'experience', 'growth', 'next', 'review'];
  const currentStep = getBilanLesson(level).steps.findIndex(step => step.id === legacySteps[over.currentStep ?? 0]);
  const work = { id: 'bilan-work', status: 'IN_PROGRESS' as const, revision: 2, lastSavedAt: '2026-10-07T09:00:00Z', steps: steps as never, ...over, currentStep };
  syncMock = { state: 'saved', steps: work.steps, edit, conflict: null, resolveConflict: jest.fn(), submit, lastSavedAt: null };
  return render(<BilanWorkbench userId="student-server-id" studentName="Élève Test" level="3e" work={work} annotations={[]} {...extra} />);
}
beforeEach(() => { edit.mockReset(); submit.mockReset(); jest.mocked(getBilanSections).mockImplementation(jest.requireActual('@/lib/espace/bilan-data').getBilanSections); });
afterEach(() => jest.restoreAllMocks());
function navigate(stepId: string) { fireEvent.change(screen.getByLabelText(/^Étape /), { target: { value: stepId } }); }

it('uses the server identity without asking for a name or a level', () => {
  setup();
  expect(screen.getByText('Élève Test')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /nom|prénom/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Seconde' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Importer|ChatGPT|JSON/i)).not.toBeInTheDocument();
});

it('saves a declared worked topic through the existing server synchronization', () => {
  setup();
  const theme = bilanData.modules['3e'][0];
  const group = screen.getByRole('group', { name: theme.label });
  fireEvent.click(within(group).getByRole('radio', { name: 'Oui, travaillé en séance' }));
  expect(edit).toHaveBeenCalledWith('scope', { fields: { [theme.id]: 'yes' } }, expect.objectContaining({ currentStep: 0 }));
});

it('never proposes mini tasks for an undeclared topic', () => {
  setup({}, { currentStep: 2 });
  expect(screen.getByRole('heading', { name: 'Relire et transmettre' })).toBeInTheDocument();
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


it.each(['3e', '2nde'] as const)('skips unavailable rubrics for a fresh %s student without inventing worked topics', level => {
  setup({}, {}, { level, preview: true });
  expect(screen.getByRole('option', { name: /Où j’en suis/ })).toBeDisabled();
  expect(screen.getByRole('option', { name: /Mes essais/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  expect(screen.getByRole('heading', { name: 'Mon parcours et mes attentes' })).toBeInTheDocument();
  expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
  expect(screen.getByRole('heading', { name: 'Ce que nous avons travaillé' })).toBeInTheDocument();
  expect(screen.getAllByRole('radio').every(input => !(input as HTMLInputElement).checked)).toBe(true);
});

it.each(['no', 'unsure'])('keeps non-worked or uncertain topics excluded (%s) without a blank step', value => {
  const scope = Object.fromEntries(bilanData.modules['3e'].map(m => [m.id, value]));
  setup({ scope: { fields: scope } }, {}, { preview: true });
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  expect(screen.getByRole('heading', { name: 'Mon parcours et mes attentes' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Revoir les thèmes travaillés' }));
  expect(screen.getByRole('heading', { name: 'Ce que nous avons travaillé' })).toBeInTheDocument();
  for (const m of bilanData.modules['3e']) expect(within(screen.getByRole('group', { name: m.label })).getByRole('radio', { name: value === 'no' ? 'Non travaillé' : 'Je ne sais plus' })).toBeChecked();
});

it('unlocks actual mastery questions and tasks after declaring a worked topic', () => {
  setup({}, {}, { preview: true });
  const theme = bilanData.modules['3e'][0];
  fireEvent.click(within(screen.getByRole('group', { name: theme.label })).getByRole('radio', { name: 'Oui, travaillé en séance' }));
  expect(screen.getByRole('option', { name: /Où j’en suis/ })).toBeEnabled();
  expect(screen.getByRole('option', { name: /Mes essais/ })).toBeEnabled();
  navigate('mastery');
  expect(screen.getByRole('group', { name: theme.skills[0].text })).toBeInTheDocument();
  navigate('evidence');
  expect(screen.getByRole('group', { name: /Les essais choisis/ })).toBeInTheDocument();
});

it('skips only the trials when worked-theme skills exclude all eligible tasks', () => {
  const theme = bilanData.modules['3e'][0];
  setup({ scope: { fields: { [theme.id]: 'yes' } }, ...Object.fromEntries(['mastery', 'mastery-extra'].map(stepId => [stepId, { fields: Object.fromEntries(theme.skills.filter(skill => getBilanSkillStep('3e', skill.id) === stepId).map(skill => [skill.id, 'notworked'])) }])) }, { currentStep: 1 }, { preview: true });
  expect(screen.getByRole('option', { name: /Où j’en suis/ })).toBeEnabled();
  expect(screen.getByRole('option', { name: /Mes essais/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  expect(screen.getByRole('heading', { name: 'Mes autres repères en mathématiques' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
  expect(screen.getByRole('heading', { name: 'Où j’en suis' })).toBeInTheDocument();
});

it('does not list empty inapplicable rubrics in the review', () => {
  setup({}, { currentStep: 7 }, { preview: true });
  expect(screen.queryByText('Où j’en suis', { selector: 'summary' })).not.toBeInTheDocument();
  expect(screen.queryByText('Mes essais', { selector: 'summary' })).not.toBeInTheDocument();
});

it('explains a voluntarily skipped trial in the review instead of an empty rubric', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } } }, { currentStep: 7 }, { preview: true });
  fireEvent.click(screen.getByText('Mes essais', { selector: 'summary' }));
  expect(screen.getByText('Aucun essai choisi. Cette étape est facultative ; tu peux en parler avec ton professeur.')).toBeInTheDocument();
});


it('keeps teacher feedback on skipped rubrics visible in the review', () => {
  setup({}, { currentStep: 7, status: 'CORRECTED' }, { annotations: [
    { id: 'note-hidden', stepId: 'mastery', body: 'Nous reprendrons ensemble ce point.', scope: 'STEP', kind: 'COMMENT', createdAt: '2026-10-07T12:00:00Z' } as never,
  ] });
  expect(screen.getByText('Nous reprendrons ensemble ce point.')).toBeInTheDocument();
});

it.each([['tle-maths', 'Mathématiques'], ['tle-nsi', 'NSI']] as const)('identifies the %s questionnaire by its subject and Terminale level', (level, subject) => {
  setup({}, {}, { level, preview: true });
  expect(screen.getByText(`${subject} · Terminale · Septembre 2026`)).toBeVisible();
  expect(screen.queryByText(/Mathématiques · Seconde/)).not.toBeInTheDocument();
});

it.each(['tle-maths', 'tle-nsi'] as const)('renders the specific reflection questions for %s', level => {
  setup({}, {}, { level, preview: true });
  for (const section of getBilanSections(level)) {
    navigate(section.id);
    for (const question of section.questions) expect(screen.getByText(question.text, { exact: true })).toBeVisible();
  }
});

it('keeps the NSI no-aid and uncertain answers exclusive in both directions', () => {
  setup({}, {}, { level: 'tle-nsi', preview: true });
  navigate('methods');
  const question = getBilanSections('tle-nsi')[0].questions.find(q => q.id === 'tn-aides')!;
  const group = screen.getByRole('group', { name: question.text });
  const noAid = question.exclusiveOptions![0];
  fireEvent.click(within(group).getByLabelText('Mémo ou livret', {exact:true}));
  fireEvent.click(within(group).getByLabelText(noAid, {exact:true}));
  expect(within(group).getAllByRole('checkbox', {checked:true})).toHaveLength(1);
  expect(within(group).getByLabelText(noAid, {exact:true})).toBeChecked();
  fireEvent.click(within(group).getByLabelText('Indice du professeur', {exact:true}));
  expect(within(group).getByLabelText(noAid, {exact:true})).not.toBeChecked();
  fireEvent.click(within(group).getByLabelText('Je ne sais plus', {exact:true}));
  expect(within(group).getAllByRole('checkbox', {checked:true})).toHaveLength(1);
});


it('shows known group and start date as read-only context, with no identity input', () => {
  setup({}, {}, { context: { groupName: 'Groupe de troisième', startedAt: '2026-09-05' } } as Partial<BilanWorkbenchProps>);
  expect(screen.getByText(/Groupe de troisième/)).toBeVisible();
  expect(screen.getByText(/Bilan commencé le : 05\/09\/2026/)).toBeVisible();
  expect(screen.queryByText(/Début de l’accompagnement/)).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /groupe|début/i })).not.toBeInTheDocument();
});

it('preserves optional trial conditions and confidence when editing or skipping an existing answer', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } }, evidence: { fields: { '3-div': JSON.stringify({ answer: 'Trace initiale', retry: 'Reprise', aid: 'Un indice', skipped: false, confidence: 'Moyenne', conditions: 'Avec les outils autorisés par l’énoncé' }) } } }, { currentStep: 2 }, { preview: true });
  expect(screen.getByLabelText('Ma confiance après cet essai (facultatif)')).toHaveValue('Moyenne');
  expect(screen.getByLabelText('Conditions de mon essai (facultatif)')).toHaveValue('Avec les outils autorisés par l’énoncé');
  fireEvent.change(screen.getByLabelText('Mon premier essai et mon explication'), { target: { value: 'Trace complétée' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Je n’ai pas fait cet essai' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Je n’ai pas fait cet essai' }));
  expect(screen.getByLabelText('Ma confiance après cet essai (facultatif)')).toHaveValue('Moyenne');
  expect(screen.getByLabelText('Conditions de mon essai (facultatif)')).toHaveValue('Avec les outils autorisés par l’énoncé');
  expect(screen.getByLabelText('Mon premier essai et mon explication')).toHaveValue('Trace complétée');
});

it('clears review confirmation while preserving any other saved review fields', () => {
  setup({ review: { fields: { confirmed: 'yes', note: 'À conserver' } } });
  fireEvent.click(within(screen.getByRole('group', { name: bilanData.modules['3e'][0].label })).getByLabelText('Oui, travaillé en séance'));
  expect(edit).toHaveBeenCalledWith('review', { fields: { confirmed: '', note: 'À conserver' } }, expect.anything());
});

it('renders a scale as an accessible optional select and preserves its selected value', () => {
  jest.spyOn(bilanModule, 'getBilanSections').mockReturnValue([{ id: 'methods', title: 'Méthodes', intro: '', questions: [{ id: 'scale-test', text: 'Je vérifie ma démarche.', type: 'scale', options: ['Jamais', 'Souvent', 'Pas eu l’occasion'] }] }]);
  setup({}, { currentStep: 3 }, { preview: true });
  const select = screen.getByRole('combobox', { name: 'Je vérifie ma démarche.' });
  expect(select).toHaveValue('');
  expect(within(select).getByRole('option', { name: 'Je ne souhaite pas répondre' })).toBeInTheDocument();
  fireEvent.change(select, { target: { value: 'Souvent' } });
  expect(select).toHaveValue('Souvent');
});

it('limits the priority to selected aids and clears only an invalidated priority', () => {
  jest.spyOn(bilanModule, 'getBilanSections').mockReturnValue([{ id: 'methods', title: 'Méthodes', intro: '', questions: [
    { id: 'aids-test', text: 'Mes aides utiles', type: 'multi', options: ['Un indice', 'Un exemple'], max: 2 },
    { id: 'priority-test', text: 'Mon aide prioritaire', type: 'scale', options: ['Un indice', 'Un exemple'], priorityOf: 'aids-test' },
    { id: 'other-test', text: 'Une précision', type: 'text' },
  ] } as ReturnType<typeof getBilanSections>[number]]);
  setup({ methods: { fields: { 'aids-test': '["Un indice","Un exemple"]', 'priority-test': 'Un indice', 'other-test': 'À conserver' } } }, { currentStep: 3 }, { preview: true });
  const select = screen.getByRole('combobox', { name: 'Mon aide prioritaire' });
  expect(select).toHaveValue('Un indice');
  fireEvent.click(within(screen.getByRole('group', { name: 'Mes aides utiles' })).getByLabelText('Un indice'));
  expect(select).toHaveValue('');
  expect(within(select).queryByRole('option', { name: 'Un indice' })).not.toBeInTheDocument();
  expect(within(select).getByRole('option', { name: 'Un exemple' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /Une précision/ })).toHaveValue('À conserver');
});

it.each(['3e', '2nde'] as const)('keeps historical and additional mastery answers in their own %s steps', level => {
  const oldModule = bilanData.modules[level][0];
  const extraModule = bilanData.modules[level].find(module => module.skills.some(skill => getBilanSkillStep(level, skill.id) === 'mastery-extra'))!;
  const extraSkill = extraModule.skills.find(skill => getBilanSkillStep(level, skill.id) === 'mastery-extra')!;
  setup({ scope: { fields: { [oldModule.id]: 'yes', [extraModule.id]: 'yes' } }, mastery: { fields: { [oldModule.skills[0].id]: 'alone' } } }, {}, { level, preview: true });
  navigate('mastery-extra');
  const extraGroup = screen.getByRole('group', { name: extraSkill.text });
  fireEvent.click(within(extraGroup).getByRole('radio', { name: bilanData.mastery.help }));
  expect(within(extraGroup).getByRole('radio', { name: bilanData.mastery.help })).toBeChecked();
  expect(screen.queryByRole('group', { name: oldModule.skills[0].text })).not.toBeInTheDocument();
  navigate('mastery');
  expect(within(screen.getByRole('group', { name: oldModule.skills[0].text })).getByRole('radio', { name: bilanData.mastery.alone })).toBeChecked();
  navigate('mastery-extra');
  expect(within(screen.getByRole('group', { name: extraSkill.text })).getByRole('radio', { name: bilanData.mastery.help })).toBeChecked();
});

it.each(['3e', '2nde', 'tle-maths', 'tle-nsi'] as const)('has an actual response control in every applicable %s rubric', level => {
  setup({ scope: { fields: Object.fromEntries(bilanData.modules[level].map(module => [module.id, 'yes'])) } }, {}, { level, preview: true });
  for (const step of getBilanLesson(level).steps) {
    navigate(step.id);
    expect(screen.getByRole('heading', { name: step.title, level: 2 })).toBeVisible();
    const section = screen.getByRole('region', { name: step.title });
    expect(section.querySelectorAll('input, textarea, select').length).toBeGreaterThan(0);
  }
});

it('disables the additional mastery rubric when no corresponding topic was worked', () => {
  setup({ scope: { fields: { '3-powers': 'yes' } } }, {}, { preview: true });
  expect(screen.getByRole('option', { name: /Mes autres repères en mathématiques/ })).toBeDisabled();
  expect(screen.getByRole('option', { name: /Où j’en suis/ })).toBeEnabled();
});

it('removes an affected trial when its additional prerequisite is marked not worked', () => {
  const task = bilanData.tasks.find(candidate => candidate.module.startsWith('3-') && candidate.skills.some(skill => getBilanSkillStep('3e', skill) === 'mastery-extra'))!;
  const skillId = task.skills.find(skill => getBilanSkillStep('3e', skill) === 'mastery-extra')!;
  const skill = bilanData.modules['3e'].flatMap(module => module.skills).find(candidate => candidate.id === skillId)!;
  setup({ scope: { fields: Object.fromEntries(bilanData.modules['3e'].map(module => [module.id, 'yes'])) }, evidence: { fields: { [task.id]: '{"answer":"Ma trace"}' } } }, {}, { preview: true });
  navigate('mastery-extra');
  fireEvent.click(within(screen.getByRole('group', { name: skill.text })).getByRole('radio', { name: bilanData.mastery.notworked }));
  navigate('evidence');
  expect(screen.queryByRole('checkbox', { name: task.title })).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Ma trace')).not.toBeInTheDocument();
});

it('includes trial conditions, confidence and the initial answer together in the review', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } }, evidence: { fields: { '3-div': JSON.stringify({ answer: 'Trace vérifiable', confidence: 'Forte', conditions: 'Avec une aide ou une ressource' }) } } }, { currentStep: 7 }, { preview: true });
  fireEvent.click(screen.getByText('Mes essais', { selector: 'summary' }));
  expect(screen.getByText(/Premier essai : Trace vérifiable/)).toHaveTextContent('Confiance après l’essai : Forte');
  expect(screen.getByText(/Premier essai : Trace vérifiable/)).toHaveTextContent('Conditions déclarées : Avec une aide ou une ressource');
});

it('allows an optional confidence choice to be cleared without erasing the answer', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } }, evidence: { fields: { '3-div': '{"answer":"Trace conservée","confidence":"Forte"}' } } }, { currentStep: 2 });
  fireEvent.change(screen.getByLabelText('Ma confiance après cet essai (facultatif)'), { target: { value: '' } });
  const saved = edit.mock.calls.find(([step]) => step === 'evidence')![1];
  expect(JSON.parse(saved.fields['3-div'])).toMatchObject({ answer: 'Trace conservée' });
  expect(JSON.parse(saved.fields['3-div'])).not.toHaveProperty('confidence');
});

it.each(['3e', '2nde', 'tle-maths', 'tle-nsi'] as const)('keeps %s scales read-only after submission', level => {
  setup({}, { status: 'SUBMITTED' }, { level });
  navigate('habits');
  const step = getBilanLesson(level).steps.find(candidate => candidate.id === 'habits')!;
  const region = screen.getByRole('region', { name: step.title });
  const selects = within(region).getAllByRole('combobox');
  expect(selects.length).toBeGreaterThan(0);
  for (const select of selects) expect(select).toBeDisabled();
});


it('lets a student return to the trial reflection without replacing the initial attempt', () => {
  setup({ scope: { fields: { '3-arith': 'yes' } }, evidence: { fields: { '3-div': '{"answer":"Mon premier raisonnement"}' } } }, { currentStep: 2 }, { preview: true });
  fireEvent.click(screen.getByRole('button', { name: 'Revenir sur mes essais' }));
  expect(screen.getByRole('heading', { name: 'Avant et après mes essais' })).toBeVisible();
  expect(screen.getByText(/sans effacer ton premier ressenti/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Passer aux essais' }));
  expect(screen.getByLabelText('Mon premier essai et mon explication')).toHaveValue('Mon premier raisonnement');
});

it('keeps pedagogical hints visible for simple-choice questions as well as scales', () => {
  jest.spyOn(bilanModule, 'getBilanSections').mockReturnValue([{ id: 'methods', title: 'Méthodes', intro: '', questions: [{ id: 'hint-test', text: 'Une démarche à préciser', type: 'radio', options: ['Oui', 'Non'], hint: 'Pense à un exercice réellement travaillé.' }] }]);
  setup({}, { currentStep: 3 }, { preview: true });
  expect(screen.getByText('Pense à un exercice réellement travaillé.')).toBeVisible();
});

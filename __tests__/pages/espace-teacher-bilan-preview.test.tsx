import { fireEvent, render, screen, within } from '@testing-library/react';
import TeacherBilansPage from '@/app/espace/enseignant/bilans/page';
import { bilanData, type BilanLevel } from '@/lib/espace/bilan-data';
import { requireActorForPage } from '@/lib/espace/page-guard';

const mockEdit = jest.fn();
const mockSubmit = jest.fn();
jest.mock('@/lib/espace/page-guard', () => ({ requireActorForPage: jest.fn() }));
jest.mock('@/components/espace/shared/useWorkSync', () => ({
  useWorkSync: ({ initial }: { initial: { steps: unknown } }) => ({
    state: 'locked', steps: initial.steps, edit: mockEdit, submit: mockSubmit,
    conflict: null, lastSavedAt: null,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireActorForPage).mockResolvedValue({ id: 'synthetic-preview-teacher', role: 'COACH' } as never);
});

it.each<BilanLevel>(['3e', '2nde'])('shows all %s questions in the clearly identified teacher demonstration', async level => {
  render(await TeacherBilansPage({ searchParams: Promise.resolve({ niveau: level }) }));
  expect(screen.getByText(/Dans cet aperçu, tous les thèmes sont présélectionnés pour afficher les questions/)).toBeVisible();
  for (const theme of bilanData.modules[level]) {
    expect(within(screen.getByRole('group', { name: theme.label })).getByRole('radio', { name: 'Oui, travaillé en séance' })).toBeChecked();
  }
  fireEvent.change(screen.getByLabelText('Étape 1 sur 8'), { target: { value: '1' } });
  for (const theme of bilanData.modules[level]) for (const skill of theme.skills) {
    expect(screen.getByRole('group', { name: skill.text })).toBeVisible();
  }
  fireEvent.change(screen.getByLabelText('Étape 2 sur 8'), { target: { value: '2' } });
  expect(screen.getByRole('group', { name: /Les essais choisis/ })).toBeVisible();
  expect(mockEdit).not.toHaveBeenCalled();
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(requireActorForPage).toHaveBeenCalledWith(['COACH', 'ADMIN'], '/espace/enseignant/bilans');
});

it('keeps modified demonstrations local and rebuilds fresh, separate selections for each level', async () => {
  const originalBank = JSON.stringify(bilanData);
  const third = bilanData.modules['3e'][0];
  const first = render(await TeacherBilansPage({ searchParams: Promise.resolve({ niveau: '3e' }) }));
  fireEvent.click(within(screen.getByRole('group', { name: third.label })).getByRole('radio', { name: 'Non travaillé' }));
  expect(within(screen.getByRole('group', { name: third.label })).getByRole('radio', { name: 'Non travaillé' })).toBeChecked();
  first.unmount();
  const second = render(await TeacherBilansPage({ searchParams: Promise.resolve({ niveau: '2nde' }) }));
  expect(screen.queryByRole('group', { name: third.label })).not.toBeInTheDocument();
  for (const theme of bilanData.modules['2nde']) expect(within(screen.getByRole('group', { name: theme.label })).getByRole('radio', { name: 'Oui, travaillé en séance' })).toBeChecked();
  second.unmount();
  render(await TeacherBilansPage({ searchParams: Promise.resolve({ niveau: '3e' }) }));
  expect(within(screen.getByRole('group', { name: third.label })).getByRole('radio', { name: 'Oui, travaillé en séance' })).toBeChecked();
  expect(JSON.stringify(bilanData)).toBe(originalBank);
  expect(mockEdit).not.toHaveBeenCalled();
  expect(mockSubmit).not.toHaveBeenCalled();
});

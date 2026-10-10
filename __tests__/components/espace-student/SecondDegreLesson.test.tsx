/**
 * Parcours « Le second degré » rendu par le vrai poste de travail : toutes les étapes s'affichent
 * (formules rendues, aucun jeton résiduel) et CHAQUE champ vérifiable accepte sa bonne réponse
 * tapée comme le ferait un élève, et affiche une correction détaillée après une réponse fausse.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

const edit = jest.fn();
let syncMock: Record<string, unknown>;

jest.mock('@/components/espace/shared/useWorkSync', () => ({ useWorkSync: () => syncMock }));
jest.mock('@/lib/espace/client/python-runner', () => ({ PythonRunner: jest.fn().mockImplementation(() => ({ run: jest.fn(), terminate: jest.fn() })) }));

import { LessonWorkbench } from '@/components/espace/student/LessonWorkbench';
import content from '@/content/espace/maths-second-degre/content.json';
import type { LessonContent } from '@/lib/espace/lesson-types';

const lesson = content as unknown as LessonContent;

function mount(index: number, steps: Record<string, unknown> = {}) {
  const work = { id: 'w1', status: 'IN_PROGRESS' as const, revision: 1, currentStep: index, lastSavedAt: '2026-10-10T08:00:00Z', steps: steps as never };
  syncMock = { state: 'saved', steps: work.steps, edit, conflict: null, resolveConflict: jest.fn(), submit: jest.fn(), lastSavedAt: null };
  return render(<LessonWorkbench userId="u1" work={work} content={lesson} runnerSource={null} annotations={[]} />);
}

describe.each(lesson.steps.map((s, i) => [s.id, i] as const))('étape %s', (id, index) => {
  const step = lesson.steps[index]!;

  it('s’affiche entièrement : formules rendues, aucun jeton ni délimiteur brut', () => {
    const { container } = mount(index);
    const text = container.textContent ?? '';
    expect(text).not.toContain('\\(');
    expect(text).not.toContain('\\[');
    expect(text).not.toContain('{{');
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('input[type="text"], textarea').length).toBe(step.fields.length);
    expect(container.querySelectorAll('fieldset').length).toBe(step.questions.length);
  });

  const checked = step.fields.filter((f) => f.check);
  if (checked.length > 0) {
    it('chaque champ vérifiable accepte sa bonne réponse', () => {
      const fields = Object.fromEntries(checked.map((f) => [f.id, f.check!.accept[0]]));
      mount(index, { [id]: { fields } });
      const buttons = screen.getAllByRole('button', { name: 'Je vérifie' });
      expect(buttons).toHaveLength(checked.length);
      buttons.forEach((b) => fireEvent.click(b));
      const feedback = screen.getAllByTestId('check-feedback');
      expect(feedback).toHaveLength(checked.length);
      feedback.forEach((n) => expect(n).toHaveTextContent('Correct.'));
      expect(screen.queryByTestId('check-solution')).toBeNull();
    });

    it('une réponse fausse donne « Pas encore » et la correction détaillée de chaque champ', () => {
      const fields = Object.fromEntries(checked.map((f) => [f.id, 'zzz']));
      mount(index, { [id]: { fields } });
      screen.getAllByRole('button', { name: 'Je vérifie' }).forEach((b) => fireEvent.click(b));
      screen.getAllByTestId('check-feedback').forEach((n) => expect(n).toHaveTextContent('Pas encore.'));
      const solutions = screen.getAllByTestId('check-solution');
      expect(solutions).toHaveLength(checked.length);
      solutions.forEach((d, i) => {
        expect(d).not.toHaveAttribute('open');
        expect(within(d).getByText('Voir la correction détaillée')).toBeInTheDocument();
        expect((d.textContent ?? '').length).toBeGreaterThan(40);
        expect(d.textContent).not.toContain('\\(');
        expect(checked[i]).toBeDefined();
      });
    });
  }

  if (step.questions.length > 0) {
    it('chaque question à choix annonce la bonne réponse et explique les mauvaises', () => {
      const { unmount } = mount(index);
      unmount();
      for (const q of step.questions) {
        const choices = Object.fromEntries([[q.id, q.correct]]);
        const r = mount(index, { [id]: { choices } });
        const fb = screen.getAllByTestId('qcm-feedback');
        expect(fb[0]).toHaveTextContent('Bonne réponse.');
        r.unmount();
        const wrong = q.choices.findIndex((_, ci) => ci !== q.correct);
        const r2 = mount(index, { [id]: { choices: { [q.id]: wrong } } });
        expect(screen.getAllByTestId('qcm-feedback')[0]).toHaveTextContent('Pas tout à fait.');
        r2.unmount();
      }
    });
  }
});

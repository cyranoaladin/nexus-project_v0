import { getExamPolicyClient, requireExamPolicyClient } from '@/lib/exams/catalog-client';
import { validateOptionsSelection } from '@/lib/exams/options';
import { requireExamPolicy } from '@/lib/exams/catalog';

describe('T-client — sous-ensemble client-safe', () => {
  test('requireExamPolicyClient retourne la même policy que la version serveur pour 2027', () => {
    expect(requireExamPolicyClient(2027)).toEqual(requireExamPolicy(2027));
  });

  test('getExamPolicyClient retourne null pour une session inconnue (fail closed, comme côté serveur)', () => {
    expect(getExamPolicyClient(2099)).toBeNull();
  });

  test('validateOptionsSelection (lib/exams/options) ne dépend d\'aucun module server-only — utilisable tel quel côté client', () => {
    const result = validateOptionsSelection({ optionsTerminale: ['DGEMC'], specialitesTerminale: ['MATHEMATIQUES'] });
    expect(result.valide).toBe(true);
  });
});

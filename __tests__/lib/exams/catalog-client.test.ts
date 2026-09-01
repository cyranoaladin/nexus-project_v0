import {
  getExamPolicyClient,
  requireExamPolicyClient,
  getSupportedSessionsClient,
  getSessionStatusClient,
  getSellableSessionClient,
  getAutoCheckableEligibilityConditionsClient,
} from '@/lib/exams/catalog-client';
import { validateOptionsSelection } from '@/lib/exams/options';
import { requireExamPolicy, getSupportedSessions, getSessionStatus, checkSameSessionEligibility } from '@/lib/exams/catalog';

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

  test('getSupportedSessionsClient/getSessionStatusClient mirror the server versions exactly', () => {
    expect(getSupportedSessionsClient()).toEqual(getSupportedSessions());
    for (const session of getSupportedSessionsClient()) {
      expect(getSessionStatusClient(session)).toBe(getSessionStatus(session));
    }
  });

  test('getSellableSessionClient — mission P0-A dedupe: the single ACTIVE session, replacing every hardcoded SUPPORTED_SESSION = 2027', () => {
    expect(getSellableSessionClient()).toBe(2027);
  });

  test('getAutoCheckableEligibilityConditionsClient — same conditions checkSameSessionEligibility evaluates against, never re-derived', () => {
    const conditions = getAutoCheckableEligibilityConditionsClient(2027);
    expect(conditions.every((c) => c.autoCheckable)).toBe(true);
    expect(conditions.map((c) => c.id).sort()).toEqual(
      ['age20', 'enfant_charge', 'echec_anterieur', 'deja_titulaire_bac', 'diplome_etranger_comparable'].sort(),
    );

    // Confirming every id, individually, actually reaches ELIGIBLE via the
    // real evaluator — not just a coincidentally-matching id list.
    const policy = requireExamPolicyClient(2027);
    for (const condition of conditions) {
      const result = checkSameSessionEligibility(policy, { [condition.id]: true });
      expect(result.outcome).toBe('ELIGIBLE');
    }
  });
});

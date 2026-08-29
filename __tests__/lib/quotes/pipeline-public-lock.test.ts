import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { validateCrossInvariants } from '@/lib/config/schemas';
import {
  isActiveForInternalStaff,
  isActiveForPublic,
  isShadowModeEnabled,
  type PipelineState,
} from '@/lib/quotes/pipeline-flag';

const FORBIDDEN_PUBLIC_STATES = ['ACTIVE_PUBLIC', 'ACTIVE_PUBLIC_PERCENTAGE'] as const satisfies readonly PipelineState[];

afterEach(() => {
  _resetForTest();
});

describe.each(FORBIDDEN_PUBLIC_STATES)('V1 public pipeline lock — %s', (state) => {
  test('the governed configuration path rejects the public state', () => {
    const violations = validateCrossInvariants('pricing.candidatIndividuelPipeline', 'state', state);

    expect(violations).toEqual(expect.arrayContaining([expect.stringContaining('public activation is NO-GO')]));
  });

  test('a forbidden persisted value fails closed and cannot enable any runtime surface', () => {
    _setForTest([
      {
        namespace: 'pricing.candidatIndividuelPipeline',
        key: 'state',
        value: state,
        schemaVersion: '1.0',
        version: 1,
        updatedBy: 'test',
        updatedAt: new Date(),
      },
    ]);

    expect(isActiveForPublic()).toBe(false);
    expect(isActiveForInternalStaff()).toBe(false);
    expect(isShadowModeEnabled()).toBe(false);
  });
});

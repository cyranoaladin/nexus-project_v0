import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { SCHEMA_VERSION } from '@/lib/config/schemas';
import {
  getPipelinePublicPercentage,
  getPipelineState,
  isActiveForInternalStaff,
  isActiveForPublic,
  isShadowModeEnabled,
  type PipelineState,
} from '@/lib/quotes/pipeline-flag';

const NAMESPACE = 'pricing.candidatIndividuelPipeline';

function setState(state: PipelineState, publicPercentage = 0) {
  _setForTest([
    {
      namespace: NAMESPACE,
      key: 'state',
      value: state,
      schemaVersion: SCHEMA_VERSION,
      version: 1,
      updatedBy: 'test',
      updatedAt: new Date(),
    },
    {
      namespace: NAMESPACE,
      key: 'publicPercentage',
      value: publicPercentage,
      schemaVersion: SCHEMA_VERSION,
      version: 1,
      updatedBy: 'test',
      updatedAt: new Date(),
    },
  ]);
}

describe('pipeline-flag — fail-closed default (recâblage mission §2)', () => {
  afterEach(() => _resetForTest());

  test('defaults to OFF when no BusinessConfig override is loaded (no instrumentation snapshot in unit tests)', () => {
    expect(getPipelineState()).toBe('OFF');
  });

  test('defaults to 0% public rollout', () => {
    expect(getPipelinePublicPercentage()).toBe(0);
  });

  test('OFF: no shadow, no internal, no public', () => {
    setState('OFF');
    expect(isShadowModeEnabled()).toBe(false);
    expect(isActiveForInternalStaff()).toBe(false);
    expect(isActiveForPublic()).toBe(false);
  });

  test('SHADOW: runs in parallel, but never internal, never public', () => {
    setState('SHADOW');
    expect(isShadowModeEnabled()).toBe(true);
    expect(isActiveForInternalStaff()).toBe(false);
    expect(isActiveForPublic()).toBe(false);
  });

  test('ACTIVE_INTERNAL: staff can use it, still not public', () => {
    setState('ACTIVE_INTERNAL');
    expect(isShadowModeEnabled()).toBe(true);
    expect(isActiveForInternalStaff()).toBe(true);
    expect(isActiveForPublic()).toBe(false);
  });

  test('ACTIVE_PUBLIC_PERCENTAGE: public gate opens, percentage is readable', () => {
    setState('ACTIVE_PUBLIC_PERCENTAGE', 25);
    expect(isActiveForPublic()).toBe(true);
    expect(getPipelinePublicPercentage()).toBe(25);
  });

  test('ACTIVE_PUBLIC: fully public', () => {
    setState('ACTIVE_PUBLIC', 100);
    expect(isActiveForPublic()).toBe(true);
    expect(getPipelinePublicPercentage()).toBe(100);
  });
});

import { AriaError } from '@/lib/aria/kernel/errors';
import { resolveInteractiveParentActor } from '@/lib/aria/kernel/parent-subject';

describe('resolveInteractiveParentActor', () => {
  it('resolves a real PARENT principal', () => {
    const actor = resolveInteractiveParentActor({ userId: 'user-1', role: 'PARENT' });
    expect(actor).toEqual({ userId: 'user-1', role: 'PARENT', principalKind: 'INTERACTIVE' });
  });

  it('rejects a non-PARENT role', () => {
    expect(() => resolveInteractiveParentActor({ userId: 'user-1', role: 'ELEVE' })).toThrow(AriaError);
  });

  it('rejects a missing userId', () => {
    expect(() => resolveInteractiveParentActor({ userId: '', role: 'PARENT' })).toThrow(AriaError);
  });
});

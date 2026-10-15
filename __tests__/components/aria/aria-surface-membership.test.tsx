import { renderHook } from '@testing-library/react';
jest.mock('@/hooks/use-core-membership', () => ({ useCoreMembership: jest.fn() }));
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({ useCanonicalSession: () => ({ status: 'authenticated', data: { user: { id: 'student-v1', role: 'ELEVE', authority: 'V1' } } }) }));
let search = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => search }));
import { useCoreMembership } from '@/hooks/use-core-membership';
import { useAriaSurface } from '@/hooks/use-aria-surface';
beforeEach(() => { search = new URLSearchParams(); });
test('active Core ELEVE selects the Core API while credential authority is V1', () => {
  jest.mocked(useCoreMembership).mockReturnValue({ state: 'ACTIVE', role: 'ELEVE', retry: jest.fn() });
  expect(renderHook(useAriaSurface).result.current.surface).toBe('CORE_V2');
});
test.each(['INACTIVE', 'UNAVAILABLE', 'LOADING', 'UNAUTHENTICATED'] as const)('%s blocks all ARIA resource calls rather than falling through to V1', state => {
  jest.mocked(useCoreMembership).mockReturnValue({ state, retry: jest.fn() });
  expect(renderHook(useAriaSurface).result.current.surface).toBeNull();
});
test.each(['NOT_MEMBER', 'NOT_ENABLED'] as const)('%s uses the independently available V1 surface', state => {
  jest.mocked(useCoreMembership).mockReturnValue({ state, retry: jest.fn() });
  expect(renderHook(useAriaSurface).result.current.surface).toBe('V1');
});
test('the explicit V1 choice remains independent of a Core outage', () => {
  search = new URLSearchParams('surface=v1');
  jest.mocked(useCoreMembership).mockReturnValue({ state: 'UNAVAILABLE', retry: jest.fn() });
  expect(renderHook(useAriaSurface).result.current.surface).toBe('V1');
});
test('another active Core role receives no student resource surface', () => {
  jest.mocked(useCoreMembership).mockReturnValue({ state: 'ACTIVE', role: 'ADMIN', retry: jest.fn() });
  expect(renderHook(useAriaSurface).result.current.surface).toBeNull();
});

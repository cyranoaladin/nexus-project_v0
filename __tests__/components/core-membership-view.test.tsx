import { act, renderHook, waitFor } from '@testing-library/react';
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({ useCanonicalSession: jest.fn(), useProtectedFetch: jest.fn() }));
import { useCanonicalSession, useProtectedFetch } from '@/components/auth/SessionRecoveryProvider';
import { useCoreMembership } from '@/hooks/use-core-membership';

const fetchMock = jest.fn();
const sessionMock = jest.mocked(useCanonicalSession);
function identity(id: string | null, role = 'COACH') {
  sessionMock.mockReturnValue({ status: id ? 'authenticated' : 'unauthenticated', data: id ? { user: { id, role, authority: 'V1' }, expires: '2099-01-01' } : null } as ReturnType<typeof useCanonicalSession>);
}
const dto = (data: unknown, ok = true) => ({ ok, json: async () => ({ ok, data }) });
beforeEach(() => { jest.clearAllMocks(); identity('first'); jest.mocked(useProtectedFetch).mockReturnValue(fetchMock); });
test('Core promotion affects presentation without altering the V1 session role', async () => {
  fetchMock.mockResolvedValue(dto({ state: 'ACTIVE', role: 'ADMIN' }));
  const { result } = renderHook(useCoreMembership);
  expect(result.current.state).toBe('LOADING');
  await waitFor(() => expect(result.current).toMatchObject({ state: 'ACTIVE', role: 'ADMIN' }));
  expect(sessionMock().data?.user.role).toBe('COACH');
});
test.each([{ state: 'ACTIVE', role: 'ADMIN', email: 'private@example.test' }, { state: 'ACTIVE', role: 'invalid' }, { state: 'INACTIVE', role: 'COACH' }, { state: 'UNKNOWN' }, null])('malformed successful metadata fails closed: %j', async data => {
  fetchMock.mockResolvedValue(dto(data));
  const { result } = renderHook(useCoreMembership);
  await waitFor(() => expect(result.current.state).toBe('UNAVAILABLE'));
});
test.each(['INACTIVE', 'NOT_MEMBER', 'NOT_ENABLED'])('preserves explicit metadata state %s without treating it as authentication loss', async state => {
  fetchMock.mockResolvedValue(dto({ state }));
  const { result } = renderHook(useCoreMembership);
  await waitFor(() => expect(result.current.state).toBe(state));
  expect(sessionMock().status).toBe('authenticated');
});
test('a configured Core outage never becomes NOT_MEMBER and can be retried explicitly', async () => {
  fetchMock.mockResolvedValueOnce(dto(null, false)).mockResolvedValueOnce(dto({ state: 'ACTIVE', role: 'COACH' }));
  const { result } = renderHook(useCoreMembership);
  await waitFor(() => expect(result.current.state).toBe('UNAVAILABLE'));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.state).toBe('ACTIVE'));
});
test('a delayed response from another identity cannot change the new identity or survive logout', async () => {
  let complete!: (value: unknown) => void;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; })).mockResolvedValue(dto({ state: 'NOT_MEMBER' }));
  const { result, rerender } = renderHook(useCoreMembership);
  identity('second'); rerender();
  expect(result.current.state).toBe('LOADING');
  await waitFor(() => expect(result.current.state).toBe('NOT_MEMBER'));
  await act(async () => complete(dto({ state: 'ACTIVE', role: 'ADMIN' })));
  expect(result.current.state).toBe('NOT_MEMBER');
  identity(null); rerender();
  expect(result.current.state).toBe('UNAUTHENTICATED');
});
test('refresh revokes the Core presentation when membership is lost without changing the V1 identity', async () => {
  fetchMock.mockResolvedValueOnce(dto({ state: 'ACTIVE', role: 'COACH' })).mockResolvedValueOnce(dto({ state: 'INACTIVE' }));
  const { result } = renderHook(useCoreMembership);
  await waitFor(() => expect(result.current.state).toBe('ACTIVE'));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.state).toBe('INACTIVE'));
  expect(sessionMock().data?.user.id).toBe('first');
});

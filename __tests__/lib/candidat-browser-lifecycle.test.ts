import { hardReloadWithoutCache } from '@/e2e/helpers/candidat-browser-lifecycle';

function createHarness(reloadError?: Error) {
  const send = jest.fn().mockResolvedValue(undefined);
  const detach = jest.fn().mockResolvedValue(undefined);
  const reload = reloadError
    ? jest.fn().mockRejectedValue(reloadError)
    : jest.fn().mockResolvedValue(null);
  const newCDPSession = jest.fn().mockResolvedValue({ send, detach });
  const page = {
    context: () => ({ newCDPSession }),
    reload,
  };
  return { detach, newCDPSession, page, reload, send };
}

describe('hardReloadWithoutCache', () => {
  it('désactive réellement le cache CDP autour du reload puis le réactive', async () => {
    const harness = createHarness();

    await hardReloadWithoutCache(harness.page as never);

    expect(harness.newCDPSession).toHaveBeenCalledWith(harness.page);
    expect(harness.send.mock.calls).toEqual([
      ['Network.enable'],
      ['Network.setCacheDisabled', { cacheDisabled: true }],
      ['Network.setCacheDisabled', { cacheDisabled: false }],
    ]);
    expect(harness.reload).toHaveBeenCalledWith({ waitUntil: 'domcontentloaded' });
    expect(harness.send.mock.invocationCallOrder[1]).toBeLessThan(harness.reload.mock.invocationCallOrder[0]);
    expect(harness.reload.mock.invocationCallOrder[0]).toBeLessThan(harness.send.mock.invocationCallOrder[2]);
    expect(harness.detach).toHaveBeenCalledTimes(1);
  });

  it('réactive le cache et détache CDP même lorsque le reload échoue', async () => {
    const reloadError = new Error('reload failed');
    const harness = createHarness(reloadError);

    await expect(hardReloadWithoutCache(harness.page as never)).rejects.toBe(reloadError);

    expect(harness.send).toHaveBeenLastCalledWith('Network.setCacheDisabled', { cacheDisabled: false });
    expect(harness.detach).toHaveBeenCalledTimes(1);
  });
});

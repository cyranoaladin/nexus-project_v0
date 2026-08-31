import { hardReloadWithoutCache } from '@/e2e/helpers/candidat-browser-lifecycle';

function createHarness(options: {
  reloadError?: Error;
  resetError?: Error;
  detachError?: Error;
} = {}) {
  const send = jest.fn().mockImplementation(
    (_method: string, parameters?: { cacheDisabled?: boolean }) =>
      parameters?.cacheDisabled === false && options.resetError
        ? Promise.reject(options.resetError)
        : Promise.resolve(undefined),
  );
  const detach = options.detachError
    ? jest.fn().mockRejectedValue(options.detachError)
    : jest.fn().mockResolvedValue(undefined);
  const reload = options.reloadError
    ? jest.fn().mockRejectedValue(options.reloadError)
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
    const harness = createHarness({ reloadError });

    await expect(hardReloadWithoutCache(harness.page as never)).rejects.toBe(reloadError);

    expect(harness.send).toHaveBeenLastCalledWith('Network.setCacheDisabled', { cacheDisabled: false });
    expect(harness.detach).toHaveBeenCalledTimes(1);
  });

  it('préserve l’échec primaire du reload et agrège les deux échecs de nettoyage', async () => {
    const reloadError = new Error('reload failed');
    const resetError = new Error('cache reset failed');
    const detachError = new Error('detach failed');
    const harness = createHarness({ reloadError, resetError, detachError });

    const failure = await hardReloadWithoutCache(harness.page as never).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([reloadError, resetError, detachError]);
    expect((failure as Error & { cause?: unknown }).cause).toBe(reloadError);
  });

  it('remonte les échecs de nettoyage seuls sans les perdre', async () => {
    const resetError = new Error('cache reset failed');
    const detachError = new Error('detach failed');
    const harness = createHarness({ resetError, detachError });

    const failure = await hardReloadWithoutCache(harness.page as never).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([resetError, detachError]);
    expect(harness.reload).toHaveBeenCalledTimes(1);
  });
});

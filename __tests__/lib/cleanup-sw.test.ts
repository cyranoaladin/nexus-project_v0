describe('cleanup-sw', () => {
  const originalServiceWorker = window.navigator.serviceWorker;

  afterEach(() => {
    jest.resetModules();
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
    });
  });

  it('unregisters service workers that are not Next.js', async () => {
    const unregisterNext = jest.fn().mockResolvedValue(true);
    const unregisterOther = jest.fn().mockResolvedValue(true);
    const getRegistrations = jest.fn().mockResolvedValue([
      { scope: '/_next/', unregister: unregisterNext },
      { scope: '/legacy-sw', unregister: unregisterOther },
    ]);

    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { getRegistrations },
      configurable: true,
    });

    jest.isolateModules(() => {
      require('@/lib/cleanup-sw');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getRegistrations).toHaveBeenCalled();
    expect(unregisterNext).not.toHaveBeenCalled();
    expect(unregisterOther).toHaveBeenCalled();
  });
});

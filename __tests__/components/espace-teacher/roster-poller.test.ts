import { RosterPoller } from '@/components/espace/teacher/roster-poller';

function setup(opts: { visible?: boolean; refresh?: jest.Mock } = {}) {
  let visible = opts.visible ?? true;
  const refresh = opts.refresh ?? jest.fn().mockResolvedValue(undefined);
  const poller = new RosterPoller({ refresh, isVisible: () => visible, intervalMs: 15_000, minIntervalMs: 10_000, maxBackoffMs: 120_000 });
  return { poller, refresh, setVisible: (v: boolean) => { visible = v; poller.onVisibilityChange(); } };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('RosterPoller', () => {
  it('interroge toutes les 15 s, pas plus vite', async () => {
    const { poller, refresh } = setup();
    poller.start();
    await jest.advanceTimersByTimeAsync(14_999);
    expect(refresh).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('ne descend jamais sous l’intervalle minimal même si on demande plus court', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    const poller = new RosterPoller({ refresh, isVisible: () => true, intervalMs: 1000, minIntervalMs: 10_000 });
    poller.start();
    await jest.advanceTimersByTimeAsync(9_999);
    expect(refresh).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('se met en pause quand l’onglet est masqué et ne fait aucune requête', async () => {
    const { poller, refresh, setVisible } = setup();
    poller.start();
    await jest.advanceTimersByTimeAsync(5_000);
    setVisible(false);
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
    poller.stop();
  });

  it('reprend au retour : tout de suite si les données sont périmées', async () => {
    const { poller, refresh, setVisible } = setup();
    poller.start();
    setVisible(false);
    await jest.advanceTimersByTimeAsync(60_000);
    setVisible(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('au retour rapide d’un onglet, attend le reliquat plutôt que de marteler le serveur', async () => {
    const { poller, refresh, setVisible } = setup();
    poller.start();
    await jest.advanceTimersByTimeAsync(15_000); // 1 requête
    expect(refresh).toHaveBeenCalledTimes(1);
    setVisible(false);
    await jest.advanceTimersByTimeAsync(2_000);
    setVisible(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1); // trop tôt
    await jest.advanceTimersByTimeAsync(13_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('recule exponentiellement après des erreurs, plafonné, puis revient à la normale', async () => {
    const refresh = jest.fn().mockRejectedValue(new Error('réseau'));
    const { poller } = setup({ refresh });
    poller.start();
    await jest.advanceTimersByTimeAsync(15_000); // échec 1 → prochain dans 30 s
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(29_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2); // échec 2 → 60 s
    await jest.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(3); // échec 3 → 120 s (plafond)
    await jest.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledTimes(4); // échec 4 → toujours 120 s
    await jest.advanceTimersByTimeAsync(119_999);
    expect(refresh).toHaveBeenCalledTimes(4);
    refresh.mockResolvedValue(undefined);
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(5);
    await jest.advanceTimersByTimeAsync(15_000); // succès → retour à 15 s
    expect(refresh).toHaveBeenCalledTimes(6);
    poller.stop();
  });

  it('une actualisation manuelle n’est jamais lancée en double', async () => {
    let release!: () => void;
    const refresh = jest.fn(() => new Promise<void>((r) => (release = r)));
    const { poller } = setup({ refresh });
    poller.start();
    const a = poller.refreshNow();
    const b = poller.refreshNow();
    expect(refresh).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([a, b]);
    poller.stop();
  });

  it('stop() annule tout', async () => {
    const { poller, refresh } = setup();
    poller.start();
    poller.stop();
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('une réponse qui arrive pendant que l’onglet est masqué ne reprogramme rien', async () => {
    let release!: () => void;
    const refresh = jest.fn(() => new Promise<void>((r) => (release = r)));
    const { poller, setVisible } = setup({ refresh });
    poller.start();
    await jest.advanceTimersByTimeAsync(15_000);
    setVisible(false);
    release();
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    poller.stop();
  });
});

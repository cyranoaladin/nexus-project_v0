/**
 * P2 §9 — reset automatique après inactivité. Vérifie le minuteur avec de
 * faux timers : ne se déclenche jamais trop tôt, se réinitialise à chaque
 * activité, et ne fuit aucun listener au démontage.
 */
import { renderHook } from '@testing-library/react';
import { UTICA_DEMO_IDLE_RESET_MS, useIdleReset } from '@/lib/demo/utica-2026/useIdleReset';

describe('UTICA_DEMO_IDLE_RESET_MS', () => {
  test('vaut environ 5 minutes, comme une constante explicite (jamais 300000 dispersé)', () => {
    expect(UTICA_DEMO_IDLE_RESET_MS).toBe(5 * 60_000);
  });
});

describe('useIdleReset', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("ne se déclenche jamais avant l'expiration du délai", () => {
    const onIdle = jest.fn();
    renderHook(() => useIdleReset(onIdle, UTICA_DEMO_IDLE_RESET_MS));

    jest.advanceTimersByTime(UTICA_DEMO_IDLE_RESET_MS - 1000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  test("se déclenche exactement à l'expiration du délai en l'absence d'activité", () => {
    const onIdle = jest.fn();
    renderHook(() => useIdleReset(onIdle, UTICA_DEMO_IDLE_RESET_MS));

    jest.advanceTimersByTime(UTICA_DEMO_IDLE_RESET_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test('une activité (mousemove) réinitialise le minuteur — pas de déclenchement pendant une présentation active', () => {
    const onIdle = jest.fn();
    renderHook(() => useIdleReset(onIdle, UTICA_DEMO_IDLE_RESET_MS));

    // Juste avant expiration, une activité survient.
    jest.advanceTimersByTime(UTICA_DEMO_IDLE_RESET_MS - 1000);
    window.dispatchEvent(new Event('mousemove'));

    // Le délai complet ne s'est pas encore écoulé depuis la réinitialisation.
    jest.advanceTimersByTime(UTICA_DEMO_IDLE_RESET_MS - 1000);
    expect(onIdle).not.toHaveBeenCalled();

    // Le délai complet depuis la dernière activité s'écoule maintenant.
    jest.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test.each(['pointerdown', 'keydown', 'touchstart'])('l\'événement %s réinitialise aussi le minuteur', (eventName) => {
    const onIdle = jest.fn();
    renderHook(() => useIdleReset(onIdle, UTICA_DEMO_IDLE_RESET_MS));

    jest.advanceTimersByTime(UTICA_DEMO_IDLE_RESET_MS - 1000);
    window.dispatchEvent(new Event(eventName));
    jest.advanceTimersByTime(1000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  test('ne fuit aucun listener : démonter retire exactement les écouteurs ajoutés', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    addSpy.mockClear();
    removeSpy.mockClear();

    const { unmount } = renderHook(() => useIdleReset(jest.fn(), UTICA_DEMO_IDLE_RESET_MS));
    const addedEvents = addSpy.mock.calls.map((call) => call[0]).sort();

    unmount();
    const removedEvents = removeSpy.mock.calls.map((call) => call[0]).sort();

    expect(addedEvents).toEqual(['keydown', 'mousemove', 'pointerdown', 'touchstart']);
    expect(removedEvents).toEqual(addedEvents);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

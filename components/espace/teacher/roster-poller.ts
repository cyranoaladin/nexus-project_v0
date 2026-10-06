/**
 * Rafraîchissement du suivi en séance : logique pure, testable.
 *
 *  - un seul onglet visible interroge ; onglet masqué = aucune requête ;
 *  - cadence nominale 15 s, jamais sous 10 s ;
 *  - après une erreur : recul exponentiel plafonné, retour à la normale au premier succès ;
 *  - jamais deux requêtes en parallèle (l'actualisation manuelle partage la requête en vol).
 */
export interface RosterPollerOptions {
  refresh: () => Promise<void>;
  isVisible: () => boolean;
  intervalMs?: number;
  minIntervalMs?: number;
  maxBackoffMs?: number;
}

export class RosterPoller {
  private readonly interval: number;
  private readonly maxBackoff: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private lastAttempt = 0;
  private inFlight: Promise<void> | null = null;
  private running = false;

  constructor(private readonly options: RosterPollerOptions) {
    const min = options.minIntervalMs ?? 10_000;
    this.interval = Math.max(options.intervalMs ?? 15_000, min);
    this.maxBackoff = Math.max(options.maxBackoffMs ?? 120_000, this.interval);
  }

  /** Les données initiales viennent du serveur : elles comptent comme une requête à l'instant du démarrage. */
  start(): void {
    this.running = true;
    this.lastAttempt = Date.now();
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.clear();
  }

  onVisibilityChange(): void {
    if (!this.running) return;
    this.clear();
    if (this.options.isVisible()) this.schedule();
  }

  /** Actualisation à la demande : partage la requête en vol, repart ensuite sur la cadence normale. */
  refreshNow(): Promise<void> {
    this.clear();
    return this.run();
  }

  private currentDelay(): number {
    return Math.min(this.interval * 2 ** this.failures, this.maxBackoff);
  }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.clear();
    if (!this.running || !this.options.isVisible()) return;
    const wait = Math.max(0, this.lastAttempt + this.currentDelay() - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, wait);
  }

  private run(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.lastAttempt = Date.now();
    this.inFlight = (async () => {
      try {
        await this.options.refresh();
        this.failures = 0;
      } catch {
        this.failures += 1;
      } finally {
        this.inFlight = null;
        this.lastAttempt = Date.now();
        this.schedule();
      }
    })();
    return this.inFlight;
  }
}

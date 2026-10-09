/**
 * Moteur de synchronisation de l'autosave (logique pure, sans React ni DOM).
 *
 * Garanties :
 *  - le statut « enregistré » n'est émis qu'après un accusé OK du serveur ;
 *  - toute modification est persistée localement AVANT d'être envoyée
 *    (reprise après rafraîchissement, coupure réseau, onglet fermé) ;
 *  - une écriture obsolète ne remplace jamais silencieusement une version plus
 *    récente de la MÊME étape : conflit explicite, choix de l'élève ;
 *  - une modification d'une AUTRE étape par un autre onglet est fusionnée sans
 *    intervention (les étapes sont indépendantes) ;
 *  - une réponse perdue après écriture serveur n'est ni un conflit ni un doublon ;
 *  - travail remis ailleurs : on s'arrête, sans réessayer, sans rien perdre.
 */
export type Step = Record<string, unknown>;
export type Steps = Record<string, Step>;

export type SaveState = 'saved' | 'saving' | 'syncing' | 'offline' | 'error' | 'conflict' | 'locked';

export type SaveResponse =
  | { kind: 'ok'; revision: number; replayed?: boolean; steps?: Steps }
  | { kind: 'conflict'; current: { revision: number; steps: Steps } }
  | { kind: 'locked' }
  | { kind: 'rejected'; message: string; code?: string };

export interface SaveInput {
  baseRevision: number;
  stepId: string;
  step: Step;
  currentStep?: number;
  snapshot?: 'STEP_CHANGE' | 'RUN';
}

export interface SaveApi {
  save(input: SaveInput): Promise<SaveResponse>;
  submit(input: { baseRevision: number }): Promise<{ kind: 'ok'; revision: number } | { kind: 'conflict' | 'locked' | 'rejected'; message?: string; current?: { revision: number; steps: Steps } }>;
}

export interface DraftRecord {
  baseRevision: number;
  /** Ce que cet appareil croit être la version serveur de chaque étape. */
  lastAcked: Steps;
  pending: Steps;
  /** Base propre à chaque édition : une fusion d’une autre rubrique ne vaut pas consentement d’écrasement. */
  pendingBase?: Steps;
  currentStep?: number;
  snapshots?: Record<string, 'STEP_CHANGE' | 'RUN'>;
}

export interface DraftStore {
  load(key: string): Promise<DraftRecord | null>;
  save(key: string, record: DraftRecord): Promise<void>;
  clear(key: string): Promise<void>;
}

export interface ConflictInfo {
  stepId: string;
  mine: Step;
  theirs: Step;
  currentRevision: number;
  currentSteps: Steps;
}

export interface SyncOptions {
  /** Clé de brouillon : inclut l'utilisateur pour ne pas mêler deux élèves sur un même appareil. */
  key: string;
  api: SaveApi;
  store: DraftStore;
  initial: { revision: number; steps: Steps };
  onState?: (state: SaveState) => void;
  onSteps?: (steps: Steps) => void;
  debounceMs?: number;
  backoffMs?: number[];
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
/** JSONB peut réordonner les clés d’objet ; l’ordre des tableaux reste significatif. */
const same = (a: unknown, b: unknown): boolean => {
  if (a === b || (a == null && b == null)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => same(value, b[index]));
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
};

export class WorkSyncEngine {
  private baseRevision: number;
  private lastAcked: Steps;
  private pending: Steps = {};
  private pendingBase: Steps = {};
  private snapshots: Record<string, 'STEP_CHANGE' | 'RUN'> = {};
  private currentStep: number | undefined;
  private state: SaveState = 'saved';
  private conflict: ConflictInfo | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private flushing = false;
  private flushWaiters: (() => void)[] = [];
  private initTask: Promise<void> | null = null;
  private again = false;
  private disposed = false;
  private readonly debounceMs: number;
  private readonly backoffMs: number[];

  constructor(private readonly options: SyncOptions) {
    this.baseRevision = options.initial.revision;
    this.lastAcked = clone(options.initial.steps);
    this.debounceMs = options.debounceMs ?? 1000;
    this.backoffMs = options.backoffMs ?? [1000, 2000, 5000, 10_000, 30_000];
  }

  // ─── API publique ─────────────────────────────────────────────────────────

  /** À appeler une fois, avec le travail tel que renvoyé par le serveur au chargement. */
  init(): Promise<void> {
    return this.initTask ??= this.restoreDraft();
  }

  private async restoreDraft(): Promise<void> {
    const record = await this.options.store.load(this.options.key);
    if (this.disposed) return;
    if (!record || Object.keys(record.pending).length === 0) {
      if (record && !this.hasPending()) await this.options.store.clear(this.options.key);
      return;
    }
    const serverNow = this.options.initial.steps;
    for (const [stepId, mine] of Object.entries(record.pending)) {
      if (Object.hasOwn(this.pending, stepId)) continue; // la frappe récente prime sur le brouillon chargé tardivement
      if (same(serverNow[stepId], mine)) continue; // déjà côté serveur
      const knew = (record.pendingBase ?? record.lastAcked)[stepId];
      this.pendingBase[stepId] = clone(knew);
      if (!same(serverNow[stepId], knew) && !this.conflict) {
        // L'étape a changé côté serveur depuis ce que cet appareil savait : jamais d'écrasement silencieux.
        this.conflict = {
          stepId,
          mine: clone(mine),
          theirs: clone(serverNow[stepId] ?? {}),
          currentRevision: this.options.initial.revision,
          currentSteps: clone(serverNow),
        };
        this.pending[stepId] = clone(mine);
        continue;
      }
      this.pending[stepId] = clone(mine);
    }
    this.currentStep ??= record.currentStep;
    this.snapshots = { ...record.snapshots, ...this.snapshots };
    this.options.onSteps?.(this.getSteps());
    await this.persist();
    if (this.conflict) {
      this.emit('conflict');
      return;
    }
    if (Object.keys(this.pending).length > 0) {
      this.emit('syncing');
      this.schedule(this.debounceMs);
    }
  }

  edit(stepId: string, step: Step, meta: { currentStep?: number; snapshot?: 'STEP_CHANGE' | 'RUN' } = {}): void {
    if (this.disposed || this.state === 'locked') return;
    if (!Object.hasOwn(this.pending, stepId)) this.pendingBase[stepId] = clone(this.lastAcked[stepId]);
    this.pending[stepId] = clone(step);
    if (meta.currentStep !== undefined) this.currentStep = meta.currentStep;
    if (meta.snapshot) this.snapshots[stepId] = meta.snapshot;
    void this.persist();
    if (this.conflict) return; // en attente d'un choix : on garde mais on n'envoie pas
    this.emit('saving');
    this.schedule(this.debounceMs);
  }

  /** Vue courante : version connue du serveur + modifications locales en attente. */
  getSteps(): Steps {
    return { ...clone(this.lastAcked), ...clone(this.pending) };
  }

  getState(): SaveState {
    return this.state;
  }

  getBaseRevision(): number {
    return this.baseRevision;
  }

  getConflict(): ConflictInfo | null {
    return this.conflict ? clone(this.conflict) : null;
  }

  hasPending(): boolean {
    return Object.keys(this.pending).length > 0;
  }

  /** Le navigateur signale le retour du réseau : on n'attend pas le prochain essai. */
  notifyOnline(): void {
    if (this.disposed || this.state === 'locked' || this.conflict) return;
    this.clearTimers();
    this.attempt = 0;
    void this.flush();
  }

  /** Envoie sans attendre le debounce (onglet masqué, avant de quitter la page). */
  flushNow(): void {
    if (this.disposed || this.conflict || this.state === 'locked' || !this.hasPending()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.flush();
  }

  async resolveConflict(choice: 'keep-mine' | 'take-theirs'): Promise<void> {
    const c = this.conflict;
    if (!c) return;
    this.conflict = null;
    this.baseRevision = c.currentRevision;
    this.lastAcked = clone(c.currentSteps);
    if (choice === 'take-theirs') {
      delete this.pending[c.stepId];
      delete this.pendingBase[c.stepId];
      delete this.snapshots[c.stepId];
    } else this.pendingBase[c.stepId] = clone(c.theirs);
    this.options.onSteps?.(this.getSteps());
    await this.persist();
    if (this.hasPending()) {
      this.emit('syncing');
      await this.flush();
    } else {
      this.emit('saved');
    }
  }

  /** Vide tout ce qui est en attente, puis remet. Échoue sans remettre si quelque chose bloque. */
  async submit(): Promise<{ kind: 'ok'; revision: number } | { kind: 'blocked'; reason: SaveState } | { kind: 'failed'; message?: string }> {
    this.clearTimers();
    await this.flush();
    if (this.hasPending() || this.conflict || this.state === 'locked') return { kind: 'blocked', reason: this.state };
    try {
      const res = await this.options.api.submit({ baseRevision: this.baseRevision });
      if (res.kind === 'ok') {
        this.baseRevision = res.revision;
        await this.options.store.clear(this.options.key);
        this.emit('locked');
        return res;
      }
      if (res.kind === 'locked') this.emit('locked');
      if (res.kind === 'conflict' && res.current) {
        this.baseRevision = res.current.revision;
        this.lastAcked = clone(res.current.steps);
        this.options.onSteps?.(this.getSteps());
        await this.persist();
        return { kind: 'failed', message: 'Le travail a changé sur un autre appareil. Relisez la version actualisée avant de transmettre.' };
      }
      return { kind: 'failed', message: res.message };
    } catch {
      this.emit('offline');
      return { kind: 'failed', message: 'Connexion indisponible' };
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  // ─── Interne ──────────────────────────────────────────────────────────────

  private emit(state: SaveState): void {
    this.state = state;
    this.options.onState?.(state);
  }

  private clearTimers(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.timer = null;
    this.retryTimer = null;
  }

  private schedule(ms: number): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private async persist(): Promise<void> {
    try {
      await this.options.store.save(this.options.key, {
        baseRevision: this.baseRevision,
        lastAcked: clone(this.lastAcked),
        pending: clone(this.pending),
        pendingBase: clone(this.pendingBase),
        currentStep: this.currentStep,
        snapshots: clone(this.snapshots),
      });
    } catch {
      // Stockage local indisponible (navigation privée…) : le serveur reste la source de vérité.
    }
  }

  private async flush(): Promise<void> {
    if (this.initTask) await this.initTask;
    if (this.disposed) return;
    if (this.flushing) {
      this.again = true;
      await new Promise<void>(resolve => this.flushWaiters.push(resolve));
      return;
    }
    this.flushing = true;
    try {
      let rebases = 0;
      while (this.hasPending() && !this.conflict && this.state !== 'locked') {
        const stepId = Object.keys(this.pending)[0]!;
        const sent = clone(this.pending[stepId]!);
        if (!same(this.lastAcked[stepId], this.pendingBase[stepId])) {
          if (same(this.lastAcked[stepId], sent)) {
            delete this.pending[stepId];
            delete this.pendingBase[stepId];
            delete this.snapshots[stepId];
            await this.persist();
            continue;
          }
          this.conflict = { stepId, mine: sent, theirs: clone(this.lastAcked[stepId] ?? {}), currentRevision: this.baseRevision, currentSteps: clone(this.lastAcked) };
          this.emit('conflict');
          return;
        }
        if (this.state !== 'saving') this.emit('syncing');
        let res: SaveResponse;
        try {
          res = await this.options.api.save({
            baseRevision: this.baseRevision,
            stepId,
            step: sent,
            currentStep: this.currentStep,
            snapshot: this.snapshots[stepId],
          });
        } catch (e) {
          this.emit(e instanceof TypeError ? 'offline' : 'error');
          this.retryLater();
          return;
        }

        if (res.kind === 'ok') {
          this.attempt = 0;
          this.baseRevision = res.revision;
          if (res.steps) {
            // Une normalisation de notre propre écriture peut toucher une autre
            // rubrique. Elle ne crée pas un conflit, sauf si cette rubrique
            // avait déjà changé ailleurs par rapport à sa base locale.
            for (const pendingId of Object.keys(this.pending)) {
              if (!res.replayed && same(this.pendingBase[pendingId], this.lastAcked[pendingId])) {
                this.pendingBase[pendingId] = clone(res.steps[pendingId]);
              }
            }
            this.lastAcked = clone(res.steps);
          }
          else this.lastAcked[stepId] = sent;
          if (same(this.pending[stepId], sent)) {
            delete this.pending[stepId];
            delete this.pendingBase[stepId];
            delete this.snapshots[stepId];
          } else this.pendingBase[stepId] = clone(this.lastAcked[stepId]); // nouvelle frappe après la valeur acquittée
          this.options.onSteps?.(this.getSteps());
          await this.persist();
          continue;
        }

        if (res.kind === 'locked') {
          this.emit('locked');
          return;
        }

        if (res.kind === 'rejected') {
          this.emit('error'); // contenu refusé : inutile de réessayer à l'identique
          return;
        }

        // Conflit de révision.
        const theirs = res.current.steps[stepId];
        if (same(theirs, this.pending[stepId])) {
          this.baseRevision = res.current.revision;
          this.lastAcked = clone(res.current.steps);
          delete this.pending[stepId];
          delete this.pendingBase[stepId];
          this.options.onSteps?.(this.getSteps());
          await this.persist();
          continue;
        }
        if (same(theirs, this.pendingBase[stepId]) && rebases < 3) {
          // L'autre écriture portait sur d'autres étapes : on se recale et on renvoie.
          rebases += 1;
          this.baseRevision = res.current.revision;
          this.lastAcked = clone(res.current.steps);
          this.options.onSteps?.(this.getSteps());
          continue;
        }
        this.conflict = {
          stepId,
          mine: clone(this.pending[stepId]!),
          theirs: clone(theirs ?? {}),
          currentRevision: res.current.revision,
          currentSteps: clone(res.current.steps),
        };
        this.emit('conflict');
        return;
      }
      if (this.state !== 'locked' && !this.conflict && !this.hasPending()) this.emit('saved');
    } finally {
      this.flushing = false;
      for (const resolve of this.flushWaiters.splice(0)) resolve();
      if (this.again) {
        this.again = false;
        this.schedule(this.debounceMs);
      }
    }
  }

  private retryLater(): void {
    if (this.disposed) return;
    const delay = this.backoffMs[Math.min(this.attempt, this.backoffMs.length - 1)]!;
    this.attempt += 1;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, delay);
  }
}

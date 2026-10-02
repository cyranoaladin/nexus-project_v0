/**
 * Exécution Python dans le navigateur (Pyodide, Web Worker).
 *
 * Le code de l'élève ne quitte jamais son navigateur et n'est jamais exécuté
 * par le serveur. Le Worker est détruit en cas de dépassement de délai
 * (boucle infinie) ; un nouveau est créé à l'essai suivant. Le harnais Python
 * (`content/espace/nsi-poo/runner.py`) est repris tel quel du TP historique :
 * son filtrage est une restriction pédagogique, pas une sandbox de sécurité.
 */
export interface PythonTestResult {
  label: string;
  pass: boolean;
  message: string;
}

export interface PythonRunResult {
  ok: boolean;
  error: string | null;
  output: string;
  tests: PythonTestResult[];
  mode: 'run' | 'test';
}

export type RunnerPhase = 'idle' | 'loading' | 'running';

export const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';

// Même protocole que le worker historique ; l'instance Pyodide est conservée entre
// deux essais (chaque essai repart d'un espace de noms neuf côté harnais).
const WORKER_SOURCE = `
let pyodide = null;
let runner = null;
self.onmessage = async ({data}) => {
  const {code, step, mode, runtimeBase, runnerSource, id} = data;
  try {
    if (!pyodide) {
      self.postMessage({id, kind: 'loading'});
      const base = runtimeBase.endsWith('/') ? runtimeBase : runtimeBase + '/';
      const {loadPyodide} = await import(base + 'pyodide.mjs');
      pyodide = await loadPyodide({indexURL: base, stdout: () => {}, stderr: () => {}});
      pyodide.runPython(runnerSource);
      runner = pyodide.globals.get('run_submission');
    }
    self.postMessage({id, kind: 'running'});
    const result = runner(code, step, mode);
    const plain = result.toJs({dict_converter: Object.fromEntries});
    result.destroy();
    self.postMessage({id, kind: 'result', result: plain});
  } catch (e) {
    self.postMessage({id, kind: 'engine-error', message: String((e && e.message) || e).slice(0, 2000)});
  }
};
`;

export interface PythonRunnerOptions {
  runnerSource: string;
  runtimeBase?: string;
  /** Délai d'exécution une fois le moteur chargé (défaut 10 s). */
  runTimeoutMs?: number;
  /** Délai de chargement initial du moteur (défaut 120 s : premier chargement ≈ 10 Mo). */
  loadTimeoutMs?: number;
  onPhase?: (phase: RunnerPhase) => void;
}

export class PythonRunner {
  private worker: Worker | null = null;
  private url: string | null = null;
  private seq = 0;

  constructor(private readonly options: PythonRunnerOptions) {}

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    this.url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    this.worker = new Worker(this.url, { type: 'module' });
    return this.worker;
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }

  run(code: string, step: string, mode: 'run' | 'test'): Promise<PythonRunResult> {
    const worker = this.ensureWorker();
    const id = ++this.seq;
    const { onPhase } = this.options;
    const runTimeout = this.options.runTimeoutMs ?? 10_000;
    const loadTimeout = this.options.loadTimeoutMs ?? 120_000;

    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: PythonRunResult, kill = false) => {
        if (timer) clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        onPhase?.('idle');
        if (kill) this.terminate();
        resolve(result);
      };
      const failure = (error: string): PythonRunResult => ({ ok: false, error, output: '', tests: [], mode });
      const arm = (ms: number, message: string) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => finish(failure(message), true), ms);
      };
      const onMessage = ({ data }: MessageEvent) => {
        if (!data || data.id !== id) return;
        if (data.kind === 'loading') {
          onPhase?.('loading');
          arm(loadTimeout, 'Le moteur Python n’a pas pu être chargé (connexion ?). Réessayez.');
        } else if (data.kind === 'running') {
          onPhase?.('running');
          arm(runTimeout, 'Temps d’exécution dépassé : vérifie qu’il n’y a pas de boucle infinie.');
        } else if (data.kind === 'result') {
          finish(data.result as PythonRunResult);
        } else if (data.kind === 'engine-error') {
          finish(failure(String(data.message)), true);
        }
      };
      worker.addEventListener('message', onMessage);
      arm(loadTimeout, 'Le moteur Python n’a pas pu être chargé (connexion ?). Réessayez.');
      worker.postMessage({
        id,
        code,
        step,
        mode,
        runtimeBase: this.options.runtimeBase ?? PYODIDE_BASE,
        runnerSource: this.options.runnerSource,
      });
    });
  }
}

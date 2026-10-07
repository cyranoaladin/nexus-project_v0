import {
  WorkSyncEngine,
  type DraftStore,
  type DraftRecord,
  type SaveApi,
  type SaveResponse,
  type SaveState,
} from '@/lib/espace/client/sync-engine';

type Step = Record<string, unknown>;
const structuredClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T; // jsdom n'expose pas structuredClone

/** Serveur simulé qui reproduit la sémantique réelle de PUT /api/espace/works/[id]. */
class FakeServer {
  revision = 0;
  steps: Record<string, Step> = {};
  locked = false;
  online = true;
  puts = 0;
  failNext = 0; // nombre de requêtes à faire échouer avec une erreur réseau
  dropResponseNext = false; // applique l'écriture mais « perd » la réponse

  api: SaveApi = {
    save: async (input) => {
      this.puts += 1;
      if (this.failNext > 0) {
        this.failNext -= 1;
        throw new TypeError('network');
      }
      if (!this.online) throw new TypeError('offline');
      const res = this.handle(input);
      if (this.dropResponseNext && res.kind === 'ok') {
        this.dropResponseNext = false;
        throw new TypeError('response lost');
      }
      return res;
    },
    submit: async () => ({ kind: 'ok', revision: this.revision + 1 }),
  };

  private handle(input: { baseRevision: number; stepId: string; step: Step }): SaveResponse {
    if (this.locked) return { kind: 'locked' };
    if (input.baseRevision !== this.revision) {
      if (JSON.stringify(this.steps[input.stepId] ?? null) === JSON.stringify(input.step)) {
        return { kind: 'ok', revision: this.revision, replayed: true };
      }
      return { kind: 'conflict', current: { revision: this.revision, steps: structuredClone(this.steps) } };
    }
    this.steps[input.stepId] = structuredClone(input.step);
    this.revision += 1;
    return { kind: 'ok', revision: this.revision };
  }
}

class MemoryStore implements DraftStore {
  data = new Map<string, DraftRecord>();
  async load(key: string) {
    return this.data.get(key) ?? null;
  }
  async save(key: string, record: DraftRecord) {
    this.data.set(key, structuredClone(record));
  }
  async clear(key: string) {
    this.data.delete(key);
  }
}

function setup(server = new FakeServer(), store = new MemoryStore(), initial: { revision?: number; steps?: Record<string, Step> } = {}) {
  const states: SaveState[] = [];
  const engine = new WorkSyncEngine({
    key: 'u1:w1',
    api: server.api,
    store,
    initial: { revision: initial.revision ?? server.revision, steps: initial.steps ?? structuredClone(server.steps) },
    onState: (s) => states.push(s),
    debounceMs: 1000,
    backoffMs: [1000, 2000, 4000],
  });
  return { server, store, engine, states };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const flushAll = async () => {
  await jest.advanceTimersByTimeAsync(0);
};

describe('debounce et enregistrement', () => {
  it('regroupe les frappes rapprochées en une seule requête, avec la dernière valeur', async () => {
    const { server, engine, states } = setup();
    await engine.init();
    engine.edit('reperes', { code: 'a' });
    await jest.advanceTimersByTimeAsync(400);
    engine.edit('reperes', { code: 'ab' });
    await jest.advanceTimersByTimeAsync(400);
    engine.edit('reperes', { code: 'abc' });
    expect(server.puts).toBe(0);
    expect(states.at(-1)).toBe('saving');
    await jest.advanceTimersByTimeAsync(1000);
    expect(server.puts).toBe(1);
    expect(server.steps.reperes).toEqual({ code: 'abc' });
    expect(states.at(-1)).toBe('saved');
  });

  it('n’affiche « enregistré » qu’une fois le serveur ayant répondu OK', async () => {
    const { server, engine, states } = setup();
    await engine.init();
    engine.edit('reperes', { code: 'x' });
    expect(states.at(-1)).toBe('saving');
    server.online = false;
    await jest.advanceTimersByTimeAsync(1000);
    expect(states).not.toContain('saved');
    expect(['offline', 'error']).toContain(states.at(-1));
  });

  it('enregistre chaque étape modifiée séparément', async () => {
    const { server, engine } = setup();
    await engine.init();
    engine.edit('reperes', { code: 'a' });
    engine.edit('instances', { code: 'b' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(server.steps).toEqual({ reperes: { code: 'a' }, instances: { code: 'b' } });
    expect(server.revision).toBe(2);
  });

  it('une édition faite pendant l’envoi n’est jamais perdue', async () => {
    const { server, engine } = setup();
    await engine.init();
    engine.edit('reperes', { code: 'v1' });
    const original = server.api.save;
    let release!: () => void;
    let first = true;
    server.api.save = async (input) => {
      if (first) {
        first = false; // seule la première requête est retenue
        await new Promise<void>((r) => (release = r));
      }
      return original(input);
    };
    await jest.advanceTimersByTimeAsync(1000); // v1 part, en attente de réponse
    engine.edit('reperes', { code: 'v2' }); // frappe pendant l'envoi
    release();
    await jest.advanceTimersByTimeAsync(2000);
    expect(server.steps.reperes).toEqual({ code: 'v2' });
  });
});

describe('hors connexion et reprise', () => {
  it('conserve le brouillon localement, puis resynchronise avec backoff', async () => {
    const { server, store, engine, states } = setup();
    await engine.init();
    server.failNext = 2;
    engine.edit('reperes', { code: 'hors ligne' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(server.puts).toBe(1);
    expect((await store.load('u1:w1'))?.pending.reperes).toEqual({ code: 'hors ligne' });
    await jest.advanceTimersByTimeAsync(1000); // 1er retry (backoff 1 s) échoue encore
    expect(server.puts).toBe(2);
    await jest.advanceTimersByTimeAsync(2000); // 2e retry (backoff 2 s) réussit
    expect(server.puts).toBe(3);
    expect(server.steps.reperes).toEqual({ code: 'hors ligne' });
    expect(states.at(-1)).toBe('saved');
    expect((await store.load('u1:w1'))?.pending).toEqual({});
  });

  it('resynchronise immédiatement au retour du réseau', async () => {
    const { server, engine, states } = setup();
    await engine.init();
    server.online = false;
    engine.edit('reperes', { code: 'x' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(states.at(-1)).toBe('offline');
    server.online = true;
    engine.notifyOnline();
    await flushAll();
    expect(server.steps.reperes).toEqual({ code: 'x' });
    expect(states.at(-1)).toBe('saved');
  });

  it('reprend après un rafraîchissement : le brouillon local non synchronisé est renvoyé', async () => {
    const server = new FakeServer();
    const store = new MemoryStore();
    const first = setup(server, store);
    await first.engine.init();
    server.online = false;
    first.engine.edit('reperes', { code: 'avant refresh' });
    await jest.advanceTimersByTimeAsync(1000);
    first.engine.dispose(); // l'onglet se ferme

    server.online = true;
    const second = setup(server, store); // nouvelle page, même appareil
    await second.engine.init();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(server.steps.reperes).toEqual({ code: 'avant refresh' });
    expect(second.states.at(-1)).toBe('saved');
  });

  it('une réponse perdue après écriture serveur n’entraîne ni conflit ni doublon', async () => {
    const { server, engine, states } = setup();
    await engine.init();
    server.dropResponseNext = true;
    engine.edit('reperes', { code: 'une fois' });
    await jest.advanceTimersByTimeAsync(1000); // appliquée côté serveur, réponse perdue
    expect(server.revision).toBe(1);
    await jest.advanceTimersByTimeAsync(1000); // renvoi : le serveur reconnaît l'écriture déjà faite
    expect(server.revision).toBe(1);
    expect(states.at(-1)).toBe('saved');
  });
});

describe('conflits (plusieurs onglets ou appareils)', () => {
  it('fusionne en silence quand l’autre onglet n’a touché qu’une AUTRE étape', async () => {
    const { server, engine, states } = setup();
    await engine.init();
    server.steps.instances = { code: 'autre onglet' }; // l'autre onglet écrit l'étape 2
    server.revision = 1;
    engine.edit('reperes', { code: 'mon étape 1' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(server.steps).toEqual({ instances: { code: 'autre onglet' }, reperes: { code: 'mon étape 1' } });
    expect(states).not.toContain('conflict');
    expect(states.at(-1)).toBe('saved');
  });

  it('signale un vrai conflit quand la MÊME étape a changé ailleurs, sans rien écraser', async () => {
    const { server, engine, states } = setup();
    await engine.init();
    server.steps.reperes = { code: 'version de l’autre onglet' };
    server.revision = 1;
    engine.edit('reperes', { code: 'ma version' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(states.at(-1)).toBe('conflict');
    expect(server.steps.reperes).toEqual({ code: 'version de l’autre onglet' }); // intacte
    expect(engine.getConflict()).toMatchObject({ stepId: 'reperes', mine: { code: 'ma version' }, theirs: { code: 'version de l’autre onglet' } });
  });

  it('« garder ma version » réécrit sur la révision courante, sur cette étape seulement', async () => {
    const { server, engine, states } = setup();
    await engine.init();
    server.steps.reperes = { code: 'ailleurs' };
    server.steps.instances = { code: 'intacte' };
    server.revision = 2;
    engine.edit('reperes', { code: 'moi' });
    await jest.advanceTimersByTimeAsync(1000);
    await engine.resolveConflict('keep-mine');
    await jest.advanceTimersByTimeAsync(0);
    expect(server.steps.reperes).toEqual({ code: 'moi' });
    expect(server.steps.instances).toEqual({ code: 'intacte' });
    expect(states.at(-1)).toBe('saved');
  });

  it('« prendre la leur » abandonne ma modification et adopte la version serveur', async () => {
    const { server, store, engine, states } = setup();
    await engine.init();
    server.steps.reperes = { code: 'ailleurs' };
    server.revision = 1;
    engine.edit('reperes', { code: 'moi' });
    await jest.advanceTimersByTimeAsync(1000);
    await engine.resolveConflict('take-theirs');
    expect(engine.getSteps().reperes).toEqual({ code: 'ailleurs' });
    expect(server.steps.reperes).toEqual({ code: 'ailleurs' });
    expect((await store.load('u1:w1'))?.pending).toEqual({});
    expect(states.at(-1)).toBe('saved');
  });
});

describe('travail remis ailleurs', () => {
  it('passe en « verrouillé », garde le brouillon et ne réessaie pas', async () => {
    const { server, store, engine, states } = setup();
    await engine.init();
    server.locked = true;
    engine.edit('reperes', { code: 'trop tard' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(states.at(-1)).toBe('locked');
    const putsAfter = server.puts;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(server.puts).toBe(putsAfter); // aucun harcèlement du serveur
    expect((await store.load('u1:w1'))?.pending.reperes).toEqual({ code: 'trop tard' }); // jamais perdu silencieusement
  });
});

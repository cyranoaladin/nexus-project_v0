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

describe('reprise approfondie des bilans', () => {
  it('reflète la normalisation serveur sans restaurer une ancienne preuve ou confirmation', async () => {
    const server = new FakeServer();
    server.steps = { scope: { fields: { '3-arith': 'yes' } }, evidence: { fields: { '3-div': 'preuve précédente' } }, review: { fields: { confirmed: 'yes' } } };
    const initial = structuredClone(server.steps);
    server.api.save = async input => {
      server.revision += 1;
      server.steps = { ...server.steps, [input.stepId]: input.step, evidence: { fields: {} }, review: { fields: { confirmed: '' } } };
      return { kind: 'ok', revision: server.revision, steps: structuredClone(server.steps) };
    };
    const { engine } = setup(server, new MemoryStore(), { steps: initial });
    await engine.init();
    engine.edit('scope', { fields: { '3-arith': 'no' } });
    await jest.advanceTimersByTimeAsync(1000);
    expect(engine.getSteps()).toEqual(server.steps);
    expect(engine.getSteps().review).toEqual({ fields: { confirmed: '' } });
    expect(engine.getSteps().evidence).toEqual({ fields: {} });
  });

  it('conserve la dernière frappe quand une réponse canonique arrive pendant l’édition', async () => {
    const server = new FakeServer();
    let release!: () => void;
    let first = true;
    server.api.save = async input => {
      if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); }
      server.steps[input.stepId] = structuredClone(input.step);
      return { kind: 'ok', revision: ++server.revision, steps: structuredClone(server.steps) };
    };
    const { engine } = setup(server);
    await engine.init();
    engine.edit('methods', { fields: { correction: 'Première frappe' } });
    await jest.advanceTimersByTimeAsync(1000);
    engine.edit('methods', { fields: { correction: 'Dernière frappe' } });
    release();
    await flushAll();
    expect(engine.getSteps().methods).toEqual({ fields: { correction: 'Dernière frappe' } });
    expect(engine.getSteps()).toEqual(server.steps);
  });
  it('demande un choix pour chaque rubrique en conflit après une reprise hors ligne', async () => {
    const server = new FakeServer();
    server.revision = 2;
    server.steps = { methods: { fields: { correction: 'serveur méthodes' } }, growth: { fields: { persistent: 'serveur vécu' } } };
    const store = new MemoryStore();
    await store.save('u1:w1', { baseRevision: 0, lastAcked: {}, pending: { methods: { fields: { correction: 'local méthodes' } }, growth: { fields: { persistent: 'local vécu' } } } });
    const { engine } = setup(server, store);
    await engine.init();
    expect(engine.getState()).toBe('conflict');
    const first = engine.getConflict()!.stepId;
    await engine.resolveConflict('take-theirs');
    expect(engine.getState()).toBe('conflict');
    expect(engine.getConflict()!.stepId).not.toBe(first);
    expect(server.puts).toBe(0);
    await engine.resolveConflict('take-theirs');
    expect(engine.getSteps()).toEqual(server.steps);
  });

  it('notifie la vue quand une fusion récupère une rubrique modifiée ailleurs', async () => {
    const server = new FakeServer();
    const onSteps = jest.fn();
    const engine = new WorkSyncEngine({ key: 'u1:w1', api: server.api, store: new MemoryStore(), initial: { revision: 0, steps: {} }, onSteps });
    await engine.init();
    server.steps.scope = { fields: { '3-arith': 'no' } };
    server.revision = 1;
    engine.edit('methods', { fields: { correction: 'Mon ressenti' } });
    await jest.advanceTimersByTimeAsync(1000);
    expect(onSteps).toHaveBeenLastCalledWith(server.steps);
  });

  it('préserve la frappe commencée avant la fin de lecture du brouillon', async () => {
    let loaded!: (value: DraftRecord) => void;
    const store = new MemoryStore();
    store.load = () => new Promise(resolve => { loaded = resolve; });
    const { engine } = setup(new FakeServer(), store);
    const init = engine.init();
    engine.edit('methods', { fields: { correction: 'Frappe récente' } });
    loaded({ baseRevision: 0, lastAcked: {}, pending: { methods: { fields: { correction: 'Ancien brouillon' } } } });
    await init;
    expect(engine.getSteps().methods).toEqual({ fields: { correction: 'Frappe récente' } });
  });

  it('attend un PUT en vol avant de transmettre le bilan', async () => {
    const server = new FakeServer();
    const original = server.api.save;
    let release!: () => void;
    server.api.save = async input => { await new Promise<void>(resolve => { release = resolve; }); return original(input); };
    server.api.submit = jest.fn(async () => ({ kind: 'ok' as const, revision: server.revision + 1 }));
    const { engine } = setup(server);
    await engine.init();
    engine.edit('review', { fields: { confirmed: 'yes' } });
    await jest.advanceTimersByTimeAsync(1000);
    const submitted = engine.submit();
    expect(server.api.submit).not.toHaveBeenCalled();
    release();
    expect(await submitted).toMatchObject({ kind: 'ok' });
    expect(server.api.submit).toHaveBeenCalledTimes(1);
  });
});

describe('transmission et effets de normalisation', () => {
  it('ne confond pas sa propre invalidation de confirmation avec une édition concurrente', async () => {
    const server = new FakeServer();
    server.steps = { review: { fields: { confirmed: 'yes' } } };
    server.api.save = async input => {
      server.steps[input.stepId] = structuredClone(input.step);
      if (input.stepId !== 'review') server.steps.review = { fields: { confirmed: '' } };
      return { kind: 'ok', revision: ++server.revision, steps: structuredClone(server.steps) };
    };
    const { engine } = setup(server);
    await engine.init();
    engine.edit('methods', { fields: { correction: 'Relire mes erreurs' } });
    engine.edit('review', { fields: { confirmed: '' } });
    engine.edit('review', { fields: { confirmed: 'yes' } });
    await jest.advanceTimersByTimeAsync(1000);
    expect(engine.getState()).toBe('saved');
    expect(server.steps.review).toEqual({ fields: { confirmed: 'yes' } });
  });

  it('verrouille aussi une remise refusée car le travail a été transmis ailleurs', async () => {
    const server = new FakeServer();
    server.api.submit = async () => ({ kind: 'locked', message: 'Déjà remis' });
    const { engine } = setup(server);
    await engine.init();
    await engine.submit();
    expect(engine.getState()).toBe('locked');
    engine.edit('methods', { fields: { correction: 'ne doit pas être accepté' } });
    expect(engine.hasPending()).toBe(false);
  });

  it('récupère la version qui a changé avant la remise et exige une nouvelle action de relecture', async () => {
    const server = new FakeServer();
    const onSteps = jest.fn();
    const current = { revision: 2, steps: { methods: { fields: { correction: 'Autre appareil' } }, review: { fields: { confirmed: '' } } } };
    server.api.submit = jest.fn(async () => ({ kind: 'conflict' as const, current }));
    const engine = new WorkSyncEngine({ key: 'u1:w1', api: server.api, store: new MemoryStore(), initial: { revision: 0, steps: {} }, onSteps });
    await engine.init();
    expect(await engine.submit()).toMatchObject({ kind: 'failed' });
    expect(engine.getBaseRevision()).toBe(2);
    expect(onSteps).toHaveBeenLastCalledWith(current.steps);
    expect(server.api.submit).toHaveBeenCalledTimes(1);
  });
});

it('un rejeu acquitté ne permet pas d’écraser une autre rubrique modifiée ailleurs', async () => {
  const server = new FakeServer();
  server.api.save = async input => {
    if (input.stepId === 'methods') return { kind: 'ok', revision: 3, replayed: true, steps: { methods: input.step, growth: { fields: { persistent: 'Autre appareil' } } } };
    throw new Error('Une rubrique concurrente ne doit pas être envoyée');
  };
  const { engine } = setup(server);
  await engine.init();
  engine.edit('methods', { fields: { correction: 'Déjà reçu' } });
  engine.edit('growth', { fields: { persistent: 'Mon brouillon' } });
  await jest.advanceTimersByTimeAsync(1000);
  expect(engine.getState()).toBe('conflict');
  expect(engine.getConflict()).toMatchObject({ stepId: 'growth', mine: { fields: { persistent: 'Mon brouillon' } }, theirs: { fields: { persistent: 'Autre appareil' } } });
});

it('fusionne une autre rubrique quand PostgreSQL a seulement réordonné les clés JSON', async () => {
  const server = new FakeServer();
  server.steps = { methods: { fields: { b: 'B', a: 'A' } } };
  const { engine } = setup(server);
  await engine.init();
  server.steps = { methods: { fields: { a: 'A', b: 'B' } }, growth: { fields: { persistent: 'Autre rubrique' } } };
  server.revision = 1;
  engine.edit('methods', { fields: { b: 'B', a: 'Réponse modifiée' } });
  await jest.advanceTimersByTimeAsync(1000);
  expect(engine.getState()).toBe('saved');
  expect(server.steps.methods).toEqual({ fields: { b: 'B', a: 'Réponse modifiée' } });
  expect(server.steps.growth).toEqual({ fields: { persistent: 'Autre rubrique' } });
});

it('considère toujours un changement d’ordre dans un tableau comme une modification', async () => {
  const server = new FakeServer();
  server.steps = { methods: { choices: ['premier', 'second'] } };
  const { engine } = setup(server);
  await engine.init();
  server.steps.methods = { choices: ['second', 'premier'] };
  server.revision = 1;
  engine.edit('methods', { choices: ['premier', 'troisième'] });
  await jest.advanceTimersByTimeAsync(1000);
  expect(engine.getState()).toBe('conflict');
  expect(server.steps.methods).toEqual({ choices: ['second', 'premier'] });
});

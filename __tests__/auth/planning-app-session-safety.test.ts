import fs from 'node:fs';
import path from 'node:path';
import { waitFor } from '@testing-library/react';
import { mountStaticSessionRecovery } from '@/lib/auth/static-session-recovery';
import type { SessionRecoveryController } from '@/lib/auth/client-session-recovery';

type Runtime = {
  NexusSessionRecovery: { mountStaticSessionRecovery: typeof mountStaticSessionRecovery };
  NEXUS_PLANNING_CONFIG: object;
  NEXUS_DEFAULT_PLANNING: object;
  Nexus: {
    SessionRecovery: SessionRecoveryController;
    Panels: { confirmDialog(options: unknown): Promise<boolean> };
    Sync: { save(input: unknown): Promise<{ revision: number }>; draft: { save(data: object, revision: number): void; load(): unknown } };
    app: { state: { revision: number; sync: { status: string }; data: object }; resetToDefault(): void; restoreRevision(revision: number): Promise<void>; saveToServer(options?: object): Promise<boolean> };
  };
};

it('retires pre-recovery planning confirmations and late save success without losing the draft', async () => {
  const target = window as unknown as Runtime;
  const originalFetch = global.fetch;
  let mounted: ReturnType<typeof mountStaticSessionRecovery> | undefined;
  const timers = jest.spyOn(window, 'setInterval');
  const base = path.join(process.cwd(), 'tools/planning-studio');
  document.body.innerHTML = fs.readFileSync(path.join(base, 'index.html'), 'utf8').split('<body data-density="comfortable">')[1].split('</body>')[0];
  target.NexusSessionRecovery = { mountStaticSessionRecovery: options => (mounted = mountStaticSessionRecovery(options)) };
  target.NEXUS_PLANNING_CONFIG = { mode: 'integrated' };
  const user = { id: 'synthetic-planning', role: 'ADMIN' };
  const mutations: string[] = [];
  let finishInitialRead!: () => void;
  let documentReads = 0;
  global.fetch = jest.fn(async (input, init) => {
    let body: unknown;
    if (String(input) === '/api/auth/session') body = { user, expires: '2099-01-01T00:00:00Z' };
    else if (init?.method && init.method !== 'GET') { mutations.push(String(init.body)); body = { revision: 2 }; }
    else {
      documentReads++;
      if (documentReads === 1) await new Promise<void>(resolve => { finishInitialRead = resolve; });
      body = { document: { revision: 1 }, payload: target.NEXUS_DEFAULT_PLANNING, permissions: { canEdit: true, canRestore: true, canReset: true }, viewer: user };
    }
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
  });
  try {
    for (const file of ['data/default-data.js', ...['core', 'model', 'validation', 'storage', 'sync', 'ui-grid', 'ui-panels', 'app'].map(name => `assets/${name}.js`)]) {
      new Function(fs.readFileSync(path.join(base, file), 'utf8'))();
    }
    await waitFor(() => expect(finishInitialRead).toBeDefined());
    // A real focus verification can supersede bootstrap while its GET is held.
    window.dispatchEvent(new Event('focus'));
    await mounted!.whenVerified();
    finishInitialRead();
    await waitFor(() => expect(target.Nexus.app.state.revision).toBe(1));
    expect(documentReads).toBe(2);
    expect(mutations).toEqual([]);
    const { app, Panels, Sync, SessionRecovery: controller } = target.Nexus;
    let confirm!: (value: boolean) => void;
    jest.spyOn(Panels, 'confirmDialog').mockImplementation(() => new Promise(resolve => { confirm = resolve; }));
    app.resetToDefault();
    controller.retry(); await mounted!.whenVerified();
    confirm(true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(mutations).toEqual([]);

    const restoring = app.restoreRevision(1);
    controller.retry(); await mounted!.whenVerified();
    confirm(true); await restoring;
    expect(mutations).toEqual([]);

    const draft = { sessions: [{ id: 'unsaved-work' }] };
    Sync.draft.save(draft, 1);
    let finishSave!: (value: { revision: number }) => void;
    jest.spyOn(Sync, 'save').mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    app.state.sync.status = 'dirty';
    const saving = app.saveToServer();
    expect(document.getElementById('btnSave')).toBeDisabled();
    controller.retry(); await mounted!.whenVerified();
    finishSave({ revision: 99 });
    expect(await saving).toBe(false);
    expect(app.state.revision).toBe(1);
    expect(Sync.draft.load()).toEqual(expect.objectContaining({ data: draft }));
    expect(document.getElementById('btnSave')).toBeEnabled();
    expect(document.getElementById('saveStatus')).not.toHaveTextContent('Enregistrement…');
  } finally {
    mounted?.destroy();
    timers.mock.results.forEach(result => { if (result.type === 'return') clearInterval(result.value); });
    timers.mockRestore(); global.fetch = originalFetch; document.body.replaceChildren(); localStorage.clear();
  }
});

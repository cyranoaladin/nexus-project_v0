import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { SessionRecoveryProvider } from '@/components/auth/SessionRecoveryProvider';
import { QcmTrainerWorkspace } from '@/components/dashboard/eleve/survival/QcmTrainerWorkspace';
import { UploadPanel } from '@/components/diagnostics/candidat-libre/UploadPanel';
import { SessionReportForm } from '@/components/ui/session-report-form';
import { StrictMode } from 'react';
import type { DiagnosticQuestion } from '@/lib/diagnostics/candidat-libre/types';

jest.unmock('@/components/auth/SessionRecoveryProvider');
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }), usePathname: () => '/dashboard/coach', useSearchParams: () => new URLSearchParams() }));
jest.mock('@/lib/survival/qcm-bank', () => ({ QCM_BANK: [{ id: 'synthetic-qcm', category: 'VERT', enonce: 'Synthetic question', correctAnswer: 'A', choices: [{ letter: 'A', text: 'Synthetic answer' }] }] }));
const originalFetch = global.fetch;
const originalResizeObserver = global.ResizeObserver;
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
afterAll(() => { global.ResizeObserver = originalResizeObserver; });
let owner = 'coach-a';
const identity = () => ({ user: { id: owner, role: 'COACH' }, expires: '2099-01-01T00:00:00Z' });
function response(body: unknown, ok = true) { return { ok, status: ok ? 200 : 500, json: async () => body } as Response; }
function transport(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  global.fetch = jest.fn((input, init) => input === '/api/auth/session' ? Promise.resolve(response(identity())) : handler(input, init));
}
beforeEach(() => { owner = 'coach-a'; (useSession as jest.Mock).mockImplementation(() => ({ data: identity(), status: 'authenticated' })); });
afterEach(() => { global.fetch = originalFetch; localStorage.clear(); jest.useRealTimers(); });
async function ready() { await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED')); }

it.each(['http', 'network', 'pending'] as const)('never claims QCM persistence from an %s result', async failure => {
  let finish!: (value: Response) => void;
  transport(async () => {
    if (failure === 'http') return response({}, false);
    if (failure === 'network') throw new Error('synthetic network failure');
    return new Promise(resolve => { finish = resolve; });
  });
  render(<SessionRecoveryProvider><QcmTrainerWorkspace /></SessionRecoveryProvider>);
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'A. Synthetic answer' }));
  fireEvent.click(screen.getByRole('button', { name: /suivante/i }));
  await act(async () => {});
  expect(screen.queryByText(/Les réponses données sont enregistrées/)).not.toBeInTheDocument();
  if (failure === 'pending') {
    await act(async () => { finish(response({ isCorrect: true })); });
    expect(screen.getByText(/Les réponses données sont enregistrées/)).toBeInTheDocument();
  }
});

it('releases upload busy state on a rejected protected request without a success callback', async () => {
  const uploaded = jest.fn();
  transport(async (_input, init) => {
    if (init?.method === 'POST') throw new Error('synthetic request unavailable');
    return response({ documents: [] });
  });
  const question = { prompt: 'Synthetic upload', uploadRule: { category: 'WRITTEN_COPY', accept: ['application/pdf'], maxBytesPerFile: 10000, maxFiles: 3, help: 'Test' } } as DiagnosticQuestion;
  const view = render(<SessionRecoveryProvider><UploadPanel diagnosticId="synthetic" question={question} onUploaded={uploaded} /></SessionRecoveryProvider>);
  await ready();
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File(['test'], 'synthetic.pdf', { type: 'application/pdf' })] } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/dépôt/i));
  expect(screen.getByRole('button', { name: /Choisir un fichier/ })).not.toBeDisabled();
  expect(uploaded).not.toHaveBeenCalled();
});

it('isolates report drafts by canonical owner without adopting an ownerless cache', async () => {
  localStorage.setItem('session-report-draft-synthetic', JSON.stringify({ summary: 'Unowned historical private draft' }));
  transport(async () => response({}));
  const view = render(<SessionRecoveryProvider><SessionReportForm sessionId="synthetic" /></SessionRecoveryProvider>);
  await ready();
  expect(screen.getByLabelText(/Résumé de la session/)).toHaveValue('');
  fireEvent.change(screen.getByLabelText(/Résumé de la session/), { target: { value: 'Owner A private draft preserved' } });
  await waitFor(() => expect(localStorage.getItem('session-report-draft-synthetic:owner:coach-a')).toContain('Owner A private draft'));
  owner = 'coach-b';
  view.rerender(<SessionRecoveryProvider><SessionReportForm sessionId="synthetic" /></SessionRecoveryProvider>);
  await ready();
  expect(screen.getByLabelText(/Résumé de la session/)).toHaveValue('');
  expect(localStorage.getItem('session-report-draft-synthetic:owner:coach-a')).toContain('Owner A private draft');
});

it('does not start an audio capture after its protected page has unmounted', async () => {
  const originalMedia = navigator.mediaDevices;
  const originalRecorder = global.MediaRecorder;
  let grant!: (stream: MediaStream) => void;
  const stop = jest.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn(() => new Promise<MediaStream>(resolve => { grant = resolve; })) } });
  global.MediaRecorder = jest.fn().mockImplementation(() => ({ start: jest.fn() })) as unknown as typeof MediaRecorder;
  transport(async () => response({ documents: [] }));
  const question = { prompt: 'Synthetic oral', uploadRule: { category: 'ORAL_RECORDING', accept: ['audio/webm'], maxBytesPerFile: 10000, maxFiles: 3, help: 'Test' } } as DiagnosticQuestion;
  const view = render(<SessionRecoveryProvider><UploadPanel diagnosticId="synthetic" question={question} onUploaded={jest.fn()} /></SessionRecoveryProvider>);
  try {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’oral' }));
    view.unmount();
    await act(async () => { grant({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(global.MediaRecorder).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMedia });
    global.MediaRecorder = originalRecorder;
  }
});

it('retains report edits made after submitting an earlier snapshot', async () => {
  let finish!: (value: Response) => void;
  const saved = jest.fn();
  transport(async () => new Promise(resolve => { finish = resolve; }));
  const view = render(<SessionRecoveryProvider><SessionReportForm sessionId="synthetic" onSuccess={saved} /></SessionRecoveryProvider>);
  await ready();
  for (const id of ['summary', 'topicsCovered', 'progressNotes', 'recommendations']) {
    fireEvent.change(view.container.querySelector(`#${id}`)!, { target: { value: 'Synthetic valid report content' } });
  }
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.change(screen.getByLabelText(/Résumé de la session/), { target: { value: 'Newer unsaved report draft content' } });
  await act(async () => { finish(response({ success: true })); });
  expect(screen.getByLabelText(/Résumé de la session/)).toHaveValue('Newer unsaved report draft content');
  expect(saved).not.toHaveBeenCalled();
});

it('never posts the exam timeout twice under StrictMode', async () => {
  const post = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ isCorrect: false }));
  transport(post);
  render(<StrictMode><SessionRecoveryProvider><QcmTrainerWorkspace /></SessionRecoveryProvider></StrictMode>);
  await ready();
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Comme à l’épreuve' }));
  for (let second = 0; second < 90; second++) await act(async () => { jest.advanceTimersByTime(1000); });
  expect(post).toHaveBeenCalledTimes(1);
  expect(JSON.parse(post.mock.calls[0][1]!.body as string).givenAnswer).toBe('TIMEOUT');
});

it('can stop the microphone during recovery and keeps the recording for an explicit later deposit', async () => {
  const originalMedia = navigator.mediaDevices;
  const originalRecorder = global.MediaRecorder;
  const stopTrack = jest.fn();
  let recorder!: { state: string; mimeType: string; start: jest.Mock; stop: jest.Mock; onstop: (() => void) | null; ondataavailable: ((event: { data: Blob }) => void) | null };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) } });
  global.MediaRecorder = jest.fn().mockImplementation(() => (recorder = {
    state: 'recording', mimeType: 'audio/webm', start: jest.fn(), onstop: null, ondataavailable: null,
    stop: jest.fn(() => { recorder.state = 'inactive'; recorder.ondataavailable?.({ data: new Blob(['synthetic audio']) }); recorder.onstop?.(); }),
  })) as unknown as typeof MediaRecorder;
  const post = jest.fn(async () => response({ documents: [] }));
  transport(post);
  const question = { prompt: 'Synthetic oral', uploadRule: { category: 'ORAL_RECORDING', accept: ['audio/webm'], maxBytesPerFile: 10000, maxFiles: 3, help: 'Test' } } as DiagnosticQuestion;
  const view = render(<SessionRecoveryProvider><UploadPanel diagnosticId="synthetic" question={question} onUploaded={jest.fn()} /></SessionRecoveryProvider>);
  try {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’oral' }));
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
    global.fetch = jest.fn(() => new Promise(() => {}));
    view.rerender(<SessionRecoveryProvider><UploadPanel diagnosticId="synthetic" question={question} onUploaded={jest.fn()} /></SessionRecoveryProvider>);
    await waitFor(() => expect(document.querySelector('[data-session-observation]')).toHaveAttribute('data-session-observation', 'RECOVERING'));
    const stop = screen.getByRole('button', { name: /Arrêter l’enregistrement/ });
    expect(stop).not.toBeDisabled();
    fireEvent.click(stop);
    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Déposer l’enregistrement conservé' })).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledTimes(1); // canonical verification only
  } finally {
    view.unmount();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMedia });
    global.MediaRecorder = originalRecorder;
  }
});

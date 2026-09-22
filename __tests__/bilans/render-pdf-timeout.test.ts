/**
 * extractPdfText's timeout bound (mission §5/§6 for the diagnostics
 * feature that consumes it, but the bound itself lives here): proves the
 * underlying child process is actually killed on timeout, not merely
 * that the caller's await gives up while the process keeps running. A
 * test that only asserts "the promise rejected after N ms" cannot tell
 * those two apart — this one asserts `child.kill('SIGKILL')` was called
 * on the real handle the code spawned.
 */
import { EventEmitter } from 'node:events';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

import { spawn } from 'node:child_process';
import { extractPdfText } from '@/lib/bilans/render/pdf';

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = { end: jest.fn(), on: jest.fn() };
  kill = jest.fn();
}

test('a hanging extraction is killed (SIGKILL) on the real process handle once the bound elapses — not just abandoned', async () => {
  const fakeChild = new FakeChildProcess();
  mockedSpawn.mockReturnValue(fakeChild as unknown as ReturnType<typeof spawn>);

  const promise = extractPdfText(Buffer.from('irrelevant, the child never actually processes it'), { timeoutMs: 50 });
  await expect(promise).rejects.toThrow('BILAN_PDF_TEXT_EXTRACTION_TIMEOUT');

  expect(fakeChild.kill).toHaveBeenCalledWith('SIGKILL');
  expect(fakeChild.kill).toHaveBeenCalledTimes(1);
});

test('a child that closes normally before the bound is never killed', async () => {
  const fakeChild = new FakeChildProcess();
  mockedSpawn.mockReturnValue(fakeChild as unknown as ReturnType<typeof spawn>);

  const promise = extractPdfText(Buffer.from('irrelevant'), { timeoutMs: 5_000 });
  fakeChild.stdout.emit('data', Buffer.from('extracted text'));
  fakeChild.emit('close', 0);

  await expect(promise).resolves.toBe('extracted text');
  expect(fakeChild.kill).not.toHaveBeenCalled();
});

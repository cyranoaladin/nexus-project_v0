import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const actualFs = jest.requireActual('node:fs') as typeof import('node:fs');

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    writeFileSync: jest.fn(actual.writeFileSync),
    renameSync: jest.fn(actual.renameSync),
    rmSync: jest.fn(actual.rmSync),
  };
});

import { writeFileSync, renameSync, rmSync } from 'node:fs';
import { writeJsonFileAtomic } from '@/scripts/aria/atomic-write-json';

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'aria-atomic-write-'));
}

describe('writeJsonFileAtomic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the expected bytes deterministically', () => {
    const destination = join(fixtureRoot(), 'out.json');
    writeJsonFileAtomic(destination, Buffer.from('{"a":1}\n'));
    expect(readFileSync(destination, 'utf8')).toBe('{"a":1}\n');
  });

  it('a write failure before rename leaves an existing destination byte-identical and no orphan temp file', () => {
    const root = fixtureRoot();
    const destination = join(root, 'out.json');
    actualFs.writeFileSync(destination, 'original\n');
    (writeFileSync as jest.Mock).mockImplementationOnce(() => { throw new Error('disk full'); });

    expect(() => writeJsonFileAtomic(destination, Buffer.from('{"a":1}\n'))).toThrow('disk full');
    expect(readFileSync(destination, 'utf8')).toBe('original\n');
    expect(readdirSync(root)).toEqual(['out.json']);
  });

  it('a rename failure leaves an existing destination byte-identical and no orphan temp file', () => {
    const root = fixtureRoot();
    const destination = join(root, 'out.json');
    actualFs.writeFileSync(destination, 'original\n');
    (renameSync as jest.Mock).mockImplementationOnce(() => { throw new Error('cross-device link'); });

    expect(() => writeJsonFileAtomic(destination, Buffer.from('{"a":1}\n'))).toThrow('cross-device link');
    expect(readFileSync(destination, 'utf8')).toBe('original\n');
    expect(readdirSync(root)).toEqual(['out.json']);
  });

  it('preserves both the original failure and a cleanup failure via AggregateError, never masking the original', () => {
    const root = fixtureRoot();
    const destination = join(root, 'out.json');
    actualFs.writeFileSync(destination, 'original\n');
    (renameSync as jest.Mock).mockImplementationOnce(() => { throw new Error('cross-device link'); });
    (rmSync as jest.Mock).mockImplementationOnce(() => { throw new Error('temp file busy'); });

    let caught: unknown;
    try {
      writeJsonFileAtomic(destination, Buffer.from('{"a":1}\n'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    const aggregate = caught as AggregateError;
    expect(aggregate.errors).toHaveLength(2);
    expect((aggregate.errors[0] as Error).message).toBe('cross-device link');
    expect((aggregate.errors[1] as Error).message).toBe('temp file busy');
    expect(readFileSync(destination, 'utf8')).toBe('original\n');
  });

  it('a write failure with no pre-existing destination leaves nothing behind', () => {
    const root = fixtureRoot();
    const destination = join(root, 'out.json');
    (writeFileSync as jest.Mock).mockImplementationOnce(() => { throw new Error('disk full'); });

    expect(() => writeJsonFileAtomic(destination, Buffer.from('{"a":1}\n'))).toThrow('disk full');
    expect(existsSync(destination)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });
});

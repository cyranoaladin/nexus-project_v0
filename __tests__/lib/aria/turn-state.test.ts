import {
  canTransitionAriaTurn,
  isTerminalAriaTurnStatus,
  legacyMessageStatusForTurn,
} from '@/lib/aria/domain/conversation/turn-state';

describe('ARIA conversation Turn state machine', () => {
  it.each([
    ['PENDING', false],
    ['RUNNING', false],
    ['COMPLETED', true],
    ['CANCELLED', true],
    ['ERROR', true],
  ] as const)('classifies %s terminal=%s', (status, expected) => {
    expect(isTerminalAriaTurnStatus(status)).toBe(expected);
  });

  it.each([
    ['PENDING', 'RUNNING', true],
    ['PENDING', 'CANCELLED', true],
    ['PENDING', 'ERROR', true],
    ['RUNNING', 'COMPLETED', true],
    ['RUNNING', 'CANCELLED', true],
    ['RUNNING', 'ERROR', true],
    ['PENDING', 'COMPLETED', false],
    ['RUNNING', 'PENDING', false],
    ['COMPLETED', 'RUNNING', false],
    ['CANCELLED', 'ERROR', false],
    ['ERROR', 'COMPLETED', false],
  ] as const)('%s -> %s allowed=%s', (from, to, expected) => {
    expect(canTransitionAriaTurn(from, to)).toBe(expected);
  });

  it.each(['PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR'] as const)(
    'keeps an accepted user message COMPLETED while the assistant follows Turn %s',
    (status) => {
      expect(legacyMessageStatusForTurn('USER', status)).toBe('COMPLETED');
    },
  );

  it.each([
    ['PENDING', 'PENDING'],
    ['RUNNING', 'STREAMING'],
    ['COMPLETED', 'COMPLETED'],
    ['CANCELLED', 'CANCELLED'],
    ['ERROR', 'ERROR'],
  ] as const)('projects assistant Turn %s to legacy %s', (status, expected) => {
    expect(legacyMessageStatusForTurn('ASSISTANT', status)).toBe(expected);
  });
});

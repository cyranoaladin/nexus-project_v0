export type AriaTurnStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
export type AriaTurnMessageRole = 'USER' | 'ASSISTANT';
export type AriaLegacyMessageStatus =
  | 'PENDING'
  | 'STREAMING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR';

const allowedTransitions: Readonly<Record<AriaTurnStatus, readonly AriaTurnStatus[]>> = {
  PENDING: ['RUNNING', 'CANCELLED', 'ERROR'],
  RUNNING: ['COMPLETED', 'CANCELLED', 'ERROR'],
  COMPLETED: [],
  CANCELLED: [],
  ERROR: [],
};

export function isTerminalAriaTurnStatus(status: AriaTurnStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'ERROR';
}

export function canTransitionAriaTurn(from: AriaTurnStatus, to: AriaTurnStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function legacyMessageStatusForTurn(
  role: AriaTurnMessageRole,
  status: AriaTurnStatus,
): AriaLegacyMessageStatus {
  if (role === 'USER') return 'COMPLETED';
  if (status === 'RUNNING') return 'STREAMING';
  return status;
}

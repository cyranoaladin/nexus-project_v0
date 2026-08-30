interface RegisteredCancellation {
  readonly executionToken: string;
  readonly controller: AbortController;
}

const activeCancellations = new Map<string, RegisteredCancellation>();

export function registerAriaTurnCancellation(
  turnId: string,
  executionToken: string,
): AbortSignal {
  const existing = activeCancellations.get(turnId);
  if (existing && existing.executionToken !== executionToken) {
    existing.controller.abort('EXECUTION_REPLACED');
  }
  const controller = new AbortController();
  activeCancellations.set(turnId, { executionToken, controller });
  return controller.signal;
}

export function requestLocalAriaTurnCancellation(
  turnId: string,
  executionToken?: string,
  reason: 'USER_CANCELLED' | 'TURN_LEASE_LOST' | 'TURN_HEARTBEAT_FAILED' = 'USER_CANCELLED',
): boolean {
  const active = activeCancellations.get(turnId);
  if (!active || (executionToken && active.executionToken !== executionToken)) return false;
  if (!active.controller.signal.aborted) active.controller.abort(reason);
  return true;
}

export function unregisterAriaTurnCancellation(turnId: string, executionToken: string): void {
  const active = activeCancellations.get(turnId);
  if (active?.executionToken === executionToken) activeCancellations.delete(turnId);
}

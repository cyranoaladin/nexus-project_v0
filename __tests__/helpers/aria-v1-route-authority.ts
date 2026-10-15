/** Unit transport fixtures. Real encrypted cookies/locks live in the PostgreSQL lane. */
export const ariaV1Claims = Object.freeze({ userId: 'user-1', role: 'ELEVE' as const,
  sessionVersion: 41, expiresAt: 4_070_908_800_000 });
export const ariaV1Transaction = Object.freeze({ syntheticV1Transaction: true, $executeRawUnsafe: jest.fn(async () => 0) });
export const ariaV1Repository = {
  syntheticV1Repository: true,
  getAttemptById: jest.fn(async () => ({ id: 'attempt-1', studentId: 'student-1', courseKey: 'eds-maths-premiere' })),
  resolveStudentIdByUserId: jest.fn(async () => 'student-1'),
};
export async function syntheticV1Authority<T>(_claims: unknown,
  operation: (tx: typeof ariaV1Transaction) => Promise<T>, publish?: (value: T) => void): Promise<T> {
  const result = await operation(ariaV1Transaction);
  publish?.(result);
  return result;
}

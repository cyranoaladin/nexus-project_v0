export interface SerializedError {
  name: string;
  message: 'Operation failed';
  code?: string;
}
export function serializeError(error: unknown): SerializedError;
export function isSafeLogErrorName(value: unknown): value is string;
export function isSafeLogErrorCode(value: unknown): value is string;

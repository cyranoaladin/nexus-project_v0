export interface SerializedError {
  name: string;
  message: 'Operation failed';
  code?: string;
}
export function serializeError(error: unknown): SerializedError;

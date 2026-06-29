export type SerializedError =
  | {
      name: string;
      message: string;
      stack?: string;
      cause?: SerializedError | string;
    }
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...('cause' in error && error.cause ? { cause: serializeError(error.cause) } : {}),
    };
  }

  if (error === null || typeof error !== 'object') {
    return error as SerializedError;
  }

  try {
    return JSON.parse(JSON.stringify(error)) as SerializedError;
  } catch {
    return String(error);
  }
}

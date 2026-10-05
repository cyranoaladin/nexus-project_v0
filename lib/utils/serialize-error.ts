// Shared, side-effect-free serializer; the CommonJS utility also serves maintenance scripts.
export { serializeError, isSafeLogErrorName, isSafeLogErrorCode } from '../../scripts/serialize-error.cjs';
export type { SerializedError } from '../../scripts/serialize-error.cjs';

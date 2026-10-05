const safeNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'EvalError', 'ZodError', 'ApiError', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientInitializationError', 'PrismaClientValidationError']);
const safeDatabaseCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2000', 'P2002', 'P2003', 'P2004', 'P2025', 'P2028', 'P2034']);

/** No free text, stack, cause, object copying or user serialization hooks cross this logging boundary. */
function serializeError(error) {
  const summary = { name: 'UnknownError', message: 'Operation failed' };
  try {
    if (!(error instanceof Error)) return summary;
    summary.name = 'Error';
    const name = Object.getOwnPropertyDescriptor(error, 'name');
    if (name && typeof name.value === 'string' && safeNames.has(name.value)) summary.name = name.value;
    const code = Object.getOwnPropertyDescriptor(error, 'code');
    if (code && typeof code.value === 'string' && safeDatabaseCodes.has(code.value)) summary.code = code.value;
  } catch {
    // Hostile proxies cannot make the logging boundary throw or disclose input.
    return { name: 'UnknownError', message: 'Operation failed' };
  }
  return summary;
}

function isSafeLogErrorName(value) { return typeof value === 'string' && (safeNames.has(value) || value === 'UnknownError'); }
function isSafeLogErrorCode(value) { return typeof value === 'string' && safeDatabaseCodes.has(value); }
module.exports = { serializeError, isSafeLogErrorName, isSafeLogErrorCode };

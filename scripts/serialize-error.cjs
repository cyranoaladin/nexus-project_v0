function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error?.cause instanceof Error) {
    return {
      ...error,
      cause: {
        name: error.cause.name,
        message: error.cause.message,
        stack: error.cause.stack,
      },
    };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return String(error);
  }
}

module.exports = { serializeError };

export class CanonicalApiError extends Error {
  private constructor(
    public readonly status: 400 | 401 | 404 | 409 | 422,
    public readonly code: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(code);
    this.name = 'CanonicalApiError';
  }

  static badRequest(code = 'INVALID_REQUEST'): CanonicalApiError {
    return new CanonicalApiError(400, code);
  }

  static unauthenticated(): CanonicalApiError {
    return new CanonicalApiError(401, 'AUTHENTICATION_REQUIRED');
  }

  static notFound(): CanonicalApiError {
    return new CanonicalApiError(404, 'NOT_FOUND');
  }

  static studentRequired(): CanonicalApiError {
    return CanonicalApiError.notFound();
  }

  static audienceDenied(): CanonicalApiError {
    return CanonicalApiError.notFound();
  }

  static conflict(code: string, details?: Readonly<Record<string, unknown>>): CanonicalApiError {
    return new CanonicalApiError(409, code, details);
  }

  static incompatible(code: string): CanonicalApiError {
    return new CanonicalApiError(422, code);
  }
}

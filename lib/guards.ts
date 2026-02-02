/**
 * Authentication & Authorization Guards for API Routes
 *
 * Centralized functions to check user authentication and role-based access control (RBAC).
 * Use these guards at the beginning of API route handlers to enforce security.
 */

import { authOptions } from './auth';
import { UserRole } from '@/types/enums';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export type AuthSession = {
  user: {
    id: string;
    email: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
  };
};

/**
 * Require authenticated session
 *
 * Returns the session if user is authenticated, or a 401 error response
 *
 * @example
 * ```ts
 * const session = await requireAuth();
 * if (!session) return; // 401 response already sent
 * ```
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'You must be signed in to access this resource'
      },
      { status: 401 }
    );
  }

  // Validate session structure
  if (!session.user.id || !session.user.role) {
    console.error('Invalid session structure', { userId: session.user?.id });
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid session'
      },
      { status: 401 }
    );
  }

  return session as AuthSession;
}

/**
 * Require specific role
 *
 * Returns the session if user has the required role, or a 403 error response
 *
 * @param requiredRole - The role required to access the resource
 *
 * @example
 * ```ts
 * const session = await requireRole('ADMIN');
 * if (!session) return; // 401/403 response already sent
 * ```
 */
export async function requireRole(requiredRole: UserRole): Promise<AuthSession | NextResponse> {
  const sessionOrResponse = await requireAuth();

  // If requireAuth returned a response (error), return it
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const session = sessionOrResponse as AuthSession;

  if (session.user.role !== requiredRole) {
    console.warn('Access denied: insufficient permissions', {
      userId: session.user.id,
      userRole: session.user.role,
      requiredRole
    });

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `Access denied. Required role: ${requiredRole}`
      },
      { status: 403 }
    );
  }

  return session;
}

/**
 * Require one of multiple roles
 *
 * Returns the session if user has any of the allowed roles, or a 403 error response
 *
 * @param allowedRoles - Array of roles that can access the resource
 *
 * @example
 * ```ts
 * const session = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
 * if (!session) return; // 401/403 response already sent
 * ```
 */
export async function requireAnyRole(allowedRoles: UserRole[]): Promise<AuthSession | NextResponse> {
  const sessionOrResponse = await requireAuth();

  // If requireAuth returned a response (error), return it
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const session = sessionOrResponse as AuthSession;

  if (!allowedRoles.includes(session.user.role)) {
    console.warn('Access denied: insufficient permissions', {
      userId: session.user.id,
      userRole: session.user.role,
      allowedRoles
    });

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      },
      { status: 403 }
    );
  }

  return session;
}

/**
 * Check if session belongs to specific user (for resource ownership validation)
 *
 * @param session - The authenticated session
 * @param userId - The user ID to check ownership against
 * @returns true if session user matches userId, false otherwise
 *
 * @example
 * ```ts
 * if (!isOwner(session, resourceOwnerId)) {
 *   return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
 * }
 * ```
 */
export function isOwner(session: AuthSession, userId: string): boolean {
  return session.user.id === userId;
}

/**
 * Check if session has admin or assistante role (management access)
 *
 * @param session - The authenticated session
 * @returns true if user is admin or assistante
 *
 * @example
 * ```ts
 * if (!isStaff(session)) {
 *   return NextResponse.json({ error: 'Staff only' }, { status: 403 });
 * }
 * ```
 */
export function isStaff(session: AuthSession): boolean {
  return session.user.role === 'ADMIN' || session.user.role === 'ASSISTANTE';
}

/**
 * Type guard to check if result is an error response
 *
 * @param result - Result from guard function
 * @returns true if result is NextResponse (error), false if AuthSession
 *
 * @example
 * ```ts
 * const result = await requireAuth();
 * if (isErrorResponse(result)) return result;
 * const session = result;
 * ```
 */
export function isErrorResponse(result: AuthSession | NextResponse): result is NextResponse {
  // Check if result has response-like properties (json, status)
  // This works better with mocks than instanceof
  return result && typeof (result as any).json === 'function' && 'status' in result;
}

/**
 * Authentication & Authorization Guards for API Routes
 *
 * Centralized functions to check user authentication and role-based access control (RBAC).
 * Use these guards at the beginning of API route handlers to enforce security.
 */

import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

export type AuthSession = {
  user: {
    id: string;
    email: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
    name?: string | null;
    image?: string | null;
  };
  expires: string;
};

/**
 * Require authenticated session
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'You must be signed in to access this resource'
      },
      { status: 401 }
    );
  }

  // Validate session structure (auth v5 guarantees basic user info if session exists)
  if (!session.user.email) {
      // Should not happen with auth v5 if configured correctly
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid session state' },
        { status: 401 }
      );
  }

  return session as unknown as AuthSession;
}

/**
 * Require specific role
 */
export async function requireRole(requiredRole: UserRole): Promise<AuthSession | NextResponse> {
  const result = await requireAuth();

  if (isErrorResponse(result)) {
    return result;
  }

  const session = result as AuthSession;

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
 */
export async function requireAnyRole(allowedRoles: UserRole[]): Promise<AuthSession | NextResponse> {
  const result = await requireAuth();

  if (isErrorResponse(result)) {
    return result;
  }

  const session = result as AuthSession;

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
 * Check if the authenticated user owns the resource
 */
export function isOwner(session: AuthSession, userId: string): boolean {
  return session.user.id === userId;
}

/**
 * Check if the authenticated user is staff (ADMIN or ASSISTANTE)
 */
export function isStaff(session: AuthSession): boolean {
  return ['ADMIN', 'ASSISTANTE'].includes(session.user.role);
}

// Helper to check if result is an error response (Exported for consumers)
export function isErrorResponse(result: any): result is NextResponse {
    return typeof result?.json === 'function' && 'status' in result;
}

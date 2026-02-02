/**
 * Integration Tests - Admin Users Endpoint
 *
 * Tests CRUD operations for user management (admin only).
 */

import { GET, POST, PATCH, DELETE } from '@/app/api/admin/users/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

// Mock guards
jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireRole: jest.fn(),
  isErrorResponse: jest.fn()
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn()
}));

const mockAdminSession = {
  user: {
    id: 'admin-123',
    email: 'admin@nexus.com',
    role: 'ADMIN' as const,
    firstName: 'Admin',
    lastName: 'User'
  }
};

/**
 * Helper to create NextRequest with proper URL initialization
 * NextRequest constructor requires specific setup for nextUrl.searchParams to work
 */
function createMockRequest(url: string, options?: RequestInit): NextRequest {
  const request = new NextRequest(url, options as any);
  // Ensure nextUrl is properly initialized
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false,
    configurable: true
  });
  return request;
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockAdminSession);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
  });

  it('should return 401 when not authenticated', async () => {
    const mockErrorResponse = {
      json: async () => ({ error: 'UNAUTHORIZED', message: 'Authentication required' }),
      status: 401
    };
    (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

    const request = createMockRequest('http://localhost:3000/api/admin/users');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 403 when user is not ADMIN', async () => {
    const mockErrorResponse = {
      json: async () => ({ error: 'FORBIDDEN', message: 'Access denied. Required role: ADMIN' }),
      status: 403
    };
    (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

    const request = createMockRequest('http://localhost:3000/api/admin/users');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('should list users with pagination', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'user1@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'ELEVE',
        isActive: true,
        createdAt: new Date(),
        student: null,
        coachProfile: null,
        parentProfile: null
      }
    ];

    (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
    (prisma.user.count as jest.Mock).mockResolvedValue(1);

    const request = createMockRequest('http://localhost:3000/api/admin/users?limit=20&offset=0');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(1);
    expect(data.pagination).toEqual({
      total: 1,
      limit: 20,
      offset: 0,
      hasMore: false,
      page: 1,
      totalPages: 1
    });
  });

  it('should filter users by role', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.count as jest.Mock).mockResolvedValue(0);

    const request = createMockRequest('http://localhost:3000/api/admin/users?role=COACH');
    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'COACH' })
      })
    );
  });

  it('should search users by name or email', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.count as jest.Mock).mockResolvedValue(0);

    const request = createMockRequest('http://localhost:3000/api/admin/users?search=john');
    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ firstName: expect.anything() }),
            expect.objectContaining({ lastName: expect.anything() }),
            expect.objectContaining({ email: expect.anything() })
          ])
        })
      })
    );
  });
});

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockAdminSession);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
  });

  it('should return 422 for invalid input', async () => {
    const request = createMockRequest('http://localhost:3000/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email', // Invalid email format
        firstName: 'John',
        lastName: 'Doe',
        role: 'ELEVE'
        // Missing password
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.details).toBeDefined();
  });

  it('should return 409 when email already exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-user',
      email: 'existing@test.com'
    });

    const request = createMockRequest('http://localhost:3000/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'ELEVE',
        password: 'password123'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('CONFLICT');
    expect(data.message).toContain('already exists');
  });

  it('should create a new user successfully', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'new-user-123',
      email: 'newuser@test.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'ELEVE',
      phone: null,
      isActive: true,
      createdAt: new Date(),
      coachProfile: null
    });

    const request = createMockRequest('http://localhost:3000/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'ELEVE',
        password: 'password123'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('newuser@test.com');
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
  });
});

describe('PATCH /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockAdminSession);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
  });

  it('should return 400 when ID is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Updated'
      })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 404 when user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest('http://localhost:3000/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'nonexistent-id',
        firstName: 'Updated'
      })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('NOT_FOUND');
  });

  it('should update user successfully', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'user-123',
        email: 'user@test.com',
        firstName: 'John',
        lastName: 'Doe'
      })
      .mockResolvedValueOnce(null); // No email conflict

    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'user@test.com',
      firstName: 'Updated',
      lastName: 'Doe',
      role: 'ELEVE',
      phone: null,
      isActive: true,
      updatedAt: new Date()
    });

    const request = createMockRequest('http://localhost:3000/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'user-123',
        firstName: 'Updated'
      })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.firstName).toBe('Updated');
  });
});

describe('DELETE /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockAdminSession);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
  });

  it('should return 400 when ID is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/admin/users');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 404 when user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest('http://localhost:3000/api/admin/users?id=nonexistent');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('NOT_FOUND');
  });

  it('should prevent self-deletion', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-123', // Same as session user
      email: 'admin@nexus.com'
    });

    const request = createMockRequest('http://localhost:3000/api/admin/users?id=admin-123');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.message).toContain('Cannot delete your own account');
  });

  it('should delete user successfully', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'user@test.com'
    });
    (prisma.user.delete as jest.Mock).mockResolvedValue({});

    const request = createMockRequest('http://localhost:3000/api/admin/users?id=user-123');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('User deleted successfully');
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-123' }
    });
  });
});

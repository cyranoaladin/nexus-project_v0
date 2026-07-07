// ═══════════════════════════════════════════════════════════════════════════════
// NPC Generate API Tests
// Test the AI correction launch endpoint
// ═══════════════════════════════════════════════════════════════════════════════

import { POST } from '@/app/api/npc/submissions/[submissionId]/generate/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CopySubmissionStatus, UserRole } from '@prisma/client';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('@/lib/npc/access', () => ({
  canManageSubmissionDocuments: jest.fn(),
}));

describe('POST /api/npc/submissions/[submissionId]/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without session', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/npc/submissions/sub-1/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: 'sub-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(401);
  });

  it('returns 403 for unauthorized role', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.ELEVE },
    });

    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      pages: [],
    });

    const { canManageSubmissionDocuments } = require('@/lib/npc/access');
    canManageSubmissionDocuments.mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/npc/submissions/sub-1/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: 'sub-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(403);
  });

  it('returns 404 for non-existent submission', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.COACH },
    });

    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue(null);

    const { canManageSubmissionDocuments } = require('@/lib/npc/access');
    canManageSubmissionDocuments.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/npc/submissions/sub-1/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: 'sub-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(404);
  });

  it('rejects unsafe submission ids before reading the submission', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.COACH },
    });

    const request = new NextRequest('http://localhost/api/npc/submissions/../secret/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: '../secret' });

    const response = await POST(request, { params });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid');
    expect(prisma.copySubmission.findUnique).not.toHaveBeenCalled();
  });

  it('returns 403 if coach not assigned to student', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.COACH },
    });

    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      studentId: 'student-1',
      coachId: 'coach-2',
      pages: [],
    });

    const { canManageSubmissionDocuments } = require('@/lib/npc/access');
    canManageSubmissionDocuments.mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/npc/submissions/sub-1/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: 'sub-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(403);
  });

  it('returns 400 if no student copy', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.COACH },
    });

    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      pages: [
        { id: 'doc-1', documentType: 'SUBJECT', status: 'UPLOADED' },
      ],
    });

    const { canManageSubmissionDocuments } = require('@/lib/npc/access');
    canManageSubmissionDocuments.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/npc/submissions/sub-1/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: 'sub-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('At least one student copy is required');
  });

  it('returns 201 and creates AI job with valid documents', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.COACH },
    });

    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      pages: [
        { id: 'doc-1', documentType: 'STUDENT_COPY', status: 'UPLOADED' },
        { id: 'doc-2', documentType: 'SUBJECT', status: 'UPLOADED' },
      ],
    });

    const { canManageSubmissionDocuments } = require('@/lib/npc/access');
    canManageSubmissionDocuments.mockResolvedValue(true);

    (prisma.aiProcessingJob.create as jest.Mock).mockResolvedValue({
      id: 'job-1',
      status: 'PENDING',
    });

    (prisma.copySubmission.update as jest.Mock).mockResolvedValue({});
    (prisma.npcAuditLog.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost/api/npc/submissions/sub-1/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: 'sub-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.jobId).toBe('job-1');
    expect(data.status).toBe('QUEUED_FOR_ANALYSIS');
    // Note: reportId is NOT returned immediately since it's created asynchronously by the worker

    expect(prisma.aiProcessingJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'PENDING',
        priority: 'NORMAL',
      }),
    });

    expect(prisma.copySubmission.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        status: CopySubmissionStatus.QUEUED_FOR_ANALYSIS,
        aiJobId: 'job-1',
      },
    });
  });

  it('returns 400 if submission already processing or completed', async () => {
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.COACH },
    });

    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: CopySubmissionStatus.QUEUED_FOR_ANALYSIS,
      pages: [
        { id: 'doc-1', documentType: 'STUDENT_COPY', status: 'UPLOADED' },
      ],
    });

    const { canManageSubmissionDocuments } = require('@/lib/npc/access');
    canManageSubmissionDocuments.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/npc/submissions/sub-1/generate', {
      method: 'POST',
    });
    const params = Promise.resolve({ submissionId: 'sub-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Submission is already being processed or completed');
  });
});

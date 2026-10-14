/** @jest-environment node */

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { checkAndAwardBadges } from '@/lib/badges';
import { createLogger } from '@/lib/middleware/logger';
import { makeRecordAriaFeedback } from '@/lib/aria/application/feedback/public';
import { makePrismaAriaFeedbackRepository } from '@/lib/aria/infrastructure/prisma/feedback-repository';
import {
  makeGetAriaLearningProfile,
  makeReplaceAriaLearningProfile,
} from '@/lib/aria/application/profile/public';
import { POST } from '@/app/api/aria/feedback/route';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/badges', () => ({ checkAndAwardBadges: jest.fn() }));
jest.mock('@/lib/middleware/logger', () => ({ createLogger: jest.fn() }));
// Autorité V1 par requête (cookie privé lié + verrou) : transport synthétique, la vraie lane PostgreSQL la couvre.
jest.mock('@/lib/auth/private-v1-session', () => ({ readBoundPrivateV1Session: jest.fn(async () => require('../helpers/aria-v1-route-authority').ariaV1Claims) }));
jest.mock('@/lib/auth/v1-session-authority', () => ({ withV1SessionAuthority: jest.fn(require('../helpers/aria-v1-route-authority').syntheticV1Authority) }));
jest.mock('@/lib/aria/infrastructure/prisma/actor-authority', () => ({ lockV1AriaSubject: jest.fn(async () => undefined) }));
jest.mock('@/lib/aria/infrastructure/prisma/feedback-repository', () => ({ makePrismaAriaFeedbackRepository: jest.fn() }));

describe('ARIA feedback/profile persistence composition', () => {
  it('I020 keeps canonical writes visible and downgrades only the structured secondary badge failure', async () => {
    const feedbackRepository = { upsertOwnedFeedback: jest.fn().mockResolvedValue({
      id: 'feedback-integration-1', studentId: 'student-integration-1',
      messageId: 'message-integration-1', useful: false, reason: 'À reprendre',
      updatedAt: new Date('2026-08-30T19:00:00.000Z'),
    }) };
    const feedback = await makeRecordAriaFeedback(feedbackRepository)({
      actor: { userId: 'user-integration-1', role: 'ELEVE' },
      messageId: 'message-integration-1', useful: false, reason: ' À reprendre ',
    });
    expect(feedback).toMatchObject({ useful: false, reason: 'À reprendre' });
    expect(feedbackRepository.upsertOwnedFeedback).toHaveBeenCalledTimes(1);

    const profileRepository = {
      loadByActorUserId: jest.fn().mockResolvedValue({
        studentId: 'student-integration-1',
        academicCourseKeys: ['eds-maths-premiere'],
        profile: null,
      }),
      createDefault: jest.fn().mockResolvedValue({
        studentId: 'student-integration-1', preferencesVersion: 1,
        pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [],
        showCitations: true, updatedAt: new Date('2026-08-30T19:01:00.000Z'),
      }),
      replacePreferences: jest.fn(),
    };
    await expect(makeGetAriaLearningProfile(profileRepository)({
      actor: { userId: 'user-integration-1', role: 'ELEVE' },
    })).resolves.toMatchObject({
      preferences: { version: 1, pinnedCourseKeys: [], focusedCourseKey: null },
    });
    expect(profileRepository.createDefault).toHaveBeenCalledWith('student-integration-1');
    expect(profileRepository.replacePreferences).not.toHaveBeenCalled();
    expect(makeReplaceAriaLearningProfile).toEqual(expect.any(Function));

    const logger = { getRequestId: jest.fn(() => 'request-feedback-integration'), warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } });
    (createLogger as jest.Mock).mockReturnValue(logger);
    (makePrismaAriaFeedbackRepository as jest.Mock).mockReturnValue(feedbackRepository);
    (checkAndAwardBadges as jest.Mock).mockRejectedValue(new Error('secondary badge unavailable'));

    const response = await POST(new NextRequest('http://localhost/api/aria/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'message-integration-1', useful: false }),
      headers: { 'content-type': 'application/json' },
    }));
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      feedback: { id: 'feedback-integration-1', useful: false },
      newBadges: [],
    });
    expect(logger.warn).toHaveBeenCalledWith('ARIA secondary operation failed', {
      requestId: 'request-feedback-integration',
      operation: 'award_feedback_badges',
    });
  });
});

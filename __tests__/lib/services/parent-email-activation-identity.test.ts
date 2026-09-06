import { completeStudentActivation } from '@/lib/services/student-activation.service';
import { createActivationToken } from '@/lib/auth/activation-token';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findFirst: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() }, notification: { createMany: jest.fn() } } }));
beforeEach(() => { jest.clearAllMocks(); (prisma.user.findMany as jest.Mock).mockResolvedValue([]); });
it.each(['email', 'role', 'mergedIntoUserId'])('refuses parent activation if %s changes after token lookup', async field => {
 const token = createActivationToken('parent');
 const snapshot = { id: 'parent-1', email: 'original@example.test', role: 'PARENT', firstName: 'Parent', lastName: 'Test', mergedIntoUserId: null };
 const current: Record<string, unknown> = { ...snapshot };
 (prisma.user.findFirst as jest.Mock).mockResolvedValue(snapshot);
 (bcrypt.hash as jest.Mock).mockImplementation(async () => { current[field] = field === 'email' ? 'changed@example.test' : field === 'role' ? 'ELEVE' : 'other-parent'; return 'hash'; });
 (prisma.user.updateMany as jest.Mock).mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ({ count: ['email', 'role', 'mergedIntoUserId'].every(key => !(key in where) || current[key] === where[key]) ? 1 : 0 }));
 expect(await completeStudentActivation(token.rawToken, 'Synthetic-password-2026', 'parent')).toMatchObject({ success: false });
 expect(prisma.notification.createMany).not.toHaveBeenCalled();
});

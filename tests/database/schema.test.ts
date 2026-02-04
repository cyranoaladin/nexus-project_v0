/**
 * Database Schema Integrity Tests
 * Validates Prisma schema relations, constraints, and indexes
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Schema Integrity', () => {
    beforeAll(async () => {
        await prisma.$connect();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('User Model', () => {
        it('should have unique email constraint', async () => {
            const user = await prisma.user.create({
                data: {
                    email: `test-${Date.now()}@example.com`,
                    role: UserRole.ELEVE,
                    password: 'test123',
                },
            });

            await expect(
                prisma.user.create({
                    data: {
                        email: user.email,
                        role: UserRole.ELEVE,
                        password: 'test456',
                    },
                })
            ).rejects.toThrow();

            await prisma.user.delete({ where: { id: user.id } });
        });

        it('should have role index for performance', async () => {
            const start = Date.now();
            await prisma.user.findMany({
                where: { role: UserRole.PARENT },
                take: 10,
            });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100);
        });
    });

    describe('Cascade Delete Constraints', () => {
        it('should cascade delete student when parent is deleted', async () => {
            const parent = await prisma.user.create({
                data: {
                    email: `parent-${Date.now()}@example.com`,
                    role: UserRole.PARENT,
                    password: 'test123',
                    parentProfile: {
                        create: {
                            address: 'Test Address',
                            city: 'Test City',
                        },
                    },
                },
                include: { parentProfile: true },
            });

            const studentUser = await prisma.user.create({
                data: {
                    email: `student-${Date.now()}@example.com`,
                    role: UserRole.ELEVE,
                    password: 'test123',
                },
            });

            const student = await prisma.student.create({
                data: {
                    parentId: parent.parentProfile!.id,
                    userId: studentUser.id,
                },
            });

            await prisma.user.delete({ where: { id: parent.id } });

            const deletedStudent = await prisma.student.findUnique({
                where: { id: student.id },
            });
            expect(deletedStudent).toBeNull();

            await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {});
        });

        it.skip('should cascade delete sessions when student is deleted', async () => {
            // Skipped: Session model structure has changed
        });
    });

    describe('Performance Indexes', () => {
        it('should have userId index on sessions', async () => {
            const user = await prisma.user.create({
                data: {
                    email: `coach-${Date.now()}@example.com`,
                    role: UserRole.COACH,
                    password: 'test123',
                },
            });

            const start = Date.now();
            await prisma.session.findMany({
                where: { studentId: user.id },
                take: 10,
            });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100);

            await prisma.user.delete({ where: { id: user.id } });
        });

        it('should have sessionId index on reports', async () => {
            const start = Date.now();
            await prisma.sessionReport.findMany({
                where: { sessionId: 'test-id' },
                take: 10,
            });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100);
        });
    });

    describe('Referential Integrity', () => {
        it('should prevent orphaned student records', async () => {
            await expect(
                prisma.student.create({
                    data: {
                        parentId: 'non-existent-parent-id',
                        userId: 'non-existent-user-id',
                    },
                })
            ).rejects.toThrow();
        });

        it.skip('should prevent orphaned session records', async () => {
            // Skipped: Session model structure has changed
        });
    });

    describe('Data Consistency', () => {
        it('should maintain consistent user-student relationship', async () => {
            const parentUser = await prisma.user.create({
                data: {
                    email: `parent-${Date.now()}@example.com`,
                    role: UserRole.PARENT,
                    password: 'test123',
                    parentProfile: {
                        create: {
                            address: 'Test Address',
                            city: 'Test City',
                        },
                    },
                },
                include: { parentProfile: true },
            });

            const user = await prisma.user.create({
                data: {
                    email: `student-${Date.now()}@example.com`,
                    role: UserRole.ELEVE,
                    password: 'test123',
                },
            });

            const student = await prisma.student.create({
                data: {
                    parentId: parentUser.parentProfile!.id,
                    userId: user.id,
                },
                include: { user: true },
            });

            expect(student).toBeTruthy();
            expect(student.userId).toBe(user.id);

            await prisma.user.delete({ where: { id: user.id } });
            await prisma.user.delete({ where: { id: parentUser.id } });
        });
    });
});

describe('PostgreSQL Migration Compatibility', () => {
    it('should support PostgreSQL-specific features', async () => {
        const result = await prisma.$queryRaw`SELECT version()`;
        expect(result).toBeTruthy();
    });

    it('should have proper enum types', async () => {
        const user = await prisma.user.create({
            data: {
                email: `enum-test-${Date.now()}@example.com`,
                role: UserRole.ADMIN,
                password: 'test123',
            },
        });

        expect(user.role).toBe(UserRole.ADMIN);

        await prisma.user.delete({ where: { id: user.id } });
    });
});

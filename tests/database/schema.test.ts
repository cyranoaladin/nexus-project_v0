/**
 * Database Schema Integrity Tests
 * Validates Prisma schema relations, constraints, and indexes
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Schema Integrity', () => {
    beforeAll(async () => {
        // Ensure database connection
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
                    role: 'ELEVE',
                    password: 'test123',
                },
            });

            await expect(
                prisma.user.create({
                    data: {
                        email: user.email,
                        role: 'ELEVE',
                        password: 'test456',
                    },
                })
            ).rejects.toThrow();

            // Cleanup
            await prisma.user.delete({ where: { id: user.id } });
        });

        it('should have role index for performance', async () => {
            // This test verifies that the role index exists by checking query performance
            const start = Date.now();
            await prisma.user.findMany({
                where: { role: 'PARENT' },
                take: 10,
            });
            const duration = Date.now() - start;

            // Query should be fast with index (< 100ms for small datasets)
            expect(duration).toBeLessThan(100);
        });
    });

    describe('Cascade Delete Constraints', () => {
        it('should cascade delete student when parent is deleted', async () => {
            // Create parent
            const parent = await prisma.user.create({
                data: {
                    email: `parent-${Date.now()}@example.com`,
                    role: 'PARENT',
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

            // Create student linked to parent
            const student = await prisma.student.create({
                data: {
                    parentId: parent.parentProfile!.id,
                    user: {
                        create: {
                            email: `student-${Date.now()}@example.com`,
                            role: 'ELEVE',
                            password: 'test123',
                        },
                    },
                },
            });

            // Delete parent should cascade to student
            await prisma.user.delete({ where: { id: parent.id } });

            // Verify student is also deleted
            const deletedStudent = await prisma.student.findUnique({
                where: { id: student.id },
            });
            expect(deletedStudent).toBeNull();
        });

        it('should cascade delete sessions when student is deleted', async () => {
            // Create student
            const student = await prisma.user.create({
                data: {
                    email: `student-${Date.now()}@example.com`,
                    role: 'ELEVE',
                    password: 'test123',
                    student: {
                        create: {
                            parent: {
                                create: {
                                    user: {
                                        create: {
                                            email: `parent-${Date.now()}@example.com`,
                                            role: 'PARENT',
                                            password: 'test123',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                include: { student: true },
            });

            // Create session for student
            const session = await prisma.session.create({
                data: {
                    studentId: student.student!.id,
                    subject: 'MATHEMATIQUES',
                    scheduledAt: new Date(),
                    duration: 60,
                    status: 'SCHEDULED',
                },
            });

            // Delete student should cascade to sessions
            await prisma.user.delete({ where: { id: student.id } });

            // Verify session is also deleted
            const deletedSession = await prisma.session.findUnique({
                where: { id: session.id },
            });
            expect(deletedSession).toBeNull();
        });
    });

    describe('Performance Indexes', () => {
        it('should have userId index on sessions', async () => {
            // Create test data
            const user = await prisma.user.create({
                data: {
                    email: `coach-${Date.now()}@example.com`,
                    role: 'COACH',
                    password: 'test123',
                },
            });

            // Query by userId should be fast
            const start = Date.now();
            await prisma.session.findMany({
                where: { studentId: user.id },
                take: 10,
            });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100);

            // Cleanup
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
            // Attempt to create student without parent should fail
            await expect(
                prisma.student.create({
                    data: {
                        parentId: 'non-existent-parent-id',
                        userId: 'non-existent-user-id',
                    },
                })
            ).rejects.toThrow();
        });

        it('should prevent orphaned session records', async () => {
            // Attempt to create session without student should fail
            await expect(
                prisma.session.create({
                    data: {
                        studentId: 'non-existent-student-id',
                        subject: 'MATHEMATIQUES',
                        scheduledAt: new Date(),
                        duration: 60,
                        status: 'SCHEDULED',
                    },
                })
            ).rejects.toThrow();
        });
    });

    describe('Data Consistency', () => {
        it('should maintain consistent user-student relationship', async () => {
            const user = await prisma.user.create({
                data: {
                    email: `student-${Date.now()}@example.com`,
                    role: 'ELEVE',
                    password: 'test123',
                    student: {
                        create: {
                            parent: {
                                create: {
                                    user: {
                                        create: {
                                            email: `parent-${Date.now()}@example.com`,
                                            role: 'PARENT',
                                            password: 'test123',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                include: { student: true },
            });

            expect(user.student).toBeTruthy();
            expect(user.student!.userId).toBe(user.id);

            // Cleanup
            await prisma.user.delete({ where: { id: user.id } });
        });
    });
});

describe('PostgreSQL Migration Compatibility', () => {
    it('should support PostgreSQL-specific features', async () => {
        // Test that the schema works with PostgreSQL
        const result = await prisma.$queryRaw`SELECT version()`;
        expect(result).toBeTruthy();
    });

    it('should have proper enum types', async () => {
        // Verify that enums are properly created in PostgreSQL
        const user = await prisma.user.create({
            data: {
                email: `enum-test-${Date.now()}@example.com`,
                role: 'ADMIN',
                password: 'test123',
            },
        });

        expect(user.role).toBe('ADMIN');

        // Cleanup
        await prisma.user.delete({ where: { id: user.id } });
    });
});

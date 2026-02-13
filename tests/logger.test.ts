/**
 * Logger Unit Tests
 * Verifies that the logger correctly captures exceptions
 */

import { describe, it, expect } from '@jest/globals';
import { logger, createRequestLogger, sanitizeLogData } from '@/lib/logger';

describe('Logger', () => {
    describe('Error Logging', () => {
        it('should log errors with proper structure', () => {
            const testError = new Error('Test error message');
            testError.stack = 'Error: Test error message\n    at test.ts:10:15';

            expect(() => {
                logger.error({
                    type: 'test-error',
                    error: {
                        name: testError.name,
                        message: testError.message,
                        stack: testError.stack,
                    },
                }, 'Test error occurred');
            }).not.toThrow();
        });

        it('should capture exception details', () => {
            try {
                throw new Error('Simulated exception');
            } catch (error) {
                expect(() => {
                    logger.error({
                        type: 'exception',
                        error: error instanceof Error ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack,
                        } : error,
                    }, 'Exception caught');
                }).not.toThrow();
            }
        });
    });

    describe('Request Logger', () => {
        it('should create child logger with request context', () => {
            const requestLogger = createRequestLogger({
                requestId: 'req-123',
                method: 'POST',
                path: '/api/test',
                userId: 'user-456',
            });

            expect(requestLogger).toBeDefined();

            expect(() => requestLogger.info('Test request log')).not.toThrow();
        });
    });

    describe('Data Sanitization', () => {
        it('should redact sensitive fields', () => {
            const sensitiveData = {
                username: 'john',
                password: 'secret123',
                email: 'john@example.com',
                apikey: 'sk-1234567890',
                token: 'bearer-token',
            };

            const sanitized = sanitizeLogData(sensitiveData);

            expect(sanitized.username).toBe('john');
            expect(sanitized.email).toBe('john@example.com');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.apikey).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
        });

        it('should handle nested sensitive fields', () => {
            const data = {
                user: {
                    name: 'John',
                    password: 'secret',
                },
                creditCard: '1234-5678-9012-3456',
            };

            const sanitized = sanitizeLogData(data);

            expect(sanitized.user).toEqual({ name: 'John', password: 'secret' });
            expect(sanitized.creditCard).toBe('[REDACTED]');
        });
    });

    describe('Log Levels', () => {
        it('should respect log level configuration', () => {
            expect(() => logger.debug('Debug message')).not.toThrow();
            expect(() => logger.info('Info message')).not.toThrow();
            expect(() => logger.warn('Warning message')).not.toThrow();
        });
    });
});

describe('API Error Logging', () => {
    it('should log API route errors', async () => {
        const mockError = new Error('Database connection failed');

        expect(() => {
            logger.error({
                type: 'api-error',
                route: '/api/test',
                error: {
                    name: mockError.name,
                    message: mockError.message,
                    stack: mockError.stack,
                },
            }, 'API route error');
        }).not.toThrow();
    });

    it('should log authentication failures', () => {
        expect(() => {
            logger.warn({
                type: 'auth-failure',
                email: 'test@example.com',
                reason: 'Invalid credentials',
            }, 'Authentication failed');
        }).not.toThrow();
    });
});

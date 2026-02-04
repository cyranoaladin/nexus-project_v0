/**
 * Standardized API Error Response Format
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
        timestamp: string;
    };
}

export interface ApiSuccess<T = any> {
    success: true;
    data: T;
    timestamp: string;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

/**
 * Standard error codes
 */
export const ErrorCodes = {
    // Authentication errors (401)
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    SESSION_EXPIRED: 'SESSION_EXPIRED',

    // Authorization errors (403)
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Validation errors (400)
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

    // Resource errors (404)
    NOT_FOUND: 'NOT_FOUND',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

    // Rate limiting (429)
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

    // Server errors (500)
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

/**
 * Create a standardized error response
 */
export function createErrorResponse(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: any
): NextResponse<ApiError> {
    const errorResponse: ApiError = {
        success: false,
        error: {
            code,
            message,
            details,
            timestamp: new Date().toISOString(),
        },
    };

    // Log error
    logger.error({
        type: 'api-error',
        code,
        message,
        statusCode,
        details,
    }, 'API error response');

    return NextResponse.json(errorResponse, { status: statusCode });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
    data: T,
    statusCode: number = 200
): NextResponse<ApiSuccess<T>> {
    const successResponse: ApiSuccess<T> = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
    };

    return NextResponse.json(successResponse, { status: statusCode });
}

/**
 * Handle API errors with proper logging and response formatting
 */
export function handleApiError(error: unknown, context?: string): NextResponse<ApiError> {
    // Log the error
    logger.error({
        type: 'api-error',
        context,
        error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : error,
    }, 'Unhandled API error');

    // Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as any;

        if (prismaError.code === 'P2002') {
            return createErrorResponse(
                ErrorCodes.VALIDATION_ERROR,
                'Une ressource avec ces données existe déjà',
                400,
                { field: prismaError.meta?.target }
            );
        }

        if (prismaError.code === 'P2025') {
            return createErrorResponse(
                ErrorCodes.NOT_FOUND,
                'Ressource non trouvée',
                404
            );
        }
    }

    // Standard Error
    if (error instanceof Error) {
        return createErrorResponse(
            ErrorCodes.INTERNAL_SERVER_ERROR,
            process.env.NODE_ENV === 'development'
                ? error.message
                : 'Une erreur interne s\'est produite',
            500,
            process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined
        );
    }

    // Unknown error
    return createErrorResponse(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Une erreur inconnue s\'est produite',
        500
    );
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
    body: any,
    requiredFields: string[]
): { valid: boolean; missing?: string[] } {
    const missing = requiredFields.filter(field => !body[field]);

    if (missing.length > 0) {
        return { valid: false, missing };
    }

    return { valid: true };
}

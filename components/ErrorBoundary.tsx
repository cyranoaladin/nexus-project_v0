'use client';

/**
 * Global Error Boundary Component
 * Catches and handles React errors in the component tree
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to server-side logger
        logger.error({
            type: 'react-error',
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            componentStack: errorInfo.componentStack,
        }, 'React component error');

        this.setState({
            errorInfo,
        });

        // Send to external error tracking service if configured
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
            // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-surface-dark p-4">
                    <div className="max-w-md w-full bg-surface-card border border-white/10 rounded-card p-8 space-y-6">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-error">
                                Une erreur s'est produite
                            </h1>
                            <p className="text-neutral-300">
                                Nous sommes désolés, une erreur inattendue s'est produite.
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="space-y-2">
                                <details className="bg-surface-darker p-4 rounded-lg">
                                    <summary className="cursor-pointer text-sm font-mono text-warning">
                                        Détails de l'erreur (développement uniquement)
                                    </summary>
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-mono text-neutral-400">
                                            {this.state.error.name}: {this.state.error.message}
                                        </p>
                                        {this.state.error.stack && (
                                            <pre className="text-xs font-mono text-neutral-500 overflow-x-auto whitespace-pre-wrap">
                                                {this.state.error.stack}
                                            </pre>
                                        )}
                                    </div>
                                </details>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-brand-accent text-surface-dark font-semibold px-6 py-3 rounded-full hover:bg-brand-accent-dark transition-colors"
                            >
                                Réessayer
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 border border-white/20 text-white px-6 py-3 rounded-full hover:border-brand-accent hover:text-brand-accent transition-colors"
                            >
                                Retour à l'accueil
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

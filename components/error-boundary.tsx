'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }
    
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">
            Oups ! Une erreur s'est produite
          </h1>
          <p className="text-neutral-400">
            Quelque chose s'est mal passé. Veuillez réessayer.
          </p>
        </div>

        {isDev && error && (
          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4 text-left">
            <p className="text-slate-300 font-mono text-sm break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg font-medium transition-colors"
          >
            Recharger la page
          </button>
          <button
            onClick={onReset}
            className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>

        <p className="text-sm text-neutral-500">
          Si le problème persiste, veuillez{' '}
          <a href="/contact" className="text-brand-primary hover:underline">
            contacter le support
          </a>
        </p>
      </div>
    </div>
  );
}

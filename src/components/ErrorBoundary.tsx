import React from 'react';
import { translations } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // Class components can't use hooks — read the locale straight off the store.
      const { locale } = useAppStore.getState();
      const tr = translations[locale] ?? translations.en;
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-0)] text-white p-8">
          <div className="max-w-lg">
            <h1 className="text-2xl font-bold text-[var(--brand)] mb-4">{tr['common.somethingWentWrong']}</h1>
            <pre className="text-sm text-red-400 bg-red-400/10 p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">{`${this.state.error?.message ?? ''}\n\n${this.state.error?.stack ?? ''}`}</pre>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4 px-4 py-2 bg-[var(--brand)] text-white rounded-lg"
            >
              {tr['common.retry']}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import React from 'react';

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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] text-white p-8">
          <div className="max-w-lg">
            <h1 className="text-2xl font-bold text-[#FF4713] mb-4">Something went wrong</h1>
            <pre className="text-sm text-red-400 bg-red-400/10 p-4 rounded-lg overflow-auto max-h-64">{this.state.error?.message}\n\n{this.state.error?.stack}</pre>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4 px-4 py-2 bg-[#FF4713] text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

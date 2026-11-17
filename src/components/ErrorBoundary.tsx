import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary:', error, info);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `${parsed.operationType?.toUpperCase() || 'Firestore'} error on ${parsed.path || 'database'}: ${parsed.error}`;
        }
      } catch {
        // Not JSON
      }

      return (
        <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E2E8E4] rounded-xl p-6 space-y-4">
            <h1 className="text-lg font-bold text-[#14231D]">Something went wrong</h1>
            <p className="text-sm text-[#4F625A] leading-relaxed break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0A7250] rounded-lg hover:bg-[#07573D] transition-colors"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

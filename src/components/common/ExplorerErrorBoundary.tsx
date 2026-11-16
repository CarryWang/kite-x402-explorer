import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ExplorerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ExplorerErrorBoundary caught exception:', error, errorInfo);
  }

  private handleExportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      location: typeof window !== 'undefined' ? window.location.href : 'N/A',
      errorMessage: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kite-explorer-error-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-neutral-200">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-900/60 text-red-300 font-bold">!</span>
            <div>
              <h3 className="text-sm font-semibold text-red-200">{this.props.fallbackTitle || 'Component Rendering Error'}</h3>
              <p className="text-xs text-red-400/80">An unexpected exception occurred while rendering this explorer view.</p>
            </div>
          </div>
          <pre className="mt-4 max-h-32 overflow-auto rounded bg-neutral-900/90 p-3 font-mono text-xs text-red-300">
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium hover:bg-neutral-700 transition"
            >
              Try Again
            </button>
            <button
              onClick={this.handleExportReport}
              className="rounded bg-red-900/40 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900/60 transition"
            >
              Download Diagnostic JSON
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ExplorerErrorBoundary;

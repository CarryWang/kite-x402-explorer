import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Kite x402 Explorer:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: 'var(--bg-primary)',
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '560px',
              textAlign: 'center',
              padding: '2.5rem',
              border: '1px solid rgba(244, 63, 94, 0.3)',
            }}
          >
            <AlertOctagon size={48} color="var(--accent-rose)" style={{ margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Component Render Exception
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              An unexpected error occurred while rendering the service view. This has been logged for diagnosis.
            </p>
            {this.state.error && (
              <pre
                className="code-block"
                style={{
                  textAlign: 'left',
                  fontSize: '0.78rem',
                  marginBottom: '1.5rem',
                  color: 'var(--accent-rose)',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button className="btn btn-primary" onClick={this.handleReset} style={{ margin: '0 auto' }}>
              <RotateCcw size={14} /> Reload Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

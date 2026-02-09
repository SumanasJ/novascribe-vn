
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Error Boundary to catch and display errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          background: '#0f172a',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#ef4444' }}>
            应用出错了
          </h1>
          <p style={{ fontSize: '14px', marginBottom: '20px', color: '#94a3b8' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <details style={{ marginBottom: '20px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#60a5fa' }}>
              查看错误详情
            </summary>
            <pre style={{
              marginTop: '10px',
              padding: '10px',
              background: '#1e293b',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              {this.state.error?.stack || 'No stack trace available'}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

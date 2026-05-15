import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

const IS_DEV = import.meta.env.DEV;

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("App Crash:", error, errorInfo);
    if (IS_DEV) {
      console.group('ErrorBoundary details');
      console.error('Error message:', error?.message || error);
      console.error('Component stack:', errorInfo?.componentStack || 'No component stack available.');
      console.groupEnd();
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="size-20 rounded-3xl bg-red-950/30 border border-red-500/30 flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Something went wrong</h1>
          <p className="text-slate-400 mt-2 max-w-xs font-medium">The application encountered an unexpected error. Please try refreshing.</p>
          {IS_DEV && this.state.error && (
            <details className="mt-4 max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left text-xs text-slate-300">
              <summary className="cursor-pointer font-bold text-slate-100">Developer details</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words">{this.state.error?.stack || this.state.error?.message || 'No error stack available.'}</pre>
              {this.state.errorInfo?.componentStack && (
                <pre className="mt-3 whitespace-pre-wrap break-words text-slate-400">{this.state.errorInfo.componentStack}</pre>
              )}
            </details>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="mt-8 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-900/40 active:scale-95 transition-all"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

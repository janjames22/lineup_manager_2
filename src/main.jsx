import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_error) { return { hasError: true }; }
  componentDidCatch(_error, _errorInfo) { console.error("App Crash:", _error, _errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="size-20 rounded-3xl bg-red-950/30 border border-red-500/30 flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Something went wrong</h1>
          <p className="text-slate-400 mt-2 max-w-xs font-medium">The application encountered an unexpected error. Please try refreshing.</p>
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
